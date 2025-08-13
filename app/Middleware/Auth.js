import jwt from  'jsonwebtoken'
import User from '../Models/User.js'
import logger from '../utils/logger.js'
import Account from '../Models/Account.js'

class AuthMiddleware{
  static async authenticate(req, res, next){
    try{
      const token = req.header('Authorization')?.replace('Bearer ', '');
      if(!token){
        return res.status(401).json({
          status: 'error',
          message: 'Access denied. no token is provided'
        });
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

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
      res.status(401).json({
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
      res.status(500).json({
        status: 'error',
        message: 'Server error during account verification.'
      })
    }
  } 
  //role based authentication
}


export default AuthMiddleware;