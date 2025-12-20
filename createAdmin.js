// server/createAdmin.js
const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

// ================================
// 🔑 CONFIGURE YOUR ADMIN CREDENTIALS HERE
// ================================
const ADMIN_CREDENTIALS = {
  username: 'admin',              // ← Change if you want (e.g., 'riza')
  email: 'happytime@happytime.lk',     // ← Use your real business email
  password: 'HappyTime@Admin.com', // ← ⚠️ CHANGE THIS TO A STRONG PASSWORD!
  role: 'admin'
};

// ================================
// 🚀 CREATE ADMIN FUNCTION
// ================================
const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingUser = await User.findOne({
      $or: [
        { username: ADMIN_CREDENTIALS.username },
        { email: ADMIN_CREDENTIALS.email }
      ]
    });

    if (existingUser) {
      console.log('⚠️  Admin user already exists!');
      console.log('   Username:', existingUser.username);
      console.log('   Email:   ', existingUser.email);
      console.log('\n💡 To reset password, use a password reset script.');
      process.exit(0);
    }

    // Create new admin → password will be auto-hashed by User schema
    const admin = await User.create(ADMIN_CREDENTIALS);

    console.log('\n🎉 SUCCESS: Admin user created!');
    console.log('   Username:', admin.username);
    console.log('   Email:   ', admin.email);
    console.log('   Role:    ', admin.role);
    console.log('\n🔑 Your password is SECURELY HASHED in the database.');
    console.log('   Use this password to log in: "' + ADMIN_CREDENTIALS.password + '"');
    console.log('\n✅ You can now log in via POST /api/auth/admin/login');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    
    if (err.code === 11000) {
      console.error('  → Duplicate key error. Check username/email uniqueness.');
    }
    
    process.exit(1);
  }
};

// Run the function
createAdmin();