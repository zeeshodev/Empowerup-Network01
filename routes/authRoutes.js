const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();

// The login route remains the same as previously discussed
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid password" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    // 🌟 UPDATED: Send back more user details for client-side storage 🌟
    // We select specific fields to avoid sending sensitive data like password
    const userToSend = {
      id: user._id,
      name: user.name,
      email: user.email,
  referralCode: user.referralCode,
      phone: user.phone,
      dob: user.dob,
      country: user.country,
      province: user.province,
      cinicNumber: user.cinicNumber,
      designation: user.designation,
      points: user.points,
      discountPercentage: user.discountPercentage,
      uplineId: user.uplineId,
      uplineName: user.uplineName,
      joinDate: user.createdAt, // createdAt field from timestamps
      packageId: user.packageId,
    };

    res.status(200).json({
      token,
      user: userToSend, // Send the detailed user object
    });
  } catch (err) {
    console.error("Login failed:", err);
    res.status(500).json({ error: "Login failed", details: err });
  }
});

module.exports = router;
