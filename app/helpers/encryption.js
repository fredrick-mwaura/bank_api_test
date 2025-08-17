import crypto from "crypto"
import config from "../config/index.js"

const algorithm = "aes-256-gcm"
const secretKey = config.security.encryptionKey

// Encrypt function
export const encrypt = (text) => {
  if (!text) return null

  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipher(algorithm, secretKey)

  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")

  const authTag = cipher.getAuthTag()

  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  }
}

// Decrypt function
export const decrypt = (encryptedData) => {
  if (!encryptedData) return null

  const { encrypted, iv, authTag } = encryptedData
  const decipher = crypto.createDecipher(algorithm, secretKey)

  decipher.setAuthTag(Buffer.from(authTag, "hex"))

  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

// Hash function for one-way encryption
export const hash = (text) => {
  return crypto.createHash("sha256").update(text).digest("hex")
}

// Generate random token
export const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex")
}
