// server/routes/adminProfileRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// @desc    Get admin profile
// @route   GET /api/admin/profile
// @access  Private/Admin
router.get('/profile', protect, admin, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id).select('-password');
    
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    res.json({ success: true, data: admin });
  } catch (err) {
    console.error('Get admin profile error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Update admin username
// @route   PUT /api/admin/profile/username
// @access  Private/Admin
router.put('/profile/username', protect, admin, async (req, res) => {
  try {
    const { currentPassword, newUsername } = req.body;

    if (!currentPassword || !newUsername) {
      return res.status(400).json({ success: false, message: 'Current password and new username are required' });
    }

    if (newUsername.length < 3) {
      return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
    }

    const admin = await User.findById(req.user.id).select('+password');
    
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const existingAdmin = await User.findOne({ username: newUsername, _id: { $ne: admin._id } });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    admin.username = newUsername;
    await admin.save();

    res.json({ success: true, message: 'Username updated successfully', data: { username: admin.username } });

  } catch (err) {
    console.error('Update username error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Update admin password
// @route   PUT /api/admin/profile/password
// @access  Private/Admin
router.put('/profile/password', protect, admin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) { // ✅ Match your model's minlength: 8
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const admin = await User.findById(req.user.id).select('+password');
    
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // ✅ CORRECT: Assign plain password - let pre-save hook handle hashing
    admin.password = newPassword; // ← Just assign the plain password!
    await admin.save(); // ← Pre-save hook will hash it automatically

    res.json({ success: true, message: 'Password updated successfully' });

  } catch (err) {
    console.error('Update password error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;