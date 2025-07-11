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

// Middlewares
app.use(helmet());
app.use(xss());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// CSRF
const csrfProtection = csrf();
app.use(csrfProtection);
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Database
const dbPath = path.join(__dirname, 'db.json');
const initializeDB = () => {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({
      products: [],
      orders: [],
      inquiries: [],
      reviews: []
    }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath));
};
const db = initializeDB();
const saveDB = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

// Auth Middleware
const isAdmin = (req, res, next) => {
  if (req.session.isAdmin) return next();
  res.redirect('/login.html');
};

// SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Routes
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ success: true, redirect: '/dashboard.html' });
  }
  res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, redirect: '/' });
  });
});

// Email API
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
    console.error('SMTP Error:', error);
    res.status(500).json({ success: false, message: 'فشل إرسال البريد' });
  }
});

// Products API
app.get('/api/products', (req, res) => res.json(db.products));

app.post('/api/products', multer({ dest: 'uploads/' }).single('image'), (req, res) => {
  const { name, price, sizes, stock } = req.body;
  const newProduct = {
    id: Date.now().toString(),
    name,
    price: parseFloat(price),
    sizes: sizes.split(','),
    stock: parseInt(stock),
    image: req.file.filename,
    createdAt: new Date()
  };
  db.products.push(newProduct);
  saveDB();
  io.emit('product-updated');
  res.json({ success: true, product: newProduct });
});

// Orders API
app.get('/api/orders', isAdmin, (req, res) => res.json(db.orders));

app.post('/api/orders', multer({ dest: 'uploads/' }).single('paymentProof'), (req, res) => {
  const order = {
    id: Date.now().toString(),
    ...req.body,
    status: 'pending',
    paymentProof: req.file?.filename,
    createdAt: new Date()
  };
  db.orders.push(order);
  saveDB();
  res.json({ success: true, order });
});

app.put('/api/orders/:id', isAdmin, (req, res) => {
  const order = db.orders.find(o => o.id === req.params.id);
  if (order) {
    Object.assign(order, req.body, { updatedAt: new Date() });
    saveDB();
    return res.json({ success: true, order });
  }
  res.status(404).json({ success: false });
});

// Serve HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', req.path));
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});