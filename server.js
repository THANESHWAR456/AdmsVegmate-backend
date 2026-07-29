/**
 * Adam's Vegmate Product Catalog backend server.
 *
 * This file:
 * - Creates the Express application
 * - Connects to MongoDB
 * - Applies security middleware
 * - Limits repeated requests
 * - Registers API routes
 * - Handles server errors safely
 */

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const {
  rateLimit,
} = require("express-rate-limit");

const enquiryRoutes = require(
  "./routes/enquiryRoutes",
);

const authRoutes = require(
  "./routes/authRoutes",
);

const productRoutes = require(
  "./routes/productRoutes",
);

const uploadRoutes = require(
  "./routes/uploadRoutes",
);

const websiteContentRoutes = require(
  "./routes/websiteContentRoutes",
);

const app = express();

const PORT =
  process.env.PORT || 5000;

const isProduction =
  process.env.NODE_ENV === "production";

/**
 * Remove the Express technology header.
 */
app.disable("x-powered-by");

/**
 * Prepare the list of frontend addresses that may
 * access the backend from a web browser.
 *
 * During local development:
 * http://localhost:5173
 *
 * During deployment, CLIENT_URL should contain the
 * production frontend address.
 */
const configuredOrigins = (
  process.env.CLIENT_URL || ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const developmentOrigins = isProduction
  ? []
  : [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ];

const allowedOrigins = new Set([
  ...developmentOrigins,
  ...configuredOrigins,
]);

/**
 * Add secure HTTP response headers.
 *
 * The cross-origin resource policy allows uploaded
 * product images to be displayed by the frontend.
 */
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  }),
);

/**
 * Restrict browser access to approved frontend URLs.
 */
app.use(
  cors({
    origin(origin, callback) {
      /**
       * Requests without an Origin header include
       * tools such as Postman and server health checks.
       */
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      const corsError = new Error(
        "Origin not allowed by CORS.",
      );

      corsError.statusCode = 403;

      return callback(corsError);
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PATCH",
      "PUT",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    maxAge: 86400,
  }),
);

/**
 * Display incoming requests in the terminal.
 */
app.use(
  morgan(
    isProduction ? "combined" : "dev",
  ),
);

/**
 * Create a consistent response when a request limit
 * has been exceeded.
 */
const createRateLimitHandler =
  (message) =>
  (request, response) => {
    response.status(429).json({
      success: false,
      message,
    });
  };

/**
 * General API rate limiter.
 *
 * Each IP address may make up to 300 API requests
 * within 15 minutes.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,

  standardHeaders: true,
  legacyHeaders: false,

  skip: (request) =>
    request.method === "OPTIONS",

  handler: createRateLimitHandler(
    "Too many requests. Please wait a few minutes and try again.",
  ),
});

/**
 * Admin login rate limiter.
 *
 * This helps reduce automated password guessing.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,

  standardHeaders: true,
  legacyHeaders: false,

  skip: (request) =>
    request.method === "OPTIONS",

  handler: createRateLimitHandler(
    "Too many login attempts. Please wait 15 minutes and try again.",
  ),
});

/**
 * Public enquiry rate limiter.
 *
 * Each IP address may send up to five enquiries
 * within one hour.
 */
const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,

  standardHeaders: true,
  legacyHeaders: false,

  skip: (request) =>
    request.method === "OPTIONS",

  handler: createRateLimitHandler(
    "Too many enquiries were submitted. Please wait before trying again.",
  ),
});

/**
 * Upload rate limiter.
 *
 * This helps reduce automated or excessive file uploads.
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,

  standardHeaders: true,
  legacyHeaders: false,

  skip: (request) =>
    request.method === "OPTIONS",

  handler: createRateLimitHandler(
    "Too many upload requests. Please wait before uploading again.",
  ),
});

/**
 * Apply the general limiter to every API route.
 *
 * Static product images under /uploads are not counted.
 */
app.use("/api", apiLimiter);

/**
 * Read JSON bodies.
 *
 * Product images should use the upload endpoint rather
 * than being stored as large Base64 JSON strings.
 */
app.use(
  express.json({
    limit: "1mb",
  }),
);

/**
 * Read URL-encoded form data.
 */
app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
    parameterLimit: 100,
  }),
);

/**
 * Make uploaded images publicly accessible.
 *
 * Hidden files and directory index pages are disabled.
 */
app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads"),
    {
      dotfiles: "deny",
      index: false,
      fallthrough: false,
      maxAge: isProduction
        ? "7d"
        : 0,
    },
  ),
);

/**
 * Apply the strict limiter specifically to admin login.
 */
app.use(
  "/api/auth/login",
  loginLimiter,
);

/**
 * Register authentication routes.
 */
app.use(
  "/api/auth",
  authRoutes,
);

/**
 * Apply the public enquiry limiter only when a new
 * enquiry is being submitted.
 */
app.post(
  "/api/enquiries",
  enquiryLimiter,
);

/**
 * Register enquiry routes.
 */
app.use(
  "/api/enquiries",
  enquiryRoutes,
);

/**
 * Register product routes.
 */
app.use(
  "/api/products",
  productRoutes,
);

/**
 * Protect file-upload requests with an additional limit.
 */
app.use(
  "/api/uploads",
  uploadLimiter,
  uploadRoutes,
);

/**
 * Register website-content routes.
 */
app.use(
  "/api/website-content",
  websiteContentRoutes,
);

/**
 * Backend health-check endpoint.
 */
app.get(
  "/api/health",
  (request, response) => {
    response.status(200).json({
      success: true,
      message:
        "Product Catalog backend is running.",
    });
  },
);

/**
 * Handle unknown API routes.
 */
app.use(
  "/api",
  (request, response) => {
    response.status(404).json({
      success: false,
      message: "API route not found.",
    });
  },
);

/**
 * Handle errors from static uploaded files.
 */
app.use(
  (
    error,
    request,
    response,
    next,
  ) => {
    if (
      error.status === 404 &&
      request.originalUrl.startsWith(
        "/uploads/",
      )
    ) {
      return response.status(404).json({
        success: false,
        message:
          "Uploaded file not found.",
      });
    }

    return next(error);
  },
);

/**
 * Handle unexpected server errors.
 *
 * Internal error details are never returned to visitors.
 */
app.use(
  (
    error,
    request,
    response,
    next,
  ) => {
    if (response.headersSent) {
      return next(error);
    }

    const statusCode =
      error.statusCode ||
      error.status ||
      500;

    if (statusCode >= 500) {
      console.error(
        "Unhandled server error:",
        error,
      );
    }

    const publicMessage =
      statusCode === 403
        ? "This request is not permitted."
        : statusCode === 413
          ? "The submitted request is too large."
          : statusCode >= 500
            ? "An unexpected server error occurred."
            : error.message ||
              "The request could not be completed.";

    return response
      .status(statusCode)
      .json({
        success: false,
        message: publicMessage,
      });
  },
);

/**
 * Validate required environment variables.
 */
function validateEnvironment() {
  const requiredVariables = [
    "MONGO_URI",
    "JWT_SECRET",
  ];

  const missingVariables =
    requiredVariables.filter(
      (variableName) =>
        !process.env[variableName],
    );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missingVariables.join(
        ", ",
      )}`,
    );
  }

  if (
    isProduction &&
    configuredOrigins.length === 0
  ) {
    throw new Error(
      "CLIENT_URL is required in production.",
    );
  }

  if (
    process.env.JWT_SECRET.length < 32
  ) {
    throw new Error(
      "JWT_SECRET must contain at least 32 characters.",
    );
  }
}

/**
 * Connect to MongoDB and start the Express server.
 */
async function startServer() {
  try {
    validateEnvironment();

    await mongoose.connect(
      process.env.MONGO_URI,
    );

    console.log(
      "MongoDB connected successfully.",
    );

    app.listen(PORT, () => {
      console.log(
        `Backend server running on http://localhost:${PORT}`,
      );
    });
  } catch (error) {
    console.error(
      "Server startup failed:",
      error.message,
    );

    process.exit(1);
  }
}

startServer();