const express = require('express');
const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const path = require('path');

const app = express();
const server = http.createServer(app);
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        email TEXT UNIQUE,
        password TEXT,
        google_id TEXT UNIQUE,
        tg_id TEXT UNIQUE,
        elo INTEGER DEFAULT 1000
    )`);
});

app.use(express.json());
app.use(session({
    secret: 'session_secret',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('public'));

passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) return done(err);
        if (!user) return done(null, false);
        const match = await bcrypt.compare(password, user.password);
        if (!match) return done(null, false);
        return done(null, user);
    });
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
    db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => done(err, row));
});

app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [username, email, hash], (err) => {
        if (err) return res.status(400).json({ error: "Exists" });
        res.json({ success: true });
    });
});

app.post('/login', passport.authenticate('local'), (req, res) => {
    res.json({ success: true, user: { username: req.user.username, elo: req.user.elo } });
});

server.listen(3000);