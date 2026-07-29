const mongoose = require("mongoose");

/**
 * Product schema for Adam's Vegmate Limited.
 *
 * Each product represents a dish-specific, ready-to-cook
 * vegetable kit supplied to food-service businesses.
 */
const productSchema = new mongoose.Schema(
  {
    /**
     * Example: Sambar Vegetable Kit
     */
    name: {
      type: String,
      required: [true, "Product name is required."],
      trim: true,
      minlength: [
        2,
        "Product name must contain at least 2 characters.",
      ],
      maxlength: [
        200,
        "Product name cannot exceed 200 characters.",
      ],
    },

    /**
     * Internal URL-friendly product name.
     *
     * Example:
     * sambar-vegetable-kit
     */
    slug: {
      type: String,
      required: [true, "Product slug is required."],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [
        220,
        "Product slug cannot exceed 220 characters.",
      ],
    },

    /**
     * Name of the dish for which the kit is prepared.
     *
     * Example: Sambar
     */
    dishName: {
      type: String,
      required: [true, "Dish name is required."],
      trim: true,
      minlength: [
        2,
        "Dish name must contain at least 2 characters.",
      ],
      maxlength: [
        150,
        "Dish name cannot exceed 150 characters.",
      ],
    },

    shortDescription: {
      type: String,
      required: [true, "Short description is required."],
      trim: true,
      minlength: [
        10,
        "Short description must contain at least 10 characters.",
      ],
      maxlength: [
        300,
        "Short description cannot exceed 300 characters.",
      ],
    },

    fullDescription: {
      type: String,
      required: [true, "Full description is required."],
      trim: true,
      minlength: [
        20,
        "Full description must contain at least 20 characters.",
      ],
      maxlength: [
        5000,
        "Full description cannot exceed 5000 characters.",
      ],
    },

    /**
     * Uploaded product image URLs.
     */
    images: {
      type: [String],
      default: [],
      validate: {
        validator(images) {
          return images.length <= 10;
        },
        message:
          "A product can contain a maximum of 10 images.",
      },
    },

    /**
     * Cleaned and finely chopped vegetables included
     * inside the vacuum-packed kit.
     */
    vegetablesIncluded: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: [
            100,
            "A vegetable name cannot exceed 100 characters.",
          ],
        },
      ],
      default: [],
      validate: [
        {
          validator(vegetables) {
            return vegetables.length >= 1;
          },
          message:
            "At least one included vegetable is required.",
        },
        {
          validator(vegetables) {
            return vegetables.length <= 30;
          },
          message:
            "A product can contain a maximum of 30 vegetables.",
        },
      ],
    },

    /**
     * Only published products appear publicly.
     */
    published: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * Searchable product information.
 */
productSchema.index({
  name: "text",
  dishName: "text",
  shortDescription: "text",
  fullDescription: "text",
  vegetablesIncluded: "text",
});

/**
 * Improve public product retrieval.
 */
productSchema.index({
  published: 1,
  createdAt: -1,
});

const Product = mongoose.model(
  "Product",
  productSchema,
);

module.exports = Product;