require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// تهيئة Express
const app = express();

// إجبار استخدام HTTPS في production
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
});

// تهيئة قاعدة البيانات JSON
const DB_FILE = path.join(__dirname, 'db.json');

function readDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        const defaultDB = {
            users: [],
            products: [],
            orders: [],
            suggestions: [],
            contactMessages: []
        };
        writeDB(defaultDB);
        return defaultDB;
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? 'https://ba7er-production.up.railway.app' : '*',
    credentials: true
}));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-strong-secret-key-here',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

// CSRF protection
const csrfProtection = csrf({ 
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'strict'
    }
});
app.use(csrfProtection);

// تهيئة تحميل الملفات
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// تهيئة SMTP
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

// اختبار اتصال SMTP
transporter.verify((error) => {
    if (error) console.error('SMTP connection error:', error);
});

// ملفات ثابتة
app.use(express.static(path.join(__dirname, 'public')));

// Middleware لحقن CSRF token في جميع الاستجابات
app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard.html', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

// Authentication routes
app.post('/api/login', async (req, res) => {
    try {
        // التحقق من وجود CSRF token
        if (!req.body._csrf) {
            return res.status(403).json({ 
                success: false, 
                error: 'رمز الحماية غير صالح' 
            });
        }

        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'اسم المستخدم وكلمة المرور مطلوبان' 
            });
        }

        const db = readDB();
        const user = db.users.find(u => u.username === username);
        
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ 
                success: false, 
                error: 'بيانات الدخول غير صحيحة' 
            });
        }
        
        req.session.user = user;
        res.json({ 
            success: true, 
            redirect: '/dashboard.html'
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'حدث خطأ في الخادم' 
        });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ success: false });
        }
        res.clearCookie('connect.sid');
        res.clearCookie('_csrf');
        res.json({ success: true, redirect: '/login.html' });
    });
});

// Products API
app.get('/api/products', (req, res) => {
    try {
        const db = readDB();
        res.json(db.products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/products', upload.single('image'), (req, res) => {
    try {
        const { name, description, price, sizes, stock } = req.body;
        const db = readDB();
        
        const product = {
            id: uuidv4(),
            name,
            description,
            price: parseFloat(price),
            sizes: sizes.split(',').map(s => s.trim()),
            stock: parseInt(stock),
            image: req.file ? path.basename(req.file.path) : null,
            createdAt: new Date().toISOString()
        };
        
        db.products.push(product);
        writeDB(db);
        
        res.json(product);
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Orders API
app.get('/api/orders', (req, res) => {
    try {
        const { status } = req.query;
        const db = readDB();
        
        let orders = db.orders;
        if (status && status !== 'all') {
            orders = orders.filter(o => o.status === status);
        }
        
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
        const db = readDB();
        
        const contactMessage = {
            id: uuidv4(),
            name,
            email,
            message,
            createdAt: new Date().toISOString()
        };
        
        db.contactMessages.push(contactMessage);
        writeDB(db);
        
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
        const db = readDB();
        
        const suggestion = {
            id: uuidv4(),
            content,
            email,
            createdAt: new Date().toISOString()
        };
        
        db.suggestions.push(suggestion);
        writeDB(db);
        
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
        const db = readDB();
        
        const orderIndex = db.orders.findIndex(o => o.id === id);
        if (orderIndex === -1) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        db.orders[orderIndex].status = status;
        db.orders[orderIndex].trackingNumber = trackingNumber;
        writeDB(db);
        
        const order = db.orders[orderIndex];
        
        if (order.customerEmail && (status === 'shipped' || status === 'delivered')) {
            let subject, text;
            
            if (status === 'shipped') {
                subject = 'تم شحن طلبك - متجر 𝐵𝒜𝟩𝐸𝑅';
                text = `مرحباً ${order.customerName},\n\nتم شحن طلبك رقم ${order.id}.\n\nرقم التتبع: ${trackingNumber}\n\nمع تحياتنا,\nفريق 𝐵𝒜𝟩𝐸𝑅`;
            } else {
                subject = 'تم تسليم طلبك - متجر 𝐵𝒜𝟩𝐸𝑅';
                text = `مرحباً ${order.customerName},\n\nتم تسليم طلبك رقم ${order.id} بنجاح.\n\nنأمل أن تكون راضياً عن مشترياتك.\n\nمع تحياتنا,\nفريق 𝐵𝒜𝟩𝐸𝑅`;
            }
            
            await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: order.customerEmail,
                subject,
                text
            });
        }
        
        res.json({ success: true, order });
    } catch (error) {
        console.error('Order status update error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// إنشاء مستخدم مدير إذا لم يوجد
function createInitialAdmin() {
    const db = readDB();
    const adminExists = db.users.some(u => u.username === 'BA7ER');
    
    if (!adminExists) {
        const hashedPassword = bcrypt.hashSync('Fahd', 10);
        const admin = {
            id: uuidv4(),
            username: 'BA7ER',
            password: hashedPassword,
            role: 'admin',
            createdAt: new Date().toISOString()
        };
        
        db.users.push(admin);
        writeDB(db);
        console.log('تم إنشاء المستخدم الإداري الافتراضي');
    }
}

// بدء الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    createInitialAdmin();
});