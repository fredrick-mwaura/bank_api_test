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