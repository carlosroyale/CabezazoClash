// server.js - El Recepcionista (Matchmaking)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Match = require('./Match.js'); // Importamos la clase de la partida

const app = express();
const server = http.createServer(app);
server.on('connection', (socket) => {
    socket.setNoDelay(true); // Aniquilamos el Algoritmo de Nagle
});
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"], transports: ['websocket', 'polling'], credentials: true },
    allowEIO3: true,
    perMessageDeflate: false // Apagamos la compresión de Socket.io
});

// Servimos tu carpeta raíz
app.use(express.static(__dirname));

// Falsificamos el objeto window de los navegadores para que las físicas funcionen en Node.js
global.window = { playSound: () => {}, currentPlayers: [] };
const constants = require('./juego/js/constants.js');
Object.assign(global, constants);

// --- SISTEMA DE MATCHMAKING ---
let waitingPlayer = null;           // El jugador que está esperando rival
const activeMatches = new Map();    // Diccionario de partidas activas (room_1, room_2...)
let matchIdCounter = 0;             // Contador para crear IDs únicos

io.on('connection', (socket) => {
    console.log(`Nuevo usuario conectado al lobby: ${socket.id}`);

    socket.on('joinMatch', () => {
        // Si hay alguien esperando y NO es el mismo jugador pulsando dos veces
        if (waitingPlayer && waitingPlayer.id !== socket.id) {

            const roomId = 'room_' + (++matchIdCounter);
            console.log(`⚔️ Creando partida [${roomId}] entre ${waitingPlayer.id} y ${socket.id}`);

            // Creamos la nueva partida pasándole los dos jugadores
            const match = new Match(waitingPlayer, socket, io, roomId, () => {
                // Este callback se ejecuta cuando la partida termina (Match.js llama a destroy())
                activeMatches.delete(roomId);
                console.log(`🗑️ Partida [${roomId}] borrada de la memoria.`);
            });

            // Guardamos la partida en el registro activo
            activeMatches.set(roomId, match);

            // Vaciamos la silla de espera para los próximos que lleguen
            waitingPlayer = null;
        } else {
            // Si la silla está vacía, el jugador se sienta a esperar
            waitingPlayer = socket;
            console.log(`⏳ Jugador ${socket.id} esperando un rival digno...`);
        }
    });

    socket.on('disconnect', () => {
        // Solo nos preocupamos si el que se desconecta estaba en la sala de espera
        if (waitingPlayer === socket) {
            console.log(`🏃‍♂️ El jugador ${socket.id} se cansó de esperar y se fue.`);
            waitingPlayer = null;
        }
        // Si estaba jugando una partida, Match.js se encarga de gestionar su propia desconexión.
    });
});
const PORT = process.env.PORT || 8080;
// const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor de Matchmaking activo en el puerto ${PORT}`);
});