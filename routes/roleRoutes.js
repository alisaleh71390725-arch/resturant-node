const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController'); // make sure this path is correct

// Add new role
router.post('/', roleController.addRole);

// Update a role by ID
router.put('/:roleId', roleController.updateRole);

// Delete a role by ID
router.delete('/:roleId', roleController.deleteRole);

// GET all roles
router.get('/all', roleController.getAllRoles);

module.exports = router;
