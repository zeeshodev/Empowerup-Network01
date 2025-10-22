const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const WithdrawalService = require('../services/withdrawalService');
const CommissionService = require('../services/commissionService');
const Withdrawal = require('../models/Withdrawal');

// Create withdrawal request (User)
router.post('/request', auth, async (req, res) => {
    try {
        const { amount, paymentMethod, accountDetails } = req.body;
        const userId = req.user.id || req.user._id;

        if (!amount || amount < 100) {
            return res.status(400).json({ success: false, message: 'Minimum withdrawal amount is 100.' });
        }

        // Authoritative available balance comes from commission summary
        const summary = await CommissionService.getUserCommissionSummary(userId);
        const available = summary.totalAvailable || 0;

        if (amount > available) {
            return res.status(400).json({ success: false, message: 'Insufficient available commission balance for withdrawal' });
        }

        const withdrawal = await WithdrawalService.createWithdrawal({
            userId,
            amount,
            paymentMethod,
            accountDetails,
            status: 'pending',
        });

        res.status(201).json({ success: true, message: 'Withdrawal request submitted successfully', withdrawal });
    } catch (error) {
        console.error('Error creating withdrawal request:', error);
        res.status(500).json({ success: false, message: 'Failed to submit withdrawal request', error: error.message });
    }
});

// Get user's withdrawal history (User)
router.get('/user/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;
        const withdrawals = await WithdrawalService.getUserWithdrawals(userId);
        res.status(200).json({ success: true, withdrawals });
    } catch (error) {
        console.error('Error fetching user withdrawals:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user withdrawals' });
    }
});

// Get all withdrawals (Admin only)
router.get('/all', adminAuth, async (req, res) => {
    try {
        const withdrawals = await WithdrawalService.getAllWithdrawals();
        res.status(200).json({ success: true, withdrawals });
    } catch (error) {
        console.error('Error fetching all withdrawals:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch withdrawals' });
    }
});

// Update withdrawal status (Admin only)
router.put('/:withdrawalId/status', adminAuth, async (req, res) => {
    try {
        const { withdrawalId } = req.params;
        const { status, adminNote } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status. Must be 'approved' or 'rejected'" });
        }

        const withdrawal = await WithdrawalService.updateWithdrawalStatus(withdrawalId, status, adminNote, req.user.id || req.user._id);

        res.status(200).json({ success: true, message: `Withdrawal ${status} successfully`, withdrawal });
    } catch (error) {
        console.error('Error updating withdrawal status:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to update withdrawal status' });
    }
});

// Get withdrawal statistics (Admin only)
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const stats = await WithdrawalService.getWithdrawalStats();
        res.status(200).json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching withdrawal stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch withdrawal statistics' });
    }
});

// Get recent withdrawals (Admin only)
router.get('/recent', adminAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const withdrawals = await WithdrawalService.getRecentWithdrawals(limit);
        res.status(200).json({ success: true, withdrawals });
    } catch (error) {
        console.error('Error fetching recent withdrawals:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch recent withdrawals' });
    }
});

// Get specific withdrawal details (Admin only)
router.get('/:withdrawalId', adminAuth, async (req, res) => {
    try {
        const { withdrawalId } = req.params;
        const withdrawal = await WithdrawalService.getWithdrawalById(withdrawalId);
        if (!withdrawal) return res.status(404).json({ success: false, message: 'Withdrawal not found' });
        res.status(200).json({ success: true, withdrawal });
    } catch (error) {
        console.error('Error fetching withdrawal details:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch withdrawal details' });
    }
});

module.exports = router;