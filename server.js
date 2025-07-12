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

// Initialize Express
const app = express();

// Enable trust proxy for Railway
app.enable('trust proxy');

// Force HTTPS in production
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !req.secure) {
        return res.redirect('https://' + req.headers.host + req.url);
    }
    next();
});

// Initialize JSON database
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

// Basic Middleware
app.use(helmet());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS Configuration
app.use(cors({
    origin: 'https://ba7er-production.up.railway.app',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'strong-secret-key-123',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: { 
        secure: true,
        httpOnly: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000
    },
    store: process.env.DATABASE_URL ? 
        new (require('connect-pg-simple')(session))({
            conString: process.env.DATABASE_URL,
            createTableIfMissing: true
        }) : null
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

// CSRF Protection
const csrfProtection = csrf({ 
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'none'
    }
});
app.use(csrfProtection);

// Inject CSRF token
app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
});

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// SMTP configuration
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

// Static files
app.use(express.static(path.join(__dirname, 'public')));

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

// Authentication
app.post('/api/login', async (req, res) => {
    try {
        if (!req.body._csrf) {
            return res.status(403).json({ 
                success: false, 
                error: 'Invalid CSRF token' 
            });
        }

        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username and password are required' 
            });
        }

        const db = readDB();
        const user = db.users.find(u => u.username === username);
        
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid credentials' 
            });
        }
        
        req.session.regenerate(err => {
            if (err) {
                console.error('Session error:', err);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Server error' 
                });
            }
            
            req.session.user = user;
            res.json({ 
                success: true, 
                redirect: '/dashboard.html'
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Server error' 
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
            subject: 'Message Received - BA7ER Store',
            text: `Hello ${name},\n\nThank you for contacting us. We have received your message and will respond soon.\n\nYour message:\n${message}\n\nBest regards,\nBA7ER Team`
        };
        
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Message received successfully' });
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
                subject: 'Thank You for Your Suggestion',
                text: `We appreciate your suggestion and will review it carefully.\n\nBest regards,\nBA7ER Team`
            };
            await transporter.sendMail(mailOptions);
        }
        
        res.json({ success: true, message: 'Suggestion received successfully' });
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
        res.json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error('Email sending error:', error);
        res.status(500).json({ success: false, message: 'Failed to send email' });
    }
});

// Order status update
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
                subject = 'Your Order Has Shipped';
                text = `Hello ${order.customerName},\n\nYour order #${order.id} has shipped.\n\nTracking: ${trackingNumber}\n\nBest regards,\nBA7ER Team`;
            } else {
                subject = 'Your Order Has Been Delivered';
                text = `Hello ${order.customerName},\n\nYour order #${order.id} has been delivered.\n\nThank you for shopping with us!\n\nBest regards,\nBA7ER Team`;
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
        console.error('Order status error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Create initial admin
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
        console.log('Initial admin user created');
    }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    createInitialAdmin();
});