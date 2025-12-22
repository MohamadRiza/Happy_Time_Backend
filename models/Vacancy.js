// server/models/Vacancy.js
const mongoose = require('mongoose');

const VacancySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
  },
  salary: {
    type: String,
    required: [true, 'Salary info is required'],
    trim: true, // e.g., "LKR 120,000 – 150,000" or "Negotiable"
  },
  shift: {
    type: String,
    required: [true, 'Working hours/shift is required'],
    trim: true, // e.g., "9:00 AM – 6:00 PM, Mon–Sat"
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    default: 'Sri Lanka',
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  }
}, {
  timestamps: true, // Adds createdAt, updatedAt
});

module.exports = mongoose.model('Vacancy', VacancySchema);