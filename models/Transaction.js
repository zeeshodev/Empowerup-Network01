const mongoose = require("mongoose");

/**
 * Transaction Schema
 * Records all product/package purchases
 */
const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  productId: {
    type: String,
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  productPrice: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  referringUplinerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  referringUplinerName: {
    type: String
  },
  teamLeadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  teamLeadName: {
    type: String
  },
  transactionType: {
    type: String,
    enum: ['package_purchase', 'product_purchase', 'registration_with_package'],
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'cancelled', 'refunded'],
    default: 'completed'
  },
  commissionsGenerated: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ referringUplinerId: 1, createdAt: -1 });
transactionSchema.index({ teamLeadId: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ commissionsGenerated: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);

