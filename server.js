// server.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const session = require('express-session');
const csrf = require('csurf');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// أمان
app.use(helmet());
app.use(xss());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// جلسات
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // تغيير لـ true إذا كنت تستخدم HTTPS
}));

// CSRF
const csrfProtection = csrf();
app.use(csrfProtection);
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// قاعدة البيانات
const dbPath = './db.json';
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ products: [], orders: [], inquiries: [], reviews: [] }, null, 2));
const db = JSON.parse(fs.readFileSync(dbPath));
const saveDB = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

// حماية الأدمن
const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) return next();
  res.redirect('/login.html');
};

// APIs
// تقديم CSRF token
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// صفحات ثابتة
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/shop.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'shop.html')));
app.get('/suggestions.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'suggestions.html')));
app.get('/contact.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'contact.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard.html', isAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));

// تسجيل الدخول
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/dashboard.html'); // تم التعديل هنا
  }
  return res.status(401).send('خطأ في تسجيل الدخول');
});

// خروج
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// APIs للبيانات
app.get('/api/products', (req, res) => res.json(db.products));
app.get('/api/orders', isAdmin, (req, res) => res.json(db.orders));
app.get('/api/inquiries', isAdmin, (req, res) => res.json(db.inquiries));
app.get('/api/reviews', isAdmin, (req, res) => res.json(db.reviews));

// طلب جديد
app.post('/api/order', multer({ dest: 'uploads/' }).single('paymentProof'), (req, res) => {
  const order = { 
    ...req.body, 
    status: 'pending',
    createdAt: new Date(),
    paymentProof: req.file ? req.file.filename : null
  };
  db.orders.push(order);
  
  const prod = db.products.find(p => p.name === order.product);
  if (prod) prod.stock = Math.max(0, prod.stock - +order.quantity);
  
  saveDB();
  res.json({ success: true, message: 'تم استلام الطلب بنجاح' });
});

// منتج جديد
app.post('/api/product', multer({ dest: 'uploads/' }).single('image'), isAdmin, (req, res) => {
  const { name, price, sizes, stock } = req.body;
  const image = req.file.filename;
  
  db.products.push({ 
    name, 
    price, 
    sizes: sizes.split(','), 
    stock: +stock, 
    image,
    createdAt: new Date()
  });
  
  saveDB();
  io.emit('new-product');
  res.json({ success: true, message: 'تم إضافة المنتج بنجاح' });
});

// تحديث حالة الطلب
app.post('/api/update-order/:id', isAdmin, (req, res) => {
  const order = db.orders.find(o => o.id === req.params.id);
  if (order) {
    order.status = req.body.status;
    order.updatedAt = new Date();
    saveDB();
    return res.json({ success: true });
  }
  res.status(404).json({ success: false });
});

// حذف طلب
app.delete('/api/delete-order/:id', isAdmin, (req, res) => {
  db.orders = db.orders.filter(o => o.id !== req.params.id);
  saveDB();
  res.json({ success: true });
});

// إرسال بريد
app.post('/api/send-email', isAdmin, async (req, res) => {
  const { to, subject, message } = req.body;
  
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text: message
    });
    
    res.json({ success: true, message: 'تم إرسال الرسالة بنجاح' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'فشل إرسال الرسالة' });
  }
});

// إضافة استفسار
app.post('/api/inquiry', (req, res) => {
  const inquiry = {
    ...req.body,
    status: 'new',
    createdAt: new Date()
  };
  db.inquiries.push(inquiry);
  saveDB();
  res.json({ success: true });
});

// الرد على استفسار
app.post('/api/respond-inquiry/:id', isAdmin, (req, res) => {
  const inquiry = db.inquiries.find(i => i.id === req.params.id);
  if (inquiry) {
    inquiry.response = req.body.response;
    inquiry.status = 'responded';
    inquiry.respondedAt = new Date();
    saveDB();
    return res.json({ success: true });
  }
  res.status(404).json({ success: false });
});

// Socket.io
io.on('connection', (socket) => {
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});