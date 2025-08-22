#!/bin/bash

# login req
echo -e "\n\n--- Login with Device Info ---\n"

# Login with device information for push notifications 
#deviceId => crypto rand no info about your device is taken
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doe@mail.com",
    "password": "StrongPass123!",
    "rememberMe": false,
    "deviceId": "63cfc44418dbffe7b710815a130057a162625c3ff3845ad7492464c9d2d485b7", 
    # "pushToken": "..."
  }'
