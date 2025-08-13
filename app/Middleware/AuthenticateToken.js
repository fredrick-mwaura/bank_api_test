import { config } from '../../config'

function AuthenticateToken(req, res, next) {
  const authHeader = req.Headers['Authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (token == null) return
  const secret = config.jwt.secret
  jwt.verify(token, secret, (error, email)=>{
    if (error){
      return res.status(403)
    }
    req.email = email
    next()
  })
}
export default AuthenticateToken