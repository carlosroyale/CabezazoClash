const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        transports: ['websocket', 'polling'],
        credentials: true
    },
    allowEIO3: true
});
// Servimos la carpeta raíz del proyecto
app.use(express.static(__dirname));

// --- MOCK DE BROWSER PARA LAS FÍSICAS ---
global.window = {
    playSound: () => {}, // Función vacía para que no pete el servidor al "sonar" un rebote
    currentPlayers: []
};

// --- IMPORTAMOS TU MOTOR FÍSICO ---
const constants = require('./juego/js/constants.js');

// TRUCO MÁGICO: Inyectamos todas las constantes en el "global" de Node.js
// Así entities.js y physics.js pueden leer GRAV, RESTITUTION, etc., sin modificar su código.
Object.assign(global, constants);

// --- IMPORTAMOS TU MOTOR FÍSICO ---
const { makePlayer, updatePlayer, updateBall, controlPlayer } = require('./juego/js/entities.js');
const { collidePlayers, collidePlayerBall } = require('./juego/js/physics.js');

// --- VARIABLES DEL MUNDO ---
const W = 1845;
const H = 1038;
const FLOOR_Y = H - 325;

// El "Tablero" oficial del servidor
let gameState = {
    p1: makePlayer(180, FLOOR_Y - 90, "P1", true),
    p2: makePlayer(W - 180, FLOOR_Y - 90, "P2", false),
    ball: { r: 18, x: W / 2, y: FLOOR_Y - 200, vx: 0, vy: 0, angle: 0 },
    score: { left: 0, right: 0 }
};

// Control de jugadores (Matchmaking hiper-básico)
let clients = {
    p1: null, // Guardará el ID del socket del Jugador 1
    p2: null  // Guardará el ID del socket del Jugador 2
};

// Guardamos las teclas que está pulsando cada jugador
let inputs = {
    p1: new Set(),
    p2: new Set()
};

// --- CONEXIONES DE LOS JUGADORES ---
io.on('connection', (socket) => {
    console.log(`Nuevo jugador conectado: ${socket.id}`);

    // Asignar rol al jugador
    let role = null;
    if (!clients.p1) {
        clients.p1 = socket.id;
        role = 'p1';
        console.log(`${socket.id} es el Jugador 1 (Izquierda)`);
    } else if (!clients.p2) {
        clients.p2 = socket.id;
        role = 'p2';
        console.log(`${socket.id} es el Jugador 2 (Derecha)`);
    } else {
        console.log(`${socket.id} es un Espectador (Sala llena)`);
        role = 'spectator';
    }

    // Le decimos al cliente quién es
    socket.emit('initRole', role);

    // Escuchar cuando el jugador pulsa o suelta una tecla
    socket.on('playerInput', (data) => {
        if (role !== 'p1' && role !== 'p2') return;

        // data.key será por ejemplo "KeyW", data.isDown será true o false
        if (data.isDown) {
            inputs[role].add(data.key);
        } else {
            inputs[role].delete(data.key);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Jugador desconectado: ${socket.id}`);
        if (clients.p1 === socket.id) { clients.p1 = null; inputs.p1.clear(); }
        if (clients.p2 === socket.id) { clients.p2 = null; inputs.p2.clear(); }
    });
});

// --- EL BUCLE DEL SERVIDOR (60 FPS) ---
const TICK_RATE = 1000 / 60; // ~16.6ms
let lastTime = Date.now();

setInterval(() => {
    const now = Date.now();
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    dt = Math.min(dt, DT_MAX);

    // Si los dos jugadores están conectados, la partida está "viva"
    if (clients.p1 && clients.p2) {
        // 1. Aplicar controles (Mapeamos para que ambos usen las mismas teclas lógicas pero muevan su respectivo muñeco)
        controlPlayer(gameState.p1, dt, "KeyA", "KeyD", "KeyW", "Space", inputs.p1);
        controlPlayer(gameState.p2, dt, "KeyA", "KeyD", "KeyW", "Space", inputs.p2);

        // 2. Físicas
        updatePlayer(gameState.p1, dt, W, FLOOR_Y);
        updatePlayer(gameState.p2, dt, W, FLOOR_Y);
        collidePlayers(gameState.p1, gameState.p2);
        updateBall(gameState.ball, dt, W, FLOOR_Y);
        collidePlayerBall(gameState.p1, gameState.ball);
        collidePlayerBall(gameState.p2, gameState.ball);

        // (Más adelante añadiremos el control de las porterías y bordes del mapa)
    }

    // 3. Enviar la foto exacta de la realidad a todos los conectados
    io.emit('gameState', gameState);

}, TICK_RATE);

// Usamos el 8080 por defecto porque es el favorito de DigitalOcean App Platform
const PORT = process.env.PORT || 8080;

// EL TRUCO: Añadir '0.0.0.0' obliga a Node a escuchar las conexiones externas del proxy de DO
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor de juegos activo escuchando en 0.0.0.0:${PORT}`);
});