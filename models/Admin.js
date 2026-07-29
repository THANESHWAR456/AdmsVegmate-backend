const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

/**
 * Password-security configuration.
 *
 * bcrypt only processes the first 72 bytes of a password,
 * so longer passwords must be rejected rather than silently
 * truncated.
 */
const BCRYPT_SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_BYTES = 72;

/**
 * Validate the password using its UTF-8 byte length.
 *
 * A character may use more than one byte, so checking only
 * password.length is not sufficient for bcrypt.
 */
function passwordHasValidByteLength(password) {
  if (typeof password !== "string") {
    return false;
  }

  const passwordBytes = Buffer.byteLength(
    password,
    "utf8",
  );

  return (
    passwordBytes <= MAX_PASSWORD_BYTES
  );
}

/**
 * Admin schema.
 *
 * Administrator passwords are never stored as plain text.
 * The password is hashed automatically before the document
 * is saved.
 */
const adminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [
        true,
        "Admin name is required.",
      ],
      trim: true,
      minlength: [
        2,
        "Admin name must contain at least 2 characters.",
      ],
      maxlength: [
        100,
        "Admin name cannot exceed 100 characters.",
      ],
    },

    email: {
      type: String,
      required: [
        true,
        "Admin email is required.",
      ],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [
        254,
        "Admin email cannot exceed 254 characters.",
      ],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address.",
      ],
    },

    password: {
      type: String,
      required: [
        true,
        "Admin password is required.",
      ],

      minlength: [
        MIN_PASSWORD_LENGTH,
        `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
      ],

      validate: {
        validator:
          passwordHasValidByteLength,

        message:
          "Password cannot exceed 72 UTF-8 bytes.",
      },

      /**
       * Prevent password hashes from being returned
       * automatically by database queries.
       */
      select: false,
    },

    role: {
      type: String,
      enum: ["admin"],
      default: "admin",
      immutable: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,

    /**
     * Remove sensitive fields whenever an administrator
     * document is converted to JSON.
     */
    toJSON: {
      transform(
        document,
        returnedObject,
      ) {
        delete returnedObject.password;
        delete returnedObject.passwordChangedAt;

        return returnedObject;
      },
    },

    toObject: {
      transform(
        document,
        returnedObject,
      ) {
        delete returnedObject.password;
        delete returnedObject.passwordChangedAt;

        return returnedObject;
      },
    },
  },
);

/**
 * Hash a new or changed password before saving.
 *
 * Mongoose runs document validation before the normal
 * save middleware, so the plain password is validated
 * before it is replaced with a bcrypt hash.
 */
adminSchema.pre(
  "save",
  async function hashPassword() {
    if (!this.isModified("password")) {
      return;
    }

    if (
      typeof this.password !== "string"
    ) {
      throw new Error(
        "Admin password must be a string.",
      );
    }

    const passwordBytes =
      Buffer.byteLength(
        this.password,
        "utf8",
      );

    if (
      passwordBytes >
      MAX_PASSWORD_BYTES
    ) {
      throw new Error(
        "Password cannot exceed 72 UTF-8 bytes.",
      );
    }

    this.password = await bcrypt.hash(
      this.password,
      BCRYPT_SALT_ROUNDS,
    );

    /**
     * Existing accounts may not have a creation timestamp
     * yet, so only record this as a password change after
     * the document has previously been stored.
     */
    if (!this.isNew) {
      this.passwordChangedAt =
        new Date(
          Date.now() - 1000,
        );
    }
  },
);

/**
 * Prevent password changes through query-based updates.
 *
 * Operations such as findOneAndUpdate() do not execute
 * the document save-password hook. Password changes must
 * therefore use:
 *
 * admin.password = newPassword;
 * await admin.save();
 */
function blockUnsafePasswordUpdate() {
  const update =
    this.getUpdate() || {};

  const directPassword =
    update.password;

  const setPassword =
    update.$set?.password;

  const setOnInsertPassword =
    update.$setOnInsert?.password;

  if (
    directPassword !== undefined ||
    setPassword !== undefined ||
    setOnInsertPassword !== undefined
  ) {
    throw new Error(
      "Admin passwords must be changed using document.save().",
    );
  }
}

[
  "findOneAndUpdate",
  "updateOne",
  "updateMany",
].forEach((middlewareName) => {
  adminSchema.pre(
    middlewareName,
    blockUnsafePasswordUpdate,
  );
});

/**
 * Compare a submitted login password with the stored
 * bcrypt hash.
 */
adminSchema.methods.comparePassword =
  async function comparePassword(
    enteredPassword,
  ) {
    if (
      typeof enteredPassword !==
        "string" ||
      typeof this.password !==
        "string"
    ) {
      return false;
    }

    const enteredPasswordBytes =
      Buffer.byteLength(
        enteredPassword,
        "utf8",
      );

    if (
      enteredPasswordBytes >
      MAX_PASSWORD_BYTES
    ) {
      return false;
    }

    return bcrypt.compare(
      enteredPassword,
      this.password,
    );
  };

/**
 * Check whether a token was issued before the latest
 * password change.
 */
adminSchema.methods.passwordChangedAfter =
  function passwordChangedAfter(
    tokenIssuedAt,
  ) {
    if (!this.passwordChangedAt) {
      return false;
    }

    const passwordChangedTimestamp =
      Math.floor(
        this.passwordChangedAt.getTime() /
          1000,
      );

    return (
      passwordChangedTimestamp >
      tokenIssuedAt
    );
  };

const Admin = mongoose.model(
  "Admin",
  adminSchema,
);

module.exports = Admin;