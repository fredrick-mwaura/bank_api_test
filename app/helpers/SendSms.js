import Twilio from "twilio";
import { config } from "../../config/index.js";

const client = Twilio(config.twilio.sid, config.twilio.authtoken)

export const sendMessage = async(phoneNumber, message) => {
  await client.messages.create({
    to: phoneNumber,
    from: config.twilio.phone,
    body: message
  })
}

export function verify(phoneNumber, code){
    //verifiying phone
    const accountSid = config.twilio.acctId;
    const authToken = config.twilio.authtoken;
    const client = Twilio(accountSid, authToken);
  
    client.verify.v2.services(config.twilio.sid)
          .verificationChecks
          .create({to: phoneNumber, code: '[Code]'})
          .then(verification_check => console.log(verification_check.status));
  
}

export function verifyCode(phoneNumber, code){
  client.verify.v2.services(config.twilio.acctId)
    .verifications
    .create({ to: phoneNumber, channel: 'sms' })
    .then(verification => console.log(verification.status));

}