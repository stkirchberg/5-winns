const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { key, checkWinLine } = require('./logic');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Ein Spieler hat sich verbunden:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Spieler hat die Verbindung getrennt.');
    });
});

server.listen(3000, () => {
    console.log('Server läuft auf http://localhost:3000');
});