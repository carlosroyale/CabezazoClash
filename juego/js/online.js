// online.js - Lógica del multijugador y WebSockets

window.isOnlineMode = false;
let onlineState = null;
let myRole = null; // Saber si somos P1 o P2

if (typeof socket !== 'undefined') {
    // Escuchamos el estado del juego
    socket.on('gameState', (state) => {
        if (matchFinishedExternally) return;
        onlineState = state;
    });

    socket.on('initRole', (role) => {
        myRole = role;
        console.log("El servidor me ha asignado el rol:", myRole);
    });

    socket.on('matchGoal', () => {
        if (!window.isOnlineMode) return;
        window.playSound('sfx-goal', 0.5);
        const scoreboardUI = document.getElementById('scoreboard');
        if(scoreboardUI) scoreboardUI.classList.add('goal-active');
    });

    socket.on('matchReset', () => {
        if (!window.isOnlineMode) return;
        const scoreboardUI = document.getElementById('scoreboard');
        if(scoreboardUI) scoreboardUI.classList.remove('goal-active');
    });

    socket.on('matchEnd', () => {
        if (!window.isOnlineMode) return;
        matchFinishedExternally = true;
        window.playSound('sfx-whistle');
        if (gameTimerEl) gameTimerEl.textContent = "0";
        endGame();
    });

    socket.on('pongLatency', (clientTimestamp) => {
        const latency = Date.now() - clientTimestamp;
        const badWifiIcon = document.getElementById('bad-connection-warning');
        if (latency > 200) {
            if (badWifiIcon) badWifiIcon.classList.remove('hidden');
        } else {
            if (badWifiIcon) badWifiIcon.classList.add('hidden');
        }
    });

    socket.on('playerLeft', () => {
        if (!window.isOnlineMode) return;
        gameRunning = false;
        document.dispatchEvent(new Event('game-paused'));

        // Si el rival se va durante el 3,2,1, ocultamos el número
        const contador = document.getElementById("contador-pausa");
        if (contador) contador.classList.add("hidden");

        document.getElementById("screen-game").classList.remove("active");
        document.getElementById("screen-online-waiting").classList.remove("active");
        document.getElementById("screen-opponent-left").classList.add("active");
        document.getElementById("pause-menu").classList.add("hidden");
    });
}

function lerp(start, end, factor) {
    return start + (end - start) * factor;
}

function startOnlineGame({canvas, ctx: ctxParam, scoreEl: scoreElParam, timerEl: timerElParam}) {
    window.isOnlineMode = true;
    gameRunning = true;
    matchFinishedExternally = false;

    gameCtx = ctxParam;
    gameScoreEl = scoreElParam;
    gameTimerEl = timerElParam;

    const waitingScreen = document.getElementById("screen-online-waiting");
    const gameScreen = document.getElementById("screen-game");

    let isOnlineCountdownActive = false;
    let lastCountdownInt = 0;

    document.getElementById("btn-cancel-online").onclick = () => {
        // 1. Nos desconectamos del servidor para salir de la cola de espera
        if (typeof socket !== 'undefined') socket.disconnect();

        // 2. Apagamos el motor y reseteamos el estado online
        window.Game.stopBasicGame();

        // 3. Volvemos suavemente a la pantalla de modos sin recargar
        if (window.Main && window.Main.showScreen) {
            const screenModeSelect = document.getElementById("screen-mode-select");
            window.Main.showScreen(screenModeSelect);
        }
    };

    socket.off('matchReady');
    socket.on('matchReady', () => {
        waitingScreen.classList.remove("active");
        gameScreen.classList.add("active");

        isOnlineCountdownActive = true;
        lastCountdownInt = 0;

        if (window.Main.isTouchDevice && window.Main.isTouchDevice()) {
            document.getElementById("touch-controls").classList.remove("hidden");
        }

        if (window.Main.stopAllSounds) window.Main.stopAllSounds();
        if (window.Main.playMatchAmbient) window.Main.playMatchAmbient();

        lastTime = performance.now();
        requestAnimationFrame(onlineLoop);
    });

    p1 = makePlayer(180, FLOOR_Y - 90, "P1", true);
    p2 = makePlayer(W - 180, FLOOR_Y - 90, "P2", false);
    ball = {r: 18, x: W / 2, y: FLOOR_Y - 200, vx: 0, vy: 0, angle: 0};

    let isFirstStateReceived = false;
    lastTime = performance.now();

    socket.emit('joinMatch');

    function onlineLoop(time) {
        if (!gameRunning || !window.isOnlineMode) return;

        let dt = (time - lastTime) / 1000;
        lastTime = time;
        dt = Math.min(dt, DT_MAX);

        if (onlineState) {
            const pauseMenu = document.getElementById("pause-menu");
            const screenOptions = document.getElementById("screen-options");
            const screenHowToPlay = document.getElementById("screen-how-to-play");

            const isSubMenuOpen = (screenOptions && screenOptions.classList.contains("active")) ||
                (screenHowToPlay && screenHowToPlay.classList.contains("active"));

            if (onlineState.isPaused) {
                if (pauseMenu && pauseMenu.classList.contains("hidden") && !isSubMenuOpen) {
                    gamePaused = true;
                    pauseMenu.classList.remove("hidden");
                    document.getElementById('game-wrap').classList.add('is-paused');
                    if (window.Main && window.Main.stopAllSounds) window.Main.stopAllSounds();
                }
            } else {
                if (gamePaused || (pauseMenu && !pauseMenu.classList.contains("hidden")) || isSubMenuOpen) {
                    gamePaused = false;
                    if (screenOptions && screenOptions.classList.contains("active")) {
                        const btnCerrarOpt = document.getElementById("btn-entendido");
                        if (btnCerrarOpt) btnCerrarOpt.click();
                    }
                    if (screenHowToPlay && screenHowToPlay.classList.contains("active")) {
                        const btnCerrarHelp = document.getElementById("btn-close-how-to-play");
                        if (btnCerrarHelp) btnCerrarHelp.click();
                    }
                    if (pauseMenu) pauseMenu.classList.add("hidden");
                    document.getElementById('game-wrap').classList.remove('is-paused');
                    if (window.Main && window.Main.playMatchAmbient) window.Main.playMatchAmbient();
                }
            }

            const contador = document.getElementById("contador-pausa");
            if (onlineState.countdown > 0) {
                isOnlineCountdownActive = true;
                contador.classList.remove("hidden");
                let currentInt = Math.ceil(onlineState.countdown);
                contador.textContent = currentInt;

                if (currentInt !== lastCountdownInt && currentInt > 0) {
                    window.playSound('sfx-jump', 0.3);
                    lastCountdownInt = currentInt;
                }
            } else {
                if (isOnlineCountdownActive && !onlineState.isPaused) {
                    isOnlineCountdownActive = false;
                    contador.classList.add("hidden");
                    window.playSound('sfx-whistle');
                    lastCountdownInt = 0;
                }
            }

            score.left = onlineState.score.left;
            score.right = onlineState.score.right;
            gameTime = onlineState.gameTime;

            updateScore();
            updateTimer();

            if (!isFirstStateReceived || isOnlineCountdownActive || gamePaused) {
                p1.x = onlineState.p1.x; p1.y = onlineState.p1.y; p1.vx = onlineState.p1.vx; p1.vy = onlineState.p1.vy;
                p2.x = onlineState.p2.x; p2.y = onlineState.p2.y; p2.vx = onlineState.p2.vx; p2.vy = onlineState.p2.vy;
                ball.x = onlineState.ball.x; ball.y = onlineState.ball.y; ball.vx = onlineState.ball.vx; ball.vy = onlineState.ball.vy;
                p1.kickAngle = onlineState.p1.kickAngle; p2.kickAngle = onlineState.p2.kickAngle; ball.angle = onlineState.ball.angle;
                isFirstStateReceived = true;
            }
            else {
                // --- PREDICCIÓN Y EXTRAPOLACIÓN ---
                const ENEMY_CORRECTION = 0.12; // Más suave para evitar tirones
                const LOCAL_CORRECTION = 0.05;

                let myPlayer = myRole === 'p1' ? p1 : p2;
                let enemyPlayer = myRole === 'p1' ? p2 : p1;

                const c1 = (myRole === 'p1') ? LOCAL_CORRECTION : ENEMY_CORRECTION;
                const c2 = (myRole === 'p2') ? LOCAL_CORRECTION : ENEMY_CORRECTION;

                p1.x = lerp(p1.x, onlineState.p1.x, c1);
                p1.y = lerp(p1.y, onlineState.p1.y, c1);
                p1.vx = lerp(p1.vx, onlineState.p1.vx, c1);
                p1.vy = lerp(p1.vy, onlineState.p1.vy, c1);
                p1.kickAngle = lerp(p1.kickAngle, onlineState.p1.kickAngle, c1);

                p2.x = lerp(p2.x, onlineState.p2.x, c2);
                p2.y = lerp(p2.y, onlineState.p2.y, c2);
                p2.vx = lerp(p2.vx, onlineState.p2.vx, c2);
                p2.vy = lerp(p2.vy, onlineState.p2.vy, c2);
                p2.kickAngle = lerp(p2.kickAngle, onlineState.p2.kickAngle, c2);

                // --- LERP DINÁMICO SUAVIZADO ---
                let distToMe = Math.hypot(myPlayer.x - ball.x, myPlayer.y - ball.y);
                let distToEnemy = Math.hypot(enemyPlayer.x - ball.x, enemyPlayer.y - ball.y);

                let ballCorrection = 0.1; // Base más suave
                if (distToMe < distToEnemy && distToMe < 180) {
                    ballCorrection = 0.03; // Contigo es casi 100% local (fluidez total)
                } else if (distToEnemy < distToMe && distToEnemy < 180) {
                    ballCorrection = 0.20; // Con él obedece al servidor, pero sin ser brusco
                }

                ball.x = lerp(ball.x, onlineState.ball.x, ballCorrection);
                ball.y = lerp(ball.y, onlineState.ball.y, ballCorrection);
                ball.vx = lerp(ball.vx, onlineState.ball.vx, ballCorrection);
                ball.vy = lerp(ball.vy, onlineState.ball.vy, ballCorrection);
                ball.angle = lerp(ball.angle, onlineState.ball.angle, ballCorrection);
            }

            p1.isRightFacing = onlineState.p1.isRightFacing;
            p2.isRightFacing = onlineState.p2.isRightFacing;
        }

        // SIMULACIÓN LOCAL MEJORADA (Dead Reckoning)
        if (!isOnlineCountdownActive && !gamePaused && !matchFinishedExternally) {
            let myPlayer = myRole === 'p1' ? p1 : p2;
            let enemyPlayer = myRole === 'p1' ? p2 : p1;

            // 1. Control local (Solo nosotros)
            controlPlayer(myPlayer, dt, "KeyA", "KeyD", "KeyW", "Space", keys);

            // 2. FÍSICAS CONTINUAS PARA AMBOS
            updatePlayer(myPlayer, dt, W, FLOOR_Y);

            // ¡Vuelve el update para el enemigo! Al no tener controlPlayer,
            // se deslizará suavemente usando la última velocidad (vx/vy) que mandó el servidor.
            updatePlayer(enemyPlayer, dt, W, FLOOR_Y);

            // Permitimos que nuestros cuerpos choquen entre sí
            collidePlayers(p1, p2);

            // 3. Físicas de la pelota
            updateBall(ball, dt, W, FLOOR_Y);

            window.currentPlayers = [p1, p2];
            const playersBackToBack = arePlayersBackToBack(p1, p2);
            if (playersBackToBack) resolveBackToBackBallSqueeze(ball, p1, p2);

            // 4. ANULACIÓN SENSORIAL
            // Solo calculamos el choque entre NOSOTROS y la pelota.
            // Borramos por completo el collidePlayerBall(enemyPlayer, ball).
            // Si el enemigo la toca, será el Lerp Dinámico quien mueva la pelota visualmente.
            collidePlayerBall(myPlayer, ball);

            if (playersBackToBack) resolveBackToBackBallSqueeze(ball, p1, p2);
            else resolveBallSqueezeUp(ball, p1, p2);

            checkGoalCollisions(ball, leftGoal, rightGoal);
        }

        dibujar(gameCtx, W, H, p1, p2, ball, leftGoal, rightGoal);
        animationId = requestAnimationFrame(onlineLoop);
    }

    window.pingInterval = setInterval(() => {
        if (window.isOnlineMode && typeof socket !== 'undefined') socket.emit('pingLatency', Date.now());
        else clearInterval(window.pingInterval);
    }, 1000);
}

// Vinculamos startOnlineGame al objeto global para que main.js pueda llamarlo
window.Game.startOnlineGame = startOnlineGame;

// Sobrescribimos limpiamente stopBasicGame
const originalStop = window.Game.stopBasicGame;
window.Game.stopBasicGame = function() {
    originalStop();
    window.isOnlineMode = false;
};