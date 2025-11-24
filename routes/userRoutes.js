const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  getDescription,
  addUser,
  updateUser,
  deleteUser,
  getUserbyID,
  loginUser,
  changePassword,
  getExpiration
} = require('../controllers/userController');
router.post('/login', loginUser);
router.get('/all', getAllUsers);
router.get('/exp/:userId', getExpiration);
router.get('/desc', getDescription);
router.get('/:userId', getUserbyID);
router.post('/', addUser);
router.put('/:userId', updateUser);
router.delete('/:userId', deleteUser);

router.put('/:userId/change-password', changePassword);

module.exports = router;
