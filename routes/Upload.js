const router = require("express").Router();
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { ImgUpload } = require("../controllers/UploadController.js");
const axios = require('axios');
const path = require('path');
const { createWriteStream } = require('fs');
const { authMiddleware } = require("../middleware/authMiddleware");
const uploadLocal = require("../config/multerConfig");

//! Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDNAME,
  api_key: process.env.CLOUDAPIKEY,
  api_secret: process.env.CLOUDAPISECRET,
});

//! Multer Cloudinary storage
const upload = multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: {
      public_id: (req, file) => `${Date.now()}-${file.originalname.trim().split('.').slice(0, -1).join('.')}`,
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, //? 10MB
});

router.post("/img-upload", authMiddleware, upload.single("image"), ImgUpload);

router.post("/local-upload", authMiddleware, uploadLocal.single('image'), ImgUpload);

router.post('/img-download', async (req, res) => {
  try {
    const { public_id } = req.body;

    // Construct the Cloudinary image URL
    const imageUrl = `https://res.cloudinary.com/${process.env.CLOUDNAME}/image/upload/${public_id}`;

    const fileName = imageUrl.split('/').pop();
    console.log(fileName);
    const localPath = path.join('uploads', `${fileName}.jpg`);

    const writer = createWriteStream(localPath);

    axios({
      method: 'get',
      url: imageUrl,
      responseType: 'stream',
    }).then(response => {
      response.data.pipe(writer);
      writer.on('finish', () => {
        console.log(`Image saved at ${localPath}`);
        res.download(localPath); // Send file to client
      });
    }).catch(error => {
      console.error(error);
      res.status(500).send('Error downloading image');
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error downloading image');
  }
});

module.exports = router;
