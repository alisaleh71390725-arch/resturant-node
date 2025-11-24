const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Add new category
router.post('/', categoryController.addCategory);

// Update a category by ID
router.put('/:categoryId', categoryController.updateCategory);

// Delete a category by ID
router.delete('/:categoryId', categoryController.deleteCategory);

// GET all categories
router.get('/all', categoryController.getAllCategories);


module.exports = router;
