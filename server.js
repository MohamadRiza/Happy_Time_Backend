// server/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path'); // ✅ Added path import
require('dotenv').config();

// ======================
// IMPORT ROUTES
// ======================
const authRoutes = require('./routes/authRoutes');
const vacancyRoutes = require('./routes/vacancyRoutes');
const messageRoutes = require('./routes/messageRoutes');
const productRoutes = require('./routes/productRoutes');
const cloudinary = require('./config/cloudinary');
const customerRoutes = require('./routes/customerRoutes');
const cartRoutes = require('./routes/cartRoutes');
const adminRoutes = require('./routes/adminRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const adminApplicationRoutes = require('./routes/adminApplicationRoutes');

const app = express();

// ======================
// SECURITY MIDDLEWARE
// ======================

// Set secure headers
app.use(helmet());

// Allow frontend origin (from .env for flexibility)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({ origin: FRONTEND_URL, credentials: true }));

// Rate limiting for auth routes (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

// Body parser (increase limit for future image uploads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ SERVE STATIC FILES FROM UPLOADS DIRECTORY
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ======================
// ROUTES
// ======================
app.use('/api/auth', authRoutes);
app.use('/api/vacancies', vacancyRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/applications', applicationRoutes);

// ✅ FIXED ROUTE REGISTRATION - Use different paths
app.use('/api/admin', adminRoutes);
app.use('/api/admin/applications', adminApplicationRoutes); // ✅ Different path

// Create uploads directory
const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
if (!fs.existsSync('uploads/cvs')) {
  fs.mkdirSync('uploads/cvs');
}

// ======================
// GLOBAL ERROR HANDLING
// ======================
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler (for async errors)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  });
});

// ======================
// DATABASE & SERVER
// ======================
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully');

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);
    });
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

startServer();