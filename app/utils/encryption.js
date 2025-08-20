import crypto from 'crypto'

const algorithm = 'aes-256-gcm'
const secretKey = process.env.ENCRIPTION_KEY

export const encrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, iv);

  let encryped = cipher.update(text, 'utf-8', 'hex');
  encryped += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  
  return {
    encryped,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

export const decrypt = (encryptedData) => {
  const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(encryptedData.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'))

  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8')
  decrypted = decipher.final('utf-8')

  return decrypted;
}
