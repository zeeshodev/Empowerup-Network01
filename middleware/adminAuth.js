const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.adminId);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Admin not found.",
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Account is deactivated.",
      });
    }

    // Attach both the found admin document and a lightweight `user` object so
    // existing routes that expect `req.user` work (they access `req.user.id`)
    req.admin = admin;
    try {
      // prefer explicit id fields to match other middleware shape
      req.user = { id: admin._id.toString(), _id: admin._id.toString(), role: 'admin' };
    } catch (e) {
      // fallback: if admin is not present for any reason, still set decoded payload
      req.user = decoded || {};
    }
    next();
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(401).json({
      success: false,
      message: "Access denied. Invalid token.",
    });
  }
};

module.exports = adminAuth; 