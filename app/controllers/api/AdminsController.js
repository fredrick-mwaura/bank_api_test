import Admin from "../../Models/Admin.js"
import * as emailService from '../../Services/EmailService.js'
import { config } from "../../../config/index.js"
import logger from "../../utils/logger.js"
import bcrypt from "bcryptjs"

class AdminsController{

  async Register(req, res) {
    let adminCount = Admin.find({role: "admin"}).countDocuments()
    if(adminCount >= 1){
      ////for x-forwarded-for req
      // let xForwardedFor = req.headers['x-forwarded-for']
      // if (xForwardedFor) {
      //   let list = xForwardedFor.split(',')
      //   ipAddress = list[0] //get client ip - first one
      // }else{
      //  return ipAddress = req.socket.remoteAddress
      // }
      const ipAddress = req.ip
      const locationResp = await fetch(`${config.privates.ipstack_url}/${ipAddress}?access_key=${config.privates.ipstack}`)
          .then((response) => response.json())
          .then((data)=> { 
            return data 
          })
          .catch((err) => {
            console.error("Failed to fetch location from ipstack", err)
            return {}
          })

      let email = config.adminEmail
      if(!email){
        console.error("Admin email not set in environment variable ADMIN_EMAIL")
        return res.status(500).json({
          success: false,
          message: "Can not create account"
        })
      }
      locationResp = {
        ...locationResp,
        userAgent: req.get("User-Agent")
      }
      let alertData = {
        type: "vital",
        ipAddress: ipAddress,
        location: locationResp,
        timestamp: new Date(),
        subject: "Admin Account Creation Attempt",
        message: `There was an unauthorized attempt to create an admin account on your system. Since an admin account already exists, this action was blocked. Please review the details below and ensure your system's security.`,
        alert: "Unauthorized Admin Account Creation Attempt",
        action: "No action was taken as an admin account already exists. If this wasn't you, please ensure your system's security."
      }

      await emailService.sendSecurityAlert(email, alertData)
      return res.status(400).json({
        success: false,
        message: "Can not create account"
      })
    }
    try{
      if(!req.body) {
        return res.status(400).json({
          success: false,
          message: "all fields are required!"
        })

      }

    }catch(error){
      logger.error('error in registering', error)
      console.log("error", error)
      throw error
    }
  }
  async Login(req, res) {
    try{
      if(!req.body.email || !req.body.password){
        return res.status(400).json({
          success: false,
          message: "email and password are required"
        })
      }

      const admin = await Admin.findOne({email: req.body.email})
      if(!admin){
        return res.status(404).json({
          success: false,
          message: "email or password is incorrect"
        })
      }

      if(admin.role !== "admin"){
        return res.status(403).json({
          success: false,
          message: "Access denied!"
        })
      }

      if(!admin.active){
        return res.status(403).json({
          success: false,
          message: "Account not active, contact support for way forward."
        })
      }

      //check password
      if(!req.body.password){
        return res.status(400).json({
          success: false,
          message: "password is required"
        })
      }

      if(req.body.password.length < 6){
        return res.status(400).json({
          success: false,
          message: "password must be at least 6 characters"
        })
      }
    
      const isMatch = await bcrypt.compare(req.body.password, admin.password)
      if(!isMatch){
        return res.status(401).json({
          success: false,
          message: "incorrect password. try again."
        })
      }

      const token = admin.generateAuthToken()
      const alertData = {
        type: "new_login",
        ipAddress: req.ip,
        location: {},
        timestamp: new Date(),
        subject: "New Admin Login Detected",
        message: `A new login to your admin account was detected. If this was you, no further action is needed. If you do not recognize this activity, please secure your account immediately.`,
        alert: "New Admin Login Detected",
        action: "If this wasn't a recognizable admin, please lock the user or change the password and review your account security settings."
      }
      let email = config.adminEmail
      if(!email){
        console.error("Admin email not set in environment variable ADMIN_EMAIL")
        return res.status(500).json({
          success: false,
          message: "Can not complete login"
        })
      }
      await emailService.sendSecurityAlert(email, alertData)
      res.status(200).json({
        success: true,
        message: "login successful",
        data: {
          admin: {
            id: admin._id,
            email: admin.email,
            role: admin.role
          },
          token
        }
      })

    }catch(error){
      logger.error('error in login', error)
      console.log("error", error)
      throw error
    }

  }
}