const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 100, // Minimum withdrawal amount
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["easypaisa", "jazzcash", "bank"],
    },
    accountDetails: {
      accountNumber: String,
      accountTitle: String,
      bankName: String,
      phoneNumber: String,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminNote: {
      type: String,
      default: "",
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin", // Changed from "User" to "Admin"
    },
    processedAt: {
      type: Date,
    },
    transactionId: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
withdrawalSchema.index({ userId: 1, status: 1 });
withdrawalSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Withdrawal", withdrawalSchema); 