// server/routes/vacancyRoutes.js
const express = require('express');
const Vacancy = require('../models/Vacancy');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// @desc    Get all vacancies (for public careers page)
// @route   GET /api/vacancies
// @access  Public
router.get('/', async (req, res) => {
  try {
    const vacancies = await Vacancy.find({ status: 'active' }).sort({ createdAt: -1 });
    res.json({ success: true, data: vacancies });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Create new vacancy
// @route   POST /api/vacancies
// @access  Admin only
router.post('/', protect, admin, async (req, res) => {
  try {
    const vacancy = await Vacancy.create(req.body);
    res.status(201).json({ success: true, data: vacancy });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, errors });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ✅ FIXED: Public route to get SINGLE vacancy (for /careers/:id)
// @desc    Get single vacancy by ID (public, active only)
// @route   GET /api/vacancies/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const vacancy = await Vacancy.findOne({
      _id: req.params.id,
      status: 'active' // Only show active vacancies to public
    });

    if (!vacancy) {
      return res.status(404).json({
        success: false,
        message: 'Vacancy not found or not currently open'
      });
    }

    res.json({ success: true, data: vacancy });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Update vacancy
// @route   PUT /api/vacancies/:id
// @access  Admin only
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const vacancy = await Vacancy.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!vacancy) {
      return res.status(404).json({ success: false, message: 'Vacancy not found' });
    }
    res.json({ success: true, data: vacancy });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, errors });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Delete vacancy
// @route   DELETE /api/vacancies/:id
// @access  Admin only
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const vacancy = await Vacancy.findByIdAndDelete(req.params.id);
    if (!vacancy) {
      return res.status(404).json({ success: false, message: 'Vacancy not found' });
    }
    res.json({ success: true, message: 'Vacancy deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;