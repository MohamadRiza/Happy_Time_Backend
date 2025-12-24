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

    // Trim and validate required fields
    const trimmedName = (name || '').trim();
    const trimmedEmail = (email || '').trim();
    const trimmedMessage = (message || '').trim();
    const trimmedBranch = (branch || '').trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage || !trimmedBranch) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email' });
    }

    const newMessage = await Message.create({
      name: trimmedName,
      email: trimmedEmail,
      phone: phone ? phone.trim() : '',
      message: trimmedMessage,
      branch: trimmedBranch,
    });

    res.status(201).json({ success: true,  newMessage });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, errors });
    }
    console.error('Message submission error:', err);
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
    console.error('Fetch messages error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ✅ NEW: Bulk delete messages
// @desc    Delete multiple messages
// @route   DELETE /api/messages/bulk
// @access  Admin
router.delete('/bulk', protect, admin, async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No message IDs provided' });
    }

    const result = await Message.deleteMany({ _id: { $in: ids } });
    
    res.json({ 
      success: true, 
      message: `${result.deletedCount} message(s) deleted successfully` 
    });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ success: false, message: 'Bulk delete failed' });
  }
});

// @desc    Mark message as read/replied (admin)
// @route   PUT /api/messages/:id
// @access  Admin
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status
    if (status && !['unread', 'read', 'replied'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { status: status || 'read' },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    res.json({ success: true,  message });
  } catch (err) {
    console.error('Update message error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Delete a single message
// @route   DELETE /api/messages/:id
// @access  Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const message = await Message.findByIdAndDelete(req.params.id);
    
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;