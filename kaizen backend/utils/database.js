const mongoose = require('mongoose');

// MongoDB connection string - you can set this in your .env file
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatbot_contacts';

// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB successfully');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        // Don't exit the process, just log the error
        console.warn('Continuing without database connection - contact info will not be saved');
    }
};

// User Contact Schema
const userContactSchema = new mongoose.Schema({
    email: {
        type: String,
        required: false,
        default: null,
        validate: {
            validator: function(v) {
                return v === null || /\S+@\S+\.\S+/.test(v);
            },
            message: 'Invalid email format'
        }
    },
    phone: {
        type: String,
        required: false,
        default: null,
        validate: {
            validator: function(v) {
                return v === null || /(\+?\d{1,4}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/.test(v);
            },
            message: 'Invalid phone number format'
        }
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    hasContactInfo: {
        type: Boolean,
        default: false,
        required: true
    }
}, {
    timestamps: true // This adds createdAt and updatedAt fields automatically
});

// Create the model
const UserContact = mongoose.model('UserContact', userContactSchema);

// Function to save user contact info to database
const saveUserContactToDB = async (userInfo) => {
    try {
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected, skipping contact save');
            return null;
        }

        // Build query to find existing record by email or phone
        let query = {};
        if (userInfo.email && userInfo.phone) {
            // If both email and phone are provided, check for either
            query = {
                $or: [
                    { email: userInfo.email },
                    { phone: userInfo.phone }
                ]
            };
        } else if (userInfo.email) {
            // If only email is provided
            query = { email: userInfo.email };
        } else if (userInfo.phone) {
            // If only phone is provided
            query = { phone: userInfo.phone };
        } else {
            // If neither email nor phone is provided, create a new record
            query = { _id: new mongoose.Types.ObjectId() };
        }

        // Update data - only update fields that are provided
        const updateData = {
            hasContactInfo: userInfo.hasContactInfo,
            timestamp: new Date()
        };
        
        if (userInfo.email) {
            updateData.email = userInfo.email;
        }
        if (userInfo.phone) {
            updateData.phone = userInfo.phone;
        }

        // Use findOneAndUpdate with upsert
        const savedContact = await UserContact.findOneAndUpdate(
            query,
            updateData,
            {
                new: true, // Return the updated document
                upsert: true, // Create if doesn't exist
                setDefaultsOnInsert: true // Set default values on insert
            }
        );

        console.log('User contact saved/updated in database:', {
            id: savedContact._id,
            email: savedContact.email || 'Not provided',
            phone: savedContact.phone || 'Not provided',
            timestamp: savedContact.timestamp,
            isNew: !query._id // Indicates if this was a new record
        });
        
        return savedContact;
    } catch (error) {
        console.error('Error saving user contact to database:', error);
        return null;
    }
};

// Function to get all user contacts from database
const getUserContactsFromDB = async () => {
    try {
        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            console.log('Database not connected, returning empty array');
            return [];
        }

        const contacts = await UserContact.find({}).sort({ timestamp: -1 });
        return contacts;
    } catch (error) {
        console.error('Error fetching user contacts from database:', error);
        return [];
    }
};

module.exports = {
    connectDB,
    UserContact,
    saveUserContactToDB,
    getUserContactsFromDB
};
