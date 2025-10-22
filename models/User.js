const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    dob: { type: Date },
    country: { type: String },
    province: { type: String },
    uplineName: {
  type: String,
  required: false,
    },
    uplineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
  default: null,
  required: false,
    },
    email: { type: String, required: true, unique: true },
  // Human-friendly short referral code (e.g. "A1B2C3") used in place of ObjectId for sharing
  referralCode: { type: String, required: true, unique: true, index: true },
    phone: { type: String },
    cinicNumber: { type: String },
    password: { type: String, required: true },
    // confirmPassword: { type: String }, // <-- Remove this line from the schema
    designation: { type: String, default: "New" },
    role: { type: String, default: "user", enum: ["user", "admin"] },
  // Points balance used across the app (kept for backward compatibility with existing routes)
  points: { type: Number, default: 0 },
  // Withdrawable balance kept separately if needed for cash withdrawals
  withdrawableBalance: { type: Number, default: 0 }, // optional: separate from points
    discountPercentage: { type: Number, default: 0, min: 0, max: 100 },
    packageId: { type: String, default: null },
  },
  { timestamps: true }

);

module.exports = mongoose.model("User", userSchema);
