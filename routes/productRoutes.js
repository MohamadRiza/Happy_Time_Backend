// server/routes/productRoutes.js
const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// Multer configuration
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 4
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
});

// ✅ DEFINE uploadToCloudinary BEFORE using it
const uploadToCloudinary = async (file, folder) => {
  if (!file) return null;
  
  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image',
          timeout: 60000
        },
        (error, result) => {
          if (error) {
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
    throw error;
  }
};

// Helper: Parse colors safely
const parseColors = (colorsStr) => {
  if (!colorsStr) return [];
  
  if (typeof colorsStr === 'string' && colorsStr.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(colorsStr);
      return Array.isArray(parsed) 
        ? parsed.filter(c => typeof c === 'string' && c.trim()).map(c => c.trim())
        : [];
    } catch (e) {
      return [colorsStr.trim()].filter(c => c);
    }
  }
  
  return [colorsStr.toString().trim()].filter(c => c);
};

// Multer error handler
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum file size is 50MB.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum 3 images and 1 video allowed.'
      });
    }
  }
  console.error('Request error:', err);
  res.status(500).json({ success: false, message: 'Server error' });
};

// ✅ Helper: Validate featured products limit
const validateFeaturedLimit = async (isFeatured, editingId = null) => {
  if (isFeatured) {
    const featuredCount = await Product.countDocuments({ featured: true });
    // If editing an existing featured product, don't count it
    const currentProductIsFeatured = editingId 
      ? await Product.findById(editingId).select('featured')
      : null;
    
    const countToCheck = currentProductIsFeatured && currentProductIsFeatured.featured 
      ? featuredCount - 1 
      : featuredCount;
      
    if (countToCheck >= 4) {
      throw new Error('Maximum 4 featured products allowed');
    }
  }
};

// ✅ PUBLIC ROUTES - CRITICAL ORDER: SPECIFIC BEFORE PARAMETER

// @desc    Get all active products (public)
// @route   GET /api/products
// @access  Public
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (err) {
    console.error('Fetch public products error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get featured products (public)
// @route   GET /api/products/featured
// @access  Public
router.get('/featured', async (req, res) => {
  try {
    const products = await Product.find({ 
      status: 'active', 
      featured: true 
    })
    .sort({ createdAt: -1 })
    .limit(4);
    
    res.json({ success: true, products });
  } catch (err) {
    console.error('Fetch featured products error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get all products (admin) - ✅ MUST COME BEFORE /:id
// @route   GET /api/products/admin
// @access  Admin only
router.get('/admin', protect, admin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (err) {
    console.error('Fetch admin products error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get single product (public) - ✅ COMES LAST
// @route   GET /api/products/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, product });
  } catch (err) {
    console.error('Fetch public product error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ✅ ADMIN ROUTES (REQUIRES AUTHENTICATION)

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
      const { title, description, brand, watchShape, price, modelNumber, colors, featured } = req.body;
      
      if (!title || !title.trim()) {
        return res.status(400).json({ success: false, message: 'Title is required' });
      }
      if (!description || !description.trim()) {
        return res.status(400).json({ success: false, message: 'Description is required' });
      }
      if (!brand || !brand.trim()) {
        return res.status(400).json({ success: false, message: 'Brand is required' });
      }
      if (!watchShape || !watchShape.trim()) {
        return res.status(400).json({ success: false, message: 'Watch shape is required' });
      }

      // ✅ Validate featured limit
      const isFeatured = featured === 'true' || featured === true;
      await validateFeaturedLimit(isFeatured);

      const imagePromises = (req.files?.images || []).map(file => 
        uploadToCloudinary(file, 'happy_time/products/images')
      );
      const imageUrls = await Promise.all(imagePromises);

      if (imageUrls.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one image is required' });
      }

      let videoUrl = null;
      if (req.files?.video?.[0]) {
        videoUrl = await uploadToCloudinary(req.files.video[0], 'happy_time/products/videos');
      }

      const parsedColors = parseColors(colors);
      if (parsedColors.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one color is required' });
      }

      const productData = {
        title: title.trim(),
        description: description.trim(),
        brand: brand.trim(),
        price: price ? parseFloat(price) : null,
        modelNumber: modelNumber?.trim() || 'N/A',
        watchShape: watchShape.trim(),
        colors: parsedColors,
        images: imageUrls,
        video: videoUrl,
        featured: isFeatured
      };

      const product = await Product.create(productData);
      res.status(201).json({ success: true, product });
    } catch (err) {
      console.error('Product creation error:', err);
      if (err.message && err.message.includes('Cloudinary upload failed')) {
        return res.status(500).json({ success: false, message: 'Failed to upload media files' });
      }
      if (err.message && err.message.includes('Maximum 4 featured products allowed')) {
        return res.status(400).json({ success: false, message: 'Maximum 4 featured products allowed' });
      }
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

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

      const { featured } = req.body;
      const isFeatured = featured === 'true' || featured === true;

      // ✅ Validate featured limit
      await validateFeaturedLimit(isFeatured, req.params.id);

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

      const parsedColors = req.body.colors ? parseColors(req.body.colors) : existingProduct.colors;
      if (parsedColors.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one color is required' });
      }

      const updateData = {
        title: req.body.title?.trim() || existingProduct.title,
        description: req.body.description?.trim() || existingProduct.description,
        brand: req.body.brand?.trim() || existingProduct.brand,
        price: req.body.price ? parseFloat(req.body.price) : existingProduct.price,
        modelNumber: req.body.modelNumber?.trim() || existingProduct.modelNumber || 'N/A',
        watchShape: req.body.watchShape?.trim() || existingProduct.watchShape,
        colors: parsedColors,
        images: imageUrls,
        video: videoUrl,
        featured: isFeatured
      };

      const product = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
      res.json({ success: true, product });
    } catch (err) {
      console.error('Product update error:', err);
      if (err.message && err.message.includes('Cloudinary upload failed')) {
        return res.status(500).json({ success: false, message: 'Failed to upload media files' });
      }
      if (err.message && err.message.includes('Maximum 4 featured products allowed')) {
        return res.status(400).json({ success: false, message: 'Maximum 4 featured products allowed' });
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
    console.error('Delete product error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;