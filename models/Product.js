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
  // ✅ MAKE GENDER OPTIONAL - Only for watches
  gender: {
    type: String,
    enum: ['men', 'women', 'kids', 'unisex'],
    // Removed "required" - gender is now optional
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
  // ✅ ADD PRODUCT TYPE
  productType: {
    type: String,
    enum: ['watch', 'wall_clock'],
    required: [true, 'Product type is required'],
    default: 'watch'
  },
  colors: [{
    type: String,
    trim: true,
    required: [true, 'At least one color is required'],
  }],
  images: [{
    type: String,
    required: [true, 'At least one image is required'],
  }],
  video: {
    type: String,
    trim: true,
  },
  featured: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Product', ProductSchema);