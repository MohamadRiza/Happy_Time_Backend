// server/routes/messageRoutes.js
const express = require('express');
const Message = require('../models/Message');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// @desc    Submit a new message (public)
// @route   POST /api/messages
// @access  Public
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, message, branch } = req.body;

    if (!name || !email || !message || !branch) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const newMessage = await Message.create({
      name,
      email,
      phone,
      message,
      branch,
    });

    res.status(201).json({ success: true,  newMessage });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, errors });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get all messages (admin only)
// @route   GET /api/messages
// @access  Admin
router.get('/', protect, admin, async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    res.json({ success: true,  messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Mark message as read/replied (admin)
// @route   PUT /api/messages/:id
// @access  Admin
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status || 'read' },
      { new: true }
    );
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    res.json({ success: true,  message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Delete a message
// @route   DELETE /api/messages/:id
// @access  Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;