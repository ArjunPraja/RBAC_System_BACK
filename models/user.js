const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // Import uuid

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        password: {
            type: String,
            required: true
        },
        role: {
            type: String,
            enum: ['admin', 'user','manager'],
            default: 'user'
        },
        photo: {
            type: String, // Path to the uploaded photo
            default: null
        },
        uuid: {
            type: String,
            required: true,
            unique: true,
            default: uuidv4 // Automatically generates a UUID
        }
    },
    { timestamps: true }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
