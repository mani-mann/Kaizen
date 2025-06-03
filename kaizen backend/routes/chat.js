const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { model } = require('../utils/gemini');
const { checkIfContactInfo, extractAndLogUserInfo } = require('../utils/contactUtils');
const { getUserContactsFromDB } = require('../utils/database');

// Load FAQs
let faqs = [];
try {
    faqs = require('../faq.json');
} catch (error) {
    console.error("Error loading faqs.json:", error.message);
}

// Chat endpoint
router.post('/chat', async (req, res) => {
    const { message: userMessage, conversation = [] } = req.body;

    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim() === '') {
        return res.status(400).json({ error: 'Message is required and must be a non-empty string.' });
    }

    try {
        let faqContext = "";
        if (faqs.length > 0) {
            faqContext = "Here are some Frequently Asked Questions that might help:\n" +
                         faqs.map(faq => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n') +
                         "\n\n";
        }

        let conversationContext = "";
        if (conversation.length > 0) {
            conversationContext = "Previous conversation:\n" +
                                conversation.map(msg => 
                                    `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.message}`
                                ).join('\n') + 
                                "\n\n";
        }

        const isContactInfo = checkIfContactInfo(userMessage);
        const hasRequestedContact = conversation.some(msg => 
            msg.role === 'assistant' && 
            (msg.message.toLowerCase().includes('phone') && msg.message.toLowerCase().includes('email'))
        );

        let mainPrompt;
        let contactPrompt = null;

        if (isContactInfo) {
            mainPrompt = `You are a friendly customer support chatbot. The user has just provided their contact information: "${userMessage}".
Thank them politely for providing their details and let them know you've saved their information. 
Ask if there's anything else you can help them with.

Your response:`;
        } else {
            mainPrompt = `You are a friendly and helpful customer support chatbot for our website.
Your goal is to assist users by answering their questions.
${faqContext}${conversationContext}Based on the FAQs provided (if any), the conversation history, and your general knowledge, please answer the user's question.
If the question is about something not covered in the FAQs, try to provide a helpful general answer or suggest how the user might find the information they need (e.g., "You can find more details on our contact page.").
If you cannot answer the question or it's outside your scope as a website assistant, politely say so. do not any "*" to markdown formatting.
Maintain context from the conversation to provide better assistance.

Current User Question: "${userMessage}"

Your Answer:`;

            if (!hasRequestedContact) {
                contactPrompt = "To best assist you, could you please provide your phone number and email address?";
            }
        }

        const result = await model.generateContent(mainPrompt);
        const response = await result.response;
        const text = response.text();

        let messages = [{ type: 'reply', content: text }];

        if (contactPrompt) {
            messages.push({ type: 'contact_request', content: contactPrompt });
        }

        await extractAndLogUserInfo(conversation, userMessage, model);

        res.json({ messages: messages });

    } catch (error) {
        console.error("Error with Gemini API or processing chat request:", error);
        if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {
            return res.status(400).json({
                error: `I couldn't provide a response due to content restrictions. Reason: ${error.response.promptFeedback.blockReason}`,
                details: "This might be because the question or the potential answer triggered a safety filter."
            });
        }
        res.status(500).json({ error: "Sorry, I'm having a bit of trouble connecting to my knowledge base right now. Please try again in a moment." });
    }
});

// Clear conversation endpoint
router.post('/chat/clear', (req, res) => {
    res.json({ 
        message: "Conversation cleared. How can I help you today?",
        success: true 
    });
});

// Get collected user information endpoint
router.get('/user-contacts', async (req, res) => {
    try {
        const contacts = await getUserContactsFromDB();
        res.json({ contacts: contacts, count: contacts.length });
    } catch (error) {
        console.error('Error reading user contacts from database:', error);
        res.status(500).json({ error: 'Error retrieving user contacts' });
    }
});

module.exports = router;
