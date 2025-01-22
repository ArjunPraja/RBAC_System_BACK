const express = require('express');
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
const Image = require('./models/Photo'); 
const fs = require('fs');


const User = require('./models/user');
const verifyToken = require('./Middleware/varify_token');


const app = express();
const PORT = process.env.PORT || 5000;

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


app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200', // Adjust based on your frontend URL
  methods: 'GET,POST,PUT,DELETE',
  credentials: true,
}));
app.use('/uploads', express.static(path.join(__dirname, process.env.UPLOAD_DIR || 'uploads')));


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

const generateToken = (user) => {
  return jwt.sign(
    { uuid: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};


app.post('/register', upload.single('photo'), async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const photo = req.file ? req.file.path : null;

  
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'Email already in use.' });

    const hashedPassword = await bcryptjs.hash(password, 10);

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

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    
    const isPasswordValid = await bcryptjs.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

   
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


app.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.put('/upload-photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No photo uploaded.' });
    }

    const email = req.headers['user-email']; 
    if (!email) {
      return res.status(400).json({ message: 'User email is missing.' });
    }

    const user = await User.findOneAndUpdate(
      { email: email },
      { $set: { photo: `uploads/${req.file.filename}` } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }


    res.status(200).json({ message: 'Profile photo uploaded successfully', user });

  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});


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

    
    const imageData = fs.readFileSync(req.file.path);

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
