const axios = require('axios');
const fs = require('fs');
const pdf = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const ExtractedText = require('../Models/text');

const maxFileSize = 75 * 1024 * 1024; // 75 MB

const maxEmbeddingTokens = 2048; // Example token limit for embeddings

const getModelName = () => {
    if (process.env.USE_GPT_4o === 'true') {
        return 'gpt-4o';
    } else if (process.env.USE_MINI_MODEL === 'true') {
        return 'gpt-4o-mini';
    } else {
        return 'gpt-4'; // Default to ChatGPT-4 if no flags are set
    }
};

const getEmbeddings = async (text) => {
    const response = await axios.post('https://api.openai.com/v1/embeddings', {
        model: 'text-embedding-ada-002',
        input: text
    }, {
        headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    return response.data.data[0].embedding; // Return the generated embedding
};

// Function to split text into chunks
const splitTextIntoChunks = (text, maxTokens) => {
    const words = text.split(' ');
    let chunks = [];
    let currentChunk = '';

    for (const word of words) {
        const nextChunk = currentChunk ? currentChunk + ' ' + word : word;
        // Estimate token count; you can adjust this logic based on your requirements
        const estimatedTokens = nextChunk.length / 4; // Rough estimation: 1 token ≈ 4 characters
        if (estimatedTokens <= maxTokens) {
            currentChunk = nextChunk;
        } else {
            chunks.push(currentChunk);
            currentChunk = word; // Start a new chunk with the current word
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk); // Push the last chunk if not empty
    }

    return chunks;
};

const uploadFiles = async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
    }

    let extractedTexts = [];
    const userID = uuidv4();
    let allExtractedText = ''; // Variable to hold combined extracted text

    for (const file of req.files) {
        const fileSize = fs.statSync(file.path).size;

        // Check file size limit
        if (fileSize > maxFileSize) {
            return res.status(400).json({ message: 'File too large' });
        }

        const dataBuffer = fs.readFileSync(file.path);

        try {
            const data = await pdf(dataBuffer, { max: 0 }); // Extract text only

            if (!data.text || data.text.trim() === '') {
                console.warn('No text found in the PDF file. It might be image-based.');
                continue; // Skip this file if no text is found
            }

            // Store the extracted text for suggested question generation
            allExtractedText += data.text + '\n'; // Append each file's text

            // Split extracted text into chunks
            const textChunks = splitTextIntoChunks(data.text, maxEmbeddingTokens);
            const embeddingPromises = textChunks.map(chunk => getEmbeddings(chunk)); // Generate embeddings for each chunk

            // Wait for all embeddings to be generated
            const embeddings = await Promise.all(embeddingPromises);

            // Save extracted text and embeddings
            textChunks.forEach((chunk, index) => {
                extractedTexts.push({ text: chunk, embeddings: embeddings[index] });
            });

        } catch (error) {
            console.error('Error extracting PDF text:', error);
            return res.status(500).json({ message: 'Error processing PDF file' });
        }
    }
    console.log(extractedTexts)

    const savePromises = extractedTexts.map(({ text, embeddings }) => {
        const extractedText = new ExtractedText({
            text,
            embeddings,
            userId: userID
        });
        return extractedText.save();
    });

    try {
        await Promise.all(savePromises);

        // Generate a logical suggested question based on the combined extracted text
        const suggestedQuestion = await generateSuggestedQuestion(allExtractedText); // Use the combined text

        res.status(200).json({
            message: 'Files uploaded and text extracted successfully',
            userID,
            suggestedQuestion // Include suggested question
        });
    } catch (error) {
        console.error('Error saving extracted texts to MongoDB:', error);
        res.status(500).json({ message: 'Error saving extracted texts' });
    }
};


// Function to generate a suggested question using OpenAI
const generateSuggestedQuestion = async (extractedText) => {
    const prompt = `Based on the following text, suggest a first question to ask about it:\n\n${extractedText}\n\nSuggested Question:`;

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: getModelName(), // Use the model defined in your getModelName function
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.choices[0].message.content.trim(); // Return the generated question
    } catch (error) {
        console.error('Error generating suggested question:', error);
        return 'What information does the document provide?'; // Fallback question
    }
};

// Cosine similarity function to compare vectors
const cosineSimilarity = (vecA, vecB) => {
    const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (magnitudeA * magnitudeB);
};

// Ask question and retrieve answer from OpenAI API
const askQuestion = async (req, res) => {
    const userQuestion = req.body.question;
    const questionEmbedding = await getEmbeddings(userQuestion);
    const extractedTexts = await ExtractedText.find({ userId: req.body.userId });

    if (!extractedTexts || extractedTexts.length === 0) {
        return res.status(400).json({ message: 'No extracted text available' });
    }

    // Sort and find the most relevant texts using cosine similarity
    const relevantTexts = extractedTexts
        .map(doc => ({
            text: doc.text,
            similarity: cosineSimilarity(questionEmbedding, doc.embeddings)
        }))
        .sort((a, b) => b.similarity - a.similarity) // Sort by similarity
        .slice(0, 3) // Get top 3 relevant texts
        .map(doc => doc.text)
        .join('\n'); // Combine the top relevant texts

    const modelName = getModelName();
    console.log(modelName)
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: modelName,
            messages: [
                { role: 'user', content: `Based on the following text: "${relevantTexts}", answer the question: "${userQuestion}"` }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        res.status(200).json({ answer: response.data.choices[0].message.content });
    } catch (error) {
        console.error('Error asking question:', error);
        res.status(500).json({ message: 'Error retrieving answer' });
    }
};

module.exports = { uploadFiles, askQuestion };
