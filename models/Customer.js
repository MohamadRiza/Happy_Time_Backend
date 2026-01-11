// server/models/Customer.js
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const CustomerSchema = new mongoose.Schema({
  // Basic Information
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  dob: {
    type: Date,
    required: [true, 'Date of birth is required'],
    validate: {
      validator: function(date) {
        return date < new Date();
      },
      message: 'Date of birth must be in the past'
    }
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true
  },
  province: {
    type: String,
    required: [true, 'Province/State is required'],
    trim: true
  },
  city: {
    type: String,
    trim: true // Optional
  },
  address: {
    type: String,
    trim: true // Optional
  },
  mobileNumber: {
    type: String,
    required: [true, 'Mobile number is required'],
    trim: true,
    validate: {
      validator: function(phone) {
        return validator.isMobilePhone(phone) || phone.length >= 8;
      },
      message: 'Please provide a valid mobile number'
    }
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    validate: {
      validator: function(email) {
        return !email || validator.isEmail(email);
      },
      message: 'Please provide a valid email'
    }
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    trim: true,
    unique: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include in queries by default
  },

  // Business Information (Optional)
  businessDetails: {
    sellsWatches: {
      type: Boolean,
      default: false
    },
    hasWatchShop: {
      type: Boolean,
      default: false
    },
    shopName: {
      type: String,
      trim: true
    },
    shopAddress: {
      type: String,
      trim: true
    },
    businessType: {
      type: String,
      enum: ['retail', 'wholesale', 'independent_watchmaker', 'collector', 'other'],
      trim: true
    }
  },

  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Hash password before saving
CustomerSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
CustomerSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Customer', CustomerSchema);