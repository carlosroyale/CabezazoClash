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
    resetRound();

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
    // 1. Controles
    // FÍJATE AQUÍ: Añadimos "Space" para P1 antes de 'keys'
    controlPlayer(p1, dt, "KeyA", "KeyD", "KeyW", "Space", keys);

    if (botEnabled) controlBot(p2, dt, ball, W, FLOOR_Y, keys);
    else {
        // FÍJATE AQUÍ: Añadimos "KeyP" para P2 antes de 'keys'
        controlPlayer(p2, dt, "ArrowLeft", "ArrowRight", "ArrowUp", "KeyP", keys);
    }

    // 2. Física jugadores
    updatePlayer(p1, dt, W, FLOOR_Y);
    updatePlayer(p2, dt, W, FLOOR_Y);

    // 2.1 Colisiones entre jugadores
    collidePlayers(p1, p2);

    // 3. Física pelota
    updateBall(ball, dt, W, FLOOR_Y);

    // 4. Colisiones jugador-pelota
    collidePlayerBall(p1, ball);
    collidePlayerBall(p2, ball);
    // APLICAR CHUTE MANUAL
    applyKickForce(p1, ball);
    applyKickForce(p2, ball);
    resolveBallSqueezeUp(ball, p1, p2);

    // 5. Colisiones con las porterías (largueros)
    checkGoalCollisions(ball, leftGoal, rightGoal);

    // 5.1 Jugadores no pueden pasar por encima del larguero
    const postSize = 8;
    const leftCrossbar  = { x: leftGoal.x,  y: leftGoal.y,  w: leftGoal.w,  h: postSize };
    const rightCrossbar = { x: rightGoal.x, y: rightGoal.y, w: rightGoal.w, h: postSize };
    collidePlayerStaticRect(p1, leftCrossbar);
    collidePlayerStaticRect(p1, rightCrossbar);
    collidePlayerStaticRect(p2, leftCrossbar);
    collidePlayerStaticRect(p2, rightCrossbar);

    // 6. Gol
    checkGoal();

    // 7. Tiempo
    if (!gamePaused) {
        gameTime -= dt;
        if (gameTime <= 0) {
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
    const scoreboardUI = document.getElementById('scoreboard'); // Capturamos el marcador

    // Gol en la portería izquierda (marca el derecho)
    // Entra "más de la mitad" porque comprobamos el CENTRO de la pelota (ball.x)
    if (ball.x < leftGoalLine && ball.y > leftGoal.y) {
        score.right++;
        isGoalScored = true;

        // ENCENDER ANIMACIÓN
        if(scoreboardUI) scoreboardUI.classList.add('goal-active');

        setTimeout(() => {
            // APAGAR ANIMACIÓN AL REINICIAR
            if(scoreboardUI) scoreboardUI.classList.remove('goal-active');
            resetRound("right");
        }, 2000); // 2 segundos de celebración
    }
    // Gol en la portería derecha (marca el izquierdo)
    else if (ball.x > rightGoalLine && ball.y > rightGoal.y) {
        score.left++;
        isGoalScored = true;

        // ENCENDER ANIMACIÓN
        if(scoreboardUI) scoreboardUI.classList.add('goal-active');

        setTimeout(() => {
            // APAGAR ANIMACIÓN AL REINICIAR
            if(scoreboardUI) scoreboardUI.classList.remove('goal-active');
            resetRound("left");
        }, 2000); // 2 segundos de celebración
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

    ball.x = W / 2;
    ball.y = FLOOR_Y - 200;
    ball.vx = lastScorer === "left" ? 220 : -220;
    ball.vy = -220;
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

// API pública del motor para main.js e input.js
window.Game = {
    startBasicGame,
    startIdle,
    pauseGame,
    resumeGame,
    stopBasicGame,
    resize,
    resetRound
};