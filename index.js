const express = require('express');
const cors = require('cors');
const fs = require('fs');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');  // For session storage in MongoDB
const uploadRoutes = require('./Routes/chat');
require('dotenv').config();

// Express Server Setup
const app = express();
const port = process.env.PORT || 5001;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Middleware
app.use(express.json());

// Allow CORS from a specific origin (Frontend URL)
const allowedOrigins = ['http://localhost:3000'];
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    credentials: true // Allow credentials (cookies) to be sent across domains
}));

// Session setup with MongoDB for storage
app.use(session({
    secret: 'your-secret-key',  // Replace with a strong secret key
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.mongoURI,   // MongoDB URI stored in .env
        collectionName: 'sessions'       // Name of the collection where sessions are stored
    }),
    cookie: {
        secure: false,   // Set 'true' in production with HTTPS
        maxAge: 1000 * 60 * 60 * 24 * 7  // 1 week session expiry
    }
}));

// Use routes (add any other routes you have here)
app.use('/', uploadRoutes);

// Check session route
app.get('/check-session', (req, res) => {
    if (req.session.views) {
        req.session.views++;
        res.json({ message: `You visited ${req.session.views} times.` });
    } else {
        req.session.views = 1;
        res.json({ message: 'Welcome! This is your first visit.' });
    }
});

// Connect to MongoDB and start server
mongoose.connect(process.env.mongoURI, {})
    .then(() => {
        console.log('Connected to MongoDB Atlas');

        // Start the server
        app.listen(port, () => {
            console.log(`Node/Express Server is Up......\nPort: localhost:${port}`);
        });
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB Atlas:', error);
    });
