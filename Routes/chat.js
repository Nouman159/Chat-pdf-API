// routes/uploadRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../Middlewares/upload');
const { uploadFiles, askQuestion } = require('../Controllers/chat');

// Endpoint to handle file uploads
router.post('/upload', upload.array('pdfs', 5), uploadFiles);
router.post('/ask', askQuestion);

module.exports = router;
