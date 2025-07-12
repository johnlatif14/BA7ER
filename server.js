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

const app = express();

// Basic configurations
app.enable('trust proxy');
app.use(helmet());
app.use(cookieParser(process.env.COOKIE_SECRET || 'secure-cookie-secret'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS setup
app.use(cors({
    origin: 'https://ba7er-production.up.railway.app',
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token']
}));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'strong-session-secret',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
        secure: true,
        httpOnly: true,
        sameSite: 'none',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// CSRF protection
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

// File upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, uuidv4() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Email transporter
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
app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

app.post('/api/login', async (req, res) => {
    try {
        if (!req.body._csrf || req.body._csrf !== req.csrfToken()) {
            return res.status(403).json({ 
                success: false, 
                error: 'Invalid request' 
            });
        }

        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing credentials' 
            });
        }

        const db = JSON.parse(fs.readFileSync('db.json'));
        const user = db.users.find(u => u.username === username);
        
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ 
                success: false, 
                error: 'Invalid credentials' 
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
            error: 'Server error' 
        });
    }
});

// Other routes remain the same...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Initialize admin user if not exists
    const db = JSON.parse(fs.readFileSync('db.json'));
    if (!db.users.some(u => u.username === 'BA7ER')) {
        db.users.push({
            id: uuidv4(),
            username: 'BA7ER',
            password: bcrypt.hashSync('Fahd', 10),
            role: 'admin',
            createdAt: new Date().toISOString()
        });
        fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
    }
});