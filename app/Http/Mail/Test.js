import sendMail from "./MailConfig";
import dotenv from 'dotenv'

dotenv.config()

async function test(){
  await sendMail(
    // process.env.SMTP_USER ?? 'fredrickmwaura691@gmail.com',
    'mwaurafredrick691@gmail.com',
    'test mail',
    'just testing the mails up boy',
    '<strong style="font-weight: 900;">TEST</strong>'

  )
}

test()