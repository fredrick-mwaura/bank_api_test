import crypto from 'crypto'
import { resolve } from 'path';

/**
 * rand string
 */

export const randomString = (length) => {
  let result = ""
  let characters ="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let charLen = characters.length;
  for (let i = 0; i  < length; i++){
    result += characters.charAt(Math.floor(Math.random() * charLen))
  }
  return result;
}
/**
 * 
 * @returns randTransaction id
 */
const generateTransactionId = () => {
  const timestamp = Date.now().toString(36)
  const randString = crypto.randomBytes(4).toString("hex").toUpperCase()
  return `FRD${timestamp}${randString}`  
}

const generateAccountNumber = () => {
  const timestamp = Date.now().toString().slice(-6)
  const randNum = Math.floor(Math.random() * 100000).toString().padStart(5, "0")
  return `${timestamp}${randNum}`
}

const formatCurrency = (amount, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount)
}

const generateOtp = (length = 6) => {
  const digits = '0123456789'
  let otp = ''
  for (let i = 0; i < length; i++){
    otp += digits[Math.floor(Math.random() * digits.length)]
  }
  return otp
}

const isEmailValid = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const isPhoneValid = (phone) => {
  const phoneRegex = /^\+?[\d\s\-$$$$]+$/
  return phoneRegex.test(phone) && phone.replace(/\D/g, "").length >= 10
}

const secureRand = (length = 16) => {
  return crypto.randomBytes(length).toString('base64url')
}

const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

const paginate = (page = 1, limit = 20) => {
  const offset = (page - 1) * limit
  return {
    offset,
    limit: Number.parseInt(limit)
  }
}

const calcAge = (DOB) => {
  const today = new Date()
  const birthDate = new Date(DOB)
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())){
    age--
  }
  return age
}

export {calcAge, paginate, sleep, secureRand, isPhoneValid, isEmailValid, generateAccountNumber, generateOtp, generateTransactionId, formatCurrency}