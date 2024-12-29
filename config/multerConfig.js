const multer = require("multer");
const path = require("path");

// Multer configuration for local file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');  // Storing in the 'uploads' folder
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

// File size limit: 10MB (you can modify this if needed)
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },  // Max file size 10MB
    // Removed file filter to allow all types
    fileFilter: (req, file, cb) => {
        cb(null, true);  // Allow all file types
    }
});

module.exports = upload;
