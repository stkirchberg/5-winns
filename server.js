const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const { key, checkWinLine } = require('./logic');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Database Setup
const db = new sqlite3.Database('./database.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        email TEXT UNIQUE,
        password TEXT,
        google_id TEXT UNIQUE,
        tg_id TEXT UNIQUE,
        elo INTEGER DEFAULT 1000,
        avatar TEXT
    )`);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: 'gomoku_secret_key', // In Produktion sicher aufbewahren!
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('public'));

// Passport Konfiguration
passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) return done(err);
        if (!user) return done(null, false, { message: 'Email nicht gefunden.' });
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return done(null, false, { message: 'Passwort falsch.' });
        
        return done(null, user);
    });
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
    db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => done(err, row));
});

// --- AUTH ROUTES ---

// Registrierung
app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", 
            [username, email, hashedPassword], 
            (err) => {
                if (err) return res.status(400).send("Email bereits vergeben.");
                res.send({ success: true });
            }
        );
    } catch (e) { res.status(500).send("Fehler bei der Registrierung"); }
});

// Login
app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) return res.status(401).send(info.message);
        req.logIn(user, (err) => {
            if (err) return next(err);
            return res.send({ success: true, user: { username: user.username, elo: user.elo } });
        });
    })(req, res, next);
});

// --- SOCKET.IO LOGIK (Matchmaking & Moves) ---
let waitingPlayer = null;
let activeGames = new Map();

io.on('connection', (socket) => {
    socket.on('findGame', (userData) => {
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            const gameId = `game_${Date.now()}`;
            const opponent = waitingPlayer;
            waitingPlayer = null;
            const gameState = {
                id: gameId,
                players: { [socket.id]: { symbol: 1, name: userData.username }, [opponent.id]: { symbol: -1, name: opponent.name } },
                board: new Map(), turn: 1
            };
            activeGames.set(gameId, gameState);
            socket.join(gameId); opponent.socket.join(gameId);
            io.to(gameId).emit('matchFound', { gameId, players: gameState.players });
        } else {
            waitingPlayer = { id: socket.id, socket, name: userData.username };
            socket.emit('waiting', 'Suche Gegner...');
        }
    });

    socket.on('makeMove', ({ gameId, x, y }) => {
        const game = activeGames.get(gameId);
        if (!game || game.turn !== game.players[socket.id].symbol || game.board.has(key(x, y))) return;
        
        game.board.set(key(x, y), game.players[socket.id].symbol);
        const winLine = checkWinLine(x, y, game.players[socket.id].symbol, game.board);
        io.to(gameId).emit('moveMade', { x, y, player: game.players[socket.id].symbol });

        if (winLine) {
            io.to(gameId).emit('gameOver', { winner: socket.id, line: winLine });
            activeGames.delete(gameId);
        } else { game.turn *= -1; }
    });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server runns on http://localhost:${PORT}`));