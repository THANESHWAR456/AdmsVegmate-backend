const mongoose = require("mongoose");

/**
 * Enquiry schema for Adam's Vegmate Limited.
 *
 * Supports two types of enquiries:
 *
 * 1. Product enquiry
 *    - Connected to a specific vegetable kit
 *    - Requires productId and productName
 *
 * 2. General business enquiry
 *    - Submitted from the public Contact page
 *    - Can include company, business type and enquiry topic
 */
const enquirySchema = new mongoose.Schema(
  {
    /**
     * Identifies whether the enquiry relates to a
     * specific vegetable kit or is a general business enquiry.
     */
    enquiryType: {
      type: String,
      enum: ["Product", "General"],
      default: "Product",
    },

    /**
     * Name of the person submitting the enquiry.
     */
    customerName: {
      type: String,
      required: [
        true,
        "Contact name is required.",
      ],
      trim: true,
      minlength: [
        2,
        "Contact name must contain at least 2 characters.",
      ],
      maxlength: [
        120,
        "Contact name cannot exceed 120 characters.",
      ],
    },

    /**
     * Business or company name.
     *
     * Optional for product enquiries but collected
     * by the main B2B Contact page.
     */
    company: {
      type: String,
      trim: true,
      maxlength: [
        150,
        "Company name cannot exceed 150 characters.",
      ],
      default: "",
    },

    /**
     * Type of food-service business.
     *
     * Examples:
     * - Restaurant
     * - Hotel
     * - Catering Company
     * - Cloud Kitchen
     * - Canteen
     * - Food Manufacturer
     * - Retail Food Supplier
     */
    businessType: {
      type: String,
      trim: true,
      maxlength: [
        150,
        "Business type cannot exceed 150 characters.",
      ],
      default: "",
    },

    /**
     * Main reason for the business enquiry.
     *
     * Examples:
     * - Regular Business Supply
     * - Bulk Supply Enquiry
     * - Custom Dish-Specific Kit
     */
    enquiryTopic: {
      type: String,
      trim: true,
      maxlength: [
        200,
        "Enquiry topic cannot exceed 200 characters.",
      ],
      default: "",
    },

    /**
     * Business email address.
     */
    email: {
      type: String,
      required: [
        true,
        "Email address is required.",
      ],
      trim: true,
      lowercase: true,
      maxlength: [
        200,
        "Email address cannot exceed 200 characters.",
      ],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address.",
      ],
    },

    /**
     * Contact phone number.
     *
     * Kept optional for compatibility with older
     * enquiries and product enquiry forms.
     */
    phone: {
      type: String,
      trim: true,
      maxlength: [
        50,
        "Phone number cannot exceed 50 characters.",
      ],
      default: "",
    },

    /**
     * Older general enquiries may use the subject field.
     *
     * It is retained for backwards compatibility.
     */
    subject: {
      type: String,
      trim: true,
      maxlength: [
        200,
        "Subject cannot exceed 200 characters.",
      ],
      default: "",
    },

    /**
     * Product ID is required only when the enquiry
     * relates to a specific vegetable kit.
     */
    productId: {
      type: String,
      trim: true,
      default: "",

      required: [
        function requireProductId() {
          return this.enquiryType === "Product";
        },

        "Vegetable-kit ID is required for product enquiries.",
      ],

      set(value) {
        return value == null
          ? ""
          : String(value).trim();
      },
    },

    /**
     * Vegetable-kit name.
     *
     * Required only for product enquiries.
     */
    productName: {
      type: String,
      trim: true,
      maxlength: [
        200,
        "Vegetable-kit name cannot exceed 200 characters.",
      ],
      default: "",

      required: [
        function requireProductName() {
          return this.enquiryType === "Product";
        },

        "Vegetable-kit name is required for product enquiries.",
      ],

      set(value) {
        return value == null
          ? ""
          : String(value).trim();
      },
    },

    /**
     * Supply requirements, product question or
     * general business enquiry message.
     */
    message: {
      type: String,
      required: [
        true,
        "Enquiry message is required.",
      ],
      trim: true,
      minlength: [
        5,
        "Message must contain at least 5 characters.",
      ],
      maxlength: [
        3000,
        "Message cannot exceed 3000 characters.",
      ],
    },

    /**
     * Administrator enquiry-management status.
     */
    status: {
      type: String,
      enum: ["Unread", "Read", "Replied"],
      default: "Unread",
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Improve administrator enquiry retrieval.
 */
enquirySchema.index({
  status: 1,
  createdAt: -1,
});

enquirySchema.index({
  enquiryType: 1,
  createdAt: -1,
});

const Enquiry = mongoose.model(
  "Enquiry",
  enquirySchema,
);

module.exports = Enquiry;