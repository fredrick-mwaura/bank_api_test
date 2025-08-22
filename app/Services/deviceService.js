import Device from "../Models/Device.js";
import { sendPushNotification } from "./firebase.js";


export const deviceLogin = async (userId, identifier, deviceId, pushToken, isFirstLogin = false) => {
  let device = await Device.findOne({userId, deviceId})

  if(!device){
    device = Device.create({
      userId, identifier, deviceId, pushToken, verified: isFirstLogin ? true : false
    });
    if(!isFirstLogin){
      const otherDevices = await Device.find({
        userId,
        // not equal to deviceId
        deviceId: {$ne: deviceId}
      })

      const tokens = otherDevices.map(d => d.pushToken)
      if(tokens.length > 0){
        await sendPushNotification(
          token,
          "New device Login",
          `A new device tried to logging into your account (${identifier})`,
          {deviceId}
        )
      }
    }    
  }else{
      device.lastUsed = new Date()
      device.verified = true
      await device.save()
  }
  return device
}