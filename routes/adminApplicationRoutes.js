// server/routes/adminApplicationRoutes.js
const express = require('express');
const Application = require('../models/Application');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all applications (Admin only)
// @route   GET /api/admin/applications
// @access  Private/Admin
router.get('/', protect, admin, async (req, res) => { // ✅ REMOVED '/applications'
  try {
    const applications = await Application.find().sort({ createdAt: -1 });
    res.json({ success: true, data: applications });
  } catch (err) {
    console.error('Get applications error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Update application status (Admin only)
// @route   PUT /api/admin/applications/:id/status
// @access  Private/Admin
router.put('/:id/status', protect, admin, async (req, res) => { // ✅ REMOVED '/applications'
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'reviewing', 'shortlisted', 'rejected', 'hired'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const application = await Application.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    res.json({ success: true, message: 'Status updated successfully', data: application });
  } catch (err) {
    console.error('Update application status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;