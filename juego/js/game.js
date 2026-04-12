// game.js - El bucle principal: update y llamadas a los demás

// Constantes físicas y dimensiones (nivel BÁSICO)
let W, H;
let FLOOR_Y;                 // suelo

// Porterías (zonas de gol)
let leftGoal = {};
let rightGoal = {};

// Entidades
let ball = {r: 18, x: 0, y: 0, vx: 0, vy: 0, angle: 0};
let p1 = {};
let p2 = {};
let score = {left: 0, right: 0};
let gameTime = 60; // 60 segundos

// Variables de Juego y Bucle
let gameRunning = false;
let gamePaused = false;            // nuevo: el juego está en pausa
let animationId = null;
let lastTime = 0;
let isGoalScored = false;
let onExitCallback = null;
let botEnabled = false;
let isCelebrating = false;
let celebrationTimer = 0;
let nextScorer = null;
let serveState = { server: null, active: false };

// Variables para el modo menú
let idleRunning = false;
let idleAnimationId = null;
let gameCtx;
let gameScoreEl;
let gameTimerEl;

function resize(newW, newH) {
    if (!newW || !newH) return;
    W = newW;
    H = newH;
    FLOOR_Y = H - 325;

    // Recalcular posiciones de las porterías si la pantalla cambia
    leftGoal = {x: 0, y: FLOOR_Y - GOAL_H, w: GOAL_W, h: GOAL_H};
    rightGoal = {x: W - GOAL_W, y: FLOOR_Y - GOAL_H, w: GOAL_W, h: GOAL_H};
}

// Iniciar fondo animado/estático para el menú
function startIdle({canvas, ctx: ctxParam}) {
    stopBasicGame(); // Asegurarnos de que el juego está parado
    stopIdle();      // Evitar bucles duplicados

    gameCtx = ctxParam;
    idleRunning = true;
    resize(canvas.width, canvas.height);

    function idleLoop() {
        // Pasamos null a las entidades para que desaparezcan en el menú
        dibujar(gameCtx, W, H, null, null, null, leftGoal, rightGoal);
        if (idleRunning) {
            idleAnimationId = requestAnimationFrame(idleLoop);
        }
    }

    idleLoop();
}

// Detener el fondo del menú
function stopIdle() {
    idleRunning = false;
    if (idleAnimationId) {
        cancelAnimationFrame(idleAnimationId);
        idleAnimationId = null;
    }
}

// iniciar juego básico
// parámetros: { canvas, ctx, scoreEl, timerEl, onExit }
function startBasicGame({canvas, ctx: ctxParam, scoreEl: scoreElParam, timerEl: timerElParam, onExit, bot = false}) {
    // Detener el modo menú antes de jugar
    stopIdle();
    stopBasicGame();

    gameCtx = ctxParam;
    gameScoreEl = scoreElParam;
    gameTimerEl = timerElParam;
    onExitCallback = onExit;
    botEnabled = !!bot;

    // APLICAR TAMAÑO Y POSICIONAR PORTERÍAS
    resize(canvas.width, canvas.height);

    // Inicializar jugadores
    p1 = makePlayer(180, FLOOR_Y - 90, "P1", true);
    p2 = makePlayer(W - 180, FLOOR_Y - 90, "P2", false);

    // Reiniciar valores
    score = {left: 0, right: 0};
    gameTime = 60;
    updateScore();
    updateTimer();
    serveState = { server: null, active: false };
    resetRound();
    isCelebrating = false;
    celebrationTimer = 0;
    const scoreboardUI = document.getElementById('scoreboard');
    if(scoreboardUI) scoreboardUI.classList.remove('goal-active');

    // Arrancar bucle
    gameRunning = true;
    lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
}

function stopBasicGame() {
    gameRunning = false;
    gamePaused = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

function endGame() {
    stopBasicGame();
    // Llamar a la función de main.js para mostrar la pantalla de fin
    if (window.showEndScreen) {
        window.showEndScreen(score.left, score.right);
    }
}

// pausa y reanuda sin perder el estado
function pauseGame() {
    if (!gameRunning || gamePaused) return;
    gamePaused = true;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    document.dispatchEvent(new Event('game-paused'));
}

function resumeGame() {
    if (!gameRunning || !gamePaused) return;
    gamePaused = false;
    lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
    document.dispatchEvent(new Event('game-resumed'));
}

function gameLoop(time) {
    if (!gameRunning || gamePaused) return;

    let dt = (time - lastTime) / 1000;
    lastTime = time;
    dt = Math.min(dt, DT_MAX);

    update(dt);
    dibujar(gameCtx, W, H, p1, p2, ball, leftGoal, rightGoal);

    animationId = requestAnimationFrame(gameLoop);
}

function update(dt) {
    if (serveState.active) {
        // Cerramos la fase de saque en cuanto la pelota abandona el centro.
        if (Math.abs(ball.x - W / 2) > W * 0.08) {
            serveState.active = false;
        }
    }

    // 1. Controles
    controlPlayer(p1, dt, "KeyA", "KeyD", "KeyW", "Space", keys);

    if (botEnabled) {
        const botServeBlocked = serveState.active && serveState.server === "right";
        if (botServeBlocked) {
            // Durante el saque del bot, lo dejamos totalmente bloqueado.
            p2.vx = 0;
            p2.isKicking = false;
            if (p2.kickAngle > 0) {
                p2.kickAngle -= (p2.kickSpeed / 3) * dt;
                if (p2.kickAngle < 0) p2.kickAngle = 0;
            }
        } else {
            controlBot(p2, dt, ball, W, FLOOR_Y, keys, false);
        }
    }
    else {
        controlPlayer(p2, dt, "ArrowLeft", "ArrowRight", "ArrowUp", "KeyP", keys);
    }

    // 2. Física jugadores
    updatePlayer(p1, dt, W, FLOOR_Y);
    updatePlayer(p2, dt, W, FLOOR_Y);

    // 2.1 Colisiones entre jugadores
    collidePlayers(p1, p2);

    // 2.2 Colisiones del jugador con los postes
    const postSize = 8;
    const leftCrossbar  = { x: leftGoal.x,  y: leftGoal.y,  w: leftGoal.w,  h: postSize };
    const rightCrossbar = { x: rightGoal.x, y: rightGoal.y, w: rightGoal.w, h: postSize };
    collidePlayerStaticRect(p1, leftCrossbar);
    collidePlayerStaticRect(p1, rightCrossbar);
    collidePlayerStaticRect(p2, leftCrossbar);
    collidePlayerStaticRect(p2, rightCrossbar);

    // 3. Física pelota
    updateBall(ball, dt, W, FLOOR_Y);

    // 4. Colisiones jugador-pelota
    window.currentPlayers = [p1, p2];
    const playersBackToBack = arePlayersBackToBack(p1, p2);
    if (playersBackToBack) {
        resolveBackToBackBallSqueeze(ball, p1, p2);
    }
    collidePlayerBall(p1, ball);
    collidePlayerBall(p2, ball);
    if (playersBackToBack) resolveBackToBackBallSqueeze(ball, p1, p2);
    else resolveBallSqueezeUp(ball, p1, p2);

    // 5. Colisiones pelota - porterías
    checkGoalCollisions(ball, leftGoal, rightGoal);

    // --- 5.1 MURO DE CONTENCIÓN ABSOLUTO (EL TRUCO PARA LA VELOCIDAD REAL) ---
    // Si la pelota es empujada fuera del mapa, devolvemos la pelota a su sitio,
    // y si el jugador la está pisando, lo frenamos a él también.

    // Distancia: Mitad del ancho del jugador (28) + Radio del balón (18) + pequeño margen
    const crushDist = 50;

    if (ball.x - ball.r < 0) {
        const exceso = ball.r - ball.x;
        ball.x = ball.r;
        if (p2.x > ball.x && (p2.x - ball.x) < crushDist) p2.x += exceso;
        if (p1.x > ball.x && (p1.x - ball.x) < crushDist) p1.x += exceso;
    }
    if (ball.x + ball.r > W) {
        const exceso = (ball.x + ball.r) - W;
        ball.x = W - ball.r;
        if (p1.x < ball.x && (ball.x - p1.x) < crushDist) p1.x -= exceso;
        if (p2.x < ball.x && (ball.x - p2.x) < crushDist) p2.x -= exceso;
    }

    // --- 5.2 CÁLCULO DE VELOCIDAD REAL EXACTA ---
    // Leemos cuánto se han desplazado de verdad las coordenadas en este frame
    p1.realVx = p1.lastX !== undefined ? (p1.x - p1.lastX) / dt : 0;
    p1.realVy = p1.lastY !== undefined ? (p1.y - p1.lastY) / dt : 0;
    p2.realVx = p2.lastX !== undefined ? (p2.x - p2.lastX) / dt : 0;
    p2.realVy = p2.lastY !== undefined ? (p2.y - p2.lastY) / dt : 0;
    ball.realVx = ball.lastX !== undefined ? (ball.x - ball.lastX) / dt : 0;
    ball.realVy = ball.lastY !== undefined ? (ball.y - ball.lastY) / dt : 0;

    // Guardamos las coordenadas finales reales para el próximo frame
    p1.lastX = p1.x; p1.lastY = p1.y;
    p2.lastX = p2.x; p2.lastY = p2.y;
    ball.lastX = ball.x; ball.lastY = ball.y;

    // 6. Gol
    checkGoal();

    // Al usar 'dt', si el juego se pausa, 'dt' no avanza, por lo que el tiempo se congela.
    if (isCelebrating) {
        celebrationTimer -= dt;
        if (celebrationTimer <= 0) {
            isCelebrating = false;
            const scoreboardUI = document.getElementById('scoreboard');
            if(scoreboardUI) scoreboardUI.classList.remove('goal-active');
            resetRound(nextScorer);
        }
    }

    // 7. Tiempo
    if (!gamePaused) {
        gameTime -= dt;
        if (gameTime <= 0) {
            window.playSound('sfx-whistle');
            endGame();
        }
        updateScore();
        updateTimer();
    }
}

function checkGoal() {
    // Si ya se ha marcado un gol, no seguimos comprobando hasta que se reinicie
    if (isGoalScored) return;

    // Líneas de gol (donde están los postes frontales)
    const leftGoalLine = leftGoal.x + leftGoal.w;
    const rightGoalLine = rightGoal.x;
    const scoreboardUI = document.getElementById('scoreboard');

    // Gol en la portería izquierda (marca el derecho)
    // Entra "más de la mitad" porque comprobamos el CENTRO de la pelota (ball.x)
    if (ball.x < leftGoalLine && ball.y > leftGoal.y) {
        score.right++;
        isGoalScored = true;
        window.playSound('sfx-goal', 0.5);

        // ENCENDER ANIMACIÓN
        if(scoreboardUI) scoreboardUI.classList.add('goal-active');

        // Iniciamos la celebración
        isCelebrating = true;
        celebrationTimer = 2.0; // 2 segundos
        nextScorer = "right";
    }
    // Gol en la portería derecha (marca el izquierdo)
    else if (ball.x > rightGoalLine && ball.y > rightGoal.y) {
        score.left++;
        isGoalScored = true;
        window.playSound('sfx-goal', 0.5);

        // ENCENDER ANIMACIÓN
        if(scoreboardUI) scoreboardUI.classList.add('goal-active');

        // Iniciamos la celebración
        isCelebrating = true;
        celebrationTimer = 2.0; // 2 segundos
        nextScorer = "left";
    }
}

function resetRound(lastScorer = null) {
    isGoalScored = false; // Permitimos marcar gol de nuevo

    // reset posiciones
    p1.x = 180;
    p1.y = FLOOR_Y - p1.h / 2;
    p1.vx = 0;
    p1.vy = 0;
    p2.x = W - 180;
    p2.y = FLOOR_Y - p2.h / 2;
    p2.vx = 0;
    p2.vy = 0;

    ball.x = W ;
    ball.y = FLOOR_Y - 200 - 200;

    if (lastScorer === "left") {
        ball.vx = 220;  // Marcó el P1 (izq), así que saca el P2 (der)
        serveState.server = "right";
    } else if (lastScorer === "right") {
        ball.vx = -220; // Marcó el P2 (der), así que saca el P1 (izq)
        serveState.server = "left";
    } else {
        // Si no hay goleador previo (saque inicial), echamos una moneda al aire:
        // Math.random() genera un número entre 0 y 1. Si es mayor a 0.5 va a la derecha, si no, a la izquierda.
        ball.vx = Math.random() > 0.5 ? 220 : -220;
        serveState.server = ball.vx > 0 ? "right" : "left";
    }

    //ball.vy = -220;
    ball.vx = 0;
    ball.vy = 0;
    //serveState.active = true;
}

function updateScore() {
    if (gameScoreEl) {
        gameScoreEl.textContent = `${score.left} - ${score.right}`;
    }
}

function updateTimer() {
    if (gameTimerEl) {
        gameTimerEl.textContent = `${Math.max(0, Math.ceil(gameTime))}`;
    }
}

// Se usa exclusivamente para repintar el frame estático cuando
// se redimensiona la ventana y el juego está en pausa.
function forceRedraw(contexto) {
    if (gamePaused) {
        // Usamos los objetos globales actuales tal y como se quedaron al pausar
        dibujar(contexto, W, H, p1, p2, ball, leftGoal, rightGoal);
    }
}

// API pública del motor para main.js e input.js
window.Game = {
    startBasicGame,
    startIdle,
    pauseGame,
    resumeGame,
    stopBasicGame,
    resize,
    resetRound,
    forceRedraw
};