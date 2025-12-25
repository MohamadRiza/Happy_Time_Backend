// server/routes/productRoutes.js
const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// Multer configuration with proper error handling
const storage = multer.memoryStorage();

// Configure limits: 50MB per file, max 4 files total (3 images + 1 video)
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 4
  },
  fileFilter: (req, file, cb) => {
    // Accept only images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
});

// Custom Multer error handler
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum file size is 50MB.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Too many files uploaded. Maximum 3 images and 1 video allowed.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 4 files allowed (3 images + 1 video).'
      });
    }
  }
  next(err);
};

// @desc    Upload image/video to Cloudinary
const uploadToCloudinary = async (file, folder) => {
  if (!file) return null;
  
  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image',
          timeout: 60000 // 60 second timeout
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(new Error('Cloudinary upload failed'));
          } else {
            resolve(result);
          }
        }
      );
      uploadStream.end(file.buffer);
    });
    
    return result.secure_url;
  } catch (error) {
    console.error('Upload to Cloudinary failed:', error);
    throw error;
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Admin only
router.post(
  '/',
  protect,
  admin,
  upload.fields([
    { name: 'images', maxCount: 3 },
    { name: 'video', maxCount: 1 }
  ]),
  handleMulterError,
  async (req, res) => {
    try {
      // Upload images
      const imagePromises = (req.files?.images || []).map(file => 
        uploadToCloudinary(file, 'happy_time/products/images')
      );
      const imageUrls = await Promise.all(imagePromises);

      // Upload video
      let videoUrl = null;
      if (req.files?.video?.[0]) {
        // Note: Video duration validation should be done client-side or with Cloudinary webhook
        videoUrl = await uploadToCloudinary(req.files.video[0], 'happy_time/products/videos');
      }

      // Parse and validate colors
      let colors = [];
      try {
        colors = JSON.parse(req.body.colors || '[]');
        colors = colors.filter(c => typeof c === 'string' && c.trim()).map(c => c.trim());
      } catch (e) {
        return res.status(400).json({ success: false, message: 'Invalid colors format' });
      }

      // Validate required fields
      if (!req.body.title?.trim()) {
        return res.status(400).json({ success: false, message: 'Title is required' });
      }
      if (!req.body.description?.trim()) {
        return res.status(400).json({ success: false, message: 'Description is required' });
      }
      if (!req.body.brand) {
        return res.status(400).json({ success: false, message: 'Brand is required' });
      }
      if (!req.body.watchShape) {
        return res.status(400).json({ success: false, message: 'Watch shape is required' });
      }
      if (imageUrls.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one image is required' });
      }
      if (colors.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one color is required' });
      }

      const productData = {
        title: req.body.title.trim(),
        description: req.body.description.trim(),
        brand: req.body.brand,
        price: req.body.price ? parseFloat(req.body.price) : null,
        modelNumber: req.body.modelNumber?.trim() || 'N/A',
        watchShape: req.body.watchShape,
        colors: colors,
        images: imageUrls,
        video: videoUrl,
      };

      const product = await Product.create(productData);
      res.status(201).json({ success: true,  product });
    } catch (err) {
      console.error('Product creation error:', err);
      // Handle Cloudinary-specific errors
      if (err.message && err.message.includes('Cloudinary upload failed')) {
        return res.status(500).json({ success: false, message: 'Failed to upload media files' });
      }
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// @desc    Get all products (admin)
// @route   GET /api/products/admin
// @access  Admin only
router.get('/admin', protect, admin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true,  products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Admin only
router.get('/:id', protect, admin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true,  product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Admin only
router.put(
  '/:id',
  protect,
  admin,
  upload.fields([
    { name: 'images', maxCount: 3 },
    { name: 'video', maxCount: 1 }
  ]),
  handleMulterError,
  async (req, res) => {
    try {
      const existingProduct = await Product.findById(req.params.id);
      if (!existingProduct) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      let updateData = {};

      // Handle file uploads
      let imageUrls = existingProduct.images;
      let videoUrl = existingProduct.video;

      if (req.files?.images && req.files.images.length > 0) {
        const newImagePromises = req.files.images.map(file => 
          uploadToCloudinary(file, 'happy_time/products/images')
        );
        imageUrls = await Promise.all(newImagePromises);
      }

      if (req.files?.video?.[0]) {
        videoUrl = await uploadToCloudinary(req.files.video[0], 'happy_time/products/videos');
      }

      // Parse colors
      let colors = existingProduct.colors;
      if (req.body.colors) {
        try {
          colors = JSON.parse(req.body.colors);
          colors = colors.filter(c => typeof c === 'string' && c.trim()).map(c => c.trim());
          if (colors.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one color is required' });
          }
        } catch (e) {
          return res.status(400).json({ success: false, message: 'Invalid colors format' });
        }
      }

      // Build update data
      updateData = {
        title: req.body.title?.trim() || existingProduct.title,
        description: req.body.description?.trim() || existingProduct.description,
        brand: req.body.brand || existingProduct.brand,
        price: req.body.price ? parseFloat(req.body.price) : existingProduct.price,
        modelNumber: req.body.modelNumber?.trim() || existingProduct.modelNumber || 'N/A',
        watchShape: req.body.watchShape || existingProduct.watchShape,
        colors: colors,
        images: imageUrls,
        video: videoUrl,
      };

      const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
      res.json({ success: true,  product });
    } catch (err) {
      console.error('Product update error:', err);
      if (err.message && err.message.includes('Cloudinary upload failed')) {
        return res.status(500).json({ success: false, message: 'Failed to upload media files' });
      }
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Admin only
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;