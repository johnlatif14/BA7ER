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

// Database simulation (in a real app, use MongoDB or MySQL)
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

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'a70fd3493122c0bbacb3508b914ec265c05e79d4a1408cad2645d553ff8376eb',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'https://ba7er-production.up.railway.app/'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
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

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username);
  
  if (user && bcrypt.compareSync(password, user.password)) {
    req.session.user = user;
    res.json({ success: true, redirect: '/dashboard.html' });
  } else {
    res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }
});

app.post('/api/logout', isAuthenticated, (req, res) => {
  req.session.destroy();
  res.json({ success: true, redirect: '/login.html' });
});

// Products API
app.get('/api/products', (req, res) => {
  res.json(db.products);
});

app.post('/api/products', isAuthenticated, upload.single('image'), (req, res) => {
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
  res.json({ success: true, product: newProduct });
});

// Orders API
app.get('/api/orders', isAuthenticated, (req, res) => {
  const { status } = req.query;
  let orders = db.orders;
  
  if (status && status !== 'all') {
    orders = orders.filter(order => order.status === status);
  }
  
  res.json(orders);
});

app.post('/api/orders', upload.fields([
  { name: 'transactionImage', maxCount: 1 }
]), (req, res) => {
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
  
  // Send email notification
  const mailOptions = {
    from: process.env.SMTP_USER || 'your-email@gmail.com',
    to: process.env.ADMIN_EMAIL || 'admin@example.com',
    subject: 'طلب جديد - متجر 𝐵𝒜𝟩𝐸𝑅',
    text: `تم استلام طلب جديد من ${name}\n\nالمنتج: ${product.name}\nالسعر: ${product.price} جنيه\nطريقة الدفع: ${payment === 'cash' ? 'الدفع عند الاستلام' : 'فودافون كاش'}`
  };
  
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    }
  });
  
  res.json({ success: true, order: newOrder });
});

// Contact API
app.post('/api/contact', (req, res) => {
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
  
  // Send email
  const mailOptions = {
    from: process.env.SMTP_USER || 'your-email@gmail.com',
    to: process.env.ADMIN_EMAIL || 'admin@example.com',
    subject: `رسالة جديدة: ${subject}`,
    text: `اسم المرسل: ${name}\nالبريد الإلكتروني: ${email}\n\nالرسالة:\n${message}`
  };
  
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    }
  });
  
  res.json({ success: true, contact: newContact });
});

// Suggestions API
app.post('/api/suggestions', upload.single('design'), (req, res) => {
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
    createdAt: new Date().toISOString()
  };
  
  db.suggestions.push(newSuggestion);
  res.json({ success: true, suggestion: newSuggestion });
});

// Email API
app.post('/api/send-email', isAuthenticated, (req, res) => {
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
  
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
      return res.json({ success: false, message: 'فشل إرسال البريد الإلكتروني' });
    }
    res.json({ success: true, message: 'تم إرسال البريد الإلكتروني بنجاح' });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});