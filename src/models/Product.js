const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String, // URL or path
      default: null,
    },
    amount: {
      type: Number,
      required: true,
      default: 0, // USD
    },
    cycleDays: {
      type: Number,
      required: true, // e.g. 3, 35, 40
    },
    dailyIncome: {
      type: Number,
      required: true, // USD per day
    },
    maxUnits: {
      type: Number,
      required: true,
      default: 1,
    },
    availableUnits: {
      type: Number,
      required: true,
      default: 1,
    },
    isFree: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0, // lower = shown first
    },
  },
  { timestamps: true }
);

// Virtual: is sold out
productSchema.virtual('isSoldOut').get(function () {
  return this.availableUnits <= 0;
});

// Total return over cycle
productSchema.virtual('totalReturn').get(function () {
  return +(this.dailyIncome * this.cycleDays).toFixed(4);
});

productSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);
