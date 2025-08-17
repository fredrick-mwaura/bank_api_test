import jwt from "jsonwebtoken"
import { config } from "../../config/index.js"
// Generate access and refresh tokens
const generateTokens = (user, rememberMe = false) => {
  const payload = {
    id: user._id,
    email: user.email,
    role: user.role,
  }

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  })

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: rememberMe ? "30d" : config.jwt.refreshExpiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  })

  return { accessToken, refreshToken }
}

// Verify refresh token
const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret, {
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  })
}

export {
  generateTokens,
  verifyRefreshToken,
}
