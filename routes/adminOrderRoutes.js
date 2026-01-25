// server/routes/adminOrderRoutes.js
const express = require('express');
const Order = require('../models/Order');
const Product = require('../models/Product'); // ✅ ADD PRODUCT MODEL
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

// ✅ HELPER FUNCTION: Reduce product stock quantities
const reduceProductStock = async (items) => {
  const updatePromises = items.map(async (item) => {
    if (!item.productId || !item.selectedColor || item.quantity <= 0) {
      return null;
    }

    // Find the product
    const product = await Product.findById(item.productId);
    if (!product) return null;

    // Find the color in the product's colors array
    const colorIndex = product.colors.findIndex(
      color => color.name === item.selectedColor
    );

    if (colorIndex !== -1 && product.colors[colorIndex].quantity !== null) {
      const newQuantity = Math.max(0, product.colors[colorIndex].quantity - item.quantity);
      
      // Update the specific color quantity
      await Product.findByIdAndUpdate(
        item.productId,
        { [`colors.${colorIndex}.quantity`]: newQuantity },
        { new: true }
      );
      
      console.log(`✅ Reduced stock for ${product.title} - ${item.selectedColor}: ${item.quantity} units`);
    }
  });

  await Promise.all(updatePromises);
};

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

    // Get current order to check if receipt status is changing to verified
    const currentOrder = await Order.findById(req.params.id);
    if (!currentOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
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

    // ✅ REDUCE STOCK ONLY WHEN RECEIPT STATUS CHANGES TO VERIFIED
    if (receiptStatus === 'verified' && currentOrder.receiptStatus !== 'verified') {
      try {
        await reduceProductStock(order.items);
        console.log(`✅ Stock reduced for order ${order._id}`);
      } catch (stockError) {
        console.error('Stock reduction error:', stockError);
        // Don't fail the order update if stock reduction fails
      }
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