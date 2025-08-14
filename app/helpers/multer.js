import multer from "multer";
import fs from 'fs'

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if(!fs.existsSync('uploads/profile')){
      fs.mkdirSync('uploads/profile');
    }
    const dir = 'uploads/profile';
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '_' + file.originalname);
  },
  limits: {
    fileSize: 1024 * 1024 * 2 //2mbs 
  },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/gif'].includes(file.mimetype);
    cb(ok ? null : new Error('invalid file type. please upload a ".jpeg, .jpg, .png or a .gif image"'))
  }
});

const upload = multer({storage});

export default upload;