// server/routes/orderRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Configure multer for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/receipts/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const userId = req.user?.id || 'unknown';
    cb(null, 'receipt-' + userId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const validTypes = /jpeg|jpg|png|pdf/;
    const extname = validTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = validTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only JPG, PNG, and PDF files are allowed!'));
  }
});

// @desc    Create new order with bank transfer
// @route   POST /api/orders
// @access  Private/Customer
router.post('/', protect, upload.single('receipt'), async (req, res) => {
  try {
    // ✅ PARSE ITEMS FROM STRING TO JSON
    let items;
    try {
      items = JSON.parse(req.body.items);
    } catch (parseError) {
      console.error('Items parsing error:', parseError);
      return res.status(400).json({ success: false, message: 'Invalid items format' });
    }

    const totalAmount = parseFloat(req.body.totalAmount);
    const customerId = req.user.id;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in order' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Receipt is required' });
    }

    const order = new Order({
      customer: customerId,
      items,
      totalAmount,
      paymentMethod: 'bank_transfer',
      receipt: req.file.path,
      status: 'pending_payment',
      receiptStatus: 'pending'
    });

    await order.save();
    
    // Clear customer cart
    await Customer.findByIdAndUpdate(customerId, { $set: { cart: [] } });

    res.status(201).json({ 
      success: true, 
      message: 'Order placed successfully. Please wait for admin confirmation.',
      data: order 
    });

  } catch (err) {
    console.error('Create order error:', err);
    // Clean up uploaded file on error
    if (req.file) {
      const fs = require('fs');
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get customer orders
// @route   GET /api/orders
// @access  Private/Customer
router.get('/', protect, async (req, res) => {
  try {
    // ✅ CRITICAL: Ensure user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    const orders = await Order.find({ customer: req.user.id })
      .sort({ createdAt: -1 })
      .populate('items.productId', 'title brand images');
    
    res.json({ success: true, data: orders });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private/Customer
router.get('/:id', protect, async (req, res) => {
  try {
    // ✅ CRITICAL: Ensure user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    const order = await Order.findOne({ 
      _id: req.params.id, 
      customer: req.user.id 
    }).populate('items.productId', 'title brand images');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    res.json({ success: true, data: order });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Cancel order (only if pending)
// @route   DELETE /api/orders/:id
// @access  Private/Customer
router.delete('/:id', protect, async (req, res) => {
  try {
    // ✅ CRITICAL: Ensure user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    const order = await Order.findOne({ 
      _id: req.params.id, 
      customer: req.user.id 
    });
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    if (order.status !== 'pending_payment') {
      return res.status(400).json({ success: false, message: 'Cannot cancel this order' });
    }
    
    await Order.findByIdAndDelete(req.params.id);
    
    // Clean up receipt file
    if (order.receipt) {
      const fs = require('fs');
      if (fs.existsSync(order.receipt)) {
        fs.unlinkSync(order.receipt);
      }
    }
    
    res.json({ success: true, message: 'Order cancelled successfully' });
    
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;