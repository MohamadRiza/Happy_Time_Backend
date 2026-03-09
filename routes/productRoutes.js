const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// Helper: Count words (handles extra spaces, newlines)
const countWords = (str) => {
  if (!str || typeof str !== 'string') return 0;
  return str.trim().split(/\s+/).filter(word => word.length > 0).length;
};

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
// Accepts: images (up to 15), videos (up to 2), colorImage_0..colorImage_19 (one per color)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 37
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'), false);
    }
  }
});

// Multer error handler
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum file size is 20MB.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files.'
      });
    }
  }
  console.error('Request error:', err);
  res.status(500).json({ success: false, message: 'Server error' });
};

// Helper: Validate featured products limit
const validateFeaturedLimit = async (isFeatured, editingId = null) => {
  if (isFeatured) {
    const featuredCount = await Product.countDocuments({ featured: true });
    const currentProductIsFeatured = editingId 
      ? await Product.findById(editingId).select('featured')
      : null;
    const countToCheck = currentProductIsFeatured && currentProductIsFeatured.featured 
      ? featuredCount - 1 
      : featuredCount;
    if (countToCheck >= 6) {
      throw new Error('Maximum 6 featured products allowed');
    }
  }
};

// Helper: Parse colors from req.body
const parseColors = (body) => {
  const colors = [];
  let colorIndex = 0;
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
      colors.push({ name: name.trim(), quantity, colorImage: null }); // colorImage filled later
    }
    colorIndex++;
  }
  if (colors.length === 0 && body.colors) {
    if (Array.isArray(body.colors)) {
      body.colors.forEach(color => {
        if (color.name && typeof color.name === 'string' && color.name.trim()) {
          const quantity = color.quantity && !isNaN(color.quantity) 
            ? parseInt(color.quantity) 
            : null;
          colors.push({ name: color.name.trim(), quantity, colorImage: null });
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
              colors.push({ name: color.name.trim(), quantity, colorImage: null });
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse colors JSON:', e);
      }
    }
  }
  return colors;
};

// Helper: Parse specifications from req.body
const parseSpecifications = (body) => {
  const specifications = [];
  let specIndex = 0;
  while (body[`specifications[${specIndex}][key]`] !== undefined && 
         body[`specifications[${specIndex}][value]`] !== undefined) {
    const key = body[`specifications[${specIndex}][key]`];
    const value = body[`specifications[${specIndex}][value]`];
    if (key && typeof key === 'string' && key.trim() && 
        value && typeof value === 'string' && value.trim()) {
      specifications.push({ key: key.trim(), value: value.trim() });
    }
    specIndex++;
  }
  if (specifications.length === 0 && body.specifications) {
    if (Array.isArray(body.specifications)) {
      body.specifications.forEach(spec => {
        if (spec.key && spec.key.trim() && spec.value && spec.value.trim()) {
          specifications.push({ key: spec.key.trim(), value: spec.value.trim() });
        }
      });
    } else if (typeof body.specifications === 'string') {
      try {
        const parsedSpecs = JSON.parse(body.specifications);
        if (Array.isArray(parsedSpecs)) {
          parsedSpecs.forEach(spec => {
            if (spec.key && spec.key.trim() && spec.value && spec.value.trim()) {
              specifications.push({ key: spec.key.trim(), value: spec.value.trim() });
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse specifications JSON:', e);
      }
    }
  }
  return specifications;
};

// Helper to parse warranty from req.body
const parseWarranty = (body) => {
  const duration = body.warrantyDuration;
  const description = body.warrantyDescription?.trim() || '';
  const validDurations = ['1year', '3months', '6months', '2years', 'nowarranty'];
  const finalDuration = validDurations.includes(duration) ? duration : 'nowarranty';
  return {
    duration: finalDuration,
    description: finalDuration === 'nowarranty' ? '' : description.slice(0, 200)
  };
};

// Upload helper
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

// Public routes
router.get('/', async (req, res) => {
  try {
    const products = await Product.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (err) {
    console.error('Fetch public products error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/featured', async (req, res) => {
  try {
    const products = await Product.find({ 
      status: 'active', 
      featured: true 
    }).sort({ createdAt: -1 }).limit(6);
    res.json({ success: true, products });
  } catch (err) {
    console.error('Fetch featured products error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/admin', protect, admin, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (err) {
    console.error('Fetch admin products error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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

// CREATE PRODUCT
router.post(
  '/',
  protect,
  admin,
  upload.fields([
    { name: 'images', maxCount: 15 },
    { name: 'videos', maxCount: 2 },
    // colorImage_0 through colorImage_19 — one field per color slot
    ...Array.from({ length: 20 }, (_, i) => ({ name: `colorImage_${i}`, maxCount: 1 }))
  ]),
  handleMulterError,
  async (req, res) => {
    try {
      const { 
        title, description, brand, watchShape, price, 
        modelNumber, featured, productType, gender 
      } = req.body;

      // Price: max 10 digits
      if (price !== undefined && price !== '') {
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum < 0) {
          return res.status(400).json({ success: false, message: 'Price must be a valid non-negative number' });
        }
        if (priceNum.toString().length > 10) {
          return res.status(400).json({ success: false, message: 'Price cannot exceed 10 digits (max: 9,999,999,999)' });
        }
      }

      // Model Number: max 20 chars
      if (modelNumber && modelNumber.trim().length > 20) {
        return res.status(400).json({ success: false, message: 'Model number cannot exceed 20 characters' });
      }

      // Description: max 200 words
      if (description && countWords(description) > 200) {
        return res.status(400).json({ success: false, message: 'Description cannot exceed 200 words' });
      }

      if (!title?.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
      if (!description?.trim()) return res.status(400).json({ success: false, message: 'Description is required' });
      if (!brand?.trim()) return res.status(400).json({ success: false, message: 'Brand is required' });
      if (!watchShape?.trim()) return res.status(400).json({ success: false, message: 'Watch shape is required' });

      if (!productType || !['watch', 'wall_clock'].includes(productType)) {
        return res.status(400).json({ success: false, message: 'Valid product type is required' });
      }

      let finalGender = undefined;
      if (productType === 'watch') {
        if (!gender || !['men', 'women', 'kids', 'unisex'].includes(gender)) {
          return res.status(400).json({ success: false, message: 'Valid gender is required for wrist watches' });
        }
        finalGender = gender;
      }

      const colors = parseColors(req.body);
      if (colors.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one color combination is required' });
      }

      const specifications = parseSpecifications(req.body);
      const warranty = parseWarranty(req.body);

      const isFeatured = featured === 'true' || featured === true;
      await validateFeaturedLimit(isFeatured);

      // Upload main images
      const imagePromises = (req.files?.images || []).map(file => 
        uploadToCloudinary(file, 'happy_time/products/images')
      );
      const imageUrls = await Promise.all(imagePromises);

      if (imageUrls.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one image is required' });
      }

      // Upload videos
      let videoUrls = [];
      if (req.files?.videos && req.files.videos.length > 0) {
        const videoPromises = req.files.videos.map(file =>
          uploadToCloudinary(file, 'happy_time/products/videos')
        );
        videoUrls = await Promise.all(videoPromises);
      }

      // Upload per-color images — each color slot uses field name "colorImage_{index}"
      const colorImageMap = {}; // colorIndex -> cloudinary url
      for (let i = 0; i < colors.length; i++) {
        const fieldName = `colorImage_${i}`;
        const fileArr = req.files?.[fieldName];
        if (fileArr && fileArr.length > 0) {
          const url = await uploadToCloudinary(fileArr[0], 'happy_time/products/color_images');
          colorImageMap[i] = url;
        }
      }

      // Attach colorImage URLs to colors
      colors.forEach((color, idx) => {
        if (colorImageMap[idx]) {
          color.colorImage = colorImageMap[idx];
        } else {
          // Existing URL kept from edit (sent as plain text field colorImageUrl_N)
          const existingUrl = req.body[`colorImageUrl_${idx}`];
          color.colorImage = existingUrl || null;
        }
      });

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
        videos: videoUrls,
        featured: isFeatured,
        warranty: warranty,
        ...(finalGender !== undefined && { gender: finalGender })
      };

      const product = await Product.create(productData);
      res.status(201).json({ success: true, product });
    } catch (err) {
      console.error('Product creation error:', err);
      if (err.message?.includes('Cloudinary upload failed')) {
        return res.status(500).json({ success: false, message: 'Failed to upload media files' });
      }
      if (err.message?.includes('Maximum 4 featured products allowed')) {
        return res.status(400).json({ success: false, message: 'Maximum 4 featured products allowed' });
      }
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// UPDATE PRODUCT
router.put(
  '/:id',
  protect,
  admin,
  upload.fields([
    { name: 'images', maxCount: 15 },
    { name: 'videos', maxCount: 2 },
    ...Array.from({ length: 20 }, (_, i) => ({ name: `colorImage_${i}`, maxCount: 1 }))
  ]),
  handleMulterError,
  async (req, res) => {
    try {
      const existingProduct = await Product.findById(req.params.id);
      if (!existingProduct) {
        return res.status(404).json({ success: false, message: 'Product not found' });
      }

      const { productType, gender, featured, price, modelNumber, description } = req.body;

      if (price !== undefined && price !== '') {
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum < 0) {
          return res.status(400).json({ success: false, message: 'Price must be a valid non-negative number' });
        }
        if (priceNum.toString().length > 10) {
          return res.status(400).json({ success: false, message: 'Price cannot exceed 10 digits (max: 9,999,999,999)' });
        }
      }

      if (modelNumber && modelNumber.trim().length > 20) {
        return res.status(400).json({ success: false, message: 'Model number cannot exceed 20 characters' });
      }

      if (description && countWords(description) > 200) {
        return res.status(400).json({ success: false, message: 'Description cannot exceed 200 words' });
      }

      const finalProductType = productType || existingProduct.productType;
      if (!['watch', 'wall_clock'].includes(finalProductType)) {
        return res.status(400).json({ success: false, message: 'Valid product type is required' });
      }

      let finalGender = undefined;
      if (finalProductType === 'watch') {
        const genderVal = gender || existingProduct.gender;
        if (!genderVal || !['men', 'women', 'kids', 'unisex'].includes(genderVal)) {
          return res.status(400).json({ success: false, message: 'Valid gender is required for wrist watches' });
        }
        finalGender = genderVal;
      }

      const colors = parseColors(req.body);
      if (colors.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one color combination is required' });
      }

      const specifications = parseSpecifications(req.body);
      const warranty = parseWarranty(req.body);

      const isFeatured = featured === 'true' || featured === true;
      await validateFeaturedLimit(isFeatured, req.params.id);

      // Main images
      let imageUrls = existingProduct.images;
      if (req.files?.images && req.files.images.length > 0) {
        const newImagePromises = req.files.images.map(file => 
          uploadToCloudinary(file, 'happy_time/products/images')
        );
        imageUrls = await Promise.all(newImagePromises);
      }

      // Videos
      let videoUrls = existingProduct.videos;
      if (req.files?.videos && req.files.videos.length > 0) {
        const videoPromises = req.files.videos.map(file =>
          uploadToCloudinary(file, 'happy_time/products/videos')
        );
        videoUrls = await Promise.all(videoPromises);
      }

      // Per-color images — field name "colorImage_{index}" per color slot
      const colorImageMap = {};
      for (let i = 0; i < colors.length; i++) {
        const fieldName = `colorImage_${i}`;
        const fileArr = req.files?.[fieldName];
        if (fileArr && fileArr.length > 0) {
          const url = await uploadToCloudinary(fileArr[0], 'happy_time/products/color_images');
          colorImageMap[i] = url;
        }
      }

      // Attach colorImage URLs to colors (new upload or existing URL kept from frontend)
      colors.forEach((color, idx) => {
        if (colorImageMap[idx]) {
          color.colorImage = colorImageMap[idx];
        } else {
          // Existing URL passed from frontend as plain text field colorImageUrl_N
          const existingUrl = req.body[`colorImageUrl_${idx}`];
          color.colorImage = existingUrl || null;
        }
      });

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
        videos: videoUrls,
        featured: isFeatured,
        warranty: warranty
      };

      if (finalProductType === 'watch') {
        updateData.gender = finalGender;
      } else {
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
      if (err.message?.includes('Cloudinary upload failed')) {
        return res.status(500).json({ success: false, message: 'Failed to upload media files' });
      }
      if (err.message?.includes('Maximum 4 featured products allowed')) {
        return res.status(400).json({ success: false, message: 'Maximum 4 featured products allowed' });
      }
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// DELETE PRODUCT
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