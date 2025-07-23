require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// إعداد الجلسات
app.use(session({
    secret: process.env.SESSION_SECRET || 'default-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 ساعة
    }
}));

// ضمان أن الاستجابات تكون JSON
app.use((req, res, next) => {
    res.header('Content-Type', 'application/json');
    next();
});

// ملفات JSON
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SUGGESTIONS_FILE = path.join(DATA_DIR, 'suggestions.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

// إنشاء مجلد البيانات إذا لم يكن موجودًا
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// إنشاء ملفات JSON إذا لم تكن موجودة
const initFile = (filePath, initialData = []) => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
    }
};

initFile(PRODUCTS_FILE);
initFile(ORDERS_FILE);
initFile(SUGGESTIONS_FILE);
initFile(MESSAGES_FILE);

// قراءة البيانات من ملف JSON
const readData = (filePath) => {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
        return [];
    }
};

// كتابة البيانات إلى ملف JSON
const writeData = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error writing to ${filePath}:`, error);
    }
};

// Middleware للتحقق من المصادقة
const authenticate = (req, res, next) => {
    if (req.path === '/api/login' || req.path === '/login' || req.path === '/' || req.path.startsWith('/public')) {
        return next();
    }

    if (!req.session.isAuthenticated) {
        return res.status(401).json({ error: 'غير مصرح به' });
    }

    next();
};

app.use(authenticate);

// تسجيل الدخول
app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                error: 'اسم المستخدم وكلمة المرور مطلوبان',
                success: false
            });
        }

        if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
            req.session.isAuthenticated = true;
            return res.json({ 
                success: true,
                message: 'تم تسجيل الدخول بنجاح'
            });
        } else {
            return res.status(401).json({ 
                error: 'اسم المستخدم أو كلمة المرور غير صحيحة',
                success: false
            });
        }
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ 
            error: 'حدث خطأ في الخادم',
            success: false
        });
    }
});

// تسجيل الخروج
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ 
                error: 'حدث خطأ أثناء تسجيل الخروج',
                success: false
            });
        }
        return res.json({ 
            success: true,
            message: 'تم تسجيل الخروج بنجاح'
        });
    });
});

// Routes للصفحات
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
    if (!req.session.isAuthenticated) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// معالج الأخطاء العام
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'حدث خطأ في الخادم',
        success: false
    });
});

// بدء الخادم
app.listen(PORT, () => {
    console.log(`الخادم يعمل على http://localhost:${PORT}`);
});