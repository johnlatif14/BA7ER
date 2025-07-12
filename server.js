require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ba7er_store', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CSRF protection
const csrfProtection = csrf({ cookie: true });
app.use(csrfProtection);

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// SMTP Configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Test SMTP connection
transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP connection error:', error);
  } else {
    console.log('SMTP server is ready to send emails');
  }
});

// Database Models
const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now }
}));

const Product = mongoose.model('Product', new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  sizes: { type: [String], default: [] },
  stock: { type: Number, default: 0 },
  image: { type: String },
  createdAt: { type: Date, default: Date.now }
}));

const Order = mongoose.model('Order', new mongoose.Schema({
  customerName: { type: String, required: true },
  customerEmail: { type: String },
  customerPhone: { type: String },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quantity: { type: Number, default: 1 },
    size: { type: String }
  }],
  total: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'shipped', 'delivered'], default: 'pending' },
  address: { type: String },
  trackingNumber: { type: String },
  createdAt: { type: Date, default: Date.now }
}));

const Suggestion = mongoose.model('Suggestion', new mongoose.Schema({
  content: { type: String, required: true },
  email: { type: String },
  createdAt: { type: Date, default: Date.now }
}));

const ContactMessage = mongoose.model('ContactMessage', new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Authentication routes
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    req.session.user = user;
    res.json({ success: true, redirect: '/dashboard.html' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, redirect: '/login.html' });
});

// Products API
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, sizes, stock } = req.body;
    const product = new Product({
      name,
      description,
      price,
      sizes: sizes.split(',').map(s => s.trim()),
      stock,
      image: req.file ? req.file.filename : null
    });
    await product.save();
    res.json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Orders API
app.get('/api/orders', async (req, res) => {
  try {
    const { status } = req.query;
    const query = status && status !== 'all' ? { status } : {};
    const orders = await Order.find(query).populate('items.productId');
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Contact form
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const contactMessage = new ContactMessage({ name, email, message });
    await contactMessage.save();
    
    // Send confirmation email
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: 'تم استلام رسالتك - متجر 𝐵𝒜𝟩𝐸𝑅',
      text: `مرحباً ${name},\n\nشكراً لتواصلك معنا. لقد تلقينا رسالتك وسنقوم بالرد عليك في أقرب وقت ممكن.\n\nرسالتك:\n${message}\n\nمع تحياتنا,\nفريق 𝐵𝒜𝟩𝐸𝑅`
    };
    
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'تم استلام رسالتك بنجاح' });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Suggestions
app.post('/api/suggestions', async (req, res) => {
  try {
    const { content, email } = req.body;
    const suggestion = new Suggestion({ content, email });
    await suggestion.save();
    
    if (email) {
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: email,
        subject: 'شكراً لاقتراحك - متجر 𝐵𝒜𝟩𝐸𝑅',
        text: `نشكرك على مشاركة اقتراحك معنا. سنقوم بدراسته والعمل على تحسين متجرنا بناءً على ملاحظاتك القيمة.\n\nمع تحياتنا,\nفريق 𝐵𝒜𝟩𝐸𝑅`
      };
      await transporter.sendMail(mailOptions);
    }
    
    res.json({ success: true, message: 'تم استلام اقتراحك بنجاح' });
  } catch (error) {
    console.error('Suggestion error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Email sending
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    
    const mailOptions = {
      from: process.env.SMTP_USER,
      to,
      subject,
      text,
      html: `<p>${text.replace(/\n/g, '<br>')}</p>`
    };
    
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'تم إرسال البريد الإلكتروني بنجاح' });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ success: false, message: 'فشل إرسال البريد الإلكتروني' });
  }
});

// Order status update with tracking
app.post('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber } = req.body;
    
    const order = await Order.findByIdAndUpdate(id, { status, trackingNumber }, { new: true });
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    // Send email notification if status changed to shipped or delivered
    if (order.customerEmail && (status === 'shipped' || status === 'delivered')) {
      let subject, text;
      
      if (status === 'shipped') {
        subject = 'تم شحن طلبك - متجر 𝐵𝒜𝟩𝐸𝑅';
        text = `مرحباً ${order.customerName},\n\nتم شحن طلبك رقم ${order._id}.\n\nرقم التتبع: ${trackingNumber}\n\nيمكنك تتبع شحنتك باستخدام الرابط التالي: https://tracking.example.com/?tracking=${trackingNumber}\n\nمع تحياتنا,\nفريق 𝐵𝒜𝟩𝐸𝑅`;
      } else {
        subject = 'تم تسليم طلبك - متجر 𝐵𝒜𝟩𝐸𝑅';
        text = `مرحباً ${order.customerName},\n\nتم تسليم طلبك رقم ${order._id} بنجاح.\n\nنأمل أن تكون راضياً عن مشترياتك. إذا كان لديك أي استفسارات، لا تتردد في التواصل معنا.\n\nمع تحياتنا,\nفريق 𝐵𝒜𝟩𝐸𝑅`;
      }
      
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: order.customerEmail,
        subject,
        text
      };
      
      await transporter.sendMail(mailOptions);
    }
    
    res.json({ success: true, order });
  } catch (error) {
    console.error('Order status update error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create initial admin user if not exists
async function createInitialAdmin() {
  const adminExists = await User.findOne({ username: 'BA7ER' });
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('Fahd', 10);
    const admin = new User({
      username: 'admin',
      password: hashedPassword,
      role: 'admin'
    });
    await admin.save();
    console.log('Initial admin user created');
  }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  createInitialAdmin();
});