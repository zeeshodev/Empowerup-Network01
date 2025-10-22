const nodemailer = require("nodemailer");

// Configure transporter using domain/webmail SMTP settings via environment variables.
// Set these in your .env or environment: EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE (true/false), EMAIL_USER, EMAIL_PASS
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'mail.empowerupnetworkcompany.com',
  port: parseInt(process.env.EMAIL_PORT, 10) || 587,
  secure: (process.env.EMAIL_SECURE === 'true') || false, // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER || 'admin@empowerupnetworkcompany.com',
    pass: process.env.EMAIL_PASS || process.env.EMAIL_APP_PASSWORD,
  },
  tls: {
    // Allow self-signed certificates if explicitly disabled via env (set to 'false' to disable strict check)
    rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false',
  },
});

// ✅ Add transporter.verify() to check connection at startup
transporter.verify(function (error, success) {
  if (error) {
    console.error("❌ Email sender connection failed:", error && error.message ? error.message : error);
    console.error(
      "Please check EMAIL_HOST, EMAIL_PORT, EMAIL_USER and EMAIL_PASS (or EMAIL_APP_PASSWORD) in your environment/.env file."
    );
  } else {
    console.log("✅ Email sender connected successfully, ready to send emails!");
  }
});

// 🌟 UPDATED: sendWelcomeEmail function to match the image's content and structure 🌟
const sendWelcomeEmail = async (
  userEmail,
  userName,
  userId,
  eboName,
  eboEmail,
  eboAddress
) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'admin@empowerupnetworkcompany.com', // default sender (override with EMAIL_FROM)
      to: userEmail, // The recipient's email (newly registered user)
      subject: "Welcome to the EmpowerUp Family!", // Email Subject updated to EmpowerUp
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 20px auto; padding: 0; border: none; background-color: #ffffff;">
          <!-- Header Image (Placeholder - you'll need to host your own image or remove this) -->
          <div style="text-align: center; background-color: #000; padding: 20px 0;">
            <img src="https://i.postimg.cc/02W7mNqx/Final-Logo-Copy.png" alt="EmpowerUp Header" style="max-width: 100%; height: auto; display: block; margin: 0 auto;">
          </div>
          <div style="background-color: #f4f4f4; padding: 20px 40px; border-bottom: 1px solid #eee;">
            <p style="font-size: 1.2em; color: #555;">MY ACCOUNT &nbsp;&nbsp;&nbsp; SHOP</p>
          </div>

          <!-- Main Content Area -->
          <div style="padding: 40px; background-color: #ffffff; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 1.1em; color: #333; margin-bottom: 20px;">Welcome to the EmpowerUp Family, ${
              userName || userEmail.split("@")[0]
            }!</p>
            <p style="margin-bottom: 15px;">We're pleased to have you in our exclusive EmpowerUp Preferred Customer program.</p>
            <p style="margin-bottom: 20px;">You can now order all your favorite EmpowerUp products at a discount.</p>

            <p style="font-weight: bold; margin-bottom: 5px;">Your ID # is: ${
              userId || "N/A"
            }</p>
            <p style="margin-bottom: 20px;">Ready to get started? Remember, you can always reach out to the EmpowerUp Business Owner below for help with product information or purchasing.</p>

            <p style="font-weight: bold; margin-bottom: 5px;">Your EBO's information is:</p>
            <p style="margin-bottom: 5px;">${eboName || "Samra Mehar"}</p>
            <p style="margin-bottom: 5px;">${
              eboAddress || "PAKISTAN, Abu Dhabi 52250<br>United Arab Emirates"
            }</p>
            <p style="margin-bottom: 20px;"><a href="mailto:${
              eboEmail || "samramehar007@gmail.com"
            }" style="color: #007bff; text-decoration: none;">${
        eboEmail || "samramehar007@gmail.com"
      }</a></p>

            <p style="margin-bottom: 20px;">Get started by Login to your account. <a href="http://localhost:3000/login" style="color: #007bff; text-decoration: none;">Click here</a></p>

            <p style="margin-bottom: 10px;">If you have any questions or comments, please contact our Customer Support Team at <a href="mailto:hello@empowerupnetworkcompany.com" style="color: #007bff; text-decoration: none;">customerservice@empowerupnetworkcompany.com</a> or +92 3190044608</p>
            <p style="margin-bottom: 30px;">Please do not reply to this automated email.</p>

            <!-- Best Wishes Signature -->
            <div style="text-align: left; margin-top: 30px;">
              <p style="font-family: 'Brush Script MT', cursive; font-size: 1.8em; color: #555; margin-bottom: 5px;">Best wishes,</p>
              <p style="font-family: 'Brush Script MT', cursive; font-size: 1.8em; color: #555;">the EmpowerUp team</p>
            </div>
          </div>

          <!-- Footer/Social Section -->
          <div style="text-align: center; padding: 20px; background-color: #f4f4f4; border-top: 1px solid #eee; border-radius: 0 0 8px 8px; margin-top: 20px;">
            <p style="font-size: 0.9em; color: #777;">Join the conversation</p>
            <!-- Add social media icons/links here if needed -->
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Welcome email sent:", info.response);
    return true;
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return false;
  }
};

module.exports = {
  sendWelcomeEmail,
};
