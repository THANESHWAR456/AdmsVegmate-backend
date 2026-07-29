const express = require("express");
const mongoose = require("mongoose");

const Enquiry = require("../models/Enquiry");
const protectAdmin = require(
  "../middleware/authMiddleware",
);

const router = express.Router();

/**
 * Convert any submitted value into a clean string.
 *
 * This prevents null or undefined values from being
 * passed into fields that expect text.
 */
function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

/**
 * Extract B2B details from older Contact-page messages.
 *
 * Older messages may contain:
 *
 * Business Type: Restaurant
 * Enquiry Topic: Regular Business Supply
 *
 * The remaining lines are returned as the actual
 * customer message.
 */
function extractBusinessDetails(message) {
  const originalMessage = cleanText(message);

  if (!originalMessage) {
    return {
      businessType: "",
      enquiryTopic: "",
      cleanedMessage: "",
    };
  }

  let businessType = "";
  let enquiryTopic = "";

  const customerMessageLines = [];

  originalMessage
    .split("\n")
    .forEach((line) => {
      const trimmedLine = line.trim();

      if (
        trimmedLine
          .toLowerCase()
          .startsWith("business type:")
      ) {
        businessType = trimmedLine
          .replace(/business type:/i, "")
          .trim();

        return;
      }

      if (
        trimmedLine
          .toLowerCase()
          .startsWith("enquiry topic:")
      ) {
        enquiryTopic = trimmedLine
          .replace(/enquiry topic:/i, "")
          .trim();

        return;
      }

      customerMessageLines.push(line);
    });

  return {
    businessType,

    enquiryTopic,

    cleanedMessage:
      customerMessageLines
        .join("\n")
        .trim() || originalMessage,
  };
}

/**
 * POST /api/enquiries
 *
 * Public route.
 *
 * Accepts:
 * - Vegetable-kit enquiries from ProductDetails.jsx
 * - General B2B enquiries from Contact.jsx
 *
 * Compatible contact-name fields:
 * - customerName
 * - name
 *
 * Compatible product information:
 * - productId and productName
 * - product object
 */
router.post("/", async (request, response) => {
  try {
    const {
      customerName,
      name,
      company,
      businessType,
      enquiryTopic,
      email,
      phone,
      subject,
      productId,
      productName,
      product,
      message,
      enquiryType,
    } = request.body;

    /**
     * Support both old and new contact-name fields.
     */
    const resolvedCustomerName = cleanText(
      customerName || name,
    );

    /**
     * Resolve product information from direct fields
     * or from a supplied product object.
     */
    const resolvedProductId = cleanText(
      productId ||
        product?._id ||
        product?.id,
    );

    const resolvedProductName = cleanText(
      productName ||
        product?.name,
    );

    /**
     * Explicit enquiry types receive priority.
     *
     * This prevents a general enquiry from being
     * incorrectly treated as a product enquiry when
     * the frontend sends:
     *
     * productName: "General Business Enquiry"
     */
    let resolvedEnquiryType = "General";

    if (enquiryType === "General") {
      resolvedEnquiryType = "General";
    } else if (enquiryType === "Product") {
      resolvedEnquiryType = "Product";
    } else if (
      resolvedProductId ||
      (
        resolvedProductName &&
        resolvedProductName !==
          "General Business Enquiry"
      )
    ) {
      resolvedEnquiryType = "Product";
    }

    /**
     * Extract business type and enquiry topic from
     * older messages when they were not submitted
     * as separate fields.
     */
    const extractedDetails =
      extractBusinessDetails(message);

    const resolvedBusinessType = cleanText(
      businessType ||
        extractedDetails.businessType,
    );

    const resolvedEnquiryTopic = cleanText(
      enquiryTopic ||
        extractedDetails.enquiryTopic ||
        subject,
    );

    const resolvedSubject = cleanText(
      subject ||
        resolvedEnquiryTopic ||
        (
          resolvedEnquiryType === "General"
            ? "General Business Enquiry"
            : ""
        ),
    );

    /**
     * Use the cleaned message after removing any
     * business-type and enquiry-topic header lines.
     */
    const resolvedMessage = cleanText(
      extractedDetails.cleanedMessage,
    );

    /**
     * Create and store the B2B enquiry.
     */
    const enquiry = await Enquiry.create({
      enquiryType:
        resolvedEnquiryType,

      customerName:
        resolvedCustomerName,

      company:
        cleanText(company),

      businessType:
        resolvedBusinessType,

      enquiryTopic:
        resolvedEnquiryTopic,

      email:
        cleanText(email),

      phone:
        cleanText(phone),

      subject:
        resolvedSubject,

      productId:
        resolvedEnquiryType === "Product"
          ? resolvedProductId
          : "",

      productName:
        resolvedEnquiryType === "Product"
          ? resolvedProductName
          : "",

      message:
        resolvedMessage,
    });

    return response.status(201).json({
      success: true,

      message:
        resolvedEnquiryType === "General"
          ? "Your business enquiry has been submitted successfully."
          : "Your vegetable-kit enquiry has been submitted successfully.",

      data: enquiry,
    });
  } catch (error) {
    console.error(
      "Enquiry creation error:",
      error,
    );

    /**
     * Return readable Mongoose validation messages.
     */
    if (error.name === "ValidationError") {
      const validationMessages =
        Object.values(error.errors).map(
          (validationError) =>
            validationError.message,
        );

      return response.status(400).json({
        success: false,
        message:
          validationMessages.join(" "),
      });
    }

    return response.status(400).json({
      success: false,

      message:
        error.message ||
        "Unable to submit the business enquiry.",
    });
  }
});

/**
 * Protect every route below this middleware.
 */
router.use(protectAdmin);

/**
 * GET /api/enquiries
 *
 * Protected administrator route.
 * Returns all business enquiries, newest first.
 */
router.get("/", async (request, response) => {
  try {
    const enquiries =
      await Enquiry.find().sort({
        createdAt: -1,
      });

    return response.status(200).json({
      success: true,
      count: enquiries.length,
      data: enquiries,
    });
  } catch (error) {
    console.error(
      "Enquiry list error:",
      error,
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to retrieve business enquiries.",
    });
  }
});

/**
 * GET /api/enquiries/:id
 *
 * Protected administrator route.
 * Returns one enquiry using its MongoDB ID.
 */
router.get(
  "/:id",
  async (request, response) => {
    try {
      const { id } = request.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return response.status(400).json({
          success: false,
          message: "Invalid enquiry ID.",
        });
      }

      const enquiry =
        await Enquiry.findById(id);

      if (!enquiry) {
        return response.status(404).json({
          success: false,
          message:
            "Business enquiry not found.",
        });
      }

      return response.status(200).json({
        success: true,
        data: enquiry,
      });
    } catch (error) {
      console.error(
        "Single enquiry error:",
        error,
      );

      return response.status(500).json({
        success: false,
        message:
          "Unable to retrieve the business enquiry.",
      });
    }
  },
);

/**
 * PATCH /api/enquiries/:id/status
 *
 * Protected administrator route.
 *
 * Updates the status of a business enquiry.
 *
 * Allowed statuses:
 * - Unread
 * - Read
 * - Replied
 */
router.patch(
  "/:id/status",
  async (request, response) => {
    try {
      const { id } = request.params;

      const status = cleanText(
        request.body.status,
      );

      const allowedStatuses = [
        "Unread",
        "Read",
        "Replied",
      ];

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return response.status(400).json({
          success: false,
          message: "Invalid enquiry ID.",
        });
      }

      if (
        !allowedStatuses.includes(status)
      ) {
        return response.status(400).json({
          success: false,
          message:
            "Status must be Unread, Read, or Replied.",
        });
      }

      const enquiry =
        await Enquiry.findByIdAndUpdate(
          id,
          {
            status,
          },
          {
            new: true,
            runValidators: true,
          },
        );

      if (!enquiry) {
        return response.status(404).json({
          success: false,
          message:
            "Business enquiry not found.",
        });
      }

      return response.status(200).json({
        success: true,

        message:
          `Business enquiry marked as ${status}.`,

        data: enquiry,
      });
    } catch (error) {
      console.error(
        "Enquiry status update error:",
        error,
      );

      return response.status(500).json({
        success: false,
        message:
          "Unable to update the business enquiry status.",
      });
    }
  },
);

/**
 * DELETE /api/enquiries/:id
 *
 * Protected administrator route.
 * Permanently deletes one business enquiry.
 */
router.delete(
  "/:id",
  async (request, response) => {
    try {
      const { id } = request.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return response.status(400).json({
          success: false,
          message: "Invalid enquiry ID.",
        });
      }

      const enquiry =
        await Enquiry.findByIdAndDelete(id);

      if (!enquiry) {
        return response.status(404).json({
          success: false,
          message:
            "Business enquiry not found.",
        });
      }

      return response.status(200).json({
        success: true,
        message:
          "Business enquiry deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Enquiry deletion error:",
        error,
      );

      return response.status(500).json({
        success: false,
        message:
          "Unable to delete the business enquiry.",
      });
    }
  },
);

module.exports = router;