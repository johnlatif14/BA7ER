require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const http = require('http');
const multer = require('multer');
const nodemailer = require('nodemailer');
const xss = require('xss-clean');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);

// ========== الإعدادات الأساسية ==========
const CONFIG = {
  // بيانات الدخول (يمكنك تغييرها)
  ADMIN: { 
    username: 'BA7ER',     // اسم المستخدم
    password: bcrypt.hashSync('Fahd', 10)  // كلمة المرور (مشفرة)
  },
  
  // إعدادات الجلسة
  SESSION_SECRET: 'cbc7c57f08ed14e4ce4bc3e8042395d4ab4f24026fb2a4927e817ec3d8a2a51f',
  
  // إعدادات البريد الإلكتروني (SMTP)
  SMTP: {
    host: 'smtp.gmail.com',    // سيرفر جيميل
    port: 587,                 // منفذ جيميل
    user: 'clanking957@gmail.com',  // ايميل جيميل الخاص بك
    pass: 'ooag vozw olmr xwdt'     // كلمة مرور الجيميل
  }
};

// ========== تهيئة المكونات ==========
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB كحد أقصى
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('نوع الملف غير مسموح به'), false);
    }
  }
});

const transporter = nodemailer.createTransport({
  host: CONFIG.SMTP.host,
  port: CONFIG.SMTP.port,
  secure: false,
  auth: {
    user: CONFIG.SMTP.user,
    pass: CONFIG.SMTP.pass
  }
});

// ========== Middleware الأساسية ==========
app.use(morgan('combined'));
app.use(xss());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// إعداد الجلسات
const sessionConfig = {
  secret: CONFIG.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // تغيير لـ true إذا كنت تستخدم HTTPS
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 ساعة
  }
};
app.use(session(sessionConfig));

// تحديد معدل الطلبات
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// ========== نظام الملفات ==========
const dbPath = path.join(__dirname, 'db.json');

function getDB() {
  try {
    return fs.existsSync(dbPath) 
      ? JSON.parse(fs.readFileSync(dbPath)) 
      : { products: [], orders: [], users: [] };
  } catch (err) {
    console.error('Error reading DB:', err);
    return { products: [], orders: [], users: [] };
  }
}

function saveDB(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving DB:', err);
    throw err;
  }
}

// ========== التحقق من الصلاحيات ==========
const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(403).json({ success: false, error: 'غير مصرح بالوصول' });
  }
};

// ========== نقاط النهاية ==========
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'اسم المستخدم وكلمة المرور مطلوبان' });
  }

  if (username === CONFIG.ADMIN.username && await bcrypt.compare(password, CONFIG.ADMIN.password)) {
    req.session.isAdmin = true;
    req.session.user = { username, role: 'admin' };
    return res.json({ success: true, redirect: '/dashboard.html' });
  }
  
  res.status(401).json({ success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, error: 'خطأ في تسجيل الخروج' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, redirect: '/login.html' });
  });
});

// ... (بقية نقاط النهاية كما هي)

// ========== تشغيل الخادم ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
  }
  
  if (!fs.existsSync(dbPath)) {
    saveDB({ products: [], orders: [], users: [] });
  }
  
  console.log(`
  ====================================
  الخادم يعمل على http://localhost:${PORT}
  
  بيانات الدخول:
  اسم المستخدم: adminBa7er
  كلمة المرور: Fahd123!@#
  
  إعدادات SMTP:
  السيرفر: smtp.gmail.com
  البريد: ba7er.store@gmail.com
  ====================================
  `);
});

// معالجة الأخطاء
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));