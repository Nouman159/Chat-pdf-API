const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const uploadRoutes = require('./Routes/chat');
const uploadFirebaseRoutes = require('./Controllers/upload');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5001;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

app.use(express.json());

const allowedOrigins = ['http://localhost:3000'];
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    credentials: true
}));

app.use('/', uploadRoutes);
app.use('/upload', uploadFirebaseRoutes);

mongoose.connect(process.env.mongoURI, {})
    .then(() => {
        console.log('Connected to MongoDB Atlas');
        app.listen(port, () => {
            console.log(`Node/Express Server is Up...... Port : ${port}`);
        });
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB Atlas:', error);
    });
