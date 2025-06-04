const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Email service configuration
class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }    // Initialize nodemailer transporter
    initializeTransporter() {
        try {
            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS,
                },
            });

            // Verify connection
            this.transporter.verify((error, success) => {
                if (error) {
                    console.warn('Email service initialization failed:', error.message);
                    console.warn('Email functionality will be disabled');
                } else {
                    console.log('Email service initialized successfully');
                }
            });
        } catch (error) {
            console.warn('Email service setup failed:', error.message);
            console.warn('Continuing without email functionality');
        }
    }

    // Check if email service is available
    isAvailable() {
        return this.transporter !== null;
    }    // Send welcome email to user
    async sendResourceEmail(email, subject, url) {
        if (!this.isAvailable()) {
            console.log('Email service not available, skipping welcome email');
            return { success: false, message: 'Email service not configured' };
        }

        try {
            console.log(subject);
            
            // Load HTML template from file
            const htmlTemplate = await this.loadEmailTemplate('resource.html', {
                url: url,
                currentDate: new Date().toLocaleDateString()
            });

            const mailOptions = {
                from: `"Kaizen MicroLessons" <${process.env.EMAIL_USER}>`,
                to: email,
                subject,
                html: htmlTemplate,
                headers: {
                    'X-Mailer': 'Node.js Chatbot Email Service',
                    'Reply-To': process.env.EMAIL_USER,
                },
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`email sent successfully to ${email}`);
            
            return { 
                success: true, 
                message: 'email sent successfully!',
                messageId: result.messageId 
            };
        } catch (error) {
            console.error('Failed to send welcome email:', error);
            return { 
                success: false, 
                message: 'Failed to send welcome email',
                error: error.message 
            };
        }
    }    
    async sendWelcomeEmail(email, name = 'User') {
        if (!this.isAvailable()) {
            console.log('Email service not available, skipping welcome email');
            return { success: false, message: 'Email service not configured' };
        }

        try {
            const subject = "🎉 Welcome to the 7-Day Sudoku Challenge!";
            
            // Load HTML template from file
            const htmlTemplate = await this.loadEmailTemplate('welcome.html', {
                name: name,
                userEmail: email,
                websiteUrl: process.env.WEBSITE_URL || 'https://your-website.com',
                currentDate: new Date().toLocaleDateString()
            });

            const mailOptions = {
                from: `"Kaizen MicroLessons" <${process.env.EMAIL_USER}>`,
                to: email,
                subject,
                html: htmlTemplate,
                headers: {
                    'X-Mailer': 'Node.js Chatbot Email Service',
                    'Reply-To': process.env.EMAIL_USER,
                },
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log(`Welcome email sent successfully to ${email}`);
            
            return { 
                success: true, 
                message: 'Welcome email sent successfully!',
                messageId: result.messageId 
            };
        } catch (error) {
            console.error('Failed to send welcome email:', error);
            return { 
                success: false, 
                message: 'Failed to send welcome email',
                error: error.message 
            };
        }
    }   
    
    // Load email template from file and replace placeholders

    async loadEmailTemplate(templateName, variables = {}) {
        try {
            const templatePath = path.join(__dirname, '../templates/emails', templateName);
            let htmlContent = fs.readFileSync(templatePath, 'utf8');
            
            // Replace placeholders with actual values
            for (const [key, value] of Object.entries(variables)) {
                const placeholder = new RegExp(`{{${key}}}`, 'g');
                htmlContent = htmlContent.replace(placeholder, value || '');
            }
            
            return htmlContent;
        } catch (error) {
            console.error(`Error loading email template ${templateName}:`, error);
            // Return a fallback simple HTML template
            return this.getFallbackTemplate(variables);
        }
    }

    // Fallback template if file loading fails
    getFallbackTemplate(variables) {
        return `
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Welcome to the 7-Day Sudoku Challenge!</h2>
            <p>Hello ${variables.name || 'User'}!</p>
            <p>Thank you for joining our Sudoku Challenge. We're excited to have you on board!</p>
            <p>Happy puzzling!<br>The Kaizen MicroLessons Team</p>
        </body>
        </html>
        `;
    }    // Send notification email to admin when new user signs up
    async sendAdminNotification(userInfo) {
        if (!this.isAvailable() || !process.env.ADMIN_EMAIL) {
            return { success: false, message: 'Admin notifications not configured' };
        }

        try {
            const subject = "🆕 New User Signed Up for Sudoku Challenge";
            
            // Load admin notification template
            const htmlContent = await this.loadEmailTemplate('admin-notification.html', {
                userEmail: userInfo.email || 'Not provided',
                userPhone: userInfo.phone || 'Not provided',
                timestamp: new Date().toLocaleString(),
                userId: userInfo.id || 'N/A'
            });

            const mailOptions = {
                from: `"Chatbot System" <${process.env.EMAIL_USER}>`,
                to: process.env.ADMIN_EMAIL,
                subject,
                html: htmlContent,
            };

            await this.transporter.sendMail(mailOptions);
            console.log('Admin notification sent successfully');
            
            return { success: true, message: 'Admin notification sent' };
        } catch (error) {
            console.error('Failed to send admin notification:', error);
            return { success: false, message: 'Failed to send admin notification' };
        }
    }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;
