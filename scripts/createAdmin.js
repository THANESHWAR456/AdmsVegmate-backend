/**
 * One-time admin account creation script.
 *
 * This script:
 * 1. Loads values from the .env file.
 * 2. Connects to MongoDB.
 * 3. Checks whether the admin email already exists.
 * 4. Creates the first admin with a securely hashed password.
 */

require("dotenv").config();

const mongoose = require("mongoose");
const Admin = require("../models/Admin");

/**
 * Create the first administrator account.
 */
async function createAdmin({
  closeConnection = true,
} = {}) {
  try {
    const {
      MONGO_URI,
      ADMIN_NAME,
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
    } = process.env;

    // Ensure all required environment variables are available.
    if (
      !MONGO_URI ||
      !ADMIN_NAME ||
      !ADMIN_EMAIL ||
      !ADMIN_PASSWORD
    ) {
      throw new Error(
        "MONGO_URI, ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD are required.",
      );
    }

    await mongoose.connect(MONGO_URI);

    console.log("MongoDB connected for admin setup.");

    // Prevent duplicate administrator accounts with the same email.
    const existingAdmin = await Admin.findOne({
      email: ADMIN_EMAIL.toLowerCase(),
    });

    if (existingAdmin) {
      console.log(
        `An admin account already exists for ${ADMIN_EMAIL}.`,
      );

      return;
    }

    // The Admin model automatically hashes this password before saving.
    const admin = await Admin.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    console.log("Admin account created successfully.");
    console.log(`Admin name: ${admin.name}`);
    console.log(`Admin email: ${admin.email}`);
  } catch (error) {
    console.error("Admin creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    if (closeConnection) {
      // Always close the database connection when the script finishes.
      await mongoose.connection.close();
    }
  }
}

if (require.main === module) {
  createAdmin();
}

module.exports = createAdmin;