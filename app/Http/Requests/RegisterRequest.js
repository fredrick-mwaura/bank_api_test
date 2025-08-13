import { body } from "express-validator";

export const RegisterRequest = () => [
  body("firstName")
    .notEmpty().withMessage("First name is required")
    .isAlpha().withMessage("First name must contain only letters"),
  body("lastName")
    .notEmpty().withMessage("Last name is required")
    .isAlpha().withMessage("Last name must contain only letters"),
  body("email")
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Must be a valid email")
    .normalizeEmail(),
  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("phoneNumber")
    .notEmpty().withMessage("Phone number is required")
    .isMobilePhone("any").withMessage("Invalid phone number"),
  body("dateOfBirth")
    .notEmpty().withMessage("Date of birth is required")
    .isDate().withMessage("Date of birth must be a valid date"),
];
