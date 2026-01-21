// server/routes/applicationRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose'); // ✅ ADDED MONGOOSE IMPORT
const Application = require('../models/Application');

const router = express.Router();

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

// @desc    Submit job application
// @route   POST /api/applications
// @access  Public
router.post('/', upload.single('cvFile'), async (req, res) => {
  try {
    const {
      positionId: rawPositionId, // ← Get raw value
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
      cvGoogleDriveLink
    } = req.body;

    // Validation
    if (!fullName || !dob || !city || !yearsExperience || !interestedBranch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Required fields are missing' 
      });
    }

    if (!req.file && !cvGoogleDriveLink) {
      return res.status(400).json({ 
        success: false, 
        message: 'CV file or Google Drive link is required' 
      });
    }

    // ✅ Handle manual entry (empty string or "manual")
    let positionId = null;
    if (rawPositionId && rawPositionId !== 'manual' && rawPositionId !== '') {
      // Only set positionId if it's a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(rawPositionId)) {
        positionId = rawPositionId;
      }
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
      status: 'pending'
    };

    // Add CV file path if uploaded
    if (req.file) {
      applicationData.cvFilePath = req.file.path;
    }

    const application = new Application(applicationData);
    await application.save();

    res.status(201).json({ 
      success: true, 
      message: 'Application submitted successfully',
       application
    });

  } catch (err) {
    console.error('Application submission error:', err);
    
    // Clean up uploaded file if validation fails
    if (req.file) {
      const fs = require('fs');
      // ✅ Check if file exists before deleting
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

module.exports = router;