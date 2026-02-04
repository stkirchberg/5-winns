const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const db = new sqlite3.Database('./database.db');

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, uploadDir); },
    filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage: storage });

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        elo INTEGER DEFAULT 100,
        bio TEXT DEFAULT '',
        profile_pic TEXT DEFAULT ''
    )`);
});

app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'secret123',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false });
    const hash = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (username, password, elo, bio, profile_pic) VALUES (?, ?, 100, '', '')", [username, hash], (err) => {
        if (err) return res.status(400).json({ success: false });
        res.json({ success: true });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user.id;
            req.session.save(() => res.json({ success: true }));
        } else {
            res.status(401).json({ success: false });
        }
    });
});

app.get('/api/me', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'unauthorized' });
    db.get("SELECT username, elo, bio, profile_pic FROM users WHERE id = ?", [req.session.userId], (err, row) => {
        if (row) res.json(row);
        else res.status(404).json({ error: 'not found' });
    });
});

app.post('/api/update-profile', upload.single('avatar'), (req, res) => {
    if (!req.session.userId) return res.status(401).json({ success: false });
    const bio = req.body.bio || '';
    let query = "UPDATE users SET bio = ? WHERE id = ?";
    let params = [bio, req.session.userId];

    if (req.file) {
        query = "UPDATE users SET bio = ?, profile_pic = ? WHERE id = ?";
        params = [bio, `/uploads/${req.file.filename}`, req.session.userId];
    }

    db.run(query, params, (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.listen(3000, () => console.log('Server runs on: http://localhost:3000'));