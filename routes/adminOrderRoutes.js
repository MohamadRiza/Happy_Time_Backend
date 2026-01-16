// server/routes/adminOrderRoutes.js
const express = require('express');
const Order = require('../models/Order');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all orders (Admin)
// @route   GET /api/admin/orders
// @access  Private/Admin
router.get('/orders', protect, admin, async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .populate('customer', 'fullName username email mobileNumber')
      .populate('items.productId', 'title brand images');
    
    res.json({ success: true,  orders });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get single order (Admin)
// @route   GET /api/admin/orders/:id
// @access  Private/Admin
router.get('/orders/:id', protect, admin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'fullName username email mobileNumber')
      .populate('items.productId', 'title brand images');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    res.json({ success: true,  order });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Update order status (Admin)
// @route   PUT /api/admin/orders/:id/status
// @access  Private/Admin
router.put('/orders/:id/status', protect, admin, async (req, res) => {
  try {
    const { status, receiptStatus, adminNotes } = req.body;
    const validStatuses = ['pending_payment', 'processing', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    const validReceiptStatuses = ['pending', 'verified', 'rejected'];
    
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    if (receiptStatus && !validReceiptStatuses.includes(receiptStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid receipt status' });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { 
        ...(status && { status }),
        ...(receiptStatus && { receiptStatus }),
        ...(adminNotes && { adminNotes })
      },
      { new: true }
    ).populate('customer', 'fullName username email')
     .populate('items.productId', 'title brand');
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ 
      success: true, 
      message: 'Order updated successfully',
       order 
    });

  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;