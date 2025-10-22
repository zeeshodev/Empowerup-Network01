const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config(); // Make sure this line is at the top, before any routes or other modules.

// Add a console log to check if environment variables are loaded, especially for email
console.log("Environment variables loaded.");
console.log(
  "EMAIL_USER from .env:",
  process.env.EMAIL_USER ? "Loaded" : "Not Loaded (or empty)"
); // Checks if the variable exists and is not empty

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const productRoutes = require("./routes/productRoutes");
const userRoutes = require("./routes/userRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const tokenRoutes = require("./routes/tokenRoutes");
const packagePaymentRoutes = require("./routes/packagePaymentRoutes");

const app = express();
app.use(cors());
app.use(express.json());
// Serve uploaded payment proofs
app.use('/uploads', express.static(require('path').join(process.cwd(), 'EmpowerUp-backend-main', 'uploads')));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/withdrawals", withdrawalRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/token", tokenRoutes); // Changed to a separate token route
app.use("/api/package-payments", packagePaymentRoutes);

const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI, {
    // useNewUrlParser: true,   <-- REMOVE THIS LINE
    // useUnifiedTopology: true, <-- REMOVE THIS LINE
  })
  .then(() => {
    console.log("MongoDB connected");
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error("MongoDB error:", err));
