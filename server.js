// server/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path'); // ✅ Added path import 
require('dotenv').config();
const { scheduleDailyCleanup } = require('./utils/cleanup');


// ======================
// IMPORT ROUTES
// ======================
const authRoutes = require('./routes/authRoutes');
const vacancyRoutes = require('./routes/vacancyRoutes');
const messageRoutes = require('./routes/messageRoutes');
const productRoutes = require('./routes/productRoutes');
const customerRoutes = require('./routes/customerRoutes');
const cartRoutes = require('./routes/cartRoutes');
const adminRoutes = require('./routes/adminRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const adminApplicationRoutes = require('./routes/adminApplicationRoutes');
const adminProfileRoutes = require('./routes/adminProfileRoutes');
// ✅ ADD ORDER ROUTES
const orderRoutes = require('./routes/orderRoutes');

const adminOrderRoutes = require('./routes/adminOrderRoutes');

const adminInventoryRoutes = require('./routes/adminInventoryRoutes');



const app = express();

// Trust reverse proxy (Nginx on Hostinger VPS) for correct IP & protocol
app.set('trust proxy', 1);

// ======================
// SECURITY MIDDLEWARE
// ======================

// Set secure headers (allow cross-origin resource policy for media/images)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Allow frontend origins (flexible for production and development)
const allowedOrigins = [
  'https://happytimeonline.com',
  'https://www.happytimeonline.com',
  'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));

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

// ✅ SERVE STATIC FILES FROM UPLOADS DIRECTORY (Both /uploads and /api/uploads)
const staticOptions = {
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
};
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), staticOptions));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads'), staticOptions));

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
app.use('/api/orders', orderRoutes); // ✅ ADD THIS LINE
app.use('/api/admin', adminProfileRoutes);
// ✅ FIXED ROUTE REGISTRATION - Use different paths
app.use('/api/admin', adminRoutes);
app.use('/api/admin/applications', adminApplicationRoutes); // ✅ Different path

app.use('/api/admin', adminOrderRoutes);

// ✅ NEW INVENTORY ROUTES (QTY CONTROL)
app.use('/api/admin/inventory', adminInventoryRoutes);

//30days Delete rejected applications
app.get('/test-cleanup', async (req, res) => {
  const { cleanupRejectedApplications } = require('./utils/cleanup');
  try {
    const deletedCount = await cleanupRejectedApplications();
    res.json({ message: `Cleaned up ${deletedCount} applications` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create uploads directories if they don't exist
const fs = require('fs');
const uploadDirs = [
  'uploads',
  'uploads/cvs',
  'uploads/receipts',
  'uploads/products',
  'uploads/products/images',
  'uploads/products/videos',
  'uploads/products/color_images'
];
uploadDirs.forEach(dir => {
  const fullDir = path.join(__dirname, dir);
  if (!fs.existsSync(fullDir)) {
    fs.mkdirSync(fullDir, { recursive: true });
  }
});

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
        // ✅ Start daily cleanup scheduler
    scheduleDailyCleanup();
    console.log('🧹 Daily cleanup scheduled for 2 AM');

  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

startServer();