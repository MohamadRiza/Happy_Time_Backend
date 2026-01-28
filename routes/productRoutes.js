// server/routes/productRoutes.js
const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// @desc    Search products
// @route   GET /api/products/search
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json({ success: true, products: [] });
    }
    
    const products = await Product.find({
      status: 'active',
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    })
    .select('title brand images price gender')
    .limit(10)
    .sort({ createdAt: -1 });
    
    res.json({ success: true, products });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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

// ✅ NEW HELPER: Parse colors from req.body
const parseColors = (body) => {
  const colors = [];
  let colorIndex = 0;
  
  // Debug logging
  console.log('Parsing colors from body:', JSON.stringify(body, null, 2));
  
  // Try different parsing strategies
  // Strategy 1: colors[0][name] format
  while (body[`colors[${colorIndex}][name]`] !== undefined) {
    const name = body[`colors[${colorIndex}][name]`];
    const quantityStr = body[`colors[${colorIndex}][quantity]`];
    
    if (name && typeof name === 'string' && name.trim()) {
      const quantity = quantityStr && 
                       typeof quantityStr === 'string' && 
                       !isNaN(quantityStr) && 
                       quantityStr.trim() !== '' 
        ? parseInt(quantityStr) 
        : null;
      
      colors.push({ name: name.trim(), quantity });
    }
    colorIndex++;
  }
  
  // Strategy 2: Check if colors is already parsed as an array
  if (colors.length === 0 && body.colors) {
    if (Array.isArray(body.colors)) {
      body.colors.forEach(color => {
        if (color.name && typeof color.name === 'string' && color.name.trim()) {
          const quantity = color.quantity && !isNaN(color.quantity) 
            ? parseInt(color.quantity) 
            : null;
          colors.push({ name: color.name.trim(), quantity });
        }
      });
    } else if (typeof body.colors === 'string') {
      try {
        const parsedColors = JSON.parse(body.colors);
        if (Array.isArray(parsedColors)) {
          parsedColors.forEach(color => {
            if (color.name && typeof color.name === 'string' && color.name.trim()) {
              const quantity = color.quantity && !isNaN(color.quantity) 
                ? parseInt(color.quantity) 
                : null;
              colors.push({ name: color.name.trim(), quantity });
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse colors JSON:', e);
      }
    }
  }
  
  console.log('Parsed colors:', colors);
  return colors;
};

// ✅ NEW HELPER: Parse specifications from req.body
const parseSpecifications = (body) => {
  const specifications = [];
  let specIndex = 0;
  
  // Debug logging
  console.log('Parsing specifications from body');
  
  // Strategy 1: specifications[0][key] format
  while (body[`specifications[${specIndex}][key]`] !== undefined && 
         body[`specifications[${specIndex}][value]`] !== undefined) {
    const key = body[`specifications[${specIndex}][key]`];
    const value = body[`specifications[${specIndex}][value]`];
    
    if (key && typeof key === 'string' && key.trim() && 
        value && typeof value === 'string' && value.trim()) {
      specifications.push({ 
        key: key.trim(), 
        value: value.trim() 
      });
    }
    specIndex++;
  }
  
  // Strategy 2: Check if specifications is already parsed
  if (specifications.length === 0 && body.specifications) {
    if (Array.isArray(body.specifications)) {
      body.specifications.forEach(spec => {
        if (spec.key && spec.key.trim() && spec.value && spec.value.trim()) {
          specifications.push({ 
            key: spec.key.trim(), 
            value: spec.value.trim() 
          });
        }
      });
    } else if (typeof body.specifications === 'string') {
      try {
        const parsedSpecs = JSON.parse(body.specifications);
        if (Array.isArray(parsedSpecs)) {
          parsedSpecs.forEach(spec => {
            if (spec.key && spec.key.trim() && spec.value && spec.value.trim()) {
              specifications.push({ 
                key: spec.key.trim(), 
                value: spec.value.trim() 
              });
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse specifications JSON:', e);
      }
    }
  }
  
  console.log('Parsed specifications:', specifications);
  return specifications;
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
      console.log('=== CREATE PRODUCT REQUEST ===');
      console.log('Body keys:', Object.keys(req.body));
      console.log('Files:', req.files ? Object.keys(req.files) : 'none');
      
      const { 
        title, description, brand, watchShape, price, 
        modelNumber, featured, productType, gender 
      } = req.body;
      
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

      // ✅ VALIDATE PRODUCT TYPE
      if (!productType || !['watch', 'wall_clock'].includes(productType)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Valid product type is required (watch or wall_clock)' 
        });
      }

      // ✅ HANDLE GENDER BASED ON PRODUCT TYPE
      let finalGender = undefined;
      if (productType === 'watch') {
        if (!gender || !['men', 'women', 'kids', 'unisex'].includes(gender)) {
          return res.status(400).json({ 
            success: false, 
            message: 'Valid gender (men, women, kids, unisex) is required for wrist watches' 
          });
        }
        finalGender = gender;
      }

      // ✅ USE NEW HELPER FUNCTION TO PARSE COLORS
      const colors = parseColors(req.body);

      if (colors.length === 0) {
        console.error('No colors parsed from request body');
        return res.status(400).json({ 
          success: false, 
          message: 'At least one color combination is required' 
        });
      }

      // ✅ USE NEW HELPER FUNCTION TO PARSE SPECIFICATIONS
      const specifications = parseSpecifications(req.body);

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

      const productData = {
        title: title.trim(),
        description: description.trim(),
        brand: brand.trim(),
        price: price ? parseFloat(price) : null,
        modelNumber: modelNumber?.trim() || 'N/A',
        watchShape: watchShape.trim(),
        productType: productType,
        colors: colors,
        specifications: specifications,
        images: imageUrls,
        video: videoUrl,
        featured: isFeatured,
        // ✅ ONLY ADD GENDER FOR WATCHES
        ...(finalGender !== undefined && { gender: finalGender })
      };

      console.log('Creating product with data:', JSON.stringify(productData, null, 2));
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
      console.log('=== UPDATE PRODUCT REQUEST ===');
      console.log('Body keys:', Object.keys(req.body));
      
      const existingProduct = await Product.findById(req.params.id);
      if (!existingProduct) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const { 
        productType, gender, featured 
      } = req.body;
      
      // ✅ DETERMINE FINAL PRODUCT TYPE
      const finalProductType = productType || existingProduct.productType;
      if (!['watch', 'wall_clock'].includes(finalProductType)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Valid product type is required' 
        });
      }

      // ✅ HANDLE GENDER VALIDATION
      let finalGender = undefined;
      if (finalProductType === 'watch') {
        const genderVal = gender || existingProduct.gender;
        if (!genderVal || !['men', 'women', 'kids', 'unisex'].includes(genderVal)) {
          return res.status(400).json({ 
            success: false, 
            message: 'Valid gender is required for wrist watches' 
          });
        }
        finalGender = genderVal;
      }

      // ✅ USE NEW HELPER FUNCTION TO PARSE COLORS
      const colors = parseColors(req.body);

      if (colors.length === 0) {
        console.error('No colors parsed from request body');
        return res.status(400).json({ 
          success: false, 
          message: 'At least one color combination is required' 
        });
      }

      // ✅ USE NEW HELPER FUNCTION TO PARSE SPECIFICATIONS
      const specifications = parseSpecifications(req.body);

      const isFeatured = featured === 'true' || featured === true;
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

      // ✅ BUILD UPDATE DATA WITH PROPER GENDER HANDLING
      const updateData = {
        title: req.body.title?.trim() || existingProduct.title,
        description: req.body.description?.trim() || existingProduct.description,
        brand: req.body.brand?.trim() || existingProduct.brand,
        price: req.body.price ? parseFloat(req.body.price) : existingProduct.price,
        modelNumber: req.body.modelNumber?.trim() || existingProduct.modelNumber || 'N/A',
        watchShape: req.body.watchShape?.trim() || existingProduct.watchShape,
        productType: finalProductType,
        colors: colors,
        specifications: specifications,
        images: imageUrls,
        video: videoUrl,
        featured: isFeatured,
      };

      // ✅ HANDLE GENDER UPDATE BASED ON PRODUCT TYPE
      if (finalProductType === 'watch') {
        updateData.gender = finalGender;
      } else {
        // Remove gender field for wall clocks
        await Product.findByIdAndUpdate(
          req.params.id,
          { $unset: { gender: "" } },
          { new: true }
        );
      }

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      );
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