// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const chatRoutes = require('./routes/chat');
const emailRoutes = require('./routes/email');
const { connectDB } = require('./utils/database');

// --- Configuration ---
const PORT = process.env.PORT || 3000;

// --- Initialize Database Connection ---
connectDB();

// --- Initialize Express App ---
const app = express();

// --- Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON request bodies
app.use(express.static('public')); // Serve static files from public directory

// --- Load FAQs ---
let faqs = [];
try {
    faqs = require('./faq.json'); // Node.js caches required JSON files
    console.log(`${faqs.length} FAQs loaded successfully.`);
} catch (error) {
    console.error("Error loading faqs.json:", error.message);
    console.warn("Chatbot will operate without FAQ context if faqs.json is missing or invalid.");
}

// --- API Endpoints ---

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Use chat routes
app.use('/api', chatRoutes);

// Use email routes
app.use('/api/email', emailRoutes);

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("YOUR_ACTUAL") || GEMINI_API_KEY.length < 10) {
        console.warn("WARNING: It looks like you haven't set your GEMINI_API_KEY correctly in the .env file.");
    }
});