const express = require("express");

const WebsiteContent = require("../models/WebsiteContent");
const protectAdmin = require("../middleware/authMiddleware");

const router = express.Router();

/**
 * GET /api/website-content
 *
 * Public route.
 *
 * Returns the website content used by public pages such as:
 * - Home page
 * - About page
 * - Contact page
 * - Footer
 */
router.get("/", async (request, response) => {
  try {
    const websiteContent =
      await WebsiteContent.getSingleton();

    return response.status(200).json({
      success: true,
      data: websiteContent,
    });
  } catch (error) {
    console.error(
      "Public website content error:",
      error,
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to load website content.",
    });
  }
});

/**
 * All routes below this middleware require
 * a valid administrator JWT token.
 */
router.use(protectAdmin);

/**
 * GET /api/website-content/admin
 *
 * Protected administrator route.
 *
 * Returns the complete editable website settings document.
 */
router.get("/admin", async (request, response) => {
  try {
    const websiteContent =
      await WebsiteContent.getSingleton();

    return response.status(200).json({
      success: true,
      data: websiteContent,
    });
  } catch (error) {
    console.error(
      "Admin website content error:",
      error,
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to load website settings.",
    });
  }
});

/**
 * PATCH /api/website-content
 *
 * Protected administrator route.
 *
 * Updates the single website settings document.
 */
router.patch("/", async (request, response) => {
  try {
    const allowedFields = [
      "businessName",
      "tagline",
      "heroTitle",
      "heroSubtitle",
      "heroImage",
      "heroPrimaryButtonText",
      "heroPrimaryButtonLink",
      "heroSecondaryButtonText",
      "heroSecondaryButtonLink",
      "aboutTitle",
      "aboutContent",
      "aboutImage",
      "contactEmail",
      "contactPhone",
      "alternatePhone",
      "businessAddress",
      "businessHours",
      "googleMapsEmbedUrl",
      "contactPageTitle",
      "contactPageDescription",
      "footerText",
      "copyrightText",
      "socialLinks",
      "showTestimonials",
      "showHomeAboutSection",
    ];

    /**
     * Only copy approved fields from the request body.
     *
     * This prevents protected properties such as:
     * - _id
     * - settingsKey
     * - createdAt
     * - updatedAt
     *
     * from being changed by the client.
     */
    const updateData = {};

    allowedFields.forEach((fieldName) => {
      if (
        Object.prototype.hasOwnProperty.call(
          request.body,
          fieldName,
        )
      ) {
        updateData[fieldName] =
          request.body[fieldName];
      }
    });

    /**
     * Reject an empty update request.
     */
    if (Object.keys(updateData).length === 0) {
      return response.status(400).json({
        success: false,
        message:
          "No valid website settings were provided.",
      });
    }

    /**
     * Ensure the singleton document exists before updating it.
     */
    await WebsiteContent.getSingleton();

    const updatedWebsiteContent =
      await WebsiteContent.findOneAndUpdate(
        {
          settingsKey: "main",
        },
        {
          $set: updateData,
        },
        {
          new: true,
          runValidators: true,
        },
      );

    return response.status(200).json({
      success: true,
      message:
        "Website settings updated successfully.",
      data: updatedWebsiteContent,
    });
  } catch (error) {
    console.error(
      "Website content update error:",
      error,
    );

    /**
     * Mongoose validation errors should return 400
     * so the frontend can display the exact problem.
     */
    if (error.name === "ValidationError") {
      const validationMessages =
        Object.values(error.errors).map(
          (validationError) =>
            validationError.message,
        );

      return response.status(400).json({
        success: false,
        message: validationMessages.join(" "),
      });
    }

    return response.status(500).json({
      success: false,
      message:
        "Unable to update website settings.",
    });
  }
});

module.exports = router;