const express = require('express');
const router = express.Router();
const emailService = require('../utils/emailService');
const { getUserContactsFromDB } = require('../utils/database');

// Send welcome email endpoint
router.post('/send-email', async (req, res) => {
    const { email, name } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const result = await emailService.sendWelcomeEmail(email, name || 'User');
        
        if (result.success) {
            res.json({ 
                message: result.message,
                success: true,
                messageId: result.messageId 
            });
        } else {
            res.status(500).json({ 
                error: result.message,
                success: false 
            });
        }
    } catch (error) {
        console.error('Error sending welcome email:', error);
        res.status(500).json({ 
            error: 'Failed to send welcome email',
            success: false 
        });
    }
});

// Send bulk welcome emails to all collected contacts
router.post('/send-bulk-welcome', async (req, res) => {
    try {
        const contacts = await getUserContactsFromDB();
        const emailContacts = contacts.filter(contact => contact.email);
        
        if (emailContacts.length === 0) {
            return res.json({ 
                message: 'No email contacts found to send to',
                sent: 0,
                total: 0 
            });
        }

        const results = [];
        for (const contact of emailContacts) {
            try {
                const result = await emailService.sendWelcomeEmail(contact.email, 'User');
                results.push({
                    email: contact.email,
                    success: result.success,
                    message: result.message
                });
                
                // Add delay between emails to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                results.push({
                    email: contact.email,
                    success: false,
                    message: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        
        res.json({
            message: `Sent welcome emails to ${successCount} out of ${emailContacts.length} contacts`,
            sent: successCount,
            total: emailContacts.length,
            details: results
        });
    } catch (error) {
        console.error('Error sending bulk welcome emails:', error);
        res.status(500).json({ 
            error: 'Failed to send bulk welcome emails',
            success: false 
        });
    }
});

// Check email service status
router.get('/status', (req, res) => {
    const isAvailable = emailService.isAvailable();
    
    res.json({
        emailService: {
            available: isAvailable,
            configured: !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS,
            status: isAvailable ? 'Ready' : 'Not configured'
        }
    });
});

module.exports = router;
