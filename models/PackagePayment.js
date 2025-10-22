const mongoose = require('mongoose');

const packagePaymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    packageId: { type: String, required: true },
    packageName: { type: String, required: true },
    packagePrice: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['jazzcash', 'bank'], required: true },
    payerName: { type: String },
    payerPhone: { type: String },
    proofUrl: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNote: { type: String },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    approvedAt: { type: Date },
    processed: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('PackagePayment', packagePaymentSchema);


