// server/routes/customerRoutes.js
const express = require('express');
const Customer = require('../models/Customer');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

// ✅ IMPORT CUSTOMER AUTH MIDDLEWARE
const { customerAuth } = require('../middleware/customerAuth');

const router = express.Router();

// Validation middleware
const validateRegistration = [
  body('fullName').notEmpty().withMessage('Full name is required'),
  body('dob').isISO8601().withMessage('Invalid date of birth'),
  body('country').notEmpty().withMessage('Country is required'),
  body('province').notEmpty().withMessage('Province is required'),
  body('mobileNumber').notEmpty().withMessage('Mobile number is required'),
  body('username').isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('email').optional().isEmail().withMessage('Invalid email')
];

const validateLogin = [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// @desc    Register new customer
// @route   POST /api/customers/register
// @access  Public
router.post('/register', validateRegistration, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation errors',
      errors: errors.array()
    });
  }

  try {
    const { 
      fullName, dob, country, province, city, address, 
      mobileNumber, email, username, password,
      businessDetails
    } = req.body;

    // Check if username already exists
    const existingCustomer = await Customer.findOne({ username });
    if (existingCustomer) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username already exists' 
      });
    }

    // Check if mobile number already exists
    const existingMobile = await Customer.findOne({ mobileNumber });
    if (existingMobile) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mobile number already registered' 
      });
    }

    const customerData = {
      fullName,
      dob: new Date(dob),
      country,
      province,
      mobileNumber,
      username,
      password
    };

    // Add optional fields if provided
    if (city) customerData.city = city;
    if (address) customerData.address = address;
    if (email) customerData.email = email;
    if (businessDetails) customerData.businessDetails = businessDetails;

    const customer = await Customer.create(customerData);

    // Generate JWT token (without password)
    const payload = {
      id: customer._id,
      username: customer.username,
      role: 'customer'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '30d'
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please complete your profile.',
      data: {
        token,
        customer: {
          _id: customer._id,
          fullName: customer.fullName,
          username: customer.username,
          businessDetails: customer.businessDetails
        }
      }
    });

  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username or mobile number already exists' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @desc    Login customer
// @route   POST /api/customers/login
// @access  Public
router.post('/login', validateLogin, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation errors',
      errors: errors.array()
    });
  }

  try {
    const { username, password } = req.body;

    // Find customer by username
    const customer = await Customer.findOne({ username }).select('+password');
    if (!customer) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check if account is active
    if (!customer.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account is deactivated' 
      });
    }

    // Compare password
    const isMatch = await customer.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Generate JWT token
    const payload = {
      id: customer._id,
      username: customer.username,
      role: 'customer'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '30d'
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        customer: {
          _id: customer._id,
          fullName: customer.fullName,
          username: customer.username,
          businessDetails: customer.businessDetails,
          country: customer.country,
          province: customer.province
        }
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @desc    Get customer profile
// @route   GET /api/customers/profile
// @access  Private
// ✅ ADD customerAuth MIDDLEWARE
router.get('/profile', customerAuth, async (req, res) => {
  try {
    // req.user is now available from middleware
    const customer = await Customer.findById(req.user.id).select('-password');
    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Customer not found' 
      });
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @desc    Update customer profile (optional fields)
// @route   PUT /api/customers/profile
// @access  Private
// ✅ ADD customerAuth MIDDLEWARE
router.put('/profile', customerAuth, async (req, res) => {
  try {
    const { city, address, businessDetails } = req.body;
    
    const updateData = {};
    if (city !== undefined) updateData.city = city;
    if (address !== undefined) updateData.address = address;
    if (businessDetails) updateData.businessDetails = businessDetails;

    // ✅ req.user.id is now available
    const customer = await Customer.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Customer not found' 
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: customer
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router;