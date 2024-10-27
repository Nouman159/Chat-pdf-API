const express = require('express');
const { initializeApp } = require('firebase/app');
const { getStorage, ref, getDownloadURL, uploadBytesResumable } = require('firebase/storage');
const config = require('../config');
const multer = require('multer');

const router = express.Router()
initializeApp(config);
const storage = getStorage()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/firebase', upload.array('pdfs', 5), async (req, res) => {
    try {
        const dateTime = giveCurrentDateTime()
        const fileUploadPromises = req.files.map(async (file) => {
            const storageRef = ref(storage, `files/${file.originalname + "  " + dateTime}`)
            const metadata = {
                contentType: file.mimetype
            }

            const snapshot = await uploadBytesResumable(storageRef, file.buffer, metadata)
            const downloadURL = await getDownloadURL(snapshot.ref)

            return {
                name: file.originalname,
                type: file.mimetype,
                downloadURL: downloadURL
            }
        });

        const uploadedFiles = await Promise.all(fileUploadPromises);
        return res.send({
            message: 'Files uploaded to cloud storage',
            files: uploadedFiles
        });
    } catch (err) {
        console.error(err);
        return res.status(500).send({ message: 'Error during file upload' });
    }
});


const giveCurrentDateTime = () => {
    const today = new Date();

    const date = today.getFullYear() + '-' +
        (today.getMonth() + 1).toString().padStart(2, '0') + '-' +
        today.getDate().toString().padStart(2, '0');

    const time = today.getHours().toString().padStart(2, '0') + ':' +
        today.getMinutes().toString().padStart(2, '0') + ':' +
        today.getSeconds().toString().padStart(2, '0');

    return date + ' ' + time;
}

module.exports = router