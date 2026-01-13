// server/routes/adminRoutes.js
const express = require('express');
const Customer = require('../models/Customer');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all customers (Admin only) - WITH SEARCH
// @route   GET /api/admin/customers
// @access  Private/Admin
router.get('/customers', protect, admin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      city = '',
      country = ''
    } = req.query;

    // Build search query
    let query = {};
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { fullName: searchRegex },
        { username: searchRegex },
        { email: searchRegex },
        { mobileNumber: searchRegex }
      ];
    }
    
    if (city) {
      query.city = { $regex: city, $options: 'i' };
    }
    
    if (country) {
      query.country = { $regex: country, $options: 'i' };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const customers = await Customer.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await Customer.countDocuments(query);

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          page: parseInt(page),
          pages: Math.ceil(total / limitNum),
          limit: limitNum,
          total
        },
        filters: { search, city, country }
      }
    });
  } catch (err) {
    console.error('Get customers error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get single customer (Admin only)
// @route   GET /api/admin/customers/:id
// @access  Private/Admin
router.get('/customers/:id', protect, admin, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).select('-password');
    
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ success: true, data: customer });
  } catch (err) {
    console.error('Get customer error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Update customer account status (Admin only)
// @route   PUT /api/admin/customers/:id/status
// @access  Private/Admin
router.put('/customers/:id/status', protect, admin, async (req, res) => {
  try {
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true, select: '-password' }
    );
    
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ 
      success: true, 
      message: `Account ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: customer 
    });
  } catch (err) {
    console.error('Update customer status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Delete customer account (Admin only)
// @route   DELETE /api/admin/customers/:id
// @access  Private/Admin
router.delete('/customers/:id', protect, admin, async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({ 
      success: true, 
      message: 'Customer account deleted successfully' 
    });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;