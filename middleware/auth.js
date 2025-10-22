const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Invalid authorization header.",
      });
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token.",
      });
    }

    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format.",
      });
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Access denied. User not found.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth error:", error);
    res.status(401).json({
      success: false,
      message: "Access denied. Invalid token.",
    });
  }
};

module.exports = auth; 