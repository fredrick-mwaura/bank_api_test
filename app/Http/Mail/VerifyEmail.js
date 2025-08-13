import sendMail from "./MailConfig";
import dotenv from 'dotenv'

dotenv.config()

async function Verify(){
  await sendMail(
    // process.env.SMTP_USER ?? 'fredrickmwaura691@gmail.com',
    'mwaurafredrick691@gmail.com',
    'Verify mail',
    'just Verifying the mails up boy',
    '<strong style="font-weight: 900;">TEST</strong>'

  )
}

export default Verify;