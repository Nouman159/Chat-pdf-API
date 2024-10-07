const mongoose = require('mongoose');

const ExtractedTextSchema = new mongoose.Schema({
    text: { type: String, required: true },
    embeddings: [Number],
    userId: { type: String }
}, { timestamps: true });

const ExtractedText = mongoose.model('ExtractedText', ExtractedTextSchema);

module.exports = ExtractedText;
