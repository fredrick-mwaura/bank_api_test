import sendMail from "./MailConfig.js";
import crypto from "crypto"

const app_url = process.env.APP_URL
async function ResetPassword(email){
  try{
    let token = crypto.randomBytes(64).toString("hex");
      await Password.create({
        email, 
        token,
        expiresAt: Date.now() + 900000 //15mins
    });
    let resentLink = `${app_url}/reset-password?token=${token}&email=${email}`
    await sendMail(
      email ?? 'mwaurafredrick691@gmail.com',
      'email reset!',
      'verify email',
      `<b>${resentLink}</b>`
    );
  } catch(error){
    console.log('error in sending mail', error.message)
  }
}

// ResetPassword()
export default ResetPassword;
