const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const app = express();
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        elo INTEGER DEFAULT 100
    )`);
});

app.use(express.json());
app.use(express.static('public'));
app.use(session({
    secret: 'secret123',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Auf true setzen, wenn du HTTPS nutzt
        maxAge: 1000 * 60 * 60 * 24 // 1 Tag gültig
    }
}));

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false });
    const hash = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (username, password, elo) VALUES (?, ?, 100)", [username, hash], (err) => {
        if (err) return res.status(400).json({ success: false });
        res.json({ success: true });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user.id;
            // WICHTIG: Session explizit speichern vor dem Response
            req.session.save((err) => {
                if (err) return res.status(500).json({ success: false });
                res.json({ success: true });
            });
        } else {
            res.status(401).json({ success: false });
        }
    });
});

app.get('/api/me', (req, res) => {
    if (req.session.userId) {
        db.get("SELECT username, elo FROM users WHERE id = ?", [req.session.userId], (err, row) => {
            if (row) res.json(row);
            else res.status(404).json({ error: 'User not found' });
        });
    } else {
        res.status(401).json({ error: 'unauthorized' });
    }
});

app.get('/api/leaderboard', (req, res) => {
    db.all("SELECT username, elo FROM users ORDER BY elo DESC LIMIT 10", [], (err, rows) => {
        if (err) return res.status(500).json([]);
        res.json(rows);
    });
});

app.listen(3000, () => console.log('Server läuft auf Port 3000'));