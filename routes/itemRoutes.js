const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const itemController = require('../controllers/itemController');
const fs = require('fs');


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.body.userId || req.params.userId;

    if (!userId) {
      return cb(new Error('User ID is required to upload files'), false);
    }

    const userDir = path.join(__dirname, '..', 'uploads', `user_${userId}`);

    // Create directory if it doesn't exist
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}${path.extname(file.originalname)}`);
  }
});




const upload = multer({ storage });

// Routes

// Get all items
router.get('/', itemController.getAllItems);

// Get all items for a specific user
router.get('/:userId', itemController.getAllItemsById);

// Get categories for a specific user
router.get('/categories/:userId', itemController.getCategories);

// Add a new item (with optional image upload)
router.post('/', upload.single('item_picture'), itemController.addItem);

// Update an existing item by itemId (with optional image upload)
router.put('/:itemId', upload.single('item_picture'), itemController.updateItem);

// Delete an item by itemId
router.delete('/:itemId', itemController.deleteItem);

module.exports = router;
