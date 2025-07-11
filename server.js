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

const app = express();
const server = http.createServer(app);

// =============================================
// 1. الإعدادات الأساسية والخيارات
// =============================================

// تهيئة multer لرفع الملفات
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB كحد أقصى
});

// تهيئة nodemailer لإرسال البريد
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'user@example.com',
    pass: process.env.SMTP_PASS || 'password'
  }
});

// =============================================
// 2. الميدلوير الأساسية
// =============================================

app.use(helmet()); // حماية التطبيق
app.use(express.json()); // لمعالجة طلبات JSON
app.use(express.urlencoded({ extended: true })); // لمعالجة بيانات النماذج
app.use(express.static(path.join(__dirname, 'public'))); // ملفات ثابتة
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // ملفات مرفوعة

// إعداد الجلسات
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-here',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 ساعة
  }
}));

// في قسم الميدلوير في server.js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
    },
  },
}));

// تحديد معدل الطلبات للوقاية من الهجمات
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100 // 100 طلب لكل IP
});
app.use(limiter);

// =============================================
// 3. وظائف مساعدة وقاعدة بيانات مؤقتة
// =============================================

// مسار قاعدة البيانات
const dbPath = path.join(__dirname, 'db.json');

// قراءة قاعدة البيانات أو إنشائها إذا لم تكن موجودة
function getDB() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (err) {
    return { products: [], orders: [], users: [] };
  }
}

// حفظ التغييرات في قاعدة البيانات
function saveDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// ميدلوير للتحقق من صلاحيات المدير
function isAdmin(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(403).json({ success: false, error: 'غير مصرح بالوصول' });
  }
}

// =============================================
// 4. نقاط النهاية (Routes)
// =============================================

// تسجيل الدخول
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = getDB();

  // التحقق من بيانات الدخول
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.user = { username, role: 'admin' };
    return res.json({ success: true, redirect: 'dashboard.html' });
  }
  
  res.status(401).json({ success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
});

// تسجيل الخروج
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, error: 'خطأ في تسجيل الخروج' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, redirect: '/login.html' });
  });
});

// إدارة المنتجات
app.get('/api/products', (req, res) => {
  const db = getDB();
  res.json(db.products);
});

app.post('/api/products', upload.single('image'), (req, res) => {
  const db = getDB();
  const product = {
    id: Date.now().toString(),
    ...req.body,
    image: req.file ? req.file.filename : null,
    createdAt: new Date().toISOString()
  };
  db.products.push(product);
  saveDB(db);
  res.json({ success: true, product });
});

// إدارة الطلبات
app.get('/api/orders', isAdmin, (req, res) => {
  const db = getDB();
  res.json(db.orders);
});

app.post('/api/orders', upload.single('paymentProof'), (req, res) => {
  const db = getDB();
  const order = {
    id: Date.now().toString(),
    ...req.body,
    status: 'pending',
    paymentProof: req.file ? req.file.filename : null,
    createdAt: new Date().toISOString()
  };
  db.orders.push(order);
  saveDB(db);
  res.json({ success: true, order });
});

// إرسال البريد الإلكتروني
app.post('/api/send-email', isAdmin, async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    await transporter.sendMail({
      from: `"متجر 𝐵𝒜𝟩𝐸𝑅" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text
    });
    res.json({ success: true, message: 'تم إرسال البريد بنجاح' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: 'فشل إرسال البريد' });
  }
});

// =============================================
// 5. تشغيل الخادم
// =============================================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`الخادم يعمل على http://localhost:${PORT}`);
  
  // إنشاء مجلد uploads إذا لم يكن موجوداً
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
    console.log('تم إنشاء مجلد uploads');
  }
  
  // إنشاء ملف db.json إذا لم يكن موجوداً
  if (!fs.existsSync(dbPath)) {
    saveDB({ products: [], orders: [], users: [] });
    console.log('تم إنشاء ملف db.json');
  }
});