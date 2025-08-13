import nodemailer from 'nodemailer'
import dotenv from 'dotenv'

dotenv.config()

let myEmail = process.env.SMTP_USER ?? "fredrickmwaura691@gmail.com";
let password = process.env.SMTP_PASS ?? "sdvofrpatinaujjl"
// console.log(myEmail, password)

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: myEmail,
    pass: password
  }
});

function sendMail(to, subject, text, html){
  const mailOptions = {
    from: myEmail,
    to,
    subject, 
    text,
    html
  }
  return transporter.sendMail(mailOptions)
}

export default sendMail;