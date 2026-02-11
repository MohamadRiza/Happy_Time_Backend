// server/routes/orderRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const Order = require('../models/Order');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ✅ ALLOWED COUNTRIES LIST
const allowedCountries = [
  'Sri Lanka',
  'United Arab Emirates',
  'Bahrain',
  'Egypt',
  'Iran',
  'Iraq',
  'Jordan',
  'Kuwait',
  'Lebanon',
  'Oman',
  'Palestine',
  'Qatar',
  'Saudi Arabia',
  'Syria',
  'Turkey',
  'Yemen',
  'India',
  'Maldives',
  'Bangladesh',
  'Pakistan',
  'Nepal',
  'Bhutan',
  'Myanmar',
  'Afghanistan',
  'Kazakhstan',
  'Turkmenistan',
  'Uzbekistan',
  'Azerbaijan',
  'Georgia',
  'Armenia'
];

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

    // ✅ PARSE DELIVERY ADDRESS
    let deliveryAddress = {
      address: '',
      city: '',
      province: '',
      country: 'Sri Lanka'
    };
    if (req.body.deliveryAddress) {
      try {
        deliveryAddress = typeof req.body.deliveryAddress === 'string'
          ? JSON.parse(req.body.deliveryAddress)
          : req.body.deliveryAddress;
        
        // Validate required fields
        if (!deliveryAddress.address?.trim() || !deliveryAddress.city?.trim() || !deliveryAddress.province?.trim()) {
          return res.status(400).json({ success: false, message: 'Please provide complete delivery address' });
        }

        // ✅ VALIDATE COUNTRY IS IN ALLOWED LIST
        if (!allowedCountries.includes(deliveryAddress.country)) {
          return res.status(400).json({ 
            success: false, 
            message: 'We do not ship to the selected country. Please choose a supported destination.' 
          });
        }
      } catch (addressError) {
        console.error('Delivery address parsing error:', addressError);
        return res.status(400).json({ success: false, message: 'Invalid delivery address format' });
      }
    }

    // ✅ PARSE CART ITEM IDS TO REMOVE
    let cartItemIds = [];
    if (req.body.cartItemIds) {
      try {
        cartItemIds = JSON.parse(req.body.cartItemIds);
      } catch (parseError) {
        console.error('Cart item IDs parsing error:', parseError);
      }
    }

    const totalAmount = parseFloat(req.body.totalAmount);
    const customerId = req.user.id;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in order' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Receipt is required' });
    }

    // ✅ STOCK VALIDATION BEFORE ORDER CREATION
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({ success: false, message: 'Product not found' });
      }
      
      // Check color availability
      const colorEntry = product.colors.find(c => c.name === item.selectedColor);
      if (!colorEntry || (colorEntry.quantity !== null && colorEntry.quantity < item.quantity)) {
        return res.status(400).json({ 
          success: false, 
          message: `Insufficient stock for ${product.title} - ${item.selectedColor}` 
        });
      }
    }

    const order = new Order({
      customer: customerId,
      items,
      totalAmount,
      paymentMethod: 'bank_transfer',
      receipt: req.file.path,
      status: 'pending_payment',
      receiptStatus: 'pending',
      deliveryAddress // ✅ INCLUDE DELIVERY ADDRESS
    });

    await order.save();

    // ✅ ONLY REMOVE SELECTED ITEMS FROM CART, NOT ALL ITEMS
    if (cartItemIds && cartItemIds.length > 0) {
      const customer = await Customer.findById(customerId);
      if (customer && customer.cart) {
        // Filter out only the items that were ordered
        customer.cart = customer.cart.filter(cartItem =>
          !cartItemIds.includes(cartItem._id.toString())
        );
        await customer.save();
      }
    }

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
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get customer orders
// @route   GET /api/orders
// @access  Private/Customer
router.get('/', protect, async (req, res) => {
  try {
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