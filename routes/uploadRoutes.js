const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const express = require("express");
const multer = require("multer");

const protectAdmin = require(
  "../middleware/authMiddleware",
);

const router = express.Router();

/**
 * Maximum image size:
 * 5 MB per uploaded image.
 */
const MAX_IMAGE_SIZE =
  5 * 1024 * 1024;

/**
 * Supported image MIME types and their
 * safe server-generated extensions.
 */
const imageExtensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const allowedImageTypes = new Set(
  Object.keys(imageExtensions),
);

/**
 * Valid upload folders.
 *
 * Categories were removed from the application,
 * so category uploads are no longer accepted.
 */
const allowedUploadTypes = new Set([
  "products",
  "website",
]);

/**
 * Ensure an upload directory exists.
 */
function ensureDirectoryExists(
  directoryPath,
) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, {
      recursive: true,
    });
  }
}

/**
 * Return the approved upload directory.
 */
function getUploadDirectory(
  uploadType,
) {
  if (
    !allowedUploadTypes.has(uploadType)
  ) {
    throw new Error(
      "Invalid image upload type.",
    );
  }

  const uploadDirectory = path.join(
    __dirname,
    "..",
    "uploads",
    uploadType,
  );

  ensureDirectoryExists(
    uploadDirectory,
  );

  return uploadDirectory;
}

/**
 * Remove files when validation fails.
 */
async function removeUploadedFiles(
  files = [],
) {
  await Promise.all(
    files.map(async (file) => {
      if (!file?.path) {
        return;
      }

      try {
        await fs.promises.unlink(
          file.path,
        );
      } catch (error) {
        if (error.code !== "ENOENT") {
          console.error(
            "Unable to remove rejected upload:",
            error,
          );
        }
      }
    }),
  );
}

/**
 * Multer disk-storage configuration.
 */
const storage = multer.diskStorage({
  destination(
    request,
    file,
    callback,
  ) {
    try {
      const uploadDirectory =
        getUploadDirectory(
          request.params.type,
        );

      callback(
        null,
        uploadDirectory,
      );
    } catch (error) {
      callback(error);
    }
  },

  filename(
    request,
    file,
    callback,
  ) {
    /**
     * Never use the extension supplied in the
     * original filename.
     */
    const safeExtension =
      imageExtensions[file.mimetype];

    if (!safeExtension) {
      return callback(
        new Error(
          "Unsupported image type.",
        ),
      );
    }

    const randomFilename =
      crypto
        .randomBytes(24)
        .toString("hex");

    return callback(
      null,
      `${Date.now()}-${randomFilename}${safeExtension}`,
    );
  },
});

/**
 * Preliminary MIME-type validation.
 *
 * The file signature is checked separately after
 * Multer writes the file.
 */
function imageFileFilter(
  request,
  file,
  callback,
) {
  if (
    !allowedImageTypes.has(
      file.mimetype,
    )
  ) {
    return callback(
      new Error(
        "Only JPG, JPEG, PNG and WEBP images are allowed.",
      ),
    );
  }

  return callback(null, true);
}

/**
 * Multer uploader.
 */
const upload = multer({
  storage,

  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: 10,
    fields: 5,
    parts: 15,
  },

  fileFilter: imageFileFilter,
});

/**
 * Check the actual file header.
 *
 * This prevents ordinary non-image files from being
 * accepted merely because the uploader supplied an
 * image MIME type.
 */
async function detectImageMimeType(
  filePath,
) {
  const fileHandle =
    await fs.promises.open(
      filePath,
      "r",
    );

  try {
    const header =
      Buffer.alloc(12);

    await fileHandle.read(
      header,
      0,
      header.length,
      0,
    );

    /**
     * JPEG:
     * FF D8 FF
     */
    if (
      header[0] === 0xff &&
      header[1] === 0xd8 &&
      header[2] === 0xff
    ) {
      return "image/jpeg";
    }

    /**
     * PNG:
     * 89 50 4E 47 0D 0A 1A 0A
     */
    const pngSignature =
      Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ]);

    if (
      header
        .subarray(0, 8)
        .equals(pngSignature)
    ) {
      return "image/png";
    }

    /**
     * WEBP:
     * RIFF....WEBP
     */
    if (
      header
        .subarray(0, 4)
        .toString("ascii") ===
        "RIFF" &&
      header
        .subarray(8, 12)
        .toString("ascii") ===
        "WEBP"
    ) {
      return "image/webp";
    }

    return null;
  } finally {
    await fileHandle.close();
  }
}

/**
 * Validate the upload type before Multer creates files.
 */
function validateUploadType(
  request,
  response,
  next,
) {
  if (
    !allowedUploadTypes.has(
      request.params.type,
    )
  ) {
    return response
      .status(400)
      .json({
        success: false,
        message:
          "Invalid image upload type.",
      });
  }

  return next();
}

/**
 * Use a different maximum file count depending
 * on the upload destination.
 */
function uploadImages(
  request,
  response,
  next,
) {
  const maximumFiles =
    request.params.type ===
    "website"
      ? 1
      : 10;

  const uploadMiddleware =
    upload.array(
      "images",
      maximumFiles,
    );

  return uploadMiddleware(
    request,
    response,
    next,
  );
}

/**
 * Return the public backend address.
 *
 * The deployment team should set:
 *
 * PUBLIC_BACKEND_URL=https://api.example.com
 */
function getPublicBackendUrl(
  request,
) {
  const configuredUrl =
    process.env.PUBLIC_BACKEND_URL
      ?.trim()
      .replace(/\/+$/, "");

  if (configuredUrl) {
    return configuredUrl;
  }

  return `${request.protocol}://${request.get(
    "host",
  )}`;
}

/**
 * POST /api/uploads/:type
 *
 * Protected administrator route.
 *
 * Valid upload types:
 * - products
 * - website
 *
 * Multipart field:
 * images
 */
router.post(
  "/:type",
  protectAdmin,
  validateUploadType,
  uploadImages,
  async (request, response) => {
    const files =
      request.files || [];

    if (files.length === 0) {
      return response
        .status(400)
        .json({
          success: false,
          message:
            "Please select at least one image.",
        });
    }

    try {
      /**
       * Confirm that every file's real signature
       * matches its reported MIME type.
       */
      for (const file of files) {
        const detectedMimeType =
          await detectImageMimeType(
            file.path,
          );

        if (
          !detectedMimeType ||
          detectedMimeType !==
            file.mimetype
        ) {
          await removeUploadedFiles(
            files,
          );

          return response
            .status(400)
            .json({
              success: false,
              message:
                "One or more uploaded files are not valid images.",
            });
        }
      }

      const publicBackendUrl =
        getPublicBackendUrl(
          request,
        );

      const imageUrls =
        files.map(
          (file) =>
            `${publicBackendUrl}/uploads/${request.params.type}/${file.filename}`,
        );

      return response
        .status(201)
        .json({
          success: true,

          message:
            files.length === 1
              ? "Image uploaded successfully."
              : "Images uploaded successfully.",

          data: {
            images: imageUrls,
          },
        });
    } catch (error) {
      await removeUploadedFiles(
        files,
      );

      console.error(
        "Image validation error:",
        error,
      );

      return response
        .status(500)
        .json({
          success: false,
          message:
            "Unable to validate the uploaded image.",
        });
    }
  },
);

/**
 * Handle Multer and upload errors.
 */
router.use(
  async (
    error,
    request,
    response,
    next,
  ) => {
    await removeUploadedFiles(
      request.files || [],
    );

    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return response
          .status(400)
          .json({
            success: false,
            message:
              "Each image must be 5 MB or smaller.",
          });
      }

      if (
        error.code ===
          "LIMIT_FILE_COUNT" ||
        error.code ===
          "LIMIT_UNEXPECTED_FILE"
      ) {
        const message =
          request.params.type ===
          "website"
            ? "Only one website image can be uploaded at a time."
            : "A maximum of 10 product images can be uploaded.";

        return response
          .status(400)
          .json({
            success: false,
            message,
          });
      }

      return response
        .status(400)
        .json({
          success: false,
          message:
            "The image upload could not be completed.",
        });
    }

    if (error) {
      return response
        .status(400)
        .json({
          success: false,
          message:
            error.message ||
            "Unable to upload the image.",
        });
    }

    return next();
  },
);

module.exports = router;