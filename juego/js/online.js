// online.js - Lógica del multijugador y WebSockets

window.isOnlineMode = false;
let onlineState = null;
let myRole = null; // Saber si somos J1 o J2
let bytesReceivedThisSecond = 0;
window.pingInterval = null;
let lastMeasuredLatency = null;
let latestServerSimTime = 0;
const DEFAULT_SCOREBOARD_LABELS = { left: 'J1', right: 'J2' };
const DEFAULT_ONLINE_PAUSE_AVAILABILITY = { left: true, right: true };
const pointsFormatter = new Intl.NumberFormat('es-ES');

let stateBuffer = [];
const RENDER_DELAY = 80; // Dibujaremos a ambos jugadores y la pelota 80ms en el pasado
const DEFAULT_PRESENTATION_NAMES = { left: 'Jugador 1', right: 'Jugador 2' };

function parseUserId(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function resetOnlineSessionState() {
    onlineState = null;
    myRole = null;
    stateBuffer = [];
    latestServerSimTime = 0;
    bytesReceivedThisSecond = 0;
    if (window.Main && window.Main.hideVersusScreen) window.Main.hideVersusScreen();
    updateScoreboardLabels();
    updateScoreboardPoints();
    updatePauseAvailabilityUI();
}

function updateScoreboardLabels(labels = DEFAULT_SCOREBOARD_LABELS) {
    const leftEl = document.getElementById('team-left-name');
    const rightEl = document.getElementById('team-right-name');
    if (leftEl) leftEl.textContent = labels.left || DEFAULT_SCOREBOARD_LABELS.left;
    if (rightEl) rightEl.textContent = labels.right || DEFAULT_SCOREBOARD_LABELS.right;
}

function normalizePointsLabel(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return pointsFormatter.format(value);
    }
    if (typeof value !== 'string') return '';
    return value.replace(/\s*PTS$/i, '').trim();
}

function updateScoreboardPoints(points = {}) {
    const scoreboardEl = document.getElementById('scoreboard');
    const scoreboardWrapEl = scoreboardEl ? scoreboardEl.parentElement : null;
    const leftEl = document.getElementById('team-left-points-value');
    const rightEl = document.getElementById('team-right-points-value');
    const leftText = normalizePointsLabel(points.left);
    const rightText = normalizePointsLabel(points.right);
    const hasAnyPoints = Boolean(leftText || rightText);

    if (leftEl) leftEl.textContent = leftText || '0';
    if (rightEl) rightEl.textContent = rightText || '0';
    if (scoreboardEl) scoreboardEl.classList.toggle('is-online', hasAnyPoints);
    if (scoreboardWrapEl) scoreboardWrapEl.classList.toggle('is-online', hasAnyPoints);
}

function updatePauseAvailabilityUI(pauseAvailability = DEFAULT_ONLINE_PAUSE_AVAILABILITY) {
    const leftPointsEl = document.getElementById('team-left-points');
    const rightPointsEl = document.getElementById('team-right-points');

    const leftAvailable = pauseAvailability.left !== false;
    const rightAvailable = pauseAvailability.right !== false;

    // Buscamos la CAJA entera de la pausa (.sb-pause-icon) y la ocultamos si hace falta
    if (leftPointsEl) {
        const iconBoxLeft = leftPointsEl.querySelector('.sb-pause-icon');
        if (iconBoxLeft) iconBoxLeft.classList.toggle('hidden', !leftAvailable);
    }

    if (rightPointsEl) {
        const iconBoxRight = rightPointsEl.querySelector('.sb-pause-icon');
        if (iconBoxRight) iconBoxRight.classList.toggle('hidden', !rightAvailable);
    }
}

function hasOnlinePhysicsState(state) {
    return !!state &&
        Number.isFinite(state.p1?.x) &&
        Number.isFinite(state.p1?.y) &&
        Number.isFinite(state.p2?.x) &&
        Number.isFinite(state.p2?.y) &&
        Number.isFinite(state.ball?.x) &&
        Number.isFinite(state.ball?.y);
}

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
    latestServerSimTime = 0;
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

// Exponemos la función al entorno global (window) para que el HTML pueda llamarla
window.configurarEventosSocket = function() {
    if (typeof socket === 'undefined') return;

    // Escuchamos el estado físico del juego en formato binario
    socket.on('gameSync', (arrayBuffer) => {
        if (matchFinishedExternally) return;

        // Sumamos el peso real de los bytes que acaban de llegar
        bytesReceivedThisSecond += arrayBuffer.byteLength;

        // Convertimos los bytes crudos de vuelta a números legibles
        const view = new DataView(arrayBuffer);

        // Añadimos la estructura completa por defecto
        if (!onlineState) {
            onlineState = {
                p1: {}, p2: {}, ball: {},
                score: {left: 0, right: 0}, // ¡Vital para que no crashee!
                countdown: 3.0,
                gameTime: 60,
                isPaused: false,
                pauseAvailability: { ...DEFAULT_ONLINE_PAUSE_AVAILABILITY }
            };
        }

        // Reconstruimos el estado leyendo el Array en el mismo orden exacto
        onlineState.p1.x = view.getInt16(0, true);
        onlineState.p1.y = view.getInt16(2, true);

        onlineState.p2.x = view.getInt16(4, true);
        onlineState.p2.y = view.getInt16(6, true);

        onlineState.ball.x = view.getInt16(8, true);
        onlineState.ball.y = view.getInt16(10, true);
        onlineState.ball.vx = view.getInt16(12, true);
        onlineState.ball.vy = view.getInt16(14, true);

        // Dividimos entre 100 para recuperar los decimales de los ángulos
        onlineState.p1.kickAngle = view.getInt16(16, true) / 100;
        onlineState.p2.kickAngle = view.getInt16(18, true) / 100;
        onlineState.ball.angle = view.getInt16(20, true) / 100;
        onlineState.timestamp = view.getUint32(22, true);
        latestServerSimTime = onlineState.timestamp;

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

        // Limpieza de memoria basada en tiempo de simulación del servidor (1 segundo)
        const unSegundoAtras = latestServerSimTime - 1000;
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
                isPaused: false,
                pauseTimeRemaining: 0,
                resumeRequests: { p1: false, p2: false },
                pauseAvailability: { ...DEFAULT_ONLINE_PAUSE_AVAILABILITY }
            };
        }

        // Actualizamos los datos para que tu onlineLoop los pinte en pantalla
        onlineState.gameTime = hudData.t;
        onlineState.pauseTimeRemaining = hudData.pt;
        onlineState.score.left = hudData.sl;
        onlineState.score.right = hudData.sr;
        onlineState.countdown = hudData.c;
        onlineState.isPaused = hudData.p;
        onlineState.resumeRequests = { p1: hudData.r1, p2: hudData.r2 };
        onlineState.pauseAvailability.left = hudData.pl !== false;
        onlineState.pauseAvailability.right = hudData.pr !== false;
        updatePauseAvailabilityUI(onlineState.pauseAvailability);
    });

    socket.on('soundFx', (soundEvents) => {
        if (!window.isOnlineMode || matchFinishedExternally || !Array.isArray(soundEvents)) return;

        const payloadSize = new TextEncoder().encode(JSON.stringify(soundEvents)).length;
        bytesReceivedThisSecond += payloadSize;

        soundEvents.forEach((soundEvent) => {
            if (!soundEvent || typeof soundEvent.id !== 'string') return;
            window.playSound(soundEvent.id, typeof soundEvent.v === 'number' ? soundEvent.v : 1);
        });
    });

    socket.on('initRole', (role) => {
        myRole = role;
        updatePauseAvailabilityUI(onlineState?.pauseAvailability || DEFAULT_ONLINE_PAUSE_AVAILABILITY);
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

    socket.on('matchEnd', matchData => {
        if (!window.isOnlineMode) return;
        matchFinishedExternally = true;
        if (window.Main && window.Main.hideVersusScreen) window.Main.hideVersusScreen();
        window.playSound('sfx-whistle');
        if (gameTimerEl) gameTimerEl.textContent = "0";
        endGame(matchData.leftName || DEFAULT_SCOREBOARD_LABELS.left,
            matchData.rightName || DEFAULT_SCOREBOARD_LABELS.right);

        // Mientras el jugador mira la pantalla de resultados,
        // recargamos sus puntos en segundo plano.
        fetch('../funciones_backend.php?accion=obtener_puntos')
            .then(res => res.json())
            .then(datos => {
                if (datos.puntos !== undefined) {
                    window.misPuntos = datos.puntos; // Lista y fresca para el siguiente partido
                }
            })
            .catch(err => console.warn("Error recargando puntos al final del partido:", err));
    });

    socket.on('playerLeft', () => {
        if (!window.isOnlineMode) return;
        gameRunning = false;
        document.dispatchEvent(new Event('game-paused'));
        if (window.Main && window.Main.hideVersusScreen) window.Main.hideVersusScreen();

        // Si el rival se va durante el 3,2,1, ocultamos el número
        const contador = document.getElementById("contador-pausa");
        if (contador) contador.classList.add("hidden");

        document.getElementById("screen-game").classList.remove("active");
        document.getElementById("screen-online-waiting").classList.remove("active");
        document.getElementById("screen-opponent-left").classList.add("active");
        document.getElementById("pause-menu").classList.add("hidden");
    });
};

function lerp(start, end, factor) {
    return start + (end - start) * factor;
}

function startOnlineGame({canvas, ctx: ctxParam, scoreEl: scoreElParam, timerEl: timerElParam}) {
    window.isOnlineMode = true;
    gameRunning = true;
    matchFinishedExternally = false;
    resetOnlineSessionState();
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
        if (window.Main && window.Main.hideVersusScreen) window.Main.hideVersusScreen();

        // 3. Volvemos suavemente a la pantalla de modos sin recargar
        if (window.Main && window.Main.showScreen) {
            const screenModeSelect = document.getElementById("screen-mode-select");
            window.Main.showScreen(screenModeSelect);
        }
    };

    socket.off('matchReady');
    socket.on('matchReady', matchData => {
        waitingScreen.classList.remove("active");
        gameScreen.classList.add("active");
        updateScoreboardLabels({
            left: matchData.leftLabel || DEFAULT_SCOREBOARD_LABELS.left,
            right: matchData.rightLabel || DEFAULT_SCOREBOARD_LABELS.right
        });
        updateScoreboardPoints({
            left: matchData.leftPoints,
            right: matchData.rightPoints
        });
        updatePauseAvailabilityUI({
            left: matchData.leftPauseAvailable !== false,
            right: matchData.rightPauseAvailable !== false
        });

        isOnlineCountdownActive = true;
        lastCountdownInt = 0;

        if (window.Main.isTouchDevice && window.Main.isTouchDevice()) {
            document.getElementById("touch-controls").classList.remove("hidden");
        }

        if (window.Main.stopAllSounds) window.Main.stopAllSounds();

        const startOnlineLoop = () => {
            if (window.Main && window.Main.playMatchAmbient) window.Main.playMatchAmbient();
            lastTime = performance.now();
            requestAnimationFrame(onlineLoop);
        };

        const playOnlineVersus = () => {
            if (window.Main && window.Main.playVersusIntro) {
                window.Main.playVersusIntro({
                    leftName: matchData.leftName || DEFAULT_PRESENTATION_NAMES.left,
                    rightName: matchData.rightName || DEFAULT_PRESENTATION_NAMES.right,
                    leftLabel: matchData.leftPoints,
                    rightLabel: matchData.rightPoints,
                    duration: 2000,
                    onComplete: startOnlineLoop
                });
            } else {
                startOnlineLoop();
            }
        };

        playOnlineVersus();
    });

    p1 = makePlayer(180, FLOOR_Y - 90, "J1", true);
    p2 = makePlayer(W - 180, FLOOR_Y - 90, "J2", false);
    ball = {r: 18, x: W / 2, y: FLOOR_Y - 200, vx: 0, vy: 0, angle: 0};
    latestServerSimTime = 0;

    let isFirstStateReceived = false;
    lastTime = performance.now();

    // Entramos a la sala instantáneamente enviando nuestros puntos actuales
    socket.emit('joinMatch', window.misPuntos);

    function onlineLoop(time) {
        if (!gameRunning || !window.isOnlineMode) return;

        let dt = (time - lastTime) / 1000;
        lastTime = time;
        dt = Math.min(dt, DT_MAX);

        if (onlineState) {
            const pauseMenu = document.getElementById("pause-menu");
            const screenOptions = document.getElementById("screen-options");
            const screenHowToPlay = document.getElementById("screen-how-to-play");
            const hasPhysicsState = hasOnlinePhysicsState(onlineState);

            const isSubMenuOpen = (screenOptions && screenOptions.classList.contains("active")) ||
                (screenHowToPlay && screenHowToPlay.classList.contains("active"));

            if (onlineState.isPaused) {
                if (pauseMenu && pauseMenu.classList.contains("hidden") && !isSubMenuOpen) {
                    gamePaused = true;
                    pauseMenu.classList.remove("hidden");
                    document.getElementById('game-wrap').classList.add('is-paused');
                    if (window.Main && window.Main.stopAllSounds) window.Main.stopAllSounds();
                }

                // Gestionar el mensaje de "Esperando al rival"
                const buttonsContainer = pauseMenu ? pauseMenu.querySelector('.buttons') : null;
                const waitingMsg = document.getElementById('pause-waiting-msg');

                let iAmReady = false;
                if (myRole === 'p1') iAmReady = onlineState.resumeRequests.p1;
                if (myRole === 'p2') iAmReady = onlineState.resumeRequests.p2;

                if (iAmReady) {
                    // Yo he pulsado reanudar: oculto los botones y pongo el spinner
                    if (buttonsContainer) buttonsContainer.classList.add('hidden');
                    if (waitingMsg) waitingMsg.classList.remove('hidden');
                }
                else {
                    // Todavía no he pulsado reanudar: veo los botones normales
                    if (buttonsContainer) buttonsContainer.classList.remove('hidden');
                    if (waitingMsg) waitingMsg.classList.add('hidden');
                }

                // Mostrar el contador de pausa y actualizar el número
                const pauseTimerEl = document.getElementById("online-pause-timer");
                const optValueEl = document.getElementById("opt-value");
                if (pauseTimerEl) {
                    pauseTimerEl.classList.remove("hidden");
                    if (optValueEl) optValueEl.textContent = onlineState.pauseTimeRemaining;
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

                // Resetear los botones y ocultar el mensaje de espera al salir de la pausa
                const buttonsContainer = pauseMenu ? pauseMenu.querySelector('.buttons') : null;
                const waitingMsg = document.getElementById('pause-waiting-msg');
                if (buttonsContainer) buttonsContainer.classList.remove('hidden');
                if (waitingMsg) waitingMsg.classList.add('hidden');

                // Ocultar el contador de pausa
                const pauseTimerEl = document.getElementById("online-pause-timer");
                if (pauseTimerEl) pauseTimerEl.classList.add("hidden");
            }

            const contador = document.getElementById("contador-pausa");
            if (onlineState.countdown > 0) {
                isOnlineCountdownActive = true;
                contador.classList.remove("hidden");

                // Redondeamos hacia arriba, pero limitamos el tope a 3
                let currentInt = Math.min(Math.ceil(onlineState.countdown), 3);

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

            if (hasPhysicsState && (!isFirstStateReceived || isOnlineCountdownActive || gamePaused)) {
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
            }
            else if (hasPhysicsState) {
                if (stateBuffer.length >= 2) {
                    const renderTime = latestServerSimTime - RENDER_DELAY;
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
                        p1.x = lerp(pastState.p1.x, futureState.p1.x, factor);
                        p1.y = lerp(pastState.p1.y, futureState.p1.y, factor);
                        p1.kickAngle = lerp(pastState.p1.kickAngle, futureState.p1.kickAngle, factor);

                        p2.x = lerp(pastState.p2.x, futureState.p2.x, factor);
                        p2.y = lerp(pastState.p2.y, futureState.p2.y, factor);
                        p2.kickAngle = lerp(pastState.p2.kickAngle, futureState.p2.kickAngle, factor);

                        ball.x = lerp(pastState.ball.x, futureState.ball.x, factor);
                        ball.y = lerp(pastState.ball.y, futureState.ball.y, factor);
                        ball.vx = lerp(pastState.ball.vx, futureState.ball.vx, factor);
                        ball.vy = lerp(pastState.ball.vy, futureState.ball.vy, factor);
                        ball.angle = lerp(pastState.ball.angle, futureState.ball.angle, factor);
                    }
                }
            }
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
    resetOnlineSessionState();
    if (typeof keys !== 'undefined' && keys.clear) keys.clear();
};
