const express = require("express");
const mongoose = require("mongoose");

const Product = require("../models/Product");
const protectAdmin = require(
  "../middleware/authMiddleware",
);

const router = express.Router();

/**
 * Convert product names into URL-friendly slugs.
 *
 * Example:
 * "Sambar Vegetable Kit"
 * becomes:
 * "sambar-vegetable-kit"
 */
function createSlug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Create a unique product slug.
 */
async function createUniqueSlug(
  name,
  ignoredProductId = null,
) {
  const baseSlug = createSlug(name);

  if (!baseSlug) {
    throw new Error(
      "Unable to create a valid product slug.",
    );
  }

  const query = {
    slug: baseSlug,
  };

  if (ignoredProductId) {
    query._id = {
      $ne: ignoredProductId,
    };
  }

  const existingProduct =
    await Product.findOne(query);

  if (!existingProduct) {
    return baseSlug;
  }

  return `${baseSlug}-${Date.now()}`;
}

/**
 * Clean arrays received from the frontend.
 *
 * Removes blank entries and surrounding spaces.
 */
function cleanStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => String(value).trim())
    .filter(Boolean);
}

/* =========================================================
   PUBLIC PRODUCT ROUTES
   ========================================================= */

/**
 * GET /api/products
 *
 * Returns published vegetable-kit products.
 *
 * Optional parameters:
 * ?search=sambar
 * ?page=1
 * ?limit=12
 */
router.get("/", async (request, response) => {
  try {
    const {
      search = "",
      page = "1",
      limit = "12",
    } = request.query;

    const pageNumber = Math.max(
      Number.parseInt(page, 10) || 1,
      1,
    );

    const limitNumber = Math.min(
      Math.max(
        Number.parseInt(limit, 10) || 12,
        1,
      ),
      100,
    );

    const filter = {
      published: true,
    };

    if (search.trim()) {
      filter.$text = {
        $search: search.trim(),
      };
    }

    const skip =
      (pageNumber - 1) * limitNumber;

    const [products, totalProducts] =
      await Promise.all([
        Product.find(filter)
          .sort({
            createdAt: -1,
          })
          .skip(skip)
          .limit(limitNumber),

        Product.countDocuments(filter),
      ]);

    const totalPages = Math.ceil(
      totalProducts / limitNumber,
    );

    return response.status(200).json({
      success: true,
      count: products.length,
      totalProducts,
      currentPage: pageNumber,
      totalPages,
      data: products,
    });
  } catch (error) {
    console.error(
      "Public product retrieval error:",
      error,
    );

    return response.status(500).json({
      success: false,
      message:
        "Unable to retrieve vegetable kits.",
    });
  }
});

/**
 * GET /api/products/slug/:slug
 *
 * Returns one published product using its slug.
 */
router.get(
  "/slug/:slug",
  async (request, response) => {
    try {
      const product = await Product.findOne({
        slug: request.params.slug.toLowerCase(),
        published: true,
      });

      if (!product) {
        return response.status(404).json({
          success: false,
          message: "Vegetable kit not found.",
        });
      }

      return response.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      console.error(
        "Public product details error:",
        error,
      );

      return response.status(500).json({
        success: false,
        message:
          "Unable to retrieve the vegetable kit.",
      });
    }
  },
);

/**
 * GET /api/products/:id
 *
 * Returns one published product using its MongoDB ID.
 */
router.get(
  "/:id",
  async (request, response, next) => {
    if (request.params.id === "admin") {
      return next();
    }

    try {
      const { id } = request.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return response.status(400).json({
          success: false,
          message: "Invalid product ID.",
        });
      }

      const product = await Product.findOne({
        _id: id,
        published: true,
      });

      if (!product) {
        return response.status(404).json({
          success: false,
          message: "Vegetable kit not found.",
        });
      }

      return response.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      console.error(
        "Public product retrieval error:",
        error,
      );

      return response.status(500).json({
        success: false,
        message:
          "Unable to retrieve the vegetable kit.",
      });
    }
  },
);

/* =========================================================
   PROTECTED ADMIN PRODUCT ROUTES
   ========================================================= */

router.use(protectAdmin);

/**
 * GET /api/products/admin/all
 *
 * Returns published and unpublished products.
 */
router.get(
  "/admin/all",
  async (request, response) => {
    try {
      const products = await Product.find().sort({
        createdAt: -1,
      });

      return response.status(200).json({
        success: true,
        count: products.length,
        data: products,
      });
    } catch (error) {
      console.error(
        "Admin product retrieval error:",
        error,
      );

      return response.status(500).json({
        success: false,
        message:
          "Unable to retrieve vegetable kits.",
      });
    }
  },
);

/**
 * GET /api/products/admin/:id
 *
 * Returns one product for administrator editing.
 */
router.get(
  "/admin/:id",
  async (request, response) => {
    try {
      const { id } = request.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return response.status(400).json({
          success: false,
          message: "Invalid product ID.",
        });
      }

      const product =
        await Product.findById(id);

      if (!product) {
        return response.status(404).json({
          success: false,
          message: "Vegetable kit not found.",
        });
      }

      return response.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      console.error(
        "Admin product details error:",
        error,
      );

      return response.status(500).json({
        success: false,
        message:
          "Unable to retrieve the vegetable kit.",
      });
    }
  },
);

/**
 * POST /api/products
 *
 * Creates a vegetable-kit product.
 */
router.post("/", async (request, response) => {
  try {
    const {
      name,
      dishName,
      shortDescription,
      fullDescription,
      images = [],
      vegetablesIncluded = [],
      published = true,
    } = request.body;

    if (!name || !name.trim()) {
      return response.status(400).json({
        success: false,
        message: "Product name is required.",
      });
    }

    if (!dishName || !dishName.trim()) {
      return response.status(400).json({
        success: false,
        message: "Dish name is required.",
      });
    }

    if (
      !shortDescription ||
      !shortDescription.trim()
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Short description is required.",
      });
    }

    if (
      !fullDescription ||
      !fullDescription.trim()
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Full description is required.",
      });
    }

    const cleanedVegetables =
      cleanStringArray(
        vegetablesIncluded,
      );

    if (cleanedVegetables.length === 0) {
      return response.status(400).json({
        success: false,
        message:
          "At least one included vegetable is required.",
      });
    }

    const slug =
      await createUniqueSlug(name);

    const product = await Product.create({
      name: name.trim(),
      slug,
      dishName: dishName.trim(),
      shortDescription:
        shortDescription.trim(),
      fullDescription:
        fullDescription.trim(),
      images: cleanStringArray(images),
      vegetablesIncluded:
        cleanedVegetables,
      published: Boolean(published),
    });

    return response.status(201).json({
      success: true,
      message:
        "Vegetable kit created successfully.",
      data: product,
    });
  } catch (error) {
    console.error(
      "Product creation error:",
      error,
    );

    if (error.code === 11000) {
      return response.status(409).json({
        success: false,
        message:
          "A vegetable kit with this name already exists.",
      });
    }

    return response.status(400).json({
      success: false,
      message:
        error.message ||
        "Unable to create the vegetable kit.",
    });
  }
});

/**
 * PATCH /api/products/:id
 *
 * Updates an existing vegetable-kit product.
 */
router.patch(
  "/:id",
  async (request, response) => {
    try {
      const { id } = request.params;

      if (
        !mongoose.Types.ObjectId.isValid(id)
      ) {
        return response.status(400).json({
          success: false,
          message: "Invalid product ID.",
        });
      }

      const product =
        await Product.findById(id);

      if (!product) {
        return response.status(404).json({
          success: false,
          message: "Vegetable kit not found.",
        });
      }

      const {
        name,
        dishName,
        shortDescription,
        fullDescription,
        images,
        vegetablesIncluded,
        published,
      } = request.body;

      if (name !== undefined) {
        if (!String(name).trim()) {
          return response.status(400).json({
            success: false,
            message:
              "Product name cannot be empty.",
          });
        }

        product.name = String(name).trim();

        product.slug =
          await createUniqueSlug(
            product.name,
            id,
          );
      }

      if (dishName !== undefined) {
        product.dishName =
          String(dishName).trim();
      }

      if (
        shortDescription !== undefined
      ) {
        product.shortDescription =
          String(shortDescription).trim();
      }

      if (
        fullDescription !== undefined
      ) {
        product.fullDescription =
          String(fullDescription).trim();
      }

      if (images !== undefined) {
        product.images =
          cleanStringArray(images);
      }

      if (
        vegetablesIncluded !== undefined
      ) {
        const cleanedVegetables =
          cleanStringArray(
            vegetablesIncluded,
          );

        if (
          cleanedVegetables.length === 0
        ) {
          return response.status(400).json({
            success: false,
            message:
              "At least one included vegetable is required.",
          });
        }

        product.vegetablesIncluded =
          cleanedVegetables;
      }

      if (published !== undefined) {
        product.published =
          Boolean(published);
      }

      await product.save();

      return response.status(200).json({
        success: true,
        message:
          "Vegetable kit updated successfully.",
        data: product,
      });
    } catch (error) {
      console.error(
        "Product update error:",
        error,
      );

      return response.status(400).json({
        success: false,
        message:
          error.message ||
          "Unable to update the vegetable kit.",
      });
    }
  },
);

/**
 * DELETE /api/products/:id
 *
 * Permanently deletes a vegetable-kit product.
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
          message: "Invalid product ID.",
        });
      }

      const product =
        await Product.findByIdAndDelete(id);

      if (!product) {
        return response.status(404).json({
          success: false,
          message: "Vegetable kit not found.",
        });
      }

      return response.status(200).json({
        success: true,
        message:
          "Vegetable kit deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Product deletion error:",
        error,
      );

      return response.status(500).json({
        success: false,
        message:
          "Unable to delete the vegetable kit.",
      });
    }
  },
);

module.exports = router;