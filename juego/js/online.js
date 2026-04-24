// online.js - Lógica del multijugador y WebSockets

window.isOnlineMode = false;
let onlineState = null;
let myRole = null; // Saber si somos P1 o P2
let bytesReceivedThisSecond = 0;
window.pingInterval = null;
let localBallTimeout = 0; // Tiempo restante de "posesión local" de la pelota
let lastMeasuredLatency = null;

let stateBuffer = [];
const RENDER_DELAY = 100; // Dibujaremos al enemigo y la pelota 100ms en el pasado

function updatePingUI(latency) {
    const pingEl = document.getElementById('debug-ping');
    if (pingEl) pingEl.textContent = typeof latency === 'number' ? Math.round(latency) : '-';

    const badWifiIcon = document.getElementById('bad-connection-warning');
    if (typeof latency === 'number' && latency > 150) {
        if (badWifiIcon) badWifiIcon.classList.remove('hidden');
    } else {
        if (badWifiIcon) badWifiIcon.classList.add('hidden');
    }
}

function stopNetworkDebugInterval() {
    if (window.pingInterval) {
        clearInterval(window.pingInterval);
        window.pingInterval = null;
    }

    bytesReceivedThisSecond = 0;

    lastMeasuredLatency = null;
    updatePingUI(null);

    const bytesEl = document.getElementById('debug-bytes');
    if (bytesEl) bytesEl.textContent = '0';
}

function startNetworkDebugInterval() {
    stopNetworkDebugInterval();

    window.pingInterval = setInterval(() => {
        if (!window.isOnlineMode || typeof socket === 'undefined') {
            stopNetworkDebugInterval();
            return;
        }

        const sentAt = performance.now();
        socket.timeout(1000).emit('pingLatency', sentAt, (err, echoedAt) => {
            if (err || typeof echoedAt !== 'number') return;
            lastMeasuredLatency = performance.now() - echoedAt;
            updatePingUI(lastMeasuredLatency);
        });

        const bytesEl = document.getElementById('debug-bytes');
        if (bytesEl) bytesEl.textContent = bytesReceivedThisSecond;

        bytesReceivedThisSecond = 0;
    }, 1000);
}

if (typeof socket !== 'undefined') {
    // Escuchamos el estado del juego
    // socket.on('gameState', (state) => {
    //     if (matchFinishedExternally) return;
    //     onlineState = state; // Lo mantenemos para el marcador y el tiempo general
    //
    //     // Le añadimos la marca de tiempo local de cuando llegó el paquete
    //     state.timestamp = performance.now();
    //     stateBuffer.push(state);
    //
    //     // Limpieza de memoria: Solo guardamos los paquetes del último segundo
    //     const unSegundoAtras = performance.now() - 1000;
    //     stateBuffer = stateBuffer.filter(s => s.timestamp >= unSegundoAtras);
    // });

    // Escuchamos el estado físico del juego en formato binario
    socket.on('gameSync', (arrayBuffer) => {
        if (matchFinishedExternally) return;

        // Sumamos el peso real de los bytes que acaban de llegar
        bytesReceivedThisSecond += arrayBuffer.byteLength;

        // Convertimos los bytes crudos de vuelta a números legibles
        const data = new Int16Array(arrayBuffer);

        // Añadimos la estructura completa por defecto
        if (!onlineState) {
            onlineState = {
                p1: {}, p2: {}, ball: {},
                score: {left: 0, right: 0}, // ¡Vital para que no crashee!
                countdown: 3.0,
                gameTime: 60,
                isPaused: false
            };
        }

        // Reconstruimos el estado leyendo el Array en el mismo orden exacto
        onlineState.p1.x = data[0];
        onlineState.p1.y = data[1];

        onlineState.p2.x = data[2];
        onlineState.p2.y = data[3];

        onlineState.ball.x = data[4];
        onlineState.ball.y = data[5];
        onlineState.ball.vx = data[6];
        onlineState.ball.vy = data[7];

        // Dividimos entre 100 para recuperar los decimales de los ángulos
        onlineState.p1.kickAngle = data[8] / 100;
        onlineState.p2.kickAngle = data[9] / 100;
        onlineState.ball.angle = data[10] / 100;

        onlineState.timestamp = performance.now();

        // Clonamos solo las coordenadas físicas para el buffer de interpolación
        stateBuffer.push({
            p1: { x: onlineState.p1.x, y: onlineState.p1.y, kickAngle: onlineState.p1.kickAngle },
            p2: { x: onlineState.p2.x, y: onlineState.p2.y, kickAngle: onlineState.p2.kickAngle },
            ball: {
                x: onlineState.ball.x, y: onlineState.ball.y,
                vx: onlineState.ball.vx, vy: onlineState.ball.vy, angle: onlineState.ball.angle
            },
            timestamp: onlineState.timestamp
        });

        // Limpieza de memoria (1 segundo)
        const unSegundoAtras = performance.now() - 1000;
        stateBuffer = stateBuffer.filter(s => s.timestamp >= unSegundoAtras);
    });

    // Escuchamos el nuevo evento de interfaz
    socket.on('hudSync', (hudData) => {
        if (matchFinishedExternally) return;

        // Calculamos cuánto pesa este JSON al enviarse por la red y lo sumamos
        const pesoJSON = new TextEncoder().encode(JSON.stringify(hudData)).length;
        bytesReceivedThisSecond += pesoJSON;

        // Añadimos la estructura completa por defecto
        if (!onlineState) {
            onlineState = {
                p1: {}, p2: {}, ball: {},
                score: {left: 0, right: 0}, // ¡Vital para que no crashee!
                countdown: 3.0,
                gameTime: 60,
                isPaused: false
            };
        }

        // Actualizamos los datos para que tu onlineLoop los pinte en pantalla
        onlineState.gameTime = hudData.t;
        onlineState.score.left = hudData.sl;
        onlineState.score.right = hudData.sr;
        onlineState.countdown = hudData.c;
        onlineState.isPaused = hudData.p;
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
    bytesReceivedThisSecond = 0;
    startNetworkDebugInterval();
    if (window.Main && window.Main.updateOptionsUI) window.Main.updateOptionsUI();

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
                p1.x = onlineState.p1.x;
                p1.y = onlineState.p1.y;
                p1.vx = onlineState.p1.vx || 0;
                p1.vy = onlineState.p1.vy || 0;
                p2.x = onlineState.p2.x;
                p2.y = onlineState.p2.y;
                p2.vx = onlineState.p2.vx || 0;
                p2.vy = onlineState.p2.vy || 0;
                ball.x = onlineState.ball.x;
                ball.y = onlineState.ball.y;
                ball.vx = onlineState.ball.vx;
                ball.vy = onlineState.ball.vy;
                p1.kickAngle = onlineState.p1.kickAngle;
                p2.kickAngle = onlineState.p2.kickAngle;
                ball.angle = onlineState.ball.angle;
                isFirstStateReceived = true;
            } else {
                // 1. PREDICCIÓN LOCAL (Tú)
                const myLocalPlayer = myRole === 'p1' ? p1 : p2;
                const myOnlineState = myRole === 'p1' ? onlineState.p1 : onlineState.p2;

                // Restamos tiempo a nuestro temporizador de posesión
                if (localBallTimeout > 0) localBallTimeout -= dt;

                // Comprobamos si ESTAMOS TOCANDO la pelota para robarle la posesión al servidor
                const dx = myLocalPlayer.x - ball.x;
                const dy = myLocalPlayer.y - ball.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const hitDistance = (myLocalPlayer.w / 2) + ball.r + 15; // Margen de colisión

                if (dist < hitDistance) {
                    // ¡La tocaste! Eres dueño de la pelota visualmente durante 250ms
                    localBallTimeout = 0.25;
                }

                // Corrección de tu jugador (Reconciliation)
                const desyncX = Math.abs(myLocalPlayer.x - myOnlineState.x);
                const desyncY = Math.abs(myLocalPlayer.y - myOnlineState.y);

                if (desyncX > 40) myLocalPlayer.x = lerp(myLocalPlayer.x, myOnlineState.x, 0.15);
                if (desyncY > 40) myLocalPlayer.y = lerp(myLocalPlayer.y, myOnlineState.y, 0.15);

                // 2. INTERPOLACIÓN (El Enemigo Y la Pelota)
                const enemyPlayer = myRole === 'p1' ? p2 : p1;

                if (stateBuffer.length >= 2) {
                    const renderTime = performance.now() - RENDER_DELAY;
                    let pastState = stateBuffer[0];
                    let futureState = stateBuffer[1];

                    for (let i = 1; i < stateBuffer.length; i++) {
                        if (stateBuffer[i].timestamp > renderTime) {
                            futureState = stateBuffer[i];
                            pastState = stateBuffer[i - 1];
                            break;
                        }
                    }

                    if (pastState.timestamp <= renderTime && futureState.timestamp >= renderTime) {
                        const totalTimeSpan = futureState.timestamp - pastState.timestamp;
                        const timePassed = renderTime - pastState.timestamp;
                        const factor = totalTimeSpan > 0 ? timePassed / totalTimeSpan : 0;

                        const pastEnemy = myRole === 'p1' ? pastState.p2 : pastState.p1;
                        const futureEnemy = myRole === 'p1' ? futureState.p2 : futureState.p1;

                        // Interpolamos al enemigo SIEMPRE
                        enemyPlayer.x = lerp(pastEnemy.x, futureEnemy.x, factor);
                        enemyPlayer.y = lerp(pastEnemy.y, futureEnemy.y, factor);
                        enemyPlayer.kickAngle = lerp(pastEnemy.kickAngle, futureEnemy.kickAngle, factor);

                        // 👇 LA MAGIA DE LA POSESIÓN 👇
                        // Si NO tenemos la posesión (localBallTimeout <= 0), la pelota obedece al pasado (servidor)
                        if (localBallTimeout <= 0) {
                            ball.x = lerp(pastState.ball.x, futureState.ball.x, factor);
                            ball.y = lerp(pastState.ball.y, futureState.ball.y, factor);
                            ball.angle = lerp(pastState.ball.angle, futureState.ball.angle, factor);

                            // Sincronizamos las inercias locales para que coincidan con las del servidor
                            ball.vx = futureState.ball.vx;
                            ball.vy = futureState.ball.vy;
                        }
                        // Si localBallTimeout > 0, ignoramos este lerp.
                        // La pelota se moverá libremente en el "presente" gracias al updateBall de abajo.
                    }
                }
            }
        }

        // SIMULACIÓN LOCAL MEJORADA (Dead Reckoning)
        if (!isOnlineCountdownActive && !gamePaused && !matchFinishedExternally) {
            let myPlayer = myRole === 'p1' ? p1 : p2;

            // 1. CONTROL Y MOVIMIENTO LOCAL (Solo nosotros)
            controlPlayer(myPlayer, dt, "KeyA", "KeyD", "KeyW", "Space", keys);
            updatePlayer(myPlayer, dt, W, FLOOR_Y);
            collidePlayerGoals(myPlayer, leftGoal, rightGoal);

            // ❌ ELIMINADO: updatePlayer(enemyPlayer) - Se mueve solo con el lerp() de arriba.
            // ❌ ELIMINADO: collidePlayers(p1, p2) - Si el enemigo está en el pasado, chocar localmente rompe el juego.
            // ❌ ELIMINADO: collidePlayerGoals(enemyPlayer) - El servidor ya se encarga de que no atraviese la red.

            // 2. FÍSICAS DE LA PELOTA (Predicción local básica)
            updateBall(ball, dt, W, FLOOR_Y);

            // Solo permitimos que tú empujes o golpees la pelota localmente.
            // El toque del enemigo lo recibiremos del servidor.
            collidePlayerBall(myPlayer, ball);

            // Rebotes contra la portería
            checkGoalCollisions(ball, leftGoal, rightGoal);

            // ❌ ELIMINADO: Funciones resolveBackToBackBallSqueeze y resolveBallSqueezeUp.
            // Al no tener la posición exacta y en tiempo real del enemigo en este frame,
            // intentar calcular si la pelota está aplastada entre ambos generará rebotes fantasma.
            // Confiaremos en el cálculo 'autoritativo' del servidor para esos atascos complejos.
        }

        dibujar(gameCtx, W, H, p1, p2, ball, leftGoal, rightGoal);
        animationId = requestAnimationFrame(onlineLoop);
    }
}

/* ==========================================================================
   INTEGRACIÓN DEL MÓDULO ONLINE CON EL MOTOR PRINCIPAL (Monkey Patching)
   ========================================================================== */

// 1. Exponemos la función startOnlineGame al objeto global window.Game.
// De esta manera, el menú principal (main.js) puede arrancar el partido online
// simplemente llamando a Game.startOnlineGame() al pulsar el botón de jugar, sin
// importarle cómo funciona este archivo internamente.
window.Game.startOnlineGame = startOnlineGame;

// 2. Sobrescribimos limpiamente la función de parada (stopBasicGame).
// Guardamos la función original que limpia el canvas y apaga los sonidos en una "caja fuerte".
const originalStop = window.Game.stopBasicGame;

// Redefinimos stopBasicGame para que ahora sea "más inteligente":
window.Game.stopBasicGame = function() {
    // Primero, ejecuta todo lo que ya sabía hacer antes (borrar pantalla, pausar bucle...)
    originalStop();

    // Y después, añade nuestras tareas exclusivas de limpieza del online:
    window.isOnlineMode = false; // Le avisa al input.js que deje de mandar teclas por socket
    stopNetworkDebugInterval();  // Destruye el intervalo del ping para que no consuma memoria en el fondo
};
