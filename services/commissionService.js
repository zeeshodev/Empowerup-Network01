const mongoose = require("mongoose");
const User = require("../models/User"); // Adjust path as needed
const Transaction = require("../models/Transaction"); // Adjust path as needed
const Commission = require("../models/Commission"); // Adjust path as needed

/**
 * Commission Service
 * Handles all commission-related calculations and database operations
 */
class CommissionService {

  /**
   * Calculate and create commissions for a transaction
   * @param {Object} transactionData - Transaction details
   * @param {String} transactionData.userId - ID of the purchasing user
   * @param {String} transactionData.productId - ID of the purchased product
   * @param {String} transactionData.productName - Name of the purchased product
   * @param {Number} transactionData.productPrice - Price of the purchased product
   * @param {String} transactionData.transactionType - Type of transaction
   * @param {Number} transactionData.quantity - Quantity purchased (default: 1)
   * @returns {Object} Result object with transaction and commission details
   */
  static async processCommission(transactionData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        userId,
        productId,
        productName,
        productPrice,
        transactionType,
        quantity = 1
      } = transactionData;

      // Validate input
      if (!userId || !productId || !productName || !productPrice || !transactionType) {
        throw new Error("Missing required transaction data");
      }

      // Get the purchasing user
      const purchaser = await User.findById(userId).session(session);
      if (!purchaser) {
        throw new Error(`Purchaser with ID ${userId} not found`);
      }

      const totalAmount = productPrice * quantity;

      // Get upliner and team lead information
      let upliner = null;
      let teamLead = null;

      if (purchaser.uplineId && mongoose.Types.ObjectId.isValid(purchaser.uplineId)) {
        upliner = await User.findById(purchaser.uplineId).session(session);

        // Get team lead (upliner's upliner)
        if (upliner && upliner.uplineId && mongoose.Types.ObjectId.isValid(upliner.uplineId)) {
          teamLead = await User.findById(upliner.uplineId).session(session);
        }
      }

      // Create transaction record
      const transaction = new Transaction({
        userId: purchaser._id,
        userName: purchaser.name,
        productId,
        productName,
        productPrice,
        quantity,
        totalAmount,
        referringUplinerId: upliner ? upliner._id : null,
        referringUplinerName: upliner ? upliner.name : null,
        teamLeadId: teamLead ? teamLead._id : null,
        teamLeadName: teamLead ? teamLead.name : null,
        transactionType,
        status: 'completed',
        commissionsGenerated: true
      });

      await transaction.save({ session });

      const commissions = [];
      const commissionDetails = {
        uplinerCommission: 0,
        teamLeadCommission: 0,
        totalCommissions: 0
      };

      // Calculate and create upliner commission (15%)
      if (upliner) {
        const uplinerCommissionAmount = totalAmount * 0.15; // 15%

        const uplinerCommission = new Commission({
          transactionId: transaction._id,
          recipientId: upliner._id,
          recipientName: upliner.name,
          amount: uplinerCommissionAmount,
          percentage: 15,
          commissionType: 'upliner',
          // newly generated commissions are immediately available to the recipient
          status: 'available'
        });

        await uplinerCommission.save({ session });
        commissions.push(uplinerCommission);
        commissionDetails.uplinerCommission = uplinerCommissionAmount;

        console.log(`💰 Upliner Commission: ${upliner.name} (${upliner._id}) earned $${uplinerCommissionAmount.toFixed(2)} (15% of $${totalAmount})`);
      }

      // Calculate and create team lead commission (5%)
      if (teamLead) {
        const teamLeadCommissionAmount = totalAmount * 0.05; // 5%

        const teamLeadCommission = new Commission({
          transactionId: transaction._id,
          recipientId: teamLead._id,
          recipientName: teamLead.name,
          amount: teamLeadCommissionAmount,
          percentage: 5,
          commissionType: 'team_lead',
          // newly generated commissions are immediately available to the recipient
          status: 'available'
        });

        await teamLeadCommission.save({ session });
        commissions.push(teamLeadCommission);
        commissionDetails.teamLeadCommission = teamLeadCommissionAmount;

        console.log(`🌟 Team Lead Commission: ${teamLead.name} (${teamLead._id}) earned $${teamLeadCommissionAmount.toFixed(2)} (5% of $${totalAmount})`);
      }

      commissionDetails.totalCommissions = commissionDetails.uplinerCommission + commissionDetails.teamLeadCommission;

      await session.commitTransaction();

      return {
        success: true,
        transaction,
        commissions,
        commissionDetails,
        message: `Transaction processed successfully. Total commissions: $${commissionDetails.totalCommissions.toFixed(2)}`
      };

    } catch (error) {
      await session.abortTransaction();
      console.error("❌ Commission processing failed:", error.message);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get commission history for a specific user
   * @param {String} userId - User ID
   * @param {Object} options - Query options (limit, skip, status)
   * @returns {Array} Array of commission records
   */
  static async getUserCommissions(userId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        status = null,
        startDate = null,
        endDate = null
      } = options;

      const query = { recipientId: userId };

      if (status) {
        query.status = status;
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const commissions = await Commission.find(query)
        .populate('transactionId', 'productName productPrice totalAmount transactionType createdAt')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip);

      return commissions;
    } catch (error) {
      console.error("❌ Failed to fetch user commissions:", error.message);
      throw error;
    }
  }

  /**
   * Get commission summary for a user
   * @param {String} userId - User ID
   * @returns {Object} Commission summary
   */
  static async getUserCommissionSummary(userId) {
    try {
      // Defensive: if userId is missing or invalid, return zeroed summary instead of throwing
      if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
        return {
          totalEarned: 0,
          totalPending: 0,
          totalPaid: 0,
          totalAvailable: 0,
          totalCommissions: 0,
          uplinerCommissions: 0,
          teamLeadCommissions: 0
        };
      }

      const summary = await Commission.aggregate([
        { $match: { recipientId: new mongoose.Types.ObjectId(String(userId)) } },
        {
          $group: {
            _id: null,
            totalEarned: { $sum: "$amount" },
            totalPending: {
              $sum: {
                $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0]
              }
            },
            totalPaid: {
              $sum: {
                $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0]
              }
            },
            totalAvailable: {
              $sum: {
                $cond: [{ $eq: ["$status", "available"] }, "$amount", 0]
              }
            },
            totalCommissions: { $sum: 1 },
            uplinerCommissions: {
              $sum: {
                $cond: [{ $eq: ["$commissionType", "upliner"] }, 1, 0]
              }
            },
            teamLeadCommissions: {
              $sum: {
                $cond: [{ $eq: ["$commissionType", "team_lead"] }, 1, 0]
              }
            }
          }
        }
      ]);

      return summary.length > 0 ? summary[0] : {
        totalEarned: 0,
        totalPending: 0,
        totalPaid: 0,
        totalAvailable: 0,
        totalCommissions: 0,
        uplinerCommissions: 0,
        teamLeadCommissions: 0
      };
    } catch (error) {
      console.error("❌ Failed to fetch commission summary:", error.message);
      throw error;
    }
  }

  /**
   * Mark commissions as paid
   * @param {Array} commissionIds - Array of commission IDs to mark as paid
   * @returns {Object} Update result
   */
  static async markCommissionsAsPaid(commissionIds) {
    try {
      const result = await Commission.updateMany(
        {
          _id: { $in: commissionIds },
          status: 'pending'
        },
        {
          status: 'paid',
          paidAt: new Date()
        }
      );

      return {
        success: true,
        modifiedCount: result.modifiedCount,
        message: `${result.modifiedCount} commissions marked as paid`
      };
    } catch (error) {
      console.error("❌ Failed to mark commissions as paid:", error.message);
      throw error;
    }
  }

  // Update user commission summary
  static async updateUserCommissionSummary(userId, updates) {
    // NOTE: The code previously attempted to persist a commission summary by
    // writing into the `Commission` collection, which caused Mongoose model
    // validation errors for legacy commission documents. Commission summaries
    // are computed via aggregation (getUserCommissionSummary). To avoid
    // validation and data-model conflicts, this function is now a safe no-op
    // that logs the requested deltas and returns a simple result. If you want
    // a persisted summary, create a separate `CommissionSummary` model and
    // update it here instead.
    try {
      console.log(`updateUserCommissionSummary called for ${userId} with`, updates);
      return { success: true };
    } catch (error) {
      console.error("Error in updateUserCommissionSummary (noop):", error);
      throw error;
    }
  }
}

module.exports = CommissionService;
