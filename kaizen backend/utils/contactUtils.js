const fs = require('fs');
const path = require('path');
const { saveUserContactToDB } = require('./database');
const emailService = require('./emailService');

/**
 * Check if user message contains contact information
 */
function checkIfContactInfo(message) {
    const emailRegex = /\S+@\S+\.\S+/;
    const phoneRegex = /(\+?\d{1,4}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/;
    
    return emailRegex.test(message) || phoneRegex.test(message);
}

/**
 * Save user information to file
 */
function saveUserInfoToFile(userInfo) {
    try {
        const userDataFile = path.join(__dirname, '../user_contacts.json');
        let existingData = [];
        
        // Read existing data if file exists
        if (fs.existsSync(userDataFile)) {
            const fileContent = fs.readFileSync(userDataFile, 'utf8');
            existingData = JSON.parse(fileContent);
        }
        
        // Add new user info with timestamp
        const newEntry = {
            ...userInfo,
            timestamp: new Date().toISOString(),
            id: Date.now() // Simple ID generation
        };
        
        existingData.push(newEntry);
        
        // Write back to file
        fs.writeFileSync(userDataFile, JSON.stringify(existingData, null, 2));
        console.log('User information saved to user_contacts.json');
    } catch (error) {
        console.error('Error saving user information to file:', error);
    }
}

/**
 * Extract user information from conversation and log it
 */
async function extractAndLogUserInfo(conversation, currentMessage, model) {
    try {
        // Create full conversation including current message
        const fullConversation = [...conversation, { role: 'user', message: currentMessage }];
        
        const extractionPrompt = `Analyze the following conversation and extract any user contact information provided.
Look for email addresses and phone numbers specifically.
Return the information in this exact JSON format:
{
  "email": "user_email_if_found_or_null",
  "phone": "user_phone_if_found_or_null",
  "hasContactInfo": true_or_false
}

Conversation:
${fullConversation.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.message}`).join('\n')}

Extract only valid email addresses and phone numbers. If no contact information is found, set the fields to null and hasContactInfo to false.

JSON Response:`;

        const result = await model.generateContent(extractionPrompt);
        const response = await result.response;
        const extractedText = response.text();
          // Try to parse JSON from response
        try {
            const userInfo = JSON.parse(extractedText.replace(/```json\n?|\n?```/g, '').trim());
            
            // Save to database if we have any contact information (email OR phone)
            if (userInfo.email || userInfo.phone) {
                console.log('=== USER INFORMATION EXTRACTED ===');
                console.log(`Timestamp: ${new Date().toISOString()}`);
                console.log(`Email: ${userInfo.email || 'Not provided'}`);
                console.log(`Phone: ${userInfo.phone || 'Not provided'}`);
                console.log('================================');
                
                // Save to database - even partial information
                const savedContact = await saveUserContactToDB(userInfo);
                
                if (savedContact) {
                    console.log('Contact information saved to database');
                } else {
                    console.log('Failed to save contact information to database');
                }
                
                // Note: Email sending has been disabled as requested
            }
        } catch (parseError) {
            console.log('Could not parse user info extraction:', extractedText);
        }
    } catch (error) {
        console.error('Error extracting user information:', error);
    }
}

module.exports = {
    checkIfContactInfo,
    saveUserInfoToFile,
    extractAndLogUserInfo
};
