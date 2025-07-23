require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// ملفات JSON
const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const SUGGESTIONS_FILE = path.join(DATA_DIR, 'suggestions.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

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
initFile(USERS_FILE, [{ username: 'admin', password: 'admin' }]);

// قراءة البيانات من ملف JSON
const readData = (filePath) => {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
};

// كتابة البيانات إلى ملف JSON
const writeData = (filePath, data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Middleware للتحقق من المصادقة
const authenticate = (req, res, next) => {
    if (req.path === '/api/login' || req.path.startsWith('/public') || req.path === '/') {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'غير مصرح به' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== 'valid-token') {
        return res.status(401).json({ error: 'غير مصرح به' });
    }

    next();
};

app.use(authenticate);

// تسجيل الدخول
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = readData(USERS_FILE);
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        res.json({ token: 'valid-token' });
    } else {
        res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
});

// تسجيل الخروج
app.post('/api/logout', (req, res) => {
    res.json({ message: 'تم تسجيل الخروج بنجاح' });
});

// المنتجات
app.get('/api/products', (req, res) => {
    const products = readData(PRODUCTS_FILE);
    res.json(products);
});

app.post('/api/products', (req, res) => {
    const products = readData(PRODUCTS_FILE);
    const newProduct = {
        id: Date.now().toString(),
        ...req.body,
        createdAt: new Date().toISOString()
    };
    products.push(newProduct);
    writeData(PRODUCTS_FILE, products);
    res.status(201).json(newProduct);
});

app.put('/api/products/:id', (req, res) => {
    const products = readData(PRODUCTS_FILE);
    const index = products.findIndex(p => p.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ error: 'المنتج غير موجود' });
    }
    products[index] = { ...products[index], ...req.body };
    writeData(PRODUCTS_FILE, products);
    res.json(products[index]);
});

app.delete('/api/products/:id', (req, res) => {
    const products = readData(PRODUCTS_FILE);
    const filteredProducts = products.filter(p => p.id !== req.params.id);
    writeData(PRODUCTS_FILE, filteredProducts);
    res.json({ message: 'تم حذف المنتج بنجاح' });
});

// الطلبات
app.get('/api/orders', (req, res) => {
    const orders = readData(ORDERS_FILE);
    res.json(orders);
});

app.post('/api/orders', (req, res) => {
    const orders = readData(ORDERS_FILE);
    const newOrder = {
        id: Date.now().toString(),
        ...req.body,
        status: 'قيد المعالجة',
        date: new Date().toISOString()
    };
    orders.push(newOrder);
    writeData(ORDERS_FILE, orders);
    res.status(201).json(newOrder);
});

// الاقتراحات
app.get('/api/suggestions', (req, res) => {
    const suggestions = readData(SUGGESTIONS_FILE);
    res.json(suggestions);
});

app.post('/api/suggestions', (req, res) => {
    const suggestions = readData(SUGGESTIONS_FILE);
    const newSuggestion = {
        id: Date.now().toString(),
        ...req.body,
        date: new Date().toISOString()
    };
    suggestions.push(newSuggestion);
    writeData(SUGGESTIONS_FILE, suggestions);
    res.status(201).json(newSuggestion);
});

app.delete('/api/suggestions/:id', (req, res) => {
    const suggestions = readData(SUGGESTIONS_FILE);
    const filteredSuggestions = suggestions.filter(s => s.id !== req.params.id);
    writeData(SUGGESTIONS_FILE, filteredSuggestions);
    res.json({ message: 'تم حذف الاقتراح بنجاح' });
});

// رسائل التواصل
app.get('/api/messages', (req, res) => {
    const messages = readData(MESSAGES_FILE);
    res.json(messages);
});

app.post('/api/messages', (req, res) => {
    const messages = readData(MESSAGES_FILE);
    const newMessage = {
        id: Date.now().toString(),
        ...req.body,
        date: new Date().toISOString()
    };
    messages.push(newMessage);
    writeData(MESSAGES_FILE, messages);
    res.status(201).json(newMessage);
});

app.delete('/api/messages/:id', (req, res) => {
    const messages = readData(MESSAGES_FILE);
    const filteredMessages = messages.filter(m => m.id !== req.params.id);
    writeData(MESSAGES_FILE, filteredMessages);
    res.json({ message: 'تم حذف الرسالة بنجاح' });
});

// إرسال البريد
app.post('/api/send-email', async (req, res) => {
    const { to, subject, message } = req.body;

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    try {
        await transporter.sendMail({
            from: `"𝐵𝒜𝟩𝐸𝑅 متجر التيشيرتات" <${process.env.SMTP_USER}>`,
            to,
            subject,
            text: message,
            html: `<p>${message}</p>`
        });
        res.json({ message: 'تم إرسال البريد بنجاح' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'فشل في إرسال البريد' });
    }
});

// Route للصفحة الرئيسية
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route لتسجيل الدخول
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route للوحة التحكم
app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// بدء الخادم
app.listen(PORT, () => {
    console.log(`الخادم يعمل على http://localhost:${PORT}`);
});