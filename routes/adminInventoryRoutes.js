// server/routes/adminInventoryRoutes.js | QTY Management Routes
const express = require('express');
const Product = require('../models/Product');
const InventorySettings = require('../models/InventorySettings');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// @desc    Get inventory settings
// @route   GET /api/admin/inventory/settings
// @access  Private/Admin
router.get('/settings', protect, admin, async (req, res) => {
  try {
    let settings = await InventorySettings.findOne();
    if (!settings) {
      settings = await InventorySettings.create({});
    }
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('Get inventory settings error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Update inventory settings
// @route   PUT /api/admin/inventory/settings
// @access  Private/Admin
router.put('/settings', protect, admin, async (req, res) => {
  try {
    const { lowStockThreshold, outOfStockThreshold, alertEmails, enabled } = req.body;
    
    // Validate thresholds
    if (lowStockThreshold < 1 || lowStockThreshold > 100) {
      return res.status(400).json({ success: false, message: 'Low stock threshold must be between 1-100' });
    }
    if (outOfStockThreshold < 0 || outOfStockThreshold > 10) {
      return res.status(400).json({ success: false, message: 'Out of stock threshold must be between 0-10' });
    }
    if (outOfStockThreshold >= lowStockThreshold) {
      return res.status(400).json({ success: false, message: 'Out of stock threshold must be less than low stock threshold' });
    }

    let settings = await InventorySettings.findOne();
    if (!settings) {
      settings = new InventorySettings(req.body);
    } else {
      settings.lowStockThreshold = lowStockThreshold;
      settings.outOfStockThreshold = outOfStockThreshold;
      settings.alertEmails = alertEmails || [];
      settings.enabled = enabled !== undefined ? enabled : settings.enabled;
    }
    
    await settings.save();
    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('Update inventory settings error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get inventory status
// @route   GET /api/admin/inventory/status
// @access  Private/Admin
router.get('/status', protect, admin, async (req, res) => {
  try {
    const settings = await InventorySettings.findOne();
    const lowThreshold = settings?.lowStockThreshold || 10;
    const outThreshold = settings?.outOfStockThreshold || 0;

    // Get all products with stock information
    const products = await Product.find({ status: 'active' })
      .select('title brand images colors price')
      .lean();

    const inventoryStatus = {
      outOfStock: [],
      lowStock: [],
      inStock: []
    };

    products.forEach(product => {
      product.colors.forEach(color => {
        if (color.quantity === null) {
          // Unlimited stock
          inventoryStatus.inStock.push({
            ...product,
            colorName: color.name,
            currentStock: 'Unlimited',
            stockStatus: 'inStock'
          });
        } else if (color.quantity <= outThreshold) {
          inventoryStatus.outOfStock.push({
            ...product,
            colorName: color.name,
            currentStock: color.quantity,
            stockStatus: 'outOfStock'
          });
        } else if (color.quantity <= lowThreshold) {
          inventoryStatus.lowStock.push({
            ...product,
            colorName: color.name,
            currentStock: color.quantity,
            stockStatus: 'lowStock'
          });
        } else {
          inventoryStatus.inStock.push({
            ...product,
            colorName: color.name,
            currentStock: color.quantity,
            stockStatus: 'inStock'
          });
        }
      });
    });

    res.json({ 
      success: true, 
      data: inventoryStatus,
      summary: {
        totalOutOfStock: inventoryStatus.outOfStock.length,
        totalLowStock: inventoryStatus.lowStock.length,
        totalInStock: inventoryStatus.inStock.length
      }
    });
  } catch (err) {
    console.error('Get inventory status error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Update product stock quantity
// @route   PUT /api/admin/inventory/stock/:productId
// @access  Private/Admin
router.put('/stock/:productId', protect, admin, async (req, res) => {
  try {
    const { colorName, quantity } = req.body;
    
    if (quantity < 0) {
      return res.status(400).json({ success: false, message: 'Quantity cannot be negative' });
    }
    
    if (quantity > 99999) {
      return res.status(400).json({ success: false, message: 'Quantity too large' });
    }

    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Find the color and update quantity
    const colorIndex = product.colors.findIndex(c => c.name === colorName);
    if (colorIndex === -1) {
      return res.status(404).json({ success: false, message: 'Color not found' });
    }

    // Store old quantity for logging
    const oldQuantity = product.colors[colorIndex].quantity;
    product.colors[colorIndex].quantity = quantity;
    
    await product.save();
    
    // Log the change
    console.log(`Admin updated stock for ${product.title} - ${colorName}: ${oldQuantity} → ${quantity}`);

    res.json({ 
      success: true, 
      data: product,
      message: 'Stock updated successfully'
    });
  } catch (err) {
    console.error('Update stock error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;