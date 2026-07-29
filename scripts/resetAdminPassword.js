/**
 * Reset the administrator password.
 *
 * The new password is read from ADMIN_PASSWORD in the .env file.
 * The Admin model automatically hashes the password before saving.
 */

require("dotenv").config();

const mongoose = require("mongoose");
const Admin = require("../models/Admin");

async function resetAdminPassword() {
  try {
    const { MONGO_URI, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

    if (!MONGO_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
      throw new Error(
        "MONGO_URI, ADMIN_EMAIL, and ADMIN_PASSWORD must exist in .env.",
      );
    }

    await mongoose.connect(MONGO_URI);

    console.log("MongoDB connected for password reset.");

    const admin = await Admin.findOne({
      email: ADMIN_EMAIL.trim().toLowerCase(),
    });

    if (!admin) {
      throw new Error(`No admin account exists for ${ADMIN_EMAIL}.`);
    }

    // Assigning a new password causes the Admin model's save middleware
    // to hash it securely before storing it in MongoDB.
    admin.password = ADMIN_PASSWORD;

    await admin.save();

    console.log("Admin password reset successfully.");
    console.log(`Admin email: ${admin.email}`);
  } catch (error) {
    console.error("Password reset failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

resetAdminPassword();