import Twilio from "twilio";
import { config } from "../../config/index.js";

const accountSid = config.twilio.acctId;
const authToken = config.twilio.authtoken;
const serviceSid = config.twilio.sid;

const client = Twilio(accountSid, authToken);

export default {
  sendVerificationCode: async (phone) => {
    return await client.verify.v2
      .services(serviceSid)
      .verifications
      .create({ to: phone, channel: "sms" });
  },

  checkVerificationCode: async (phone, code) => {
    return await client.verify.v2
      .services(serviceSid)
      .verificationChecks
      .create({ to: phone, code });
  }
};
