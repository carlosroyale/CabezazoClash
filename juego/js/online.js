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
        if (latency > 120) {
            if (badWifiIcon) badWifiIcon.classList.remove('hidden');
        } else {
            if (badWifiIcon) badWifiIcon.classList.add('hidden');
        }
    });

    socket.on('playerLeft', () => {
        if (!window.isOnlineMode) return;
        gameRunning = false;
        document.dispatchEvent(new Event('game-paused'));

        if (window.onlineCountdownInterval) {
            clearInterval(window.onlineCountdownInterval);
            document.getElementById("contador-pausa").classList.add("hidden");
        }

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
        if (typeof socket !== 'undefined') socket.disconnect();
        window.Game.stopBasicGame();
        waitingScreen.classList.remove("active");
        if(window.Main && window.Main.showScreen) window.Main.showScreen(document.getElementById("screen-start"));
        window.location.reload();
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
                const CORRECTION = 0.15;
                p1.x = lerp(p1.x, onlineState.p1.x, CORRECTION);
                p1.y = lerp(p1.y, onlineState.p1.y, CORRECTION);
                p2.x = lerp(p2.x, onlineState.p2.x, CORRECTION);
                p2.y = lerp(p2.y, onlineState.p2.y, CORRECTION);
                ball.x = lerp(ball.x, onlineState.ball.x, CORRECTION);
                ball.y = lerp(ball.y, onlineState.ball.y, CORRECTION);

                p1.vx = lerp(p1.vx, onlineState.p1.vx, CORRECTION);
                p1.vy = lerp(p1.vy, onlineState.p1.vy, CORRECTION);
                p2.vx = lerp(p2.vx, onlineState.p2.vx, CORRECTION);
                p2.vy = lerp(p2.vy, onlineState.p2.vy, CORRECTION);
                ball.vx = lerp(ball.vx, onlineState.ball.vx, CORRECTION);
                ball.vy = lerp(ball.vy, onlineState.ball.vy, CORRECTION);

                p1.kickAngle = lerp(p1.kickAngle, onlineState.p1.kickAngle, CORRECTION);
                p2.kickAngle = lerp(p2.kickAngle, onlineState.p2.kickAngle, CORRECTION);
                ball.angle = lerp(ball.angle, onlineState.ball.angle, CORRECTION);
            }

            p1.isRightFacing = onlineState.p1.isRightFacing;
            p2.isRightFacing = onlineState.p2.isRightFacing;
        }

        if (!isOnlineCountdownActive && !gamePaused && !matchFinishedExternally) {
            if (myRole === 'p1') controlPlayer(p1, dt, "KeyA", "KeyD", "KeyW", "Space", keys);
            else if (myRole === 'p2') controlPlayer(p2, dt, "KeyA", "KeyD", "KeyW", "Space", keys);

            updatePlayer(p1, dt, W, FLOOR_Y);
            updatePlayer(p2, dt, W, FLOOR_Y);
            collidePlayers(p1, p2);
            updateBall(ball, dt, W, FLOOR_Y);

            window.currentPlayers = [p1, p2];
            const playersBackToBack = arePlayersBackToBack(p1, p2);
            if (playersBackToBack) resolveBackToBackBallSqueeze(ball, p1, p2);
            collidePlayerBall(p1, ball);
            collidePlayerBall(p2, ball);
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