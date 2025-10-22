/*
  backfillReferralCodes.js
  - Connects to MONGO_URI and assigns a unique short referralCode to any User missing it.
  - Safe to run multiple times (idempotent for users that already have a code).

  Usage: node scripts/backfillReferralCodes.js
*/

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

const User = require('..//models/User');

function generateReferralCode() {
  return crypto.randomBytes(4).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0,6).toUpperCase();
}

async function ensureUniqueCode() {
  let code = generateReferralCode();
  let attempts = 0;
  while (await User.findOne({ referralCode: code })) {
    code = generateReferralCode();
    attempts++;
    if (attempts > 10) throw new Error('Too many attempts generating unique referral code');
  }
  return code;
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set in environment. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const users = await User.find({ $or: [{ referralCode: { $exists: false } }, { referralCode: null }, { referralCode: '' }] });
  console.log(`Found ${users.length} users missing referralCode`);

  for (const user of users) {
    try {
      const code = await ensureUniqueCode();
      user.referralCode = code;
      await user.save();
      console.log(`Updated user ${user._id} -> referralCode=${code}`);
    } catch (err) {
      console.error(`Failed to update user ${user._id}:`, err.message);
    }
  }

  console.log('Done');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
