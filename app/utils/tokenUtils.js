import jwt from "jsonwebtoken"
import { config } from "../../config/index.js"

// Generate access and refresh tokens
const generateTokens = (user, rememberMe = false) => {
  try {
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
    }

    // Use hardcoded valid time formats to avoid environment variable issues
    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: "7d", // Hardcoded valid format
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    })

    const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: rememberMe ? "30d" : "30d", // Hardcoded valid format
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    })

    return { accessToken, refreshToken }
  } catch (error) {
    console.error("Token generation error:", error)
    throw new Error("Failed to generate authentication tokens")
  }
}

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    })
  } catch (error) {
    console.error("Refresh token verification error:", error)
    throw new Error("Invalid refresh token")
  }
}

// Verify access token
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    })
  } catch (error) {
    console.error("Access token verification error:", error)
    throw new Error("Invalid access token")
  }
}

export {
  generateTokens,
  verifyRefreshToken,
  verifyAccessToken,
}
