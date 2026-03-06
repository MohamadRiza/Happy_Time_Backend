// server/models/Product.js
const mongoose = require('mongoose');
const ProductSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true,
  },
  gender: {
    type: String,
    enum: ['men', 'women', 'kids', 'unisex'],
  },
  price: {
    type: Number,
    min: [0, 'Price cannot be negative'],
  },
  modelNumber: {
    type: String,
    default: 'N/A',
    trim: true,
  },
  watchShape: {
    type: String,
    required: [true, 'Watch shape is required'],
    enum: ['Round', 'Square', 'Rectangular', 'Oval', 'Tonneau', 'Other'],
  },
  productType: {
    type: String,
    enum: ['watch', 'wall_clock'],
    required: [true, 'Product type is required'],
    default: 'watch'
  },
  // ✅ UPDATED: Colors with name, optional quantity, and optional colorImage
  colors: [{
    name: {
      type: String,
      required: [true, 'Color name is required'],
      trim: true
    },
    quantity: {
      type: Number,
      min: [0, 'Quantity cannot be negative'],
      default: null
    },
    // ✅ NEW: Per-color image URL (optional)
    colorImage: {
      type: String,
      trim: true,
      default: null
    }
  }],
  specifications: [{
    key: {
      type: String,
      required: [true, 'Specification key is required'],
      trim: true
    },
    value: {
      type: String,
      required: [true, 'Specification value is required'],
      trim: true
    }
  }],
  images: [{
    type: String,
    required: [true, 'At least one image is required'],
  }],
  videos: [{
    type: String,
    trim: true,
  }],
  featured: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  warranty: {
    duration: {
      type: String,
      enum: ['1year', '3months', '6months', '2years', 'nowarranty'],
      default: 'nowarranty'
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Warranty description cannot exceed 200 characters'],
      default: ''
    }
  }
}, {
  timestamps: true,
});
module.exports = mongoose.model('Product', ProductSchema);