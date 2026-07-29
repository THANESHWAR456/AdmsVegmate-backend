const express = require("express");
const jwt = require("jsonwebtoken");

const Admin = require("../models/Admin");

const protectAdmin = require(
  "../middleware/authMiddleware",
);

const router = express.Router();

const INVALID_LOGIN_MESSAGE =
  "Invalid email or password.";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_BYTES = 72;

/**
 * Confirm that JWT configuration is secure.
 */
function validateJwtConfiguration() {
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32
  ) {
    throw new Error(
      "JWT configuration is invalid.",
    );
  }
}

/**
 * Create an administrator JWT token.
 */
function createAdminToken(admin) {
  validateJwtConfiguration();

  return jwt.sign(
    {
      adminId: admin._id.toString(),
      role: admin.role,
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",

      expiresIn:
        process.env.JWT_EXPIRES_IN ||
        "1h",

      issuer:
        "product-catalog-api",

      audience:
        "product-catalog-admin",

      subject:
        admin._id.toString(),
    },
  );
}

/**
 * POST /api/auth/login
 *
 * Authenticates an administrator.
 */
router.post(
  "/login",
  async (request, response) => {
    response.set(
      "Cache-Control",
      "no-store",
    );

    response.set(
      "Pragma",
      "no-cache",
    );

    try {
      const email =
        typeof request.body?.email ===
        "string"
          ? request.body.email
              .trim()
              .toLowerCase()
          : "";

      const password =
        typeof request.body?.password ===
        "string"
          ? request.body.password
          : "";

      if (!email || !password) {
        return response.status(400).json({
          success: false,
          message:
            "Email and password are required.",
        });
      }

      if (
        email.length > 254 ||
        !EMAIL_PATTERN.test(email) ||
        password.length > 200
      ) {
        return response.status(400).json({
          success: false,
          message:
            "Enter a valid email and password.",
        });
      }

      const admin =
        await Admin.findOne({
          email,
        }).select("+password");

      if (
        !admin ||
        admin.isActive === false
      ) {
        return response.status(401).json({
          success: false,
          message:
            INVALID_LOGIN_MESSAGE,
        });
      }

      const passwordIsCorrect =
        await admin.comparePassword(
          password,
        );

      if (!passwordIsCorrect) {
        return response.status(401).json({
          success: false,
          message:
            INVALID_LOGIN_MESSAGE,
        });
      }

      const token =
        createAdminToken(admin);

      await Admin.updateOne(
        {
          _id: admin._id,
        },
        {
          $set: {
            lastLoginAt: new Date(),
          },
        },
      );

      return response.status(200).json({
        success: true,
        message:
          "Admin login successful.",

        token,

        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      });
    } catch (error) {
      console.error(
        "Admin login error:",
        error,
      );

      return response.status(500).json({
        success: false,
        message:
          "Unable to complete admin login.",
      });
    }
  },
);

/**
 * PATCH /api/auth/change-password
 *
 * Protected administrator route.
 *
 * Requires:
 * - Current password
 * - New password
 * - New password confirmation
 */
router.patch(
  "/change-password",
  protectAdmin,
  async (request, response) => {
    response.set(
      "Cache-Control",
      "no-store",
    );

    response.set(
      "Pragma",
      "no-cache",
    );

    try {
      const currentPassword =
        typeof request.body
          ?.currentPassword === "string"
          ? request.body.currentPassword
          : "";

      const newPassword =
        typeof request.body
          ?.newPassword === "string"
          ? request.body.newPassword
          : "";

      const confirmPassword =
        typeof request.body
          ?.confirmPassword === "string"
          ? request.body.confirmPassword
          : "";

      if (
        !currentPassword ||
        !newPassword ||
        !confirmPassword
      ) {
        return response.status(400).json({
          success: false,
          message:
            "Current password, new password and password confirmation are required.",
        });
      }

      if (
        newPassword !==
        confirmPassword
      ) {
        return response.status(400).json({
          success: false,
          message:
            "New password and confirmation do not match.",
        });
      }

      if (
        newPassword.length <
        MIN_PASSWORD_LENGTH
      ) {
        return response.status(400).json({
          success: false,
          message:
            `New password must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
        });
      }

      const newPasswordBytes =
        Buffer.byteLength(
          newPassword,
          "utf8",
        );

      if (
        newPasswordBytes >
        MAX_PASSWORD_BYTES
      ) {
        return response.status(400).json({
          success: false,
          message:
            "New password cannot exceed 72 UTF-8 bytes.",
        });
      }

      if (
        currentPassword.length > 200
      ) {
        return response.status(400).json({
          success: false,
          message:
            "Invalid current password.",
        });
      }

      const admin =
        await Admin.findById(
          request.admin._id,
        ).select(
          "+password +passwordChangedAt",
        );

      if (
        !admin ||
        admin.isActive === false
      ) {
        return response.status(401).json({
          success: false,
          message:
            "Administrator authentication is required.",
        });
      }

      const currentPasswordIsCorrect =
        await admin.comparePassword(
          currentPassword,
        );

      if (
        !currentPasswordIsCorrect
      ) {
        return response.status(400).json({
          success: false,
          message:
            "Current password is incorrect.",
        });
      }

      const newPasswordIsCurrentPassword =
        await admin.comparePassword(
          newPassword,
        );

      if (
        newPasswordIsCurrentPassword
      ) {
        return response.status(400).json({
          success: false,
          message:
            "The new password must be different from the current password.",
        });
      }

      /**
       * Saving the document runs the Admin model's
       * bcrypt password-hashing middleware.
       */
      admin.password = newPassword;

      await admin.save();

      /**
       * Issue a fresh token after changing the password.
       */
      const token =
        createAdminToken(admin);

      return response.status(200).json({
        success: true,
        message:
          "Administrator password changed successfully.",
        token,
      });
    } catch (error) {
      console.error(
        "Admin password change error:",
        error,
      );

      if (
        error.name ===
        "ValidationError"
      ) {
        const validationMessages =
          Object.values(
            error.errors,
          ).map(
            (validationError) =>
              validationError.message,
          );

        return response.status(400).json({
          success: false,
          message:
            validationMessages.join(" "),
        });
      }

      return response.status(500).json({
        success: false,
        message:
          "Unable to change the administrator password.",
      });
    }
  },
);

module.exports = router;