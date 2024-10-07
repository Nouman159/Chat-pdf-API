// middleware/multer.js
const multer = require('multer');
const path = require('path');

// Multer configuration for file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/')); // Store files in the 'uploads' folder
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname); // Add a timestamp to avoid filename conflicts
    },
});

// File filter to accept only PDFs
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true); // Accept PDF files
    } else {
        cb(new Error('Only PDF files are allowed'), false); // Reject non-PDF files
    }
};

// Multer middleware setup
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 75 * 1024 * 1024 }, // Set max file size to 75MB
});

module.exports = upload;
