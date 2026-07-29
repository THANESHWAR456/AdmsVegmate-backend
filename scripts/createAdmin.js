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
 * Minimum password length enforced by the Admin model.
 *
 * This is checked here as well so that a password which is
 * too short produces a clear message before the database
 * rejects it with a generic validation error.
 */
const MIN_PASSWORD_LENGTH = 10;

/**
 * Built-in details for the first administrator account.
 *
 * These values are used when the matching environment
 * variables are not set, so a fresh deployment always has
 * an account to sign in with.
 *
 * Setting ADMIN_NAME, ADMIN_EMAIL, or ADMIN_PASSWORD in the
 * environment overrides the value below.
 */
const DEFAULT_ADMIN = {
  name: "Adam",
  email: "thaneshwar12143@gmail.com",
  password: "Adamsapple321",
};

/**
 * Resolve the administrator details from the environment,
 * falling back to the built-in defaults.
 */
function resolveAdminDetails() {
  return {
    name:
      process.env.ADMIN_NAME?.trim() ||
      DEFAULT_ADMIN.name,

    email: (
      process.env.ADMIN_EMAIL ||
      DEFAULT_ADMIN.email
    )
      .trim()
      .toLowerCase(),

    password:
      process.env.ADMIN_PASSWORD ||
      DEFAULT_ADMIN.password,
  };
}

/**
 * Create the first administrator account.
 *
 * This function throws when the account cannot be created.
 * The caller decides how that failure should be reported,
 * so a seeding problem is never hidden.
 */
async function createAdmin({
  closeConnection = true,
} = {}) {
  try {
    const { MONGO_URI } = process.env;

    // A database address has no safe default value.
    if (!MONGO_URI) {
      throw new Error(
        "Missing required environment variable: MONGO_URI",
      );
    }

    const {
      name: adminName,
      email: adminEmail,
      password: adminPassword,
    } = resolveAdminDetails();

    /**
     * Check the password length before saving so the reason
     * for a rejected password is obvious.
     */
    if (
      adminPassword.length <
      MIN_PASSWORD_LENGTH
    ) {
      throw new Error(
        `The admin password must contain at least ${MIN_PASSWORD_LENGTH} characters (received ${adminPassword.length}). Set ADMIN_PASSWORD to a longer value.`,
      );
    }

    /**
     * Reuse the existing connection when this runs during
     * server startup, and open one when run as a script.
     */
    if (
      mongoose.connection.readyState === 0
    ) {
      await mongoose.connect(MONGO_URI);

      console.log("MongoDB connected for admin setup.");
    }

    // Prevent duplicate administrator accounts with the same email.
    const existingAdmin = await Admin.findOne({
      email: adminEmail,
    });

    if (existingAdmin) {
      console.log(
        `An admin account already exists for ${adminEmail}.`,
      );

      return existingAdmin;
    }

    // The Admin model automatically hashes this password before saving.
    const admin = await Admin.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
    });

    console.log("Admin account created successfully.");
    console.log(`Admin name: ${admin.name}`);
    console.log(`Admin email: ${admin.email}`);

    return admin;
  } finally {
    if (closeConnection) {
      // Always close the database connection when the script finishes.
      await mongoose.connection.close();
    }
  }
}

if (require.main === module) {
  createAdmin().catch((error) => {
    console.error(
      "Admin creation failed:",
      error.message,
    );

    process.exitCode = 1;
  });
}

module.exports = createAdmin;