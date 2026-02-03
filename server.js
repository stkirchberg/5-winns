const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { key, checkWinLine } = require('./logic');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new sqlite3.Database('./database.db');

db.serialize(() => {

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        email TEXT UNIQUE,
        password TEXT,
        tg_id TEXT UNIQUE,
        elo INTEGER DEFAULT 1000,
        xp INTEGER DEFAULT 0
    )`);
});

app.use(express.static('public'));


let waitingPlayer = null; 
let activeGames = new Map();

io.on('connection', (socket) => {
    console.log('Ein Spieler hat sich verbunden:', socket.id);

    socket.on('login', (data) => {
        if (data.tg_id) {

            db.get("SELECT * FROM users WHERE tg_id = ?", [data.tg_id], (err, row) => {
                if (row) {
                    socket.emit('loginSuccess', row);
                } else {
                    db.run("INSERT INTO users (username, tg_id) VALUES (?, ?)", [data.username, data.tg_id], function(err) {
                        if (err) return console.error(err.message);
                        socket.emit('loginSuccess', { id: this.lastID, username: data.username, elo: 1000 });
                    });
                }
            });
        } else if (data.email) {

            db.get("SELECT * FROM users WHERE email = ?", [data.email], (err, row) => {
                if (row) {
                    socket.emit('loginSuccess', row);
                } else {
                    socket.emit('loginError', 'User nicht gefunden.');
                }
            });
        }
    });


    socket.on('findGame', (userData) => {
        if (waitingPlayer && waitingPlayer.id !== socket.id) {
            const gameId = `game_${Date.now()}`;
            const opponent = waitingPlayer;
            waitingPlayer = null;

            const gameState = {
                id: gameId,
                players: {
                    [socket.id]: { symbol: 1, name: userData.username }, 
                    [opponent.id]: { symbol: -1, name: opponent.name } 
                },
                board: new Map(),
                turn: 1 
            };

            activeGames.set(gameId, gameState);

            socket.join(gameId);
            opponent.socket.join(gameId);

            io.to(gameId).emit('matchFound', {
                gameId: gameId,
                yourSymbol: 0,
                players: gameState.players
            });

            console.log(`Spiel gestartet: ${gameId}`);
        } else {
            waitingPlayer = { id: socket.id, socket: socket, name: userData.username };
            socket.emit('waiting', 'Suche nach einem Gegner...');
        }
    });



    socket.on('makeMove', ({ gameId, x, y }) => {
        const game = activeGames.get(gameId);
        if (!game) return;

        const playerSymbol = game.players[socket.id].symbol;

        if (game.turn !== playerSymbol) return;
        if (game.board.has(key(x, y))) return;

        game.board.set(key(x, y), playerSymbol);

        const winLine = checkWinLine(x, y, playerSymbol, game.board);

        io.to(gameId).emit('moveMade', { x, y, player: playerSymbol });

        if (winLine) {
            io.to(gameId).emit('gameOver', { winner: socket.id, line: winLine });
            activeGames.delete(gameId);
        } else {
            game.turn *= -1;
        }
    });

    socket.on('disconnect', () => {
        if (waitingPlayer && waitingPlayer.id === socket.id) waitingPlayer = null;
        console.log('Spieler hat die Verbindung getrennt.');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server runns on http://localhost:${PORT}`);
});