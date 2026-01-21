// server/routes/applicationRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const Application = require('../models/Application');

// ✅ MUST DECLARE ROUTER BEFORE USING IT
const router = express.Router(); // ← This line was missing or in wrong place!

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/cvs/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|doc|docx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF and Word documents are allowed!'));
    }
  }
});

// Helper function to generate application code
const generateApplicationCode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `HT-${timestamp}-${random}`;
};

// @desc    Submit job application
// @route   POST /api/applications
// @access  Public
router.post('/', upload.single('cvFile'), async (req, res) => {
  try {
    const {
      positionId: rawPositionId,
      positionTitle,
      fullName,
      age,
      gender,
      dob,
      country,
      city,
      address,
      canWork9to5,
      yearsExperience,
      referenceName,
      referenceEmail,
      referenceWorkplace,
      interestedBranch,
      canWorkLegally,
      cvGoogleDriveLink,
      applicantEmail // ✅ Include applicant email
    } = req.body;

    // Validation
    if (!fullName || !dob || !city || !yearsExperience || !interestedBranch || !applicantEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Required fields are missing' 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(applicantEmail)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid email address' 
      });
    }

    if (!req.file && !cvGoogleDriveLink) {
      return res.status(400).json({ 
        success: false, 
        message: 'CV file or Google Drive link is required' 
      });
    }

    // Handle positionId
    let positionId = null;
    if (rawPositionId && rawPositionId !== 'manual' && rawPositionId !== '') {
      if (mongoose.Types.ObjectId.isValid(rawPositionId)) {
        positionId = rawPositionId;
      }
    }

    // Generate unique application code
    let applicationCode;
    let codeExists = true;
    while (codeExists) {
      applicationCode = generateApplicationCode();
      const existing = await Application.findOne({ applicationCode });
      codeExists = !!existing;
    }

    const applicationData = {
      positionId,
      positionTitle: positionTitle?.trim() || 'General Application',
      fullName,
      age: age || null,
      gender,
      dob,
      country,
      city,
      address: address || '',
      canWork9to5: canWork9to5 === 'true' || canWork9to5 === true,
      yearsExperience,
      referenceName: referenceName || '',
      referenceEmail: referenceEmail || '',
      referenceWorkplace: referenceWorkplace || '',
      interestedBranch,
      canWorkLegally: canWorkLegally === 'true' || canWorkLegally === true,
      cvGoogleDriveLink: cvGoogleDriveLink || '',
      applicantEmail, // ✅ Store applicant email
      applicationCode, // ✅ Store application code
      status: 'pending'
    };

    if (req.file) {
      applicationData.cvFilePath = req.file.path;
    }

    const application = new Application(applicationData);
    await application.save();

    res.status(201).json({ 
      success: true, 
      message: 'Application submitted successfully',
      data: {
        applicationCode,
        applicantEmail
      }
    });

  } catch (err) {
    console.error('Application submission error:', err);
    
    if (req.file) {
      const fs = require('fs');
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again.' 
    });
  }
});

// @desc    Check application status
// @route   POST /api/applications/check-status
// @access  Public
router.post('/check-status', async (req, res) => {
  try {
    const { applicationCode, email } = req.body;

    if (!applicationCode || !email) {
      return res.status(400).json({
        success: false,
        message: 'Application code and email are required'
      });
    }

    const application = await Application.findOne({
      applicationCode: applicationCode.trim().toUpperCase(),
      applicantEmail: email.trim().toLowerCase()
    }).select('-cvFilePath -cvGoogleDriveLink -__v');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found. Please check your code and email.'
      });
    }

    // Mask sensitive information
    const safeApplication = {
      ...application.toObject(),
      applicantEmail: application.applicantEmail.replace(/(.{2}).+(@.*)/, '$1***$2'),
      fullName: application.fullName,
      positionTitle: application.positionTitle,
      status: application.status,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt
    };

    res.json({
      success: true,
      data: safeApplication
    });

  } catch (err) {
    console.error('Check status error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
});

module.exports = router;