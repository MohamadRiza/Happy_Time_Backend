// server/models/InventorySettings.js | QTY Management 
const mongoose = require('mongoose');

const InventorySettingsSchema = new mongoose.Schema({
  lowStockThreshold: {
    type: Number,
    default: 10,
    min: 1,
    max: 100
  },
  outOfStockThreshold: {
    type: Number,
    default: 0,
    min: 0,
    max: 10
  },
  alertEmails: [{
    type: String,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  }],
  enabled: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('InventorySettings', InventorySettingsSchema);