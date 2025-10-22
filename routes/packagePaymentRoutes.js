const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose');
const router = express.Router();

const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const PackagePayment = require('../models/PackagePayment');
const User = require('../models/User');
const CommissionService = require('../services/commissionService');

// Reuse the same in-file packages definition from userRoutes by duplicating minimal data here
const packages = [
    { id: 'starter', name: 'Essential Starter', price: 3000, points: 3, uplinerPoints: 3, teamLeaderPoints: 3, purchaserDiscount: 3 },
    { id: 'business', name: 'Prime ', price: 5500, points: 5, uplinerPoints: 3, teamLeaderPoints: 3, purchaserDiscount: 5 },
    { id: 'empire', name: 'VIP', price: 9500, points: 7, uplinerPoints: 3, teamLeaderPoints: 3, purchaserDiscount: 8 },
    { id: 'ultimate', name: 'Supreme', price: 15000, points: 11, uplinerPoints: 3, teamLeaderPoints: 3, purchaserDiscount: 10 },
];

// Multer storage configuration
const uploadDir = path.join(process.cwd(), 'EmpowerUp-backend-main', 'uploads', 'payments');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname || '').toLowerCase();
        const base = path.basename(file.originalname || 'proof', ext).replace(/[^a-z0-9-_]/gi, '_');
        cb(null, `${Date.now()}_${base}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error('Only image files are allowed (.png, .jpg, .jpeg, .webp)'));
    cb(null, true);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Submit a package payment with proof (User)
router.post('/', auth, upload.single('proof'), async (req, res) => {
    try {
        const { packageId, paymentMethod, payerName, payerPhone } = req.body;
        const userId = req.user.id || req.user._id;

        if (!packageId || !paymentMethod) {
            return res.status(400).json({ success: false, message: 'packageId and paymentMethod are required' });
        }
        const selectedPackage = packages.find(p => p.id === packageId);
        if (!selectedPackage) {
            return res.status(400).json({ success: false, message: 'Invalid packageId' });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Payment proof image is required' });
        }

        const proofUrl = `/uploads/payments/${req.file.filename}`;

        const payment = await PackagePayment.create({
            userId,
            packageId: selectedPackage.id,
            packageName: selectedPackage.name,
            packagePrice: selectedPackage.price,
            paymentMethod,
            payerName,
            payerPhone,
            proofUrl,
            status: 'pending'
        });

        res.status(201).json({ success: true, message: 'Payment submitted, pending admin approval', payment });
    } catch (err) {
        console.error('Error submitting package payment:', err);
        res.status(500).json({ success: false, message: 'Failed to submit payment', error: err.message });
    }
});

// Get current user's payments (User)
router.get('/mine', auth, async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const { paymentId, packageId, latest } = req.query;
        const filter = { userId };
        if (paymentId && mongoose.Types.ObjectId.isValid(paymentId)) {
            filter._id = paymentId;
        }
        if (packageId) {
            filter.packageId = packageId;
        }
        let query = PackagePayment.find(filter).sort({ createdAt: -1 });
        if (latest === 'true') {
            const one = await PackagePayment.findOne(filter).sort({ createdAt: -1 });
            return res.status(200).json({ success: true, payments: one ? [one] : [] });
        }
        const payments = await query.exec();
        return res.status(200).json({ success: true, payments });
    } catch (err) {
        console.error('Error fetching user payments:', err);
        return res.status(500).json({ success: false, message: 'Failed to fetch payments' });
    }
});

// List payments (Admin)
router.get('/admin', adminAuth, async (req, res) => {
    try {
        const { status } = req.query;
        const filter = {};
        if (status) filter.status = status;
        const payments = await PackagePayment.find(filter).populate('userId', 'name email phone').sort({ createdAt: -1 });
        res.status(200).json({ success: true, payments });
    } catch (err) {
        console.error('Error fetching payments:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch payments' });
    }
});

// Approve a payment (Admin) => apply same point/discount/commission logic
router.put('/:paymentId/approve', adminAuth, async (req, res) => {
    const session = await require('mongoose').startSession();
    session.startTransaction();
    try {
        const { paymentId } = req.params;
        const { adminNote } = req.body;
        const adminId = req.user.id || req.user._id;

        if (!mongoose.Types.ObjectId.isValid(paymentId)) {
            return res.status(400).json({ success: false, message: 'Invalid payment id' });
        }

        const payment = await PackagePayment.findById(paymentId).session(session);
        if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
        if (payment.status !== 'pending' || payment.processed) {
            return res.status(400).json({ success: false, message: 'Payment already processed' });
        }

        const user = await User.findById(payment.userId).session(session);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Apply distribution via CommissionService using your existing flow
        const commissionResult = await CommissionService.processCommission({
            userId: user._id,
            productId: payment.packageId,
            productName: payment.packageName,
            productPrice: payment.packagePrice,
            transactionType: 'package_purchase',
            quantity: 1,
        });

        // Also persist points/discounts updates similar to registration purchase
        // Here we mirror minimal buyer discount logic by updating user's discountPercentage if lower
        const pkgMeta = packages.find(p => p.id === payment.packageId);
        if (pkgMeta) {
            // increment points and max discount
            await User.updateOne(
                { _id: user._id },
                { $inc: { points: pkgMeta.points }, $max: { discountPercentage: pkgMeta.purchaserDiscount } },
                { session }
            );
        }

        payment.status = 'approved';
        payment.adminNote = adminNote || '';
        payment.approvedBy = adminId;
        payment.approvedAt = new Date();
        payment.processed = true;
        await payment.save({ session });

        await session.commitTransaction();
        session.endSession();

        return res.status(200).json({ success: true, message: 'Payment approved and distribution applied', commissionResult });
    } catch (err) {
        try { await session.abortTransaction(); } catch (_) { }
        session.endSession();
        console.error('Error approving payment:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to approve payment' });
    }
});

// Reject a payment (Admin)
router.put('/:paymentId/reject', adminAuth, async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { adminNote } = req.body;

        if (!mongoose.Types.ObjectId.isValid(paymentId)) {
            return res.status(400).json({ success: false, message: 'Invalid payment id' });
        }

        const payment = await PackagePayment.findById(paymentId);
        if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });
        if (payment.status !== 'pending' || payment.processed) {
            return res.status(400).json({ success: false, message: 'Payment already processed' });
        }

        payment.status = 'rejected';
        payment.adminNote = adminNote || '';
        await payment.save();

        return res.status(200).json({ success: true, message: 'Payment rejected' });
    } catch (err) {
        console.error('Error rejecting payment:', err);
        return res.status(500).json({ success: false, message: err.message || 'Failed to reject payment' });
    }
});

module.exports = router;


