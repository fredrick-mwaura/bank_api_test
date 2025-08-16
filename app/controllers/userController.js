import User from '../Models/User.js'
import AuthMiddleware from '../Middleware/Auth.js';
import upload from '../helpers/multer.js';
import Notification from '../Models/Notification.js';

const auth = AuthMiddleware.authenticate

const profile = ( auth, async (req, res)=>{
  if(!req.user || req.user === null){
    return res.status(404).json({
      success: false,
      message: 'User not found'
    })
  }
  const user = await User.findById(req.user._id).select('-password -createdAt -updatedAt -__v');
  return res.status(200).json({
    success: true,
    user: user
  })
})

const updateProfile = (auth, upload.single(image), async (req, res)=>{
  if(!req.body.trim()){
    return res.status(400).json({
      success: false,
      message: 'update atleast one field'
    })    
  }
  try{
    const { password, email, ...updatableFields} = req.body;
    if(req.file){
      //updatableFields.image = req.file.path //using path
      updatableFields.image = req.file.filename
    }
    const user = await User.findByIdAndUpdate(req.user._id, updatableFields, {new: true}).select('-password -_v -createdAt -updatedAt')
    res.status(200).json({
      success: true,
      message: 'profile updated successfully',
      user
    })
  } catch (error){
    console.log('error in updating profile', error)
    return res.status(500).json({
      message: 'error in updating profile'
    })
  }
})

const getAllUsers = (auth, async (_req, res) => {
  try {
    const users = await User.find().select('-password -createdAt -updatedAt -__v');
    if(!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No users found'
      })
    }
    return res.status(200).json({
      success: true,
      users: users
    })
  } catch(error){
    console.log("error in fetching all users!")
    return res.status(500).json({
      success: false,
      message: "error in fetching all users " + error
    })
  }
})

const getUserById = (auth, async (req, res) => {
  const id = req.params.id;
  try{
    if(!id){
      return res.status(400).json({
        success: false,
        message: 'id required'
      })
    }
    const user = await User.findById(id).select('-password -createdAt -updatedAt -__v');
    if(!user){
      return res.status(404).json({
        success: false,
        message: 'user not found'
      })
    }
  }catch(error){
    console.log('error in getting user by id', error)
    return res.status(500).json({
      success: false,
      message: 'error in getting user by id' + error.message
    })
  }
})

const updateUserStatus = (auth, req, res) => {
  if(!req.body.status){
    return res.status(400).json({
      success: false,
      message: 'status is required'
    })
  }

  const user = User.aggregate([
    {
      $match: {
        _id: mongoose.Types.ObjectId(req.user._id)
      }
    },{
      $set: {
        status: req.body.status
      }
    }
  ]);
  return res.status(200).json({
    success: true,
    message: 'user status updated successfully',
    user: user.status
  })
}

const deleteUser = (auth, async (req, res) => {
  const id = req.params.id;
  try{
    if(!id){
      return res.status(400).json({
        success: false,
        message: 'id required'
      })
    }
    const user = await User.findByIdAndDelete(id);
    if(!user){
      return res.status(404).json({
        success: false,
        message: 'user not found'
      })
    }
    return res.status(200).json({
      success: true,
      message: 'user deleted successfully'
    })
  }catch(error){
    console.log('error in deleting user', error)
    return res.status(500).json({
      success: false,
      message: 'error in deleting user' + error.message
    })
  }
})

const getNotifications = (auth, async (req, res) => {
  try{
    const userId = req.user._id;
    if(!userId){
      return res.status(400).json({
        success: false,
        message: 'user id is required'
      })
    }
    const notifications = await Notification.aggregate([
      {
        $match: {"userId": userId}
      },{
        $project: {
          "_id" : 0,
          "message": 1,
          "isRead": 1
        }
      }
    ])
    if(!notifications || notifications.length <= 0 || notifications > 1){
      return res.status(200).json({
        success: true,
        message: 'no notifications'
      })
    }
    return res.status(200).json({
      success: true,
      notifications: notifications
    })

  } catch(error){
    console.log(error)
    return res.status(500).json({
      success: false,
      message: "error in fetching your notifications " + error.message
    })
  }
})

const markAllNotificationsAsRead = (auth, async (req, res) => {
  try{
    const userId = req.user._id;
    if(!userId) {
      return res.status(400).json({
        success: false,
        message: "id is required"
      })
    }
    const result = await User.updateOne(
      { _id: userId },
      { $set: { 'notifications.$[].isRead': true } },
      { arrayFilters: [{ 'notifications.isRead': false }] } // Only update unread notifications
    );
    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      result
    });
  }catch(error){
    console.log('error in marking all notifications as read', error)
    return res.status(500).json({
      success: false,
      message: 'error in marking all notifications as read' + error.message
    })
  }
})

const markNotificationAsRead = (auth, async (req, res) => {
  const notificationId = req.params.id
  if(!notificationId){
    return res.status(400).json({
      success: false,
      message: 'Notification ID is required'
    });
  }

  try{
    const notification = await User.findByIdAndUpdate(
      notificationId,
      {$set: {isRead: true}},
      {new: true}
    );
    if(!notification){
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      })
    }
    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification
    });
  }catch(error){
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error
    })
  }
})

export { getAllUsers, getUserById, updateProfile, profile, updateUserStatus, deleteUser, markAllNotificationsAsRead, markNotificationAsRead }