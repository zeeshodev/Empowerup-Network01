const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

// Simple endpoint to verify if token is still valid
router.get("/verify-token", auth, (req, res) => {
  res.status(200).json({ 
    valid: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email
    }
  });
});

module.exports = router;
