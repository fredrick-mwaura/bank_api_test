import admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.cert("serviceAccountKey.json")
});

export const sendPushNotification = async (tokens, title, body, data = {}) => {
  const message = {
    notification: {
      title,
      body
    },
    data,   // custom key/values like { loginAttempt: "true", deviceId: "xyz" }
    tokens
  };

  await admin.messaging().sendMulticast(message);
};
