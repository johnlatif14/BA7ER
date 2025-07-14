require('dotenv').config();
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const upload = multer({ dest: 'uploads/' });

// مسار ملف قاعدة البيانات
const DB_PATH = path.join(__dirname, 'database.json');

// تهيئة قاعدة البيانات أو تحميلها إذا كانت موجودة
let db = {
  users: [
    {
      id: 1,
      username: 'ba7er',
      password: bcrypt.hashSync('Fahd', 10),
      role: 'admin'
    }
  ],
  products: [],
  orders: [],
  contacts: [],
  suggestions: []
};

// تحميل البيانات من الملف إذا كان موجوداً
if (fs.existsSync(DB_PATH)) {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    db = JSON.parse(data);
    console.log('تم تحميل قاعدة البيانات بنجاح');
  } catch (err) {
    console.error('خطأ في قراءة ملف قاعدة البيانات:', err);
  }
}

// دالة لحفظ البيانات في الملف
function saveDatabase() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    console.log('تم حفظ قاعدة البيانات');
  } catch (err) {
    console.error('خطأ في حفظ قاعدة البيانات:', err);
  }
}

// SMTP Configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'clanking957@gmail.com',
    pass: process.env.SMTP_PASS || 'ooag vozw olmr xwdt'
  }
});

// Error handling setup
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static('uploads'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'a70fd3493122c0bbacb3508b914ec265c05e79d4a1408cad2645d553ff8376eb',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'https://ba7er-production.up.railway.app'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.status(401).json({ success: false, message: 'غير مصرح بالدخول' });
};

// CSRF protection middleware
const csrfProtection = (req, res, next) => {
  res.locals.csrfToken = req.session.csrfToken = Math.random().toString(36).substring(2);
  next();
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/contact.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/suggestions.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'suggestions.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API Routes
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: res.locals.csrfToken });
});

app.post('/api/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = db.users.find(u => u.username === username);
    
    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.user = user;
      res.json({ success: true, redirect: '/dashboard.html' });
    } else {
      res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
  } catch (err) {
    next(err);
  }
});

app.post('/api/logout', isAuthenticated, (req, res) => {
  req.session.destroy();
  res.json({ success: true, redirect: '/login.html' });
});

// Products API
app.get('/api/products', async (req, res, next) => {
  try {
    res.json(db.products);
  } catch (err) {
    next(err);
  }
});

app.post('/api/products', isAuthenticated, upload.single('image'), async (req, res, next) => {
  try {
    const { name, price, sizes, stock } = req.body;
    
    if (!name || !price || !sizes || !stock) {
      return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    }
    
    const newProduct = {
      id: Date.now(),
      name,
      price: parseFloat(price),
      sizes: sizes.split(',').map(s => s.trim()),
      stock: parseInt(stock),
      image: req.file ? req.file.filename : 'default-product.jpg'
    };
    
    db.products.push(newProduct);
    saveDatabase(); // حفظ التغييرات في الملف
    res.json({ success: true, product: newProduct });
  } catch (err) {
    next(err);
  }
});

// Orders API
app.get('/api/orders', isAuthenticated, async (req, res, next) => {
  try {
    const { status } = req.query;
    let orders = db.orders;
    
    if (status && status !== 'all') {
      orders = orders.filter(order => order.status === status);
    }
    
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

app.post('/api/orders', upload.fields([{ name: 'transactionImage', maxCount: 1 }]), async (req, res, next) => {
  try {
    const {
      productId,
      name,
      address,
      email,
      phone,
      size,
      payment,
      customSize,
      transactionNumber
    } = req.body;
    
    const product = db.products.find(p => p.id == productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'المنتج غير موجود' });
    }
    
    const newOrder = {
      id: Date.now(),
      productId,
      customerName: name,
      customerAddress: address,
      customerEmail: email,
      customerPhone: phone,
      size,
      customSize: customSize || null,
      paymentMethod: payment,
      transactionNumber: payment === 'vodafone' ? transactionNumber : null,
      transactionImage: req.files?.transactionImage ? req.files.transactionImage[0].filename : null,
      productName: product.name,
      productPrice: product.price,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    db.orders.push(newOrder);
    saveDatabase(); // حفظ التغييرات في الملف
    
    const mailOptions = {
      from: process.env.SMTP_USER || 'your-email@gmail.com',
      to: process.env.ADMIN_EMAIL || 'admin@example.com',
      subject: 'طلب جديد - متجر 𝐵𝒜𝟩𝐸𝑅',
      text: `تم استلام طلب جديد من ${name}\n\nالمنتج: ${product.name}\nالسعر: ${product.price} جنيه\nطريقة الدفع: ${payment === 'cash' ? 'الدفع عند الاستلام' : 'فودافون كاش'}`
    };
    
    await transporter.sendMail(mailOptions);
    res.json({ success: true, order: newOrder });
  } catch (err) {
    next(err);
  }
});

// Contact API
app.post('/api/contact', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    }
    
    const newContact = {
      id: Date.now(),
      name,
      email,
      subject,
      message,
      createdAt: new Date().toISOString()
    };
    
    db.contacts.push(newContact);
    saveDatabase(); // حفظ التغييرات في الملف
    
    const mailOptions = {
      from: process.env.SMTP_USER || 'your-email@gmail.com',
      to: process.env.ADMIN_EMAIL || 'admin@example.com',
      subject: `رسالة جديدة: ${subject}`,
      text: `اسم المرسل: ${name}\nالبريد الإلكتروني: ${email}\n\nالرسالة:\n${message}`
    };
    
    await transporter.sendMail(mailOptions);
    res.json({ success: true, contact: newContact });
  } catch (err) {
    next(err);
  }
});

// Suggestions API
app.post('/api/suggestions', upload.single('design'), async (req, res, next) => {
  try {
    const { name, email, suggestion } = req.body;
    
    if (!name || !email || !suggestion) {
      return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    }
    
    const newSuggestion = {
      id: Date.now(),
      name,
      email,
      suggestion,
      design: req.file ? req.file.filename : null,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    
    db.suggestions.push(newSuggestion);
    saveDatabase(); // حفظ التغييرات في الملف
    res.json({ success: true, suggestion: newSuggestion });
  } catch (err) {
    next(err);
  }
});

// Email API
app.post('/api/send-email', isAuthenticated, async (req, res, next) => {
  try {
    const { to, subject, text } = req.body;
    
    if (!to || !subject || !text) {
      return res.status(400).json({ success: false, message: 'جميع الحقول مطلوبة' });
    }
    
    const mailOptions = {
      from: process.env.SMTP_USER || 'your-email@gmail.com',
      to,
      subject,
      text
    };
    
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'تم إرسال البريد الإلكتروني بنجاح' });
  } catch (err) {
    next(err);
  }
});

// Dashboard Stats API
app.get('/api/stats', isAuthenticated, async (req, res, next) => {
  try {
    const stats = {
      totalOrders: db.orders.length,
      pendingOrders: db.orders.filter(o => o.status === 'pending').length,
      topProducts: db.products
        .map(p => ({
          name: p.name,
          sales: db.orders.filter(o => o.productId === p.id).length
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5),
      salesSummary: {
        totalSales: db.orders.reduce((sum, o) => sum + o.productPrice, 0),
        totalOrders: db.orders.length,
        averageOrderValue: db.orders.length > 0 
          ? (db.orders.reduce((sum, o) => sum + o.productPrice, 0) / db.orders.length)
          : 0
      }
    };
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// Export Orders API
app.get('/api/orders/export', isAuthenticated, async (req, res, next) => {
  try {
    const { status } = req.query;
    let orders = db.orders;
    
    if (status && status !== 'all') {
      orders = orders.filter(order => order.status === status);
    }
    
    const csv = [
      ['رقم الطلب', 'العميل', 'المنتج', 'السعر', 'الحالة', 'التاريخ'],
      ...orders.map(o => [
        o.id,
        o.customerName,
        o.productName,
        o.productPrice,
        o.status,
        new Date(o.createdAt).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// Update Order Status API
app.put('/api/orders/:id/status', isAuthenticated, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const order = db.orders.find(o => o.id == id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'الطلب غير موجود' });
    }
    
    order.status = status;
    saveDatabase(); // حفظ التغييرات في الملف
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

// Update Suggestion Status API
app.put('/api/suggestions/:id/status', isAuthenticated, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const suggestion = db.suggestions.find(s => s.id == id);
    if (!suggestion) {
      return res.status(404).json({ success: false, message: 'الاقتراح غير موجود' });
    }
    
    suggestion.status = status;
    saveDatabase(); // حفظ التغييرات في الملف
    res.json({ success: true, suggestion });
  } catch (err) {
    next(err);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'حدث خطأ في الخادم',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});