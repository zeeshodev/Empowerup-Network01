const mongoose = require("mongoose");

/**
 * Commission Schema
 * Stores commission payouts for each transaction
 */
const commissionSchema = new mongoose.Schema({
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipientName: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  commissionType: {
    type: String,
    enum: ['upliner', 'team_lead'],
    required: true
  },
  status: {
  type: String,
  enum: ['available', 'pending', 'paid', 'cancelled'],
  default: 'available'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  paidAt: {
    type: Date
  }
  ,
  // If a commission has been reserved for a withdrawal request, link it
  pendingWithdrawalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Withdrawal',
  }
}, {
  timestamps: true
});

// Index for efficient queries
commissionSchema.index({ recipientId: 1, createdAt: -1 });
commissionSchema.index({ transactionId: 1 });
commissionSchema.index({ status: 1 });
commissionSchema.index({ pendingWithdrawalId: 1 });

module.exports = mongoose.model("Commission", commissionSchema);
