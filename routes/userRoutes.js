// const express = require('express');
// const router = express.Router();
// const User = require('../models/User');
// const auth = require('../middleware/auth');
// const userController = require('../controllers/userController');

// router.get('/', auth, async (req, res) => {
//   try {
//     const query = {};
//     if (req.query.userType) query.userType = req.query.userType;
    
//     const users = await User.find(query).populate('courses');
//     res.json(users);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

// // @route   PUT api/users/profile
// // @desc    Update user profile
// // @access  Private
// router.put('/profile', auth, userController.updateUserProfile);

// module.exports = router;