const express = require('express');
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
const Image = require('./models/Photo'); // Adjust the path if necessary
const fs = require('fs');

// Models
const User = require('./models/user');

// Middleware
const verifyToken = require('./Middleware/varify_token');

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 5000;

// Database Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200', // Adjust based on your frontend URL
  methods: 'GET,POST,PUT,DELETE',
  credentials: true,
}));
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));

// Multer Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || 'uploads/');
  },
  filename: (req, file, cb) => {
    // Use the original file name, with an extension based on the uploaded file's type
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

// Helper Function for Token Generation
const generateToken = (user) => {
  return jwt.sign(
    { uuid: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Routes
// User Registration
app.post('/register', upload.single('photo'), async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const photo = req.file ? req.file.path : null;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'Email already in use.' });

    // Hash password before saving
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Create a new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role,
      photo,
    });

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Error during registration:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// User Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Validate the password
    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateToken(user);

    res.status(200).json({
      message: 'Login successful',
      token: token,
      role: user.role,
      user: {
        username: user.username,
        email: user.email,
        photo: user.photo,
        uuid:user.uuid
      },
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch All Users (excluding passwords)
app.get('/users', async (req, res) => {
  try {
    // Exclude passwords from the response by selecting all fields except 'password'
    const users = await User.find().select('-password');
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Profile Photo Upload Route
app.put('/upload-photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No photo uploaded.' });
    }

    // Ensure the email is passed in the header
    const email = req.headers['user-email']; // Correct the header name to 'user-email'
    if (!email) {
      return res.status(400).json({ message: 'User email is missing.' });
    }

    // Update the user with the uploaded photo path
    const user = await User.findOneAndUpdate(
      { email: email },
      { $set: { photo: `uploads/${req.file.filename}` } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Send updated user with the new photo
    res.status(200).json({ message: 'Profile photo uploaded successfully', user });

  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// Route to handle image upload
app.post('/users/:uuid/images', upload.single('image'), async (req, res) => {
  const { uuid } = req.params;
  console.log(uuid)

  if (!req.file) {
    return res.status(400).json({ message: 'No image uploaded' });
  }

  try {
    const user = await User.findOne({ uuid });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Read the image file
    const imageData = fs.readFileSync(req.file.path);

    // Save the image to MongoDB
    const image = new Image({
      userUuid: uuid,
      imageData,
      contentType: req.file.mimetype,
    });

    await image.save();
    res.status(201).json({ message: 'Image uploaded successfully', image });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
