import express from 'express'
import { validationResult } from 'express-validator'
import { RegisterRequest } from '../Http/Requests/RegisterRequest.js'
import User from '../Models/User.js'
import bcrypt from 'bcryptjs'
import ResetPassword from '../Http/Mail/ResetPassword.js'
import dontenv from 'dotenv'
import { config } from '../../config/index.js'
import jwt from 'jsonwebtoken'

dontenv.config()
const app = express()
app.use(express.json())

app.post('/register', RegisterRequest(), async (req, res) => {

  const errors = validationResult(req);

  if(!errors.isEmpty()){
    return res.status(422).json({
      errors: errors.array()
    });
  }
  try{

    const { firstName, lastName, email, password, phoneNumber, dateOfBirth } = req.body;

    let Check_user = await User.findOne({"email": email})

    if(Check_user){
      return res.status(409).json({
        success: false,
        message: "This email cannot be used. Please try another."
      })
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      firstName,
      lastName,
      email,
      password: hashedPassword,
      phoneNumber,
      dateOfBirth
    })

    await user.save()

    res.status(201).json({
      success: true,
      message: 'successfully registered!'
    })

  }catch(error){
    console.log('error in registering', error)
    res.status(500).json({
      message: "'error in saving"
    })

  }

})

app.post("/login", async (req, res) => {
  const {email, password} = req.body;

  try{
    var user = await User.findOne({email})
    if(!user){
      return res.status(401).json({
        success: false,
        message: 'invalid email or password'
      })
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch){
      return res.status(401).json({
        success: false,
        message: "invalid email or password"
      })
    }
    var user = User.aggregate([
      {
        $project: {
          "_id": 0,
          "firstName": 1,
          "lastName": 1,
          "phoneNumber": 1,
          "email": 1,
          "dateOfBirth": 1
        }
      }
    ]);

    let serializeUser = {name: user.email}    
    const accessToken = jwt.sign(serializeUser, config.jwt.secret);

    res.status(200).json({
      success: true,
      message: "login successful",
      user: user,
      access_token: accessToken
    })
  }catch(error){
    console.log('error in login ', error.message)
    res.status(500).json({
      message: "server error"
    })
  }
})

app.post('/forgot-password', async (req, res) => {
  const {email} = req.body;
  if( !email.trim()){
    res.status(422).json({
      message: 'email is required'
    })
  }
  try{
    let user = await User.findOne({email: email});
    if (!user){
      res.status(200).json({
        success: true,
        message: "If email exists, you will get a reset email link sent to you"
      })      
    }
    ResetPassword(email);
    res.status(200).json({
      success: true,
      message: "reset email sent check your inbox to continue."
    })
  }catch(error){
    console.log('error in sending reset link', error)
    res.status(500).json({
      success: false,
      message: 'error occured in sending email: ' + error.message
    })
  }
})

async function Logout(){
  
}