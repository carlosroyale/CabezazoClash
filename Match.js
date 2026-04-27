// Match.js - Molde para partidas individuales
const { makePlayer, updatePlayer, updateBall, controlPlayer } = require('./juego/js/entities.js');
const { collidePlayers, collidePlayerBall, checkGoalCollisions, collidePlayerGoals, arePlayersBackToBack, resolveBackToBackBallSqueeze, resolveBallSqueezeUp } = require('./juego/js/physics.js');

const W = 1845;
const H = 1038;
const FLOOR_Y = H - 325;
const GOAL_W = global.GOAL_W || 80;
const GOAL_H = global.GOAL_H || 200;
const DT_MAX = global.DT_MAX || 1/30;

class Match {
    constructor(p1Socket, p2Socket, io, roomId, onMatchEndCallback) {
        this.p1Socket = p1Socket;
        this.p2Socket = p2Socket;
        this.io = io;
        this.roomId = roomId;
        this.onMatchEndCallback = onMatchEndCallback;
        this.isDestroyed = false;

        // Handlers propios de ESTA partida
        this.onP1Input = (data) => {
            if (data.isDown) this.inputs.p1.add(data.key);
            else this.inputs.p1.delete(data.key);
        };

        this.onP2Input = (data) => {
            if (data.isDown) this.inputs.p2.add(data.key);
            else this.inputs.p2.delete(data.key);
        };

        this.onP1TogglePause = () => this.togglePause();
        this.onP2TogglePause = () => this.togglePause();

        this.onP1PingLatency = (timestamp, ack) => {
            if (typeof ack === 'function') ack(timestamp);
        };

        this.onP2PingLatency = (timestamp, ack) => {
            if (typeof ack === 'function') ack(timestamp);
        };

        this.onP1Disconnect = () => this.handleDisconnect('p1');
        this.onP2Disconnect = () => this.handleDisconnect('p2');

        this.p1Socket.join(this.roomId);
        this.p2Socket.join(this.roomId);

        this.leftGoal = {x: 0, y: FLOOR_Y - GOAL_H, w: GOAL_W, h: GOAL_H};
        this.rightGoal = {x: W - GOAL_W, y: FLOOR_Y - GOAL_H, w: GOAL_W, h: GOAL_H};

        this.gameState = {
            p1: makePlayer(180, FLOOR_Y - 90, "J1", true),
            p2: makePlayer(W - 180, FLOOR_Y - 90, "J2", false),
            ball: { r: 18, x: W / 2, y: FLOOR_Y - 200, vx: 0, vy: 0, angle: 0 },
            score: { left: 0, right: 0 },
            gameTime: 60,
            isPaused: false,
            isFinished: false,
            countdown: 5.0,
            serveState: { server: null, active: true },
            isCelebrating: false
        };

        this.isGoalScored = false;
        this.celebrationTimer = 0;
        this.nextScorer = null;
        this.inputs = { p1: new Set(), p2: new Set() };

        this.loopInterval = null;
        this.lastTime = Date.now();
        this.simulationTimeMs = 0;
        this.allowedSoundEvents = new Set([
            'sfx-player-kick',
            'sfx-player-collide',
            'sfx-land',
            'sfx-jump',
            'sfx-ball-post',
            'sfx-rebound'
        ]);
        this.pendingSoundEvents = [];
        this.playerLabels = {
            left: this.getScoreboardLabel(this.p1Socket.username, 'J1'),
            right: this.getScoreboardLabel(this.p2Socket.username, 'J2')
        };
        this.playerNames = {
            left: this.getPresentationName(this.p1Socket.username, 'Jugador 1'),
            right: this.getPresentationName(this.p2Socket.username, 'Jugador 2')
        };

        this.setupEvents();
        this.startRound();

        this.p1Socket.emit('initRole', 'p1');
        this.p2Socket.emit('initRole', 'p2');
        this.io.to(this.roomId).emit('matchReady', {
            leftLabel: this.playerLabels.left,
            rightLabel: this.playerLabels.right,
            leftName: this.playerNames.left,
            rightName: this.playerNames.right
        });

        this.startLoop();
    }

    setupEvents() {
        this.p1Socket.on('playerInput', this.onP1Input);
        this.p1Socket.on('requestTogglePause', this.onP1TogglePause);
        this.p1Socket.on('pingLatency', this.onP1PingLatency);
        this.p1Socket.on('disconnect', this.onP1Disconnect);

        this.p2Socket.on('playerInput', this.onP2Input);
        this.p2Socket.on('requestTogglePause', this.onP2TogglePause);
        this.p2Socket.on('pingLatency', this.onP2PingLatency);
        this.p2Socket.on('disconnect', this.onP2Disconnect);
    }

    getScoreboardLabel(username, fallback) {
        if (typeof username !== 'string') return fallback;
        const limpio = username.trim();
        if (!limpio) return fallback;
        return limpio.slice(0, 3).toUpperCase();
    }

    getPresentationName(username, fallback) {
        if (typeof username !== 'string') return fallback;
        const limpio = username.trim();
        if (!limpio) return fallback;
        return limpio.slice(0, 18);
    }

    togglePause() {
        if (!this.gameState.isFinished && this.gameState.countdown <= 0) {
            this.gameState.isPaused = !this.gameState.isPaused;
            if (!this.gameState.isPaused) this.gameState.countdown = 3.0;

            // Enviamos el estado solo a los que están en la sala
            // this.io.to(this.roomId).emit('gameState', this.gameState);
            this.sendHUD();
        }
    }

    handleDisconnect(role) {
        if (!this.gameState.isFinished) {
            this.io.to(this.roomId).emit('playerLeft');
        }
        this.destroy(); // Destruimos la partida si alguien huye
    }

    startRound(lastScorer = null) {
        this.isGoalScored = false;
        this.gameState.isCelebrating = false;

        this.gameState.p1.x = 180; this.gameState.p1.y = FLOOR_Y - this.gameState.p1.h / 2; this.gameState.p1.vx = 0; this.gameState.p1.vy = 0;
        this.gameState.p2.x = W - 180; this.gameState.p2.y = FLOOR_Y - this.gameState.p2.h / 2; this.gameState.p2.vx = 0; this.gameState.p2.vy = 0;
        this.gameState.ball.x = W / 2; this.gameState.ball.y = FLOOR_Y - 200;

        if (lastScorer === "left") {
            this.gameState.ball.vx = 220; this.gameState.serveState.server = "right";
        } else if (lastScorer === "right") {
            this.gameState.ball.vx = -220; this.gameState.serveState.server = "left";
        } else {
            this.gameState.ball.vx = Math.random() > 0.5 ? 220 : -220;
            this.gameState.serveState.server = this.gameState.ball.vx > 0 ? "right" : "left";
        }

        this.gameState.ball.vy = -220;
        this.gameState.serveState.active = true;

        this.io.to(this.roomId).emit('matchReset');
        // Enviamos el HUD instantáneamente al empezar la ronda
        this.sendHUD();
    }

    startLoop() {
        // Bucle físico ultra rápido (60Hz) - Aquí enviamos el gameSyncBinario
        this.loopInterval = setInterval(() => {
            this.update();
        }, 1000 / 60);

        // Bucle de HUD muy relajado (2Hz - Dos veces por segundo)
        this.hudInterval = setInterval(() => {
            this.sendHUD();
        }, 500);
    }

    queueSound(soundId, volume = 1) {
        if (!this.allowedSoundEvents.has(soundId)) return;
        this.pendingSoundEvents.push({ id: soundId, v: volume });
    }

    flushQueuedSounds() {
        if (this.pendingSoundEvents.length === 0) return;
        this.io.to(this.roomId).emit('soundFx', this.pendingSoundEvents);
        this.pendingSoundEvents = [];
    }

    update() {
        const previousPlaySound = global.window.playSound;
        global.window.playSound = (soundId, volume = 1) => {
            this.queueSound(soundId, volume);
        };
        try {
            // 1. CÁLCULO DEL TIEMPO (Delta Time)
            // Calculamos el tiempo transcurrido desde la última actualización (dt).
            // Esto asegura que la velocidad del juego sea la misma independientemente del lag o los FPS.
            const now = Date.now();
            let dt = (now - this.lastTime) / 1000;
            this.lastTime = now;
            dt = Math.min(dt, DT_MAX); // Limitamos el dt máximo para evitar que los objetos atraviesen paredes si hay mucho lag.
            this.simulationTimeMs += dt * 1000;

            // 2. ESTADO DE CUENTA REGRESIVA
            // Si el juego está en la cuenta regresiva inicial (ej. 3, 2, 1...), solo descontamos el tiempo.
            if (this.gameState.countdown > 0) {
                this.gameState.countdown -= dt;
                if (this.gameState.countdown < 0) this.gameState.countdown = 0;
            }
                // 3. BUCLE PRINCIPAL DEL JUEGO
            // Solo ejecutamos las lógicas si el juego no está pausado ni ha terminado.
            else if (!this.gameState.isPaused && !this.gameState.isFinished) {

                // --- Lógica del Saque ---
                // Si estamos en estado de saque, lo desactivamos en cuanto la pelota se aleja del centro (W/2).
                if (this.gameState.serveState.active) {
                    if (Math.abs(this.gameState.ball.x - W / 2) > W * 0.08) this.gameState.serveState.active = false;
                }

                // --- Lógica de Celebración y Fin de Tiempo ---
                if (this.gameState.isCelebrating) {
                    // Si alguien metió gol, descontamos el tiempo de celebración. Al terminar, iniciamos nueva ronda.
                    this.celebrationTimer -= dt;
                    if (this.celebrationTimer <= 0) this.startRound(this.nextScorer);
                } else {
                    // Si se está jugando normalmente, el reloj del partido avanza (hacia atrás).
                    this.gameState.gameTime -= dt;

                    // Si el tiempo del partido se acaba, finalizamos el juego.
                    if (this.gameState.gameTime <= 0) {
                        this.gameState.gameTime = 0;
                        this.gameState.isFinished = true;

                        // Notificamos a los jugadores que el partido terminó y enviamos el estado final.
                        this.io.to(this.roomId).emit('matchEnd', {
                            leftName: this.playerNames.left,
                            rightName: this.playerNames.right
                        });

                        this.sendHUD();

                        // Esperamos 5 segundos antes de borrar la sala en el servidor para que vean sus resultados finales.
                        setTimeout(() => this.destroy(), 5000);
                    }
                }

                // 4. FÍSICAS Y COLISIONES
                // Solo se calculan si el partido sigue activo (incluso durante la celebración para que la pelota ruede).
                if (!this.gameState.isFinished) {

                    // --- Movimiento de Jugadores ---
                    // Leemos los inputs y calculamos el movimiento de los jugadores basándonos en el tiempo (dt).
                    controlPlayer(this.gameState.p1, dt, "KeyA", "KeyD", "KeyW", "Space", this.inputs.p1);
                    controlPlayer(this.gameState.p2, dt, "KeyA", "KeyD", "KeyW", "Space", this.inputs.p2);

                    // Actualizamos la posición en Y (gravedad, saltos) y X (fricción, límites).
                    updatePlayer(this.gameState.p1, dt, W, FLOOR_Y);
                    updatePlayer(this.gameState.p2, dt, W, FLOOR_Y);

                    // Resolvemos la colisión entre los dos jugadores.
                    collidePlayers(this.gameState.p1, this.gameState.p2);

                    // Evitamos que los jugadores atraviesen las porterías.
                    collidePlayerGoals(this.gameState.p1, this.leftGoal, this.rightGoal);
                    collidePlayerGoals(this.gameState.p2, this.leftGoal, this.rightGoal);

                    // --- Físicas de la Pelota ---
                    updateBall(this.gameState.ball, dt, W, FLOOR_Y);

                    // --- Lógica Especial de Colisiones ---
                    // Se usa global.window.currentPlayers probablemente para algún cálculo auxiliar externo.
                    global.window.currentPlayers = [this.gameState.p1, this.gameState.p2];

                    // Comprobamos si los jugadores están espalda con espalda para evitar que la pelota se quede bugeada entre ellos.
                    const playersBackToBack = arePlayersBackToBack(this.gameState.p1, this.gameState.p2);
                    if (playersBackToBack) resolveBackToBackBallSqueeze(this.gameState.ball, this.gameState.p1, this.gameState.p2);

                    // Resolvemos colisiones regulares entre jugadores y la pelota.
                    collidePlayerBall(this.gameState.p1, this.gameState.ball);
                    collidePlayerBall(this.gameState.p2, this.gameState.ball);

                    // Volvemos a chequear atascos de la pelota por si la colisión anterior la empujó hacia un mal lugar.
                    if (playersBackToBack) resolveBackToBackBallSqueeze(this.gameState.ball, this.gameState.p1, this.gameState.p2);
                    else resolveBallSqueezeUp(this.gameState.ball, this.gameState.p1, this.gameState.p2); // Empuja la pelota hacia arriba si es "aplastada" entre jugadores.

                    // Rebotes de la pelota contra las estructuras de las porterías.
                    checkGoalCollisions(this.gameState.ball, this.leftGoal, this.rightGoal);

                    // --- Anti-Aplastamiento en las Paredes ---
                    // Si la pelota choca contra la pared izquierda (< 0)...
                    const crushDist = 50;
                    if (this.gameState.ball.x - this.gameState.ball.r < 0) {
                        const exceso = this.gameState.ball.r - this.gameState.ball.x;
                        this.gameState.ball.x = this.gameState.ball.r; // Forzamos la pelota dentro de la pantalla

                        // Si algún jugador está presionando la pelota contra la pared izquierda, lo empujamos hacia atrás (derecha).
                        if (this.gameState.p2.x > this.gameState.ball.x && (this.gameState.p2.x - this.gameState.ball.x) < crushDist) this.gameState.p2.x += exceso;
                        if (this.gameState.p1.x > this.gameState.ball.x && (this.gameState.p1.x - this.gameState.ball.x) < crushDist) this.gameState.p1.x += exceso;
                    }
                    // Si la pelota choca contra la pared derecha (> W)...
                    if (this.gameState.ball.x + this.gameState.ball.r > W) {
                        const exceso = (this.gameState.ball.x + this.gameState.ball.r) - W;
                        this.gameState.ball.x = W - this.gameState.ball.r; // Forzamos la pelota dentro de la pantalla

                        // Si algún jugador presiona la pelota contra la pared derecha, lo empujamos hacia atrás (izquierda).
                        if (this.gameState.p1.x < this.gameState.ball.x && (this.gameState.ball.x - this.gameState.p1.x) < crushDist) this.gameState.p1.x -= exceso;
                        if (this.gameState.p2.x < this.gameState.ball.x && (this.gameState.ball.x - this.gameState.p2.x) < crushDist) this.gameState.p2.x -= exceso;
                    }

                    // --- Cálculo de Velocidades Reales ---
                    // Calculamos la velocidad "real" basándonos en dónde estaba la entidad el frame anterior y dónde está ahora.
                    // Esto es muy útil para la interpolación visual en el cliente o para cálculos de impactos.
                    this.gameState.p1.realVx = this.gameState.p1.lastX !== undefined ? (this.gameState.p1.x - this.gameState.p1.lastX) / dt : 0;
                    this.gameState.p1.realVy = this.gameState.p1.lastY !== undefined ? (this.gameState.p1.y - this.gameState.p1.lastY) / dt : 0;
                    this.gameState.p2.realVx = this.gameState.p2.lastX !== undefined ? (this.gameState.p2.x - this.gameState.p2.lastX) / dt : 0;
                    this.gameState.p2.realVy = this.gameState.p2.lastY !== undefined ? (this.gameState.p2.y - this.gameState.p2.lastY) / dt : 0;
                    this.gameState.ball.realVx = this.gameState.ball.lastX !== undefined ? (this.gameState.ball.x - this.gameState.ball.lastX) / dt : 0;
                    this.gameState.ball.realVy = this.gameState.ball.lastY !== undefined ? (this.gameState.ball.y - this.gameState.ball.lastY) / dt : 0;

                    // Guardamos las posiciones actuales para el cálculo de realVx/realVy del siguiente frame.
                    this.gameState.p1.lastX = this.gameState.p1.x;
                    this.gameState.p1.lastY = this.gameState.p1.y;
                    this.gameState.p2.lastX = this.gameState.p2.x;
                    this.gameState.p2.lastY = this.gameState.p2.y;
                    this.gameState.ball.lastX = this.gameState.ball.x;
                    this.gameState.ball.lastY = this.gameState.ball.y;

                    // 5. SISTEMA DE PUNTUACIÓN (GOLES)
                    // Solo comprobamos goles si el juego está en curso y no se está ya celebrando un gol anterior.
                    if (!this.isGoalScored && !this.gameState.isCelebrating) {
                        const leftGoalLine = this.leftGoal.x + this.leftGoal.w;
                        const rightGoalLine = this.rightGoal.x;

                        // Comprueba si cruzó la línea izquierda y está a la altura correcta de la portería
                        if (this.gameState.ball.x < leftGoalLine && this.gameState.ball.y > this.leftGoal.y) {
                            this.gameState.score.right++;
                            this.isGoalScored = true;
                            this.gameState.isCelebrating = true;
                            this.celebrationTimer = 2.0; // 2 segundos de celebración
                            this.nextScorer = "right";  // El siguiente en sacar/servir (o indicar quién marcó)
                            this.io.to(this.roomId).emit('matchGoal'); // Avisa al cliente para efectos, sonidos, etc.
                        }
                        // Comprueba si cruzó la línea derecha
                        else if (this.gameState.ball.x > rightGoalLine && this.gameState.ball.y > this.rightGoal.y) {
                            this.gameState.score.left++;
                            this.isGoalScored = true;
                            this.gameState.isCelebrating = true;
                            this.celebrationTimer = 2.0;
                            this.nextScorer = "left";
                            this.io.to(this.roomId).emit('matchGoal');
                        }
                    }
                }
                // 6. SINCRONIZACIÓN DE RED (Formato Binario)
                const buffer = new ArrayBuffer(26);
                const view = new DataView(buffer);
                view.setInt16(0, Math.round(this.gameState.p1.x), true);
                view.setInt16(2, Math.round(this.gameState.p1.y), true);
                view.setInt16(4, Math.round(this.gameState.p2.x), true);
                view.setInt16(6, Math.round(this.gameState.p2.y), true);
                view.setInt16(8, Math.round(this.gameState.ball.x), true);
                view.setInt16(10, Math.round(this.gameState.ball.y), true);
                view.setInt16(12, Math.round(this.gameState.ball.vx), true);
                view.setInt16(14, Math.round(this.gameState.ball.vy), true);
                view.setInt16(16, Math.round((this.gameState.p1.kickAngle || 0) * 100), true);
                view.setInt16(18, Math.round((this.gameState.p2.kickAngle || 0) * 100), true);
                view.setInt16(20, Math.round((this.gameState.ball.angle || 0) * 100), true);
                view.setUint32(22, Math.round(this.simulationTimeMs), true);

                this.io.to(this.roomId).emit('gameSync', buffer);
                this.flushQueuedSounds();
            }
        }
        finally {
            global.window.playSound = previousPlaySound;
        }
    }

    // 2. Crea la función que envía los datos lentos
    sendHUD() {
        if (this.gameState.isFinished) return;

        // Mandamos un JSON muy pequeñito solo con lo visual
        const hudData = {
            t: Math.ceil(this.gameState.gameTime), // Redondeado hacia arriba para que se vea limpio (60, 59...)
            sl: this.gameState.score.left,
            sr: this.gameState.score.right,
            c: this.gameState.countdown > 0 ? Math.ceil(this.gameState.countdown) : 0,
            p: this.gameState.isPaused
        };

        this.io.to(this.roomId).emit('hudSync', hudData);
    }

    destroy() {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        clearInterval(this.loopInterval);
        clearInterval(this.hudInterval);

        // Quitamos SOLO los listeners de esta partida
        this.p1Socket.off('playerInput', this.onP1Input);
        this.p1Socket.off('requestTogglePause', this.onP1TogglePause);
        this.p1Socket.off('pingLatency', this.onP1PingLatency);
        this.p1Socket.off('disconnect', this.onP1Disconnect);

        this.p2Socket.off('playerInput', this.onP2Input);
        this.p2Socket.off('requestTogglePause', this.onP2TogglePause);
        this.p2Socket.off('pingLatency', this.onP2PingLatency);
        this.p2Socket.off('disconnect', this.onP2Disconnect);

        this.p1Socket.leave(this.roomId);
        this.p2Socket.leave(this.roomId);

        if (this.onMatchEndCallback) this.onMatchEndCallback();
    }
}

module.exports = Match;