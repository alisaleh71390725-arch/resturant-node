const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const multer = require('multer');
const path = require('path');

// Multer temp storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'temp-' + unique + ext);
  }
});
const upload = multer({ storage });

router.get('/:id', profileController.getUserProfile);
router.post('/:id', upload.single('logo'), profileController.updateUserProfile);
router.get('/company/:companyName', profileController.getProfileByCompanyName);
router.get('/', profileController.getAllProfiles); // ✅ Must be above /:id


module.exports = router;
