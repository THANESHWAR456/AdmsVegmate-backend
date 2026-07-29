const jwt = require("jsonwebtoken");

const Admin = require("../models/Admin");

/**
 * Standard response for authentication failures.
 *
 * Using the same message prevents the API from revealing
 * whether an administrator exists, was removed or is inactive.
 */
const AUTHENTICATION_MESSAGE =
  "Administrator authentication is required.";

/**
 * Protect administrator-only routes.
 *
 * This middleware:
 * 1. Reads the Bearer token.
 * 2. Verifies the signature and token restrictions.
 * 3. Validates the decoded payload.
 * 4. Confirms the administrator still exists.
 * 5. Adds the administrator to request.admin.
 */
async function protectAdmin(
  request,
  response,
  next,
) {
  /**
   * Prevent authenticated responses from being cached.
   */
  response.set("Cache-Control", "no-store");
  response.set("Pragma", "no-cache");

  try {
    const authorizationHeader =
      request.headers.authorization;

    /**
     * Require exactly:
     *
     * Authorization: Bearer JWT_TOKEN
     */
    if (
      typeof authorizationHeader !==
      "string"
    ) {
      return response.status(401).json({
        success: false,
        message:
          AUTHENTICATION_MESSAGE,
      });
    }

    const bearerMatch =
      authorizationHeader.match(
        /^Bearer\s+([^\s]+)$/i,
      );

    if (!bearerMatch) {
      return response.status(401).json({
        success: false,
        message:
          AUTHENTICATION_MESSAGE,
      });
    }

    const token = bearerMatch[1];

    /**
     * Reject unusually large tokens before JWT processing.
     */
    if (
      !token ||
      token.length > 4096
    ) {
      return response.status(401).json({
        success: false,
        message:
          "Invalid authentication token.",
      });
    }

    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET.length < 32
    ) {
      throw new Error(
        "JWT configuration is invalid.",
      );
    }

    /**
     * Verify:
     * - Signature
     * - Expiration
     * - Issuer
     * - Audience
     * - Permitted signing algorithm
     */
    const decodedToken = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        algorithms: ["HS256"],
        issuer:
          "product-catalog-api",
        audience:
          "product-catalog-admin",
      },
    );

    /**
     * JWT payloads originate from incoming requests,
     * so validate all fields before using them.
     */
    if (
      !decodedToken ||
      typeof decodedToken !==
        "object" ||
      typeof decodedToken.adminId !==
        "string" ||
      decodedToken.adminId.length === 0
    ) {
      return response.status(401).json({
        success: false,
        message:
          "Invalid authentication token.",
      });
    }

    /**
     * Confirm the administrator still exists.
     *
     * Password is excluded from the result.
     */
    const admin =
      await Admin.findById(
        decodedToken.adminId,
      ).select("-password");

    /**
     * Use one response for deleted and inactive accounts.
     *
     * The explicit false check maintains compatibility
     * with older admin records that may not yet contain
     * an isActive field.
     */
    if (
      !admin ||
      admin.isActive === false
    ) {
      return response.status(401).json({
        success: false,
        message:
          AUTHENTICATION_MESSAGE,
      });
    }

    /**
     * Use the current administrator record from MongoDB,
     * not role information supplied inside the token.
     */
    request.admin = admin;

    request.auth = {
      adminId:
        admin._id.toString(),
      role: admin.role,
    };

    return next();
  } catch (error) {
    if (
      error.name ===
      "TokenExpiredError"
    ) {
      return response.status(401).json({
        success: false,
        message:
          "Your login session has expired. Please log in again.",
      });
    }

    if (
      error.name ===
        "JsonWebTokenError" ||
      error.name === "NotBeforeError"
    ) {
      return response.status(401).json({
        success: false,
        message:
          "Invalid authentication token.",
      });
    }

    /**
     * Invalid MongoDB identifier values may throw
     * a CastError during the administrator lookup.
     */
    if (error.name === "CastError") {
      return response.status(401).json({
        success: false,
        message:
          "Invalid authentication token.",
      });
    }

    console.error(
      "Authentication middleware error:",
      error,
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to verify administrator authentication.",
    });
  }
}

module.exports = protectAdmin;