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

        // 1. Unimos a los dos jugadores a una "sala privada"
        this.p1Socket.join(this.roomId);
        this.p2Socket.join(this.roomId);

        this.leftGoal = {x: 0, y: FLOOR_Y - GOAL_H, w: GOAL_W, h: GOAL_H};
        this.rightGoal = {x: W - GOAL_W, y: FLOOR_Y - GOAL_H, w: GOAL_W, h: GOAL_H};

        // 2. Estado ÚNICO de esta partida
        this.gameState = {
            p1: makePlayer(180, FLOOR_Y - 90, "P1", true),
            p2: makePlayer(W - 180, FLOOR_Y - 90, "P2", false),
            ball: { r: 18, x: W / 2, y: FLOOR_Y - 200, vx: 0, vy: 0, angle: 0 },
            score: { left: 0, right: 0 },
            gameTime: 60,
            isPaused: false,
            isFinished: false,
            countdown: 3.0,
            serveState: { server: null, active: true },
            isCelebrating: false
        };

        this.isGoalScored = false;
        this.celebrationTimer = 0;
        this.nextScorer = null;
        this.inputs = { p1: new Set(), p2: new Set() };

        this.loopInterval = null;
        this.lastTime = Date.now();

        // 3. Configurar listeners de red para ESTOS dos jugadores
        this.setupEvents();
        this.startRound();

        // 4. Avisarles de quién es quién y que ya pueden jugar
        this.p1Socket.emit('initRole', 'p1');
        this.p2Socket.emit('initRole', 'p2');
        this.io.to(this.roomId).emit('matchReady');

        // 5. Arrancar el motor de físicas de ESTA partida
        this.startLoop();
    }

    setupEvents() {
        // --- JUGADOR 1 ---
        this.p1Socket.on('playerInput', (data) => {
            if (data.isDown) this.inputs.p1.add(data.key);
            else this.inputs.p1.delete(data.key);
        });
        this.p1Socket.on('requestTogglePause', () => this.togglePause());
        this.p1Socket.on('pingLatency', (timestamp) => this.p1Socket.emit('pongLatency', timestamp));
        this.p1Socket.on('disconnect', () => this.handleDisconnect('p1'));

        // --- JUGADOR 2 ---
        this.p2Socket.on('playerInput', (data) => {
            if (data.isDown) this.inputs.p2.add(data.key);
            else this.inputs.p2.delete(data.key);
        });
        this.p2Socket.on('requestTogglePause', () => this.togglePause());
        this.p2Socket.on('pingLatency', (timestamp) => this.p2Socket.emit('pongLatency', timestamp));
        this.p2Socket.on('disconnect', () => this.handleDisconnect('p2'));
    }

    togglePause() {
        if (!this.gameState.isFinished && this.gameState.countdown <= 0) {
            this.gameState.isPaused = !this.gameState.isPaused;
            if (!this.gameState.isPaused) this.gameState.countdown = 3.0;

            // Enviamos el estado solo a los que están en la sala
            this.io.to(this.roomId).emit('gameState', this.gameState);
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
    }

    startLoop() {
        this.loopInterval = setInterval(() => {
            this.update();
        }, 1000 / 60);
    }

    update() {
        const now = Date.now();
        let dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        dt = Math.min(dt, DT_MAX);

        if (this.gameState.countdown > 0) {
            this.gameState.countdown -= dt;
            if (this.gameState.countdown < 0) this.gameState.countdown = 0;
        }
        else if (!this.gameState.isPaused && !this.gameState.isFinished) {

            if (this.gameState.serveState.active) {
                if (Math.abs(this.gameState.ball.x - W / 2) > W * 0.08) this.gameState.serveState.active = false;
            }

            if (this.gameState.isCelebrating) {
                this.celebrationTimer -= dt;
                if (this.celebrationTimer <= 0) this.startRound(this.nextScorer);
            } else {
                this.gameState.gameTime -= dt;
                if (this.gameState.gameTime <= 0) {
                    this.gameState.gameTime = 0;
                    this.gameState.isFinished = true;
                    this.io.to(this.roomId).emit('matchEnd');
                    this.io.to(this.roomId).emit('gameState', this.gameState);

                    // Esperamos 5 segundos antes de borrar la sala para que vean sus resultados
                    setTimeout(() => this.destroy(), 5000);
                }
            }

            if (!this.gameState.isFinished) {
                // Pasamos THIS.gameState a las físicas (no variables globales)
                controlPlayer(this.gameState.p1, dt, "KeyA", "KeyD", "KeyW", "Space", this.inputs.p1);
                controlPlayer(this.gameState.p2, dt, "KeyA", "KeyD", "KeyW", "Space", this.inputs.p2);

                updatePlayer(this.gameState.p1, dt, W, FLOOR_Y);
                updatePlayer(this.gameState.p2, dt, W, FLOOR_Y);
                collidePlayers(this.gameState.p1, this.gameState.p2);

                collidePlayerGoals(this.gameState.p1, this.leftGoal, this.rightGoal);
                collidePlayerGoals(this.gameState.p2, this.leftGoal, this.rightGoal);

                updateBall(this.gameState.ball, dt, W, FLOOR_Y);

                global.window.currentPlayers = [this.gameState.p1, this.gameState.p2];
                const playersBackToBack = arePlayersBackToBack(this.gameState.p1, this.gameState.p2);
                if (playersBackToBack) resolveBackToBackBallSqueeze(this.gameState.ball, this.gameState.p1, this.gameState.p2);
                collidePlayerBall(this.gameState.p1, this.gameState.ball);
                collidePlayerBall(this.gameState.p2, this.gameState.ball);
                if (playersBackToBack) resolveBackToBackBallSqueeze(this.gameState.ball, this.gameState.p1, this.gameState.p2);
                else resolveBallSqueezeUp(this.gameState.ball, this.gameState.p1, this.gameState.p2);

                checkGoalCollisions(this.gameState.ball, this.leftGoal, this.rightGoal);

                const crushDist = 50;
                if (this.gameState.ball.x - this.gameState.ball.r < 0) {
                    const exceso = this.gameState.ball.r - this.gameState.ball.x;
                    this.gameState.ball.x = this.gameState.ball.r;
                    if (this.gameState.p2.x > this.gameState.ball.x && (this.gameState.p2.x - this.gameState.ball.x) < crushDist) this.gameState.p2.x += exceso;
                    if (this.gameState.p1.x > this.gameState.ball.x && (this.gameState.p1.x - this.gameState.ball.x) < crushDist) this.gameState.p1.x += exceso;
                }
                if (this.gameState.ball.x + this.gameState.ball.r > W) {
                    const exceso = (this.gameState.ball.x + this.gameState.ball.r) - W;
                    this.gameState.ball.x = W - this.gameState.ball.r;
                    if (this.gameState.p1.x < this.gameState.ball.x && (this.gameState.ball.x - this.gameState.p1.x) < crushDist) this.gameState.p1.x -= exceso;
                    if (this.gameState.p2.x < this.gameState.ball.x && (this.gameState.ball.x - this.gameState.p2.x) < crushDist) this.gameState.p2.x -= exceso;
                }

                this.gameState.p1.realVx = this.gameState.p1.lastX !== undefined ? (this.gameState.p1.x - this.gameState.p1.lastX) / dt : 0;
                this.gameState.p1.realVy = this.gameState.p1.lastY !== undefined ? (this.gameState.p1.y - this.gameState.p1.lastY) / dt : 0;
                this.gameState.p2.realVx = this.gameState.p2.lastX !== undefined ? (this.gameState.p2.x - this.gameState.p2.lastX) / dt : 0;
                this.gameState.p2.realVy = this.gameState.p2.lastY !== undefined ? (this.gameState.p2.y - this.gameState.p2.lastY) / dt : 0;
                this.gameState.ball.realVx = this.gameState.ball.lastX !== undefined ? (this.gameState.ball.x - this.gameState.ball.lastX) / dt : 0;
                this.gameState.ball.realVy = this.gameState.ball.lastY !== undefined ? (this.gameState.ball.y - this.gameState.ball.lastY) / dt : 0;

                this.gameState.p1.lastX = this.gameState.p1.x; this.gameState.p1.lastY = this.gameState.p1.y;
                this.gameState.p2.lastX = this.gameState.p2.x; this.gameState.p2.lastY = this.gameState.p2.y;
                this.gameState.ball.lastX = this.gameState.ball.x; this.gameState.ball.lastY = this.gameState.ball.y;

                if (!this.isGoalScored && !this.gameState.isCelebrating) {
                    const leftGoalLine = this.leftGoal.x + this.leftGoal.w;
                    const rightGoalLine = this.rightGoal.x;

                    if (this.gameState.ball.x < leftGoalLine && this.gameState.ball.y > this.leftGoal.y) {
                        this.gameState.score.right++;
                        this.isGoalScored = true;
                        this.gameState.isCelebrating = true;
                        this.celebrationTimer = 2.0;
                        this.nextScorer = "right";
                        this.io.to(this.roomId).emit('matchGoal');
                    }
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
        }

        // Enviamos la actualización solo a los que están en esta partida
        this.io.to(this.roomId).emit('gameState', this.gameState);
    }

    destroy() {
        // Matamos el bucle
        clearInterval(this.loopInterval);

        // Quitamos los escuchadores para que no consuman RAM
        this.p1Socket.removeAllListeners('playerInput');
        this.p1Socket.removeAllListeners('requestTogglePause');
        this.p1Socket.removeAllListeners('pingLatency');
        this.p1Socket.removeAllListeners('disconnect');
        this.p2Socket.removeAllListeners('playerInput');
        this.p2Socket.removeAllListeners('requestTogglePause');
        this.p2Socket.removeAllListeners('pingLatency');
        this.p2Socket.removeAllListeners('disconnect');

        // Los echamos de la sala
        this.p1Socket.leave(this.roomId);
        this.p2Socket.leave(this.roomId);

        // Avisamos a server.js para que borre el registro de la partida
        if (this.onMatchEndCallback) this.onMatchEndCallback();
    }
}

module.exports = Match;