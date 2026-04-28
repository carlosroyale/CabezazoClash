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
let waitingPlayers = [];            // Array de jugadores esperando rival
const activeMatches = new Map();    // Diccionario de partidas activas (room_1, room_2...)
let matchIdCounter = 0;             // Contador para crear IDs únicos

// Registro global de usuarios conectados (userId -> socket.id)
const connectedUsers = new Map();

// Mapa para saber en qué sala activa está cada jugador (userId -> roomId)
const userMatchMap = new Map();

function expulsarSesionAnterior(userId) {
    const previousSocketId = connectedUsers.get(userId);
    if (!previousSocketId) return;

    const previousSocket = io.sockets.sockets.get(previousSocketId);
    if (previousSocket) {
        previousSocket.emit('sessionReplaced');
        previousSocket.disconnect(true);
    }
    else {
        connectedUsers.delete(userId);
        waitingPlayers = waitingPlayers.filter(p => p.userId !== userId);
    }
}

// Middleware de Socket.io. Se ejecuta ANTES de que el socket se conecte del todo
io.use((socket, next) => {
    // Extraemos el userId que el cliente nos enviará al intentar conectar
    const userId = socket.handshake.auth.userId;
    const username = socket.handshake.auth.username;
    const forceTakeover = socket.handshake.auth.forceTakeover === true || socket.handshake.auth.forceTakeover === 'true';

    if (userId) {
        if (connectedUsers.has(userId)) {
            if (!forceTakeover) {
                // Si el ID ya está en nuestro mapa, rechazamos la conexión con un error personalizado
                return next(new Error("already_connected"));
            }

            // El usuario ha pedido entrar aquí, así que cerramos la sesión anterior.
            expulsarSesionAnterior(userId);
        }
        // Si no está, lo registramos temporalmente en el socket para saber quién es
        socket.userId = userId;
        socket.username = typeof username === 'string' ? username : '';

        // Inicializamos los puntos a 0. ¡Se actualizarán con los reales al hacer joinMatch!
        socket.puntos = 0;

        // Y lo añadimos a la lista de usuarios activos
        connectedUsers.set(userId, socket.id);
    }

    next();
});

io.on('connection', (socket) => {
    console.log(`Nuevo usuario conectado al lobby: ${socket.id}`);

    socket.on('joinMatch', puntosFrescos => {
        // Actualizamos la memoria del servidor con el dato más reciente
        if (typeof puntosFrescos === 'number') {
            socket.puntos = puntosFrescos;
        }

        // VERIFICAR SI ESTÁ RECONECTANDO A UNA PARTIDA CAÍDA
        if (userMatchMap.has(socket.userId)) {
            const roomId = userMatchMap.get(socket.userId);
            const match = activeMatches.get(roomId);

            if (match && !match.isDestroyed) {
                console.log(`🔄 Reconectando al jugador ${socket.userId} a la partida [${roomId}]`);
                match.reconnectPlayer(socket);
                return; // Salimos de la función para no meterlo a buscar rival
            } else {
                // Si la partida caducó o fue borrada, limpiamos su registro
                userMatchMap.delete(socket.userId);
            }
        }

        // --- LÓGICA NORMAL DE BÚSQUEDA ---
        let matchedOpponentIndex = -1;

        // Recorremos la sala de espera buscando a alguien en nuestro rango
        for (let i = 0; i < waitingPlayers.length; i++) {
            const p = waitingPlayers[i];

            // No nos emparejamos a nosotros mismos (por si recarga o spamea el botón)
            if (p.id === socket.id) continue;

            // Calculamos la diferencia absoluta de puntos
            const diferencia = Math.abs((p.puntos || 0) - (socket.puntos || 0));

            // Si la diferencia es 100 o menos, ¡tenemos rival!
            if (diferencia <= 200) {
                matchedOpponentIndex = i;
                break; // Paramos de buscar
            }
        }

        if (matchedOpponentIndex !== -1) {
            // Sacamos al rival de la lista de espera
            const opponent = waitingPlayers.splice(matchedOpponentIndex, 1)[0];

            const roomId = 'room_' + (++matchIdCounter);
            console.log(`⚔️ Partida [${roomId}] | ${opponent.id} (${opponent.puntos} pts) VS ${socket.id} (${socket.puntos} pts)`);

            // Registramos que estos usuarios están ocupados en esta sala
            userMatchMap.set(opponent.userId, roomId);
            userMatchMap.set(socket.userId, roomId);

            const match = new Match(opponent, socket, io, roomId, (p1Id, p2Id) => {
                activeMatches.delete(roomId);
                if (userMatchMap.get(p1Id) === roomId) userMatchMap.delete(p1Id);
                if (userMatchMap.get(p2Id) === roomId) userMatchMap.delete(p2Id);
                console.log(`🗑️ Partida [${roomId}] borrada de la memoria.`);
            });

            activeMatches.set(roomId, match);
        }
        else {
            // Si no hay nadie en su rango, lo metemos en la lista de espera
            // (Comprobamos antes que no esté ya dentro para evitar duplicados)
            if (!waitingPlayers.find(p => p.id === socket.id)) {
                waitingPlayers.push(socket);
                console.log(`⏳ Jugador ${socket.id} (${socket.puntos} pts) esperando rival (+/- 200 pts)...`);
            }
        }
    });

    socket.on('disconnect', () => {
        // Liberamos su cuenta para que pueda volver a entrar si recarga la página
        if (socket.userId) {
            if (connectedUsers.get(socket.userId) === socket.id) {
                connectedUsers.delete(socket.userId);
                console.log(`Usuario ${socket.userId} liberado.`);
            }
        }

        // Buscamos si el jugador estaba en la cola y lo eliminamos
        const index = waitingPlayers.findIndex(p => p.id === socket.id);
        if (index !== -1) {
            waitingPlayers.splice(index, 1);
            console.log(`🏃‍♂️ El jugador ${socket.id} salió de la cola de búsqueda.`);
        }
    });
});
const PORT = process.env.PORT || 8080;
// const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor de Matchmaking activo en el puerto ${PORT}`);
});