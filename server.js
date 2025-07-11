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
const dbFile = './db.json';
const upload = multer({ dest: 'uploads/' });

const PORT = process.env.PORT || 3000;

let db = { products: [], orders: [] };
if (fs.existsSync(dbFile)) {
  db = JSON.parse(fs.readFileSync(dbFile));
}

// Security & Middleware
app.use(helmet());
app.use(xss());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(csrf());

// Auth middleware
function isAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  res.status(403).send('Forbidden');
}

// Routes

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    req.session.isAdmin = true;
    return res.redirect('/admin/dashboard.html');
  }
  res.status(401).send('Unauthorized');
});

// Get products
app.get('/api/products', (req, res) => {
  res.json(db.products);
});

// Submit order
app.post('/api/order', upload.single('paymentProof'), (req, res) => {
  const order = {
    product: req.body.product,
    quantity: parseInt(req.body.quantity),
    size: req.body.size,
    paymentMethod: req.body.paymentMethod,
    email: req.body.email,
    phone: req.body.phone,
    name: req.body.name,
    vodafoneData: req.body.paymentMethod === 'vodafone' ? {
      fromNumber: req.body.fromNumber,
      senderName: req.body.senderName,
      proofImage: req.file ? req.file.filename : null
    } : null,
    createdAt: new Date()
  };

  db.orders.push(order);

  const product = db.products.find(p => p.name === order.product);
  if (product) product.stock -= order.quantity;

  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
  res.send({ message: 'Order received' });
});

// Admin APIs

app.get('/api/orders', isAdmin, (req, res) => {
  res.json(db.orders);
});

app.post('/api/product', upload.single('image'), isAdmin, (req, res) => {
  const product = {
    name: req.body.name,
    price: req.body.price,
    sizes: req.body.sizes.split(','),
    image: req.file.filename,
    stock: parseInt(req.body.stock)
  };
  db.products.push(product);
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
  io.emit('new-product', product);
  res.send({ message: 'Product added' });
});

app.post('/api/update-stock', isAdmin, (req, res) => {
  const { name, stock } = req.body;
  const product = db.products.find(p => p.name === name);
  if (product) {
    product.stock = parseInt(stock);
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
    res.send({ message: 'Stock updated' });
  } else {
    res.status(404).send({ error: 'Product not found' });
  }
});

app.post('/api/send-email', isAdmin, async (req, res) => {
  const { to, subject, message } = req.body;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text: message
    });
    res.send({ message: 'Email sent' });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
