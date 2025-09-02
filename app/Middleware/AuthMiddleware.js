import jwt from  'jsonwebtoken'
import User from '../Models/User.js'
import logger from '../utils/logger.js'
import Account from '../Models/Account.js'
import {config} from '../../config/index.js'

class AuthMiddleware{
  static async authenticate(req, res, next){
    try{
      let token = req.header('Authorization')?.replace('Bearer ', '') || req.params.token;
      console.log('token', token)

      if(!token){
        return res.status(401).json({
          status: 'error',
          message: 'Access denied. no token is provided'
        });
      }
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findOne({"email": decoded.email}).select('-password -createdAt -updatedAt -__v');

      if(!user){
        return res.status(401).json({
          status: 'error',
          message: 'user not found'
        });
      }

      if (user.status !== 1){
        return res.status(402).json({
          status: error,
          message: 'Account not active!'
        })
      }

      req.user = user;
      next();
    }catch(error){
      logger.error('Authentication error', error)

      if(error.name === 'TokenExpiredError'){
        return res.status(401).json({
          status: 'error',
          message: 'token expired'
        })
      }
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token'
      })
    }
  }

  static async verifyAccountOwnership(req, res, next){
    try{
      const accountId = req.params.accountId || req.body.accountId;
      if(!accountId){
        return res.status(400).json({
          status: 'error',
          message: 'Account is required'
        })
      }
      const account = await Account.findById(accountId);
      if(!account){
        return res.status(404).json({
          status: 'error', 
          message: 'account not found'
        })
      }
      if(account.user.role !== 'admin' || account.userId.toString() !== req.user._id.toString()){
        return res.status(403).json({
          status: 'error',
          message: 'accessed denied, you can only access you account.'
        })
      }
      req.account = account;
      next();
    }catch(error){
      logger.error('account ownership error ', error)
      return res.status(500).json({
        status: 'error',
        message: 'Server error during account verification.'
      })
    }
  } 
  //role based authentication - admin & super admin
  static authorize (permissions = []) {
    // roles param can be a single role string (e.g. 'user') 
    // or an array of roles (e.g. ['admin', 'user'])
    if (typeof permissions === 'string') {
      permissions = [permissions];
    }

    const roles = permissions;
    return (req, res, next) => {
      if(!req.user){
        return res.status(404).json({
          status: 'error',
          message: "login first"
        })
      }
      if(!roles.includes(req.user.role)){
        return res.status(403).json({
          status: 'error',
          message: "You are not authorized to access this resources."
        })
      }
      next()
    }
  }
}

export default AuthMiddleware;