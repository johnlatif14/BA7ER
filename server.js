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

const app = express();
const server = http.createServer(app);

// =============================================
// 1. الإعدادات الأساسية والخيارات
// =============================================

// تهيئة multer لرفع الملفات
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

// تسجيل الطلبات
app.use(morgan('combined'));

// حماية ضد XSS
app.use(xss());

// حماية التطبيق مع CSP معدل
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"]
    },
  },
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// إعداد الجلسات المحسنة
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key-here',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000
  }
};

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  sessionConfig.cookie.secure = true;
}

app.use(session(sessionConfig));

// تحديد معدل الطلبات للوقاية من الهجمات
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// =============================================
// 3. وظائف مساعدة وقاعدة بيانات مؤقتة
// =============================================

const dbPath = path.join(__dirname, 'db.json');

function getDB() {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return data ? JSON.parse(data) : { products: [], orders: [], users: [] };
  } catch (err) {
    console.error('Error reading DB:', err);
    return { products: [], orders: [], users: [] };
  }
}

function saveDB(data) {
  try {
    if (fs.existsSync(dbPath)) {
      const backupPath = `${dbPath}.bak`;
      fs.copyFileSync(dbPath, backupPath);
    }
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving DB:', err);
    throw err;
  }
}

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

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    req.session.user = { username, role: 'admin' };
    return res.redirect('/dashboard.html'); // تحويل مباشر بدلاً من JSON
  }
  
  res.redirect('/login.html?error=invalid_credentials'); // إعادة توجيه مع رسالة خطأ
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

app.get('/api/products', (req, res) => {
  const db = getDB();
  res.json(db.products);
});

app.post('/api/products', upload.single('image'), (req, res, next) => {
  try {
    const { name, price } = req.body;
    if (!name || !price) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'الاسم والسعر مطلوبان' });
    }

    const db = getDB();
    const product = {
      id: Date.now().toString(),
      name: name,
      price: price,
      image: req.file ? req.file.filename : null,
      createdAt: new Date().toISOString()
    };
    
    db.products.push(product);
    saveDB(db);
    res.json({ success: true, product });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    next(err);
  }
});

app.get('/api/orders', isAdmin, (req, res) => {
  const db = getDB();
  res.json(db.orders);
});

app.post('/api/orders', upload.single('paymentProof'), (req, res, next) => {
  try {
    const { customerName, items, total } = req.body;
    if (!customerName || !items || !total) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'بيانات الطلب مطلوبة' });
    }

    const db = getDB();
    const order = {
      id: Date.now().toString(),
      customerName,
      items: JSON.parse(items),
      total: parseFloat(total),
      status: 'pending',
      paymentProof: req.file ? req.file.filename : null,
      createdAt: new Date().toISOString()
    };
    
    db.orders.push(order);
    saveDB(db);
    res.json({ success: true, order });
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    next(err);
  }
});

app.post('/api/send-email', isAdmin, async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    if (!to || !subject || !text) {
      return res.status(400).json({ success: false, error: 'بيانات البريد مطلوبة' });
    }

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
  
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
    console.log('تم إنشاء مجلد uploads');
  }
  
  if (!fs.existsSync(dbPath)) {
    saveDB({ products: [], orders: [], users: [] });
    console.log('تم إنشاء ملف db.json');
  }
});

// معالجة الأخطاء
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});