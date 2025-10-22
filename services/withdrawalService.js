const Withdrawal = require("../models/Withdrawal");
const User = require("../models/User");
const Commission = require('../models/Commission');

class WithdrawalService {
  // Create a new withdrawal request
  static async createWithdrawal(withdrawalData) {
    const session = await require('mongoose').startSession();
    session.startTransaction();
    try {
      // Check if user has sufficient balance
      const user = await User.findById(withdrawalData.userId).session(session);
      if (!user) {
        throw new Error('User not found');
      }

      // Get user's commission summary to check available balance
      const CommissionService = require('./commissionService');
      const commissionSummary = await CommissionService.getUserCommissionSummary(withdrawalData.userId);
      const availableBalance = (commissionSummary.totalAvailable || 0);

      if (withdrawalData.amount > availableBalance) {
        throw new Error('Insufficient available balance for withdrawal');
      }

      // Create withdrawal request (status pending)
      const withdrawal = new Withdrawal(withdrawalData);
      await withdrawal.save({ session });

      // Reserve actual Commission documents: pick available commissions and mark them pending
      // until we have reserved an amount >= requested amount.
      let remaining = withdrawalData.amount;
      const toReserve = [];
      // Find available commissions for this user ordered oldest first
      const availableComms = await Commission.find({ recipientId: withdrawalData.userId, status: 'available' }).session(session).sort({ createdAt: 1 });
      for (const c of availableComms) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, c.amount);
        toReserve.push({ commissionId: c._id, amount: take, fullAmount: c.amount });
        remaining -= take;
      }

      if (remaining > 0) {
        // Rollback transaction and throw
        await session.abortTransaction();
        session.endSession();
        throw new Error('Insufficient available commission documents to reserve for withdrawal');
      }

      // For each reserved commission, mark it as pending and link to withdrawal.
      for (const r of toReserve) {
        const comm = await Commission.findById(r.commissionId).session(session);
        if (!comm) continue;
        // If partial reservation (take < fullAmount), split the commission into two docs.
        if (r.amount < comm.amount) {
          const remainingAmount = comm.amount - r.amount;
          // Update the existing commission document directly (bypasses model validation)
          await Commission.updateOne({ _id: comm._id }, { $set: { amount: remainingAmount } }, { session });

          // create a reserved commission entry matching the reserved amount
          const reserved = new Commission({
            transactionId: comm.transactionId,
            recipientId: comm.recipientId,
            recipientName: comm.recipientName,
            amount: r.amount,
            percentage: comm.percentage,
            commissionType: comm.commissionType,
            status: 'pending',
            pendingWithdrawalId: withdrawal._id,
          });
          // Some legacy commission docs may miss required fields; save without strict validation to avoid failing the withdrawal
          await reserved.save({ session, validateBeforeSave: false });
        } else {
          // reserve whole commission by updating directly (bypasses validation on legacy docs)
          await Commission.updateOne({ _id: comm._id }, { $set: { status: 'pending', pendingWithdrawalId: withdrawal._id } }, { session });
        }
      }

      // Update user's commission summary - adjust totals based on actual reserved amounts
      await CommissionService.updateUserCommissionSummary(withdrawalData.userId, {
        totalAvailable: -withdrawalData.amount,
        totalPending: withdrawalData.amount
      });

      await session.commitTransaction();
      session.endSession();
      return withdrawal;
    } catch (error) {
      try { await session.abortTransaction(); } catch (e) {}
      session.endSession();
      throw error;
    }
  }

  // Get all withdrawals (for admin)
  static async getAllWithdrawals() {
    try {
      const withdrawals = await Withdrawal.find()
        .populate("userId", "name email phone")
        .populate("processedBy", "name")
        .sort({ createdAt: -1 });

      return withdrawals;
    } catch (error) {
      throw error;
    }
  }

  // Get withdrawals for a specific user
  static async getUserWithdrawals(userId) {
    try {
      const withdrawals = await Withdrawal.find({ userId })
        .populate("processedBy", "name")
        .sort({ createdAt: -1 });

      return withdrawals;
    } catch (error) {
      throw error;
    }
  }

  // Update withdrawal status (approve/reject)
  static async updateWithdrawalStatus(withdrawalId, status, adminNote, adminId) {
    try {
      const withdrawal = await Withdrawal.findById(withdrawalId);
      if (!withdrawal) {
        throw new Error("Withdrawal request not found");
      }

      if (withdrawal.status !== "pending") {
        throw new Error("Withdrawal request has already been processed");
      }

      // Update withdrawal status
      withdrawal.status = status;
      withdrawal.adminNote = adminNote || "";
      withdrawal.processedBy = adminId;
      withdrawal.processedAt = new Date();

      if (status === "approved") {
        // Generate transaction ID
        withdrawal.transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Update linked Commission documents: mark as paid
        const Commission = require('../models/Commission');
        const CommissionService = require("./commissionService");
        const linked = await Commission.find({ pendingWithdrawalId: withdrawal._id, status: 'pending' });
        let paidTotal = 0;
        for (const c of linked) {
          c.status = 'paid';
          c.paidAt = new Date();
          c.pendingWithdrawalId = undefined;
          paidTotal += c.amount;
          await c.save();
        }
        // Update user's commission summary - move from pending to paid (use actual paid total)
        await CommissionService.updateUserCommissionSummary(withdrawal.userId, {
          totalPending: -paidTotal,
          totalPaid: paidTotal
        });
      } else if (status === "rejected") {
        // If rejected, move amount back to available balance (reduce pending)
        // Find linked pending commission docs and move them back to available
  const Commission = require('../models/Commission');
  const CommissionService = require("./commissionService");
        const linked = await Commission.find({ pendingWithdrawalId: withdrawal._id, status: 'pending' });
        let restoredTotal = 0;
        for (const c of linked) {
          c.status = 'available';
          c.pendingWithdrawalId = undefined;
          restoredTotal += c.amount;
          await c.save();
        }
        await CommissionService.updateUserCommissionSummary(withdrawal.userId, {
          totalPending: -restoredTotal,
          totalAvailable: restoredTotal
        });
      }

      await withdrawal.save();

      // If approved, you might want to send notification to user
      if (status === "approved") {
        // TODO: Send email/SMS notification to user
        console.log(`Withdrawal approved for user ${withdrawal.userId}, amount: ${withdrawal.amount}`);
      }

      return withdrawal;
    } catch (error) {
      throw error;
    }
  }

  // Get withdrawal statistics
  static async getWithdrawalStats() {
    try {
      const stats = await Withdrawal.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      const formattedStats = {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        totalAmount: 0,
        pendingAmount: 0,
        approvedAmount: 0,
        rejectedAmount: 0,
      };

      stats.forEach((stat) => {
        formattedStats[stat._id] = stat.count;
        formattedStats[`${stat._id}Amount`] = stat.totalAmount;
        formattedStats.total += stat.count;
        formattedStats.totalAmount += stat.totalAmount;
      });

      return formattedStats;
    } catch (error) {
      throw error;
    }
  }

  // Get recent withdrawals
  static async getRecentWithdrawals(limit = 10) {
    try {
      const withdrawals = await Withdrawal.find()
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .limit(limit);

      return withdrawals;
    } catch (error) {
      throw error;
    }
  }

  // Get withdrawal by ID
  static async getWithdrawalById(withdrawalId) {
    try {
      const withdrawal = await Withdrawal.findById(withdrawalId)
        .populate("userId", "name email phone")
        .populate("processedBy", "name");

      return withdrawal;
    } catch (error) {
      throw error;
    }
  }

  // Validate withdrawal request
  static async validateWithdrawalRequest(withdrawalData) {
    const errors = [];

    // Check minimum amount
    if (withdrawalData.amount < 100) {
      errors.push("Minimum withdrawal amount is RS 100");
    }

    // Check payment method
    if (!["easypaisa", "jazzcash", "bank"].includes(withdrawalData.paymentMethod)) {
      errors.push("Invalid payment method");
    }

    // Check account details based on payment method
    if (withdrawalData.paymentMethod === "bank") {
      if (!withdrawalData.accountDetails?.accountNumber) {
        errors.push("Account number is required for bank transfer");
      }
      if (!withdrawalData.accountDetails?.accountTitle) {
        errors.push("Account title is required for bank transfer");
      }
      if (!withdrawalData.accountDetails?.bankName) {
        errors.push("Bank name is required for bank transfer");
      }
    } else {
      if (!withdrawalData.accountDetails?.phoneNumber) {
        errors.push("Phone number is required for mobile money transfer");
      }
    }

    return errors;
  }
}

module.exports = WithdrawalService; 