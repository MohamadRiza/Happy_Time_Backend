// server/routes/cartRoutes.js
const express = require('express');
const mongoose = require('mongoose'); // ✅ ADD THIS MISSING IMPORT
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const { customerAuth } = require('../middleware/customerAuth');

const router = express.Router();

// @desc    Get customer cart
// @route   GET /api/cart
// @access  Private
router.get('/', customerAuth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.user.id).populate('cart.productId');
    // Ensure cart exists
    const cart = customer.cart || [];
    res.json({ success: true, cart });
  } catch (err) {
    console.error('Get cart error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
router.post('/', customerAuth, async (req, res) => {
  try {
    const { productId, selectedColor, quantity = 1 } = req.body;
    
    // Validate input
    if (!productId || !selectedColor) {
      return res.status(400).json({ 
        success: false, 
        message: 'Product ID and color are required' 
      });
    }
    
    // Validate product
    const product = await Product.findOne({ _id: productId, status: 'active' });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    const customerId = req.user.id;
    const customer = await Customer.findById(customerId);
    
    // ✅ ENSURE CART EXISTS
    if (!customer.cart) {
      customer.cart = [];
    }
    
    // Check if item exists
    const existingItemIndex = customer.cart.findIndex(
      item => 
        item.productId && 
        item.productId.toString() === productId.toString() && 
        item.selectedColor === selectedColor
    );
    
    if (existingItemIndex > -1) {
      customer.cart[existingItemIndex].quantity += quantity;
    } else {
      // ✅ Use mongoose.Types.ObjectId properly
      customer.cart.push({ 
        productId: new mongoose.Types.ObjectId(productId), 
        selectedColor, 
        quantity 
      });
    }
    
    await customer.save();
    await customer.populate('cart.productId');
    
    res.json({ 
      success: true, 
      message: 'Item added to cart', 
      cart: customer.cart 
    });
    
  } catch (err) {
    console.error('Add to cart detailed error:', err); // 🔍 Detailed logging
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Update cart item
// @route   PUT /api/cart/:itemId
// @access  Private
router.put('/:itemId', customerAuth, async (req, res) => {
  try {
    const { quantity, selectedColor } = req.body;
    const customerId = req.user.id;
    const itemId = req.params.itemId;
    
    const customer = await Customer.findById(customerId);
    
    // ✅ ENSURE CART EXISTS
    if (!customer.cart) {
      customer.cart = [];
    }
    
    const itemIndex = customer.cart.findIndex(item => 
      item._id && item._id.toString() === itemId
    );
    
    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }
    
    if (quantity !== undefined) {
      customer.cart[itemIndex].quantity = Math.max(1, quantity);
    }
    if (selectedColor !== undefined) {
      customer.cart[itemIndex].selectedColor = selectedColor;
    }
    
    await customer.save();
    await customer.populate('cart.productId');
    
    res.json({ success: true, cart: customer.cart });
  } catch (err) {
    console.error('Update cart error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/:itemId
// @access  Private
router.delete('/:itemId', customerAuth, async (req, res) => {
  try {
    const customerId = req.user.id;
    const itemId = req.params.itemId;
    
    const customer = await Customer.findById(customerId);
    
    // ✅ ENSURE CART EXISTS
    if (!customer.cart) {
      customer.cart = [];
    }
    
    const initialLength = customer.cart.length;
    customer.cart = customer.cart.filter(item => 
      !item._id || item._id.toString() !== itemId
    );
    
    if (customer.cart.length === initialLength) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }
    
    await customer.save();
    res.json({ success: true, message: 'Item removed from cart' });
  } catch (err) {
    console.error('Remove cart error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;