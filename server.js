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

// Static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// جلسات
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
}));

// CSRF
app.use(csrf());
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// قاعدة البيانات
const dbPath = './db.json';
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ products: [], orders: [] }, null, 2));
const db = JSON.parse(fs.readFileSync(dbPath));
const saveDB = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

// حماية الأدمن
const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) return next();
  res.redirect('/login.html');
};

// تقديم CSRF token
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// صفحات ثابتة
app.get('/', (req, res) => res.send(renderHTML('الرئيسية', '<h1 class="text-center mt-5">مرحبًا بك في متجر بحر</h1>')));
app.get('/shop.html', (req, res) => res.send(renderHTML('الملابس', renderProducts())));
app.get('/suggestions.html', (req, res) => res.send(renderHTML('اقتراحات', `
  <form class="container mt-4">
    <textarea class="form-control mb-3" rows="5" placeholder="اكتب اقتراحك هنا"></textarea>
    <button class="btn btn-success">إرسال</button>
  </form>
`)));
app.get('/contact.html', (req, res) => res.send(renderHTML('اتصل بنا', `<div class="container mt-4"><h4>راسلنا لأي استفسار!</h4></div>`)));
app.get('/login.html', (req, res) => res.send(renderLoginPage(res.locals.csrfToken)));
app.get('/admin/dashboard.html', isAdmin, (req, res) => res.send(renderDashboard(res.locals.csrfToken)));

// تسجيل الدخول
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard.html');
  }
  return res.send('خطأ في تسجيل الدخول');
});

// خروج
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// APIs
app.get('/api/products', (req, res) => res.json(db.products));
app.get('/api/orders', isAdmin, (req, res) => res.json(db.orders));

// طلب جديد
app.post('/api/order', multer({ dest: 'uploads/' }).single('paymentProof'), (req, res) => {
  const order = { ...req.body, createdAt: new Date() };
  db.orders.push(order);
  const prod = db.products.find(p => p.name === order.product);
  if (prod) prod.stock = Math.max(0, prod.stock - +order.quantity);
  saveDB();
  res.redirect('/shop.html');
});

// منتج جديد
app.post('/api/product', multer({ dest: 'uploads/' }).single('image'), isAdmin, (req, res) => {
  const { name, price, sizes, stock } = req.body;
  const image = req.file.filename;
  db.products.push({ name, price, sizes: sizes.split(','), stock: +stock, image });
  saveDB();
  io.emit('new-product');
  res.redirect('/admin/dashboard.html');
});

// تحديث المخزون
app.post('/api/update-stock', isAdmin, (req, res) => {
  const prod = db.products.find(p => p.name === req.body.name);
  if (prod) {
    prod.stock = +req.body.stock;
    saveDB();
  }
  res.redirect('/admin/dashboard.html');
});

// إرسال بريد
app.post('/api/send-email', isAdmin, async (req, res) => {
  const { to, subject, message } = req.body;
  try {
    await nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    }).sendMail({ from: process.env.EMAIL_USER, to, subject, text: message });
  } catch (err) {
    console.error(err);
  }
  res.redirect('/admin/dashboard.html');
});

// HTML Templates
function renderHTML(title, content) {
  return `<!DOCTYPE html><html lang="ar" dir="rtl">
  <head><meta charset="UTF-8"><title>${title}</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css" rel="stylesheet">
  </head><body>
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
    <div class="container"><a class="navbar-brand" href="/">متجر بحر</a></div>
  </nav>
  <main class="container mt-4">${content}</main>
  </body></html>`;
}

function renderLoginPage(csrfToken) {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>
  <meta charset="UTF-8"><title>تسجيل الدخول</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css" rel="stylesheet"></head>
  <body><main class="container mt-5" style="max-width:400px">
    <h3 class="text-center">دخول الأدمن</h3>
    <form method="POST" action="/login">
      <input type="hidden" name="_csrf" value="${csrfToken}">
      <div class="mb-3"><input name="username" class="form-control" placeholder="اسم المستخدم" required></div>
      <div class="mb-3"><input type="password" name="password" class="form-control" placeholder="كلمة المرور" required></div>
      <button class="btn btn-primary w-100">دخول</button>
    </form>
  </main></body></html>`;
}

function renderProducts() {
  const items = db.products.map(p => `
    <div class="col-md-4 mb-4">
      <div class="card"><img src="/uploads/${p.image}" class="card-img-top">
        <div class="card-body text-center">
          <h5>${p.name}</h5>
          <p>${p.price} جنيه</p>
        </div>
      </div>
    </div>`).join('');
  return `<div class="row">${items}</div>`;
}

function renderDashboard(csrfToken) {
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>
  <meta charset="UTF-8"><title>لوحة التحكم</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.rtl.min.css" rel="stylesheet"></head>
  <body><nav class="navbar navbar-dark bg-dark p-2">
    <a class="navbar-brand" href="#">لوحة التحكم</a>
    <form method="POST" action="/logout"><button class="btn btn-light">خروج</button></form>
  </nav><main class="container mt-4">
    <h4>إضافة منتج</h4>
    <form action="/api/product" method="POST" enctype="multipart/form-data">
      <input type="hidden" name="_csrf" value="${csrfToken}">
      <input name="name" class="form-control mb-2" placeholder="الاسم" required>
      <input name="price" class="form-control mb-2" placeholder="السعر" required>
      <input name="sizes" class="form-control mb-2" placeholder="المقاسات: S,M,L" required>
      <input name="stock" class="form-control mb-2" type="number" placeholder="الكمية" required>
      <input name="image" class="form-control mb-2" type="file" required>
      <button class="btn btn-success">رفع</button>
    </form>
  </main></body></html>`;
}

// Socket.io
io.on('connection', () => {});

server.listen(process.env.PORT || 3000, () =>
  console.log('Server running on http://localhost:3000'));
