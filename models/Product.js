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
    // ✅ REMOVED enum - now accepts ANY brand name (Rolex, Haino teko, Grand Seiko, etc.)
  },
  price: {
    type: Number,
    min: [0, 'Price cannot be negative'],
    // Optional - can be null/0
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
  colors: [{
    type: String,
    trim: true,
    required: [true, 'At least one color is required'],
  }],
  images: [{
    type: String, // Cloudinary URLs
    required: [true, 'At least one image is required'],
  }],
  video: {
    type: String, // Cloudinary video URL
    trim: true,
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