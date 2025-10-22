const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const auth = require("../middleware/auth");
const adminAuth = require("../middleware/adminAuth");
const mongoose = require("mongoose");

// Get all transactions (Admin only)
router.get("/", adminAuth, async (req, res) => {
    try {
        const { status, startDate, endDate, limit = 50, skip = 0 } = req.query;

        // Build query
        let query = {};

        if (status) {
            query.status = status;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate);
            }
        }

        const transactions = await Transaction.find(query)
            .populate('userId', 'name email')
            .populate('referringUplinerId', 'name email')
            .populate('teamLeadId', 'name email')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const totalCount = await Transaction.countDocuments(query);

        res.status(200).json({
            success: true,
            transactions,
            totalCount,
            limit: parseInt(limit),
            skip: parseInt(skip)
        });
    } catch (error) {
        console.error("Error fetching transactions:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch transactions"
        });
    }
});

// Get transaction statistics (Admin only)
router.get("/stats", adminAuth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Build date filter
        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) {
                dateFilter.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                dateFilter.createdAt.$lte = new Date(endDate);
            }
        }

        // Get total sales
        const totalSales = await Transaction.aggregate([
            { $match: { ...dateFilter, status: 'completed' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        // Get total transactions count
        const totalTransactions = await Transaction.countDocuments({
            ...dateFilter,
            status: 'completed'
        });

        // Get monthly sales for the last 6 months
        const monthlySales = await Transaction.aggregate([
            { $match: { ...dateFilter, status: 'completed' } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    total: { $sum: '$totalAmount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 6 }
        ]);

        // Get sales by transaction type
        const salesByType = await Transaction.aggregate([
            { $match: { ...dateFilter, status: 'completed' } },
            {
                $group: {
                    _id: '$transactionType',
                    total: { $sum: '$totalAmount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            stats: {
                totalSales: totalSales[0]?.total || 0,
                totalTransactions,
                monthlySales,
                salesByType
            }
        });
    } catch (error) {
        console.error("Error fetching transaction stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch transaction statistics"
        });
    }
});

// Get user's transactions
router.get("/user/:userId", auth, async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 20, skip = 0 } = req.query;

        // Check if user is requesting their own transactions or is admin
        if (req.user.id !== userId && req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        const transactions = await Transaction.find({ userId })
            .populate('referringUplinerId', 'name email')
            .populate('teamLeadId', 'name email')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));

        const totalCount = await Transaction.countDocuments({ userId });

        res.status(200).json({
            success: true,
            transactions,
            totalCount,
            limit: parseInt(limit),
            skip: parseInt(skip)
        });
    } catch (error) {
        console.error("Error fetching user transactions:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch user transactions"
        });
    }
});

// Get specific transaction details
router.get("/:transactionId", auth, async (req, res) => {
    try {
        const { transactionId } = req.params;

        const transaction = await Transaction.findById(transactionId)
            .populate('userId', 'name email')
            .populate('referringUplinerId', 'name email')
            .populate('teamLeadId', 'name email');

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }

        // Check if user has access to this transaction
        if (req.user.id !== transaction.userId.toString() && req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        res.status(200).json({
            success: true,
            transaction
        });
    } catch (error) {
        console.error("Error fetching transaction details:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch transaction details"
        });
    }
});

// TEMPORARY: Create dummy transactions for testing (remove in production)
router.post("/create-dummy", adminAuth, async (req, res) => {
    try {
        const dummyTransactions = [
            {
                userId: new mongoose.Types.ObjectId(),
                userName: "Test User 1",
                productId: "product1",
                productName: "Test Product 1",
                productPrice: 1000,
                quantity: 1,
                totalAmount: 1000,
                transactionType: "product_purchase",
                status: "completed",
                createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
            },
            {
                userId: new mongoose.Types.ObjectId(),
                userName: "Test User 2",
                productId: "product2",
                productName: "Test Product 2",
                productPrice: 2000,
                quantity: 1,
                totalAmount: 2000,
                transactionType: "product_purchase",
                status: "completed",
                createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
            },
            {
                userId: new mongoose.Types.ObjectId(),
                userName: "Test User 3",
                productId: "package1",
                productName: "Test Package 1",
                productPrice: 5000,
                quantity: 1,
                totalAmount: 5000,
                transactionType: "package_purchase",
                status: "completed",
                createdAt: new Date() // Today
            }
        ];

        const createdTransactions = await Transaction.insertMany(dummyTransactions);

        res.status(201).json({
            success: true,
            message: "Dummy transactions created successfully",
            count: createdTransactions.length
        });
    } catch (error) {
        console.error("Error creating dummy transactions:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create dummy transactions"
        });
    }
});

module.exports = router; 