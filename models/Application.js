// server/models/Application.js
const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
  positionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vacancy',
    default: null
  },
  positionTitle: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  age: {
    type: Number,
    min: [18, 'Must be at least 18 years old'],
    max: [100, 'Age cannot exceed 100']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'male'
  },
  dob: {
    type: Date,
    required: true
  },
  country: {
    type: String,
    default: 'Sri Lanka'
  },
  city: {
    type: String,
    required: true
  },
  address: {
    type: String,
    default: ''
  },
  canWork9to5: {
    type: Boolean,
    default: false
  },
  yearsExperience: {
    type: String,
    required: true,
    enum: ['0-1', '1-3', '3-5', '5-10', '10+']
  },
  referenceName: {
    type: String,
    default: ''
  },
  referenceEmail: {
    type: String,
    default: ''
  },
  referenceWorkplace: {
    type: String,
    default: ''
  },
  interestedBranch: {
    type: String,
    required: true
  },
  canWorkLegally: {
    type: Boolean,
    default: false
  },
  cvFilePath: {
    type: String,
    default: ''
  },
  cvGoogleDriveLink: {
    type: String,
    default: ''
  },
  // ✅ NEW: Unique application code
  applicationCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // ✅ NEW: Applicant email for verification
  applicantEmail: {
    type: String,
    required: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'shortlisted', 'rejected', 'hired'],
    default: 'pending'
  }
}, {
  timestamps: true
});

ApplicationSchema.index(
  { "status": 1, "updatedAt": 1 }, 
  { 
    expireAfterSeconds: 30 * 24 * 60 * 60, // 30 days in seconds
    partialFilterExpression: { "status": "rejected" }
  }
);

module.exports = mongoose.model('Application', ApplicationSchema);