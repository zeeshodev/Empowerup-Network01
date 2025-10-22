const express = require("express");
const router = express.Router();
const User = require("../models/User");
const crypto = require('crypto');
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { sendWelcomeEmail } = require("../utils/emailSender");

// FIXED: Correct import path for CommissionService
const CommissionService = require("../services/commissionService");

// Designation calculation logic (remains the same)
function calculateDesignation(points) {
  // if (points >= 6000) return "Diamond";
  if (points >= 3000) return "Diamond";
  if (points >= 1500) return "Paltinum";
  if (points >= 500) return "Gold";
  if (points >= 100) return "Silver";
  return "Bronze";
}

// Conceptual Package data (in a real app, this would be in a separate model/DB)
const packages = [
  {
    id: "starter",
    name: "Essential Starter",
    price: 3000,
    points: 3,
    discount: 3,
    uplinerPoints: 3,
    teamLeaderPoints: 3,
    purchaserDiscount: 3,
  },
  {
    id: "business",
    name: "Prime ",
    price: 5500,
    points: 5,
    discount: 5,
    uplinerPoints: 3,
    teamLeaderPoints: 3,
    purchaserDiscount: 5,
  },
  {
    id: "empire",
    name: "VIP",
    price: 9500,
    points: 7,
    discount: 8,
    uplinerPoints: 3,
    teamLeaderPoints: 3,
    purchaserDiscount: 8,
  },
  {
    id: "ultimate",
    name: "Supreme",
    price: 15000,
    points: 11,
    discount: 10,
    uplinerPoints: 3,
    teamLeaderPoints: 3,
    purchaserDiscount: 10,
  },
];

/**
 * Helper function to distribute points and discounts up the referral chain.
 * UPDATED: Now also processes commissions using CommissionService
 */
async function distributePointsAndDiscountsUpTheChain(
  purchaserId,
  purchaserPoints,
  directUplinerPoints,
  teamLeaderPoints,
  purchaserDiscount,
  source,
  // NEW PARAMETERS for commission processing
  productId = null,
  productName = null,
  productPrice = null,
  transactionType = null
) {
  try {
    console.log(`🔄 Starting distribution for ${source}`);
    console.log(`📊 Commission params: productId=${productId}, productName=${productName}, productPrice=${productPrice}, transactionType=${transactionType}`);

    // 0. Update Purchaser's own points and discount (if applicable)
    const purchaser = await User.findById(purchaserId);
    if (!purchaser) {
      console.log(
        `⚠️ distributePointsAndDiscounts: Purchaser with ID ${purchaserId} not found.`
      );
      return;
    }

    const newPurchaserPoints = purchaser.points + purchaserPoints;
    const newPurchaserDesignation = calculateDesignation(newPurchaserPoints);
    const updatedPurchaser = await User.findByIdAndUpdate(
      purchaser._id,
      {
        $inc: { points: purchaserPoints },
        $set: { designation: newPurchaserDesignation },
        $max: { discountPercentage: purchaserDiscount },
      },
      { new: true, runValidators: true }
    );

    if (updatedPurchaser) {
      console.log(
        `✅ ${source} - Purchaser ${updatedPurchaser.name} (${updatedPurchaser._id}) gained ${purchaserPoints} points and ${purchaserDiscount}% discount. New total points: ${updatedPurchaser.points}, New discount: ${updatedPurchaser.discountPercentage}%`
      );
    } else {
      console.log(
        `⚠️ ${source} - Failed to update purchaser ${purchaser.name} (${purchaser._id}).`
      );
    }

    // 1. Distribute to Direct Upliner (Level 1)
    if (
      purchaser.uplineId &&
      mongoose.Types.ObjectId.isValid(purchaser.uplineId)
    ) {
      const directUpliner = await User.findById(purchaser.uplineId);
      if (directUpliner) {
        const newDirectUplinerPoints =
          directUpliner.points + directUplinerPoints;
        const newDirectUplinerDesignation = calculateDesignation(
          newDirectUplinerPoints
        );

        const updatedDirectUpliner = await User.findByIdAndUpdate(
          directUpliner._id,
          {
            $inc: { points: directUplinerPoints },
            $set: { designation: newDirectUplinerDesignation },
          },
          { new: true, runValidators: true }
        );

        if (updatedDirectUpliner) {
          console.log(
            `🎁 ${source} - Direct Upliner ${updatedDirectUpliner.name} (${updatedDirectUpliner._id}) gained ${directUplinerPoints} points. New points: ${updatedDirectUpliner.points}, Designation: ${updatedDirectUpliner.designation}`
          );
          // POST /api/addPoints
          router.post('/addPoints', async (req, res) => {
            const { userId, points } = req.body;

            try {
              const user = await User.findById(userId);
              if (!user) return res.status(404).json({ message: 'User not found' });

              user.points = (user.points || 0) + points;
              await user.save();

              res.status(200).json({ message: 'Points added', points: user.points });
            } catch (err) {
              res.status(500).json({ message: 'Server error', error: err.message });
            }
          });

          // PUT /api/users/:userId - Update user
          router.put("/:userId", async (req, res) => {
            try {
              const { userId } = req.params;
              const { name, email, phone, designation, points } = req.body;

              if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: "Invalid User ID format" });
              }

              const user = await User.findById(userId);
              if (!user) {
                return res.status(404).json({ error: "User not found" });
              }

              // Update user fields
              if (name) user.name = name;
              if (email) user.email = email;
              if (phone) user.phone = phone;
              if (designation) user.designation = designation;
              if (points !== undefined) user.points = parseInt(points) || 0;

              await user.save();

              res.status(200).json({
                message: "User updated successfully",
                user: {
                  id: user._id,
                  name: user.name,
                  email: user.email,
                  phone: user.phone,
                  designation: user.designation,
                  points: user.points
                }
              });
            } catch (err) {
              console.error("❌ Failed to update user:", err.message);
              res.status(500).json({ error: "Internal Server Error" });
            }
          });

          // DELETE /api/users/:userId - Delete user
          router.delete("/:userId", async (req, res) => {
            try {
              const { userId } = req.params;

              if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ error: "Invalid User ID format" });
              }

              const user = await User.findById(userId);
              if (!user) {
                return res.status(404).json({ error: "User not found" });
              }

              await User.findByIdAndDelete(userId);

              res.status(200).json({
                message: "User deleted successfully"
              });
            } catch (err) {
              console.error("❌ Failed to delete user:", err.message);
              res.status(500).json({ error: "Internal Server Error" });
            }
          });

          // 2. Distribute to Team Leader (Level 2 - Upliner's Upliner)
          if (
            updatedDirectUpliner.uplineId &&
            mongoose.Types.ObjectId.isValid(updatedDirectUpliner.uplineId)
          ) {
            const teamLeader = await User.findById(
              updatedDirectUpliner.uplineId
            );
            if (teamLeader) {
              const newTeamLeaderPoints = teamLeader.points + teamLeaderPoints;
              const newTeamLeaderDesignation =
                calculateDesignation(newTeamLeaderPoints);

              const updatedTeamLeader = await User.findByIdAndUpdate(
                teamLeader._id,
                {
                  $inc: { points: teamLeaderPoints },
                  $set: { designation: newTeamLeaderDesignation },
                },
                { new: true, runValidators: true }
              );

              if (updatedTeamLeader) {
                console.log(
                  `🌟 ${source} - Team Leader ${updatedTeamLeader.name} (${updatedTeamLeader._id}) gained ${teamLeaderPoints} points. New points: ${updatedTeamLeader.points}, Designation: ${updatedTeamLeader.designation}`
                );
              } else {
                console.log(
                  `⚠️ ${source} - Team Leader with ID ${updatedDirectUpliner.uplineId} not found for point distribution.`
                );
              }
            }
          } else {
            console.log(
              `ℹ️ ${source} - Direct upliner ${updatedDirectUpliner.name} has no further upliner (Team Leader) for point distribution.`
            );
          }
        } else {
          console.log(
            `⚠️ ${source} - Failed to update direct upliner ${directUpliner.name} (${directUpliner._id}).`
          );
        }
      } else {
        console.log(
          `⚠️ ${source} - Direct upliner with ID ${purchaser.uplineId} not found for point distribution.`
        );
      }
    } else {
      console.log(
        `ℹ️ ${source} - User ${purchaser.name} has no upliner for point distribution.`
      );
    }

    // NEW: Process commissions if product information is provided
    if (productId && productName && productPrice && transactionType) {
      try {
        console.log(`💰 Processing commission for ${source}...`);
        const commissionResult = await CommissionService.processCommission({
          userId: purchaserId,
          productId,
          productName,
          productPrice,
          transactionType,
          quantity: 1
        });

        console.log(`💰 Commission Processing Result: ${commissionResult.message}`);
        console.log(`💰 Commission Details:`, commissionResult.commissionDetails);
        return commissionResult;
      } catch (commissionError) {
        console.error(`❌ Commission processing failed for ${source}:`, commissionError.message);
        console.error(`❌ Commission error stack:`, commissionError.stack);
        // Don't throw error here - we want points distribution to succeed even if commission fails
        return {
          success: false,
          error: commissionError.message,
          commissionDetails: {
            uplinerCommission: 0,
            teamLeadCommission: 0,
            totalCommissions: 0
          }
        };
      }
    } else {
      console.log(`ℹ️ No commission processing for ${source} - missing product information`);
    }

  } catch (error) {
    console.error(
      `❌ Error during point/discount distribution for user ${purchaserId} from source ${source}:`,
      error.message
    );
    console.error(error);
    throw error;
  }
}

// ✅ Register Route (Modified to include commission processing)
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      dob,
      country,
      province,
      uplineName: clientUplineName,
      uplineId,
      email,
      phone,
      cinicNumber,
      password,
      confirmPassword,
      packageId, // Expect packageId from frontend
    } = req.body;

    console.log("--- START REGISTER REQUEST ---");
    console.log("Received Request Body:", req.body);
    console.log("🎯 uplineId received:", uplineId);
    console.log(
      "🔎 Valid ObjectId:",
      mongoose.Types.ObjectId.isValid(uplineId)
    );
    console.log("--- END REGISTER REQUEST ---");

    if (!email || !password || !confirmPassword) {
      return res.status(400).json({
        error: "Missing required fields (email, password, confirmPassword)",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "Email already exists" });

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let selectedPackage = null;
    if (packageId) {
      selectedPackage = packages.find((p) => p.id === packageId);
      if (!selectedPackage) {
        return res.status(400).json({ error: "Invalid packageId provided" });
      }
      console.log(`📦 Registering with package: ${selectedPackage.name}`);
    } else {
      console.log("ℹ️ Registering without a specific package.");
    }

    // Support resolving upline by either ObjectId or a short referralCode
    let upliner = null;
    if (uplineId) {
      // try ObjectId first
      if (mongoose.Types.ObjectId.isValid(uplineId)) {
        upliner = await User.findById(uplineId);
      }
      // if not found, try referralCode lookup
      if (!upliner) {
        upliner = await User.findOne({ referralCode: uplineId });
      }
      if (!upliner) {
        console.log("❌ Upliner not found in DB with provided identifier:", uplineId);
      } else {
        console.log(
          "✅ Upliner found:",
          upliner.name,
          "with current points:",
          upliner.points
        );
      }
    }

    // Generate a human-friendly short referral code for the new user
    function generateReferralCode() {
      // Create a 6-character alphanumeric uppercase code
      return crypto.randomBytes(4).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0,6).toUpperCase();
    }

    // Ensure uniqueness (small loop - referral code space is large enough for app scale)
    let referralCode = generateReferralCode();
    let attempts = 0;
    while (await User.findOne({ referralCode })) {
      referralCode = generateReferralCode();
      attempts++;
      if (attempts > 5) break; // fallback
    }

    const newUser = new User({
      name,
      dob,
      country,
      province,
      uplineName: upliner ? upliner.name : clientUplineName,
      uplineId: upliner ? upliner._id : null,
      referralCode,
      email,
      phone,
      cinicNumber,
      password: hashedPassword,
      packageId: selectedPackage ? selectedPackage.id : null,
    });

    await newUser.save();

    console.log(
      "✅ User created successfully:",
      newUser.name,
      "with ID:",
      newUser._id
    );

    let commissionResult = null;

    // Distribute points and process commissions based on the selected package
    if (selectedPackage) {
      commissionResult = await distributePointsAndDiscountsUpTheChain(
        newUser._id,
        selectedPackage.points, // Purchaser's points from package
        selectedPackage.uplinerPoints, // Direct upliner's points from package
        selectedPackage.teamLeaderPoints, // Team leader's points from package
        selectedPackage.purchaserDiscount, // Purchaser's discount
        "registration_with_package",
        // NEW: Commission parameters
        selectedPackage.id,
        selectedPackage.name,
        selectedPackage.price,
        "registration_with_package"
      );
    } else {
      // If no package selected, still reward the upliner/team leader with small referral points if uplineId provided
      const defaultUplinerPoints = newUser.uplineId ? 1 : 0;
      const defaultTeamLeaderPoints = newUser.uplineId ? 1 : 0;
      await distributePointsAndDiscountsUpTheChain(
        newUser._id,
        0, // Purchaser points
        defaultUplinerPoints, // Upliner points (1 if referral present)
        defaultTeamLeaderPoints, // Team Leader points
        0, // Purchaser discount
        "basic_registration"
        // No commission parameters for basic registration
      );
    }

    // Send welcome email to the new user
    let fboDetails = { name: "N/A", email: "N/A", address: "N/A" };
    if (newUser.uplineId) {
      const uplinerUser = await User.findById(newUser.uplineId);
      if (uplinerUser) {
        fboDetails.name = uplinerUser.name;
        fboDetails.email = uplinerUser.email;
        fboDetails.address = `${uplinerUser.province}, ${uplinerUser.country}`;
      }
    }

    const emailSent = await sendWelcomeEmail(
      email,
      name,
      newUser._id.toString(),
      fboDetails.name,
      fboDetails.email,
      fboDetails.address
    );

    const responseData = {
      message: "User registered successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        packageId: newUser.packageId
      }
    };

    // Include commission information if commissions were processed
    if (commissionResult && commissionResult.success) {
      responseData.commissions = {
        totalCommissions: commissionResult.commissionDetails.totalCommissions,
        uplinerCommission: commissionResult.commissionDetails.uplinerCommission,
        teamLeadCommission: commissionResult.commissionDetails.teamLeadCommission
      };
    }

    if (emailSent) {
      console.log("Welcome email sending process initiated successfully.");
      responseData.message += " and welcome email sent";
    } else {
      console.warn("Welcome email could not be sent. Continuing with registration success.");
      responseData.message += ", but welcome email could not be sent";
    }

    res.status(201).json(responseData);
  } catch (err) {
    console.error("❌ Registration failed:", err.message);
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @route GET /api/users
 * @desc Get all users (for admin dashboard)
 * @access Private (Admin only - implement auth middleware)
 */
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.status(200).json(users);
  } catch (err) {
    console.error("❌ Failed to fetch all users:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @route POST /api/users/purchase-package
 * @desc Allows an EXISTING user to purchase a package, gaining points/discount and distributing commissions
 * @access Private (should be protected by auth middleware in a real app)
 */
router.post("/purchase-package", async (req, res) => {
  try {
    const { userId, packageId } = req.body;

    console.log(`📦 Package purchase request: userId=${userId}, packageId=${packageId}`);

    if (!userId || !packageId) {
      return res.status(400).json({ error: "Missing userId or packageId" });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid User ID format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const selectedPackage = packages.find((p) => p.id === packageId);
    if (!selectedPackage) {
      return res.status(404).json({ error: "Package not found" });
    }

    console.log(`📦 Processing package: ${selectedPackage.name} - $${selectedPackage.price}`);

    // Process points, discounts, and commissions
    const commissionResult = await distributePointsAndDiscountsUpTheChain(
      user._id,
      selectedPackage.points,
      selectedPackage.uplinerPoints,
      selectedPackage.teamLeaderPoints,
      selectedPackage.purchaserDiscount,
      "package_purchase",
      // Commission parameters
      selectedPackage.id,
      selectedPackage.name,
      selectedPackage.price,
      "package_purchase"
    );

    const updatedUser = await User.findById(user._id);

    const responseData = {
      message: `Package '${selectedPackage.name}' purchased successfully!`,
      user: updatedUser,
      discountGained: selectedPackage.discount,
    };

    // Include commission information if available
    if (commissionResult && commissionResult.success) {
      responseData.commissions = {
        totalCommissions: commissionResult.commissionDetails.totalCommissions,
        uplinerCommission: commissionResult.commissionDetails.uplinerCommission,
        teamLeadCommission: commissionResult.commissionDetails.teamLeadCommission,
        transactionId: commissionResult.transaction._id
      };
    }

    console.log(`📦 Package purchase response:`, responseData);
    res.status(200).json(responseData);
  } catch (err) {
    console.error("❌ Package purchase failed:", err.message);
    console.error(err);
    res
      .status(500)
      .json({ error: "Internal Server Error during package purchase" });
  }
});

/**
 * @route POST /api/users/purchase-product
 * @desc Allows a user to purchase a single product, gaining specific points and distributing commissions
 * @access Private (should be protected by auth middleware in a real app)
 */
router.post("/purchase-product", async (req, res) => {
  try {
    const {
      userId,
      productId,
      productName,
      productPrice,
      productPoints = 10,
      uplinerShare = 2,
      teamLeaderShare = 1,
    } = req.body;

    console.log(`🛍️ Product purchase request:`, req.body);

    if (!userId || !productId || !productName || !productPrice) {
      return res.status(400).json({
        error: "Missing required fields: userId, productId, productName, productPrice"
      });
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid User ID format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`🛍️ Processing product: ${productName} - $${productPrice}`);

    // Process points, discounts, and commissions
    const commissionResult = await distributePointsAndDiscountsUpTheChain(
      user._id,
      productPoints,
      uplinerShare,
      teamLeaderShare,
      0, // No discount for individual product purchases
      "product_purchase",
      // Commission parameters
      productId,
      productName,
      productPrice,
      "product_purchase"
    );

    const updatedUser = await User.findById(user._id);

    const responseData = {
      message: `Product '${productName}' purchased successfully!`,
      user: updatedUser,
      pointsGained: productPoints,
    };

    // Include commission information if available
    if (commissionResult && commissionResult.success) {
      responseData.commissions = {
        totalCommissions: commissionResult.commissionDetails.totalCommissions,
        uplinerCommission: commissionResult.commissionDetails.uplinerCommission,
        teamLeadCommission: commissionResult.commissionDetails.teamLeadCommission,
        transactionId: commissionResult.transaction._id
      };
    }

    console.log(`🛍️ Product purchase response:`, responseData);
    res.status(200).json(responseData);
  } catch (err) {
    console.error("❌ Product purchase failed:", err.message);
    console.error(err);
    res
      .status(500)
      .json({ error: "Internal Server Error during product purchase" });
  }
});

// NEW ROUTES: Commission-related endpoints

/**
 * @route GET /api/users/:userId/commissions
 * @desc Get commission history for a user
 * @access Private
 */
router.get("/:userId/commissions", async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit, skip, status, startDate, endDate } = req.query;

    console.log(`📊 Fetching commissions for user: ${userId}`);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid User ID format" });
    }

    const commissions = await CommissionService.getUserCommissions(userId, {
      limit: parseInt(limit) || 50,
      skip: parseInt(skip) || 0,
      status,
      startDate,
      endDate
    });

    console.log(`📊 Found ${commissions.length} commissions for user ${userId}`);

    res.status(200).json({
      message: "Commission history fetched successfully",
      commissions,
      count: commissions.length
    });
  } catch (err) {
    console.error("❌ Failed to fetch commission history:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @route GET /api/users/:userId/commission-summary
 * @desc Get commission summary for a user
 * @access Private
 */
router.get("/:userId/commission-summary", async (req, res) => {
  try {
    const { userId } = req.params;

    console.log(`📈 Fetching commission summary for user: ${userId}`);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid User ID format" });
    }

    const summary = await CommissionService.getUserCommissionSummary(userId);

    console.log(`📈 Commission summary for user ${userId}:`, summary);

    res.status(200).json({
      message: "Commission summary fetched successfully",
      summary
    });
  } catch (err) {
    console.error("❌ Failed to fetch commission summary:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 🚀 Existing Route: Get user profile by ID (Overview & Personal Info Data)
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Accept either a Mongo ObjectId or a human-friendly referralCode
    let user = null;
    if (mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId).select("-password");
    }
    if (!user) {
      // try referralCode lookup
      user = await User.findOne({ referralCode: userId }).select("-password");
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get commission summary for the user
    let commissionSummary = {
      totalEarned: 0,
      totalPending: 0,
      totalPaid: 0,
      totalCommissions: 0,
      uplinerCommissions: 0,
      teamLeadCommissions: 0
    };

    try {
      commissionSummary = await CommissionService.getUserCommissionSummary(userId);
    } catch (commissionError) {
      console.warn(`⚠️ Could not fetch commission summary for user ${userId}:`, commissionError.message);
    }

    res.status(200).json({
      message: "User profile fetched successfully",
      user: {
        id: user._id,
  referralId: user._id,
  referralCode: user.referralCode,
        name: user.name,
        email: user.email,
        phone: user.phone,
        dob: user.dob,
        country: user.country,
        province: user.province,
        uplineName: user.uplineName,
        uplineId: user.uplineId,
        cinicNumber: user.cinicNumber,
        points: user.points,
        designation: user.designation,
        discountPercentage: user.discountPercentage,
        packageId: user.packageId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        // Include commission summary
        commissionSummary
      },
    });
  } catch (err) {
    console.error("❌ Failed to fetch user profile:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// PUT /api/users/:userId - Update user
router.put("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phone, designation, points } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid User ID format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (designation) user.designation = designation;
    if (points !== undefined) user.points = parseInt(points) || 0;

    await user.save();

    res.status(200).json({
      message: "User updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        designation: user.designation,
        points: user.points
      }
    });
  } catch (err) {
    console.error("❌ Failed to update user:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /api/users/:userId - Delete user
router.delete("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid User ID format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await User.findByIdAndDelete(userId);

    res.status(200).json({
      message: "User deleted successfully"
    });
  } catch (err) {
    console.error("❌ Failed to delete user:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/users/:userId/make-admin - Make user admin (for testing/setup)
router.post("/:userId/make-admin", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid User ID format" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.role = "admin";
    await user.save();

    res.status(200).json({
      message: "User role updated to admin successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error("❌ Failed to update user role:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// TEMPORARY: Make first user admin (for testing - remove in production)
router.post("/make-first-admin", async (req, res) => {
  try {
    const firstUser = await User.findOne().sort({ createdAt: 1 });
    if (!firstUser) {
      return res.status(404).json({ error: "No users found" });
    }

    firstUser.role = "admin";
    await firstUser.save();

    res.status(200).json({
      message: "First user made admin successfully",
      user: {
        id: firstUser._id,
        name: firstUser.name,
        email: firstUser.email,
        role: firstUser.role
      }
    });
  } catch (err) {
    console.error("❌ Failed to make first user admin:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
