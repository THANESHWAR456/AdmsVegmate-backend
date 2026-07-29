const mongoose = require("mongoose");

/**
 * Social media links sub-schema.
 *
 * This keeps all business social links grouped together.
 */
const socialLinksSchema = new mongoose.Schema(
  {
    facebook: {
      type: String,
      trim: true,
      maxlength: [
        500,
        "Facebook URL cannot exceed 500 characters.",
      ],
      default: "",
    },

    instagram: {
      type: String,
      trim: true,
      maxlength: [
        500,
        "Instagram URL cannot exceed 500 characters.",
      ],
      default: "",
    },

    linkedin: {
      type: String,
      trim: true,
      maxlength: [
        500,
        "LinkedIn URL cannot exceed 500 characters.",
      ],
      default: "",
    },

    youtube: {
      type: String,
      trim: true,
      maxlength: [
        500,
        "YouTube URL cannot exceed 500 characters.",
      ],
      default: "",
    },

    twitter: {
      type: String,
      trim: true,
      maxlength: [
        500,
        "Twitter or X URL cannot exceed 500 characters.",
      ],
      default: "",
    },
  },
  {
    _id: false,
  },
);

/**
 * Website content schema.
 *
 * Only one document should exist in this collection.
 * That single document acts as the website's editable settings record.
 */
const websiteContentSchema = new mongoose.Schema(
  {
    /**
     * A fixed key helps us find the single website settings document.
     */
    settingsKey: {
      type: String,
      unique: true,
      default: "main",
      immutable: true,
    },

    businessName: {
      type: String,
      required: [true, "Business name is required."],
      trim: true,
      minlength: [
        2,
        "Business name must contain at least 2 characters.",
      ],
      maxlength: [
        150,
        "Business name cannot exceed 150 characters.",
      ],
      default: "ProductCatalog",
    },

    tagline: {
      type: String,
      trim: true,
      maxlength: [
        250,
        "Tagline cannot exceed 250 characters.",
      ],
      default:
        "Professional products and personalised customer support.",
    },

    /**
     * Home page hero content.
     */
    heroTitle: {
      type: String,
      required: [true, "Hero title is required."],
      trim: true,
      minlength: [
        5,
        "Hero title must contain at least 5 characters.",
      ],
      maxlength: [
        250,
        "Hero title cannot exceed 250 characters.",
      ],
      default:
        "Discover products designed for your business",
    },

    heroSubtitle: {
      type: String,
      required: [true, "Hero subtitle is required."],
      trim: true,
      minlength: [
        10,
        "Hero subtitle must contain at least 10 characters.",
      ],
      maxlength: [
        800,
        "Hero subtitle cannot exceed 800 characters.",
      ],
      default:
        "Explore detailed product information, specifications, features, availability, and contact us directly for professional assistance.",
    },

    heroImage: {
      type: String,
      trim: true,
      maxlength: [
        1000,
        "Hero image URL cannot exceed 1000 characters.",
      ],
      default: "",
    },

    heroPrimaryButtonText: {
      type: String,
      trim: true,
      maxlength: [
        80,
        "Primary button text cannot exceed 80 characters.",
      ],
      default: "Explore Products",
    },

    heroPrimaryButtonLink: {
      type: String,
      trim: true,
      maxlength: [
        500,
        "Primary button link cannot exceed 500 characters.",
      ],
      default: "/products",
    },

    heroSecondaryButtonText: {
      type: String,
      trim: true,
      maxlength: [
        80,
        "Secondary button text cannot exceed 80 characters.",
      ],
      default: "Browse Categories",
    },

    heroSecondaryButtonLink: {
      type: String,
      trim: true,
      maxlength: [
        500,
        "Secondary button link cannot exceed 500 characters.",
      ],
      default: "/categories",
    },

    /**
     * About Us content.
     */
    aboutTitle: {
      type: String,
      trim: true,
      maxlength: [
        200,
        "About title cannot exceed 200 characters.",
      ],
      default: "About Our Business",
    },

    aboutContent: {
      type: String,
      trim: true,
      maxlength: [
        5000,
        "About content cannot exceed 5000 characters.",
      ],
      default:
        "We provide carefully selected products with detailed information and direct customer support.",
    },

    aboutImage: {
      type: String,
      trim: true,
      maxlength: [
        1000,
        "About image URL cannot exceed 1000 characters.",
      ],
      default: "",
    },

    /**
     * Contact information.
     */
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [
        200,
        "Contact email cannot exceed 200 characters.",
      ],
      match: [
        /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid contact email address.",
      ],
      default: "",
    },

    contactPhone: {
      type: String,
      trim: true,
      maxlength: [
        50,
        "Contact phone cannot exceed 50 characters.",
      ],
      default: "",
    },

    alternatePhone: {
      type: String,
      trim: true,
      maxlength: [
        50,
        "Alternate phone cannot exceed 50 characters.",
      ],
      default: "",
    },

    businessAddress: {
      type: String,
      trim: true,
      maxlength: [
        1000,
        "Business address cannot exceed 1000 characters.",
      ],
      default: "",
    },

    businessHours: {
      type: String,
      trim: true,
      maxlength: [
        1000,
        "Business hours cannot exceed 1000 characters.",
      ],
      default: "",
    },

    googleMapsEmbedUrl: {
      type: String,
      trim: true,
      maxlength: [
        2000,
        "Google Maps embed URL cannot exceed 2000 characters.",
      ],
      default: "",
    },

    /**
     * Public contact-page introductory content.
     */
    contactPageTitle: {
      type: String,
      trim: true,
      maxlength: [
        200,
        "Contact page title cannot exceed 200 characters.",
      ],
      default: "Contact Us",
    },

    contactPageDescription: {
      type: String,
      trim: true,
      maxlength: [
        2000,
        "Contact page description cannot exceed 2000 characters.",
      ],
      default:
        "Contact us for product information, specifications, availability, and professional assistance.",
    },

    /**
     * Footer content.
     */
    footerText: {
      type: String,
      trim: true,
      maxlength: [
        1000,
        "Footer text cannot exceed 1000 characters.",
      ],
      default:
        "Professional product catalog and customer enquiry platform.",
    },

    copyrightText: {
      type: String,
      trim: true,
      maxlength: [
        500,
        "Copyright text cannot exceed 500 characters.",
      ],
      default: "All rights reserved.",
    },

    socialLinks: {
      type: socialLinksSchema,
      default: () => ({}),
    },

    /**
     * Controls whether customer testimonials appear publicly.
     */
    showTestimonials: {
      type: Boolean,
      default: true,
    },

    /**
     * Controls whether the About section appears on the Home page.
     */
    showHomeAboutSection: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Create or retrieve the single website settings document.
 *
 * This helper prevents duplicate settings records and provides
 * default content when the website is started for the first time.
 */
websiteContentSchema.statics.getSingleton = async function getSingleton() {
  let websiteContent = await this.findOne({
    settingsKey: "main",
  });

  if (!websiteContent) {
    websiteContent = await this.create({
      settingsKey: "main",
    });
  }

  return websiteContent;
};

const WebsiteContent = mongoose.model(
  "WebsiteContent",
  websiteContentSchema,
);

module.exports = WebsiteContent;