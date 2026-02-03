const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        elo INTEGER DEFAULT 1000
    )`);
});

app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'secret123',
    resave: false,
    saveUninitialized: false
}));

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash], (err) => {
        if (err) return res.status(400).json({ success: false });
        res.json({ success: true });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = user; 
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false });
        }
    });
});

app.get('/api/me', (req, res) => {
    if (req.session.user) res.json(req.session.user);
    else res.status(401).json({ error: 'unauthorized' });
});

app.listen(3000, () => console.log('running on port 3000'));