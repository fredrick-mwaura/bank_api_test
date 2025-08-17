import nodemailer from 'nodemailer'
import { config } from '../../../config/index.js';

let myEmail = config.mail.username ?? "fredrickmwaura691@gmail.com";
let password = config.mail.password ?? "sdvofrpatinaujjl"
console.log(myEmail, password)

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