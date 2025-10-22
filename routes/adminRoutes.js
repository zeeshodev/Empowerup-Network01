const express = require("express");
const router = express.Router();
const Admin = require("../models/Admin");
const jwt = require("jsonwebtoken");
const adminAuth = require("../middleware/adminAuth");

// Admin Registration (for initial setup)
router.post("/register", async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        // Validate input
        if (!name || !email || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: "Admin with this email already exists"
            });
        }

        // Create new admin
        const admin = new Admin({
            name,
            email,
            password
        });

        await admin.save();

        // Generate JWT token
        const token = jwt.sign(
            { adminId: admin._id, email: admin.email, role: admin.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            success: true,
            message: "Admin registered successfully",
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            },
            token
        });

    } catch (error) {
        console.error("Admin registration error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

// Admin Login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // Find admin by email
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Check if admin is active
        if (!admin.isActive) {
            return res.status(401).json({
                success: false,
                message: "Account is deactivated"
            });
        }

        // Verify password
        const isPasswordValid = await admin.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // Update last login
        admin.lastLogin = new Date();
        await admin.save();

        // Generate JWT token
        const token = jwt.sign(
            { adminId: admin._id, email: admin.email, role: admin.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(200).json({
            success: true,
            message: "Admin logged in successfully",
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            },
            token
        });

    } catch (error) {
        console.error("Admin login error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

// Get admin profile (protected route)
router.get("/profile", adminAuth, async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin.adminId).select("-password");

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        res.status(200).json({
            success: true,
            admin
        });

    } catch (error) {
        console.error("Get admin profile error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

// Update admin profile (protected route)
router.put("/profile", adminAuth, async (req, res) => {
    try {
        const { name, email } = req.body;

        const admin = await Admin.findById(req.admin.adminId);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        // Update fields
        if (name) admin.name = name;
        if (email) {
            // Check if email is already taken by another admin
            const existingAdmin = await Admin.findOne({ email, _id: { $ne: admin._id } });
            if (existingAdmin) {
                return res.status(400).json({
                    success: false,
                    message: "Email is already taken"
                });
            }
            admin.email = email;
        }

        await admin.save();

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            }
        });

    } catch (error) {
        console.error("Update admin profile error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

// Change admin password (protected route)
router.put("/change-password", adminAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "All password fields are required"
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "New passwords do not match"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        const admin = await Admin.findById(req.admin.adminId);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await admin.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        // Update password
        admin.password = newPassword;
        await admin.save();

        res.status(200).json({
            success: true,
            message: "Password changed successfully"
        });

    } catch (error) {
        console.error("Change admin password error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

// Get all admins (super admin only)
router.get("/all", adminAuth, async (req, res) => {
    try {
        // Check if current admin is super admin
        if (req.admin.role !== "super_admin") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Super admin privileges required."
            });
        }

        const admins = await Admin.find().select("-password");

        res.status(200).json({
            success: true,
            admins
        });

    } catch (error) {
        console.error("Get all admins error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

module.exports = router; 