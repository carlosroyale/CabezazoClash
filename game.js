// game.js - motor del nivel básico, separado de UI
// Reestructurado al estilo de volador.js

/* ==========================================================================
   CONFIGURACIÓN E IMPORTS
   ========================================================================== */

// Namespace único para evitar contaminar global
window.Game = {};

// Constantes físicas y dimensiones (nivel BÁSICO)
let W, H;
const GRAV = 1800;           // px/s^2
let FLOOR_Y;                 // suelo
const RESTITUTION = 0.7;     // rebote pelota
const FRICTION = 0.88;       // fricción en suelo (pelota)
const DT_MAX = 1 / 30;

// Porterías (zonas de gol)
const GOAL_W = 80;
const GOAL_H = 200;
let leftGoal = {};
let rightGoal = {};

// Entidades
let ball = {r: 18, x: 0, y: 0, vx: 0, vy: 0};
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

// Imagen fondo
const bgImage = new Image();
bgImage.src = 'assets/img/fotoEstadio.png';


/* ==========================================================================
   CONTROLES
   ========================================================================== */

const keys = new Set();

const onKeyDown = (e) => {
    keys.add(e.code);

    if (e.code === "Escape") {
        if (!gameRunning) {
            // no estamos jugando, nada que hacer
            return;
        }
        if (gamePaused) {
            window.Game.resumeGame();
        } else {
            window.Game.pauseGame();
        }
        return;
    }
    if (e.code === "KeyR") {
        if (gameRunning && !gamePaused) resetRound();
    }
};

const onKeyUp = (e) => keys.delete(e.code);

// Los listeners se añaden globalmente (el Set keys se actualiza siempre,
// pero solo se procesa si el juego está corriendo)
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);


/* ==========================================================================
   LÓGICA DEL JUEGO
   ========================================================================== */

window.Game.resize = function (newW, newH) {
    if (!newW || !newH) return;
    W = newW;
    H = newH;
    FLOOR_Y = H - 325;

    // Recalcular posiciones de las porterías si la pantalla cambia
    leftGoal = {x: 0, y: FLOOR_Y - GOAL_H, w: GOAL_W, h: GOAL_H};
    rightGoal = {x: W - GOAL_W, y: FLOOR_Y - GOAL_H, w: GOAL_W, h: GOAL_H};
};

// Iniciar fondo animado/estático para el menú
window.Game.startIdle = function ({canvas, ctx}) {
    window.Game.stopBasicGame(); // Asegurarnos de que el juego está parado
    window.Game.stopIdle();      // Evitar bucles duplicados

    idleRunning = true;
    window.Game.resize(canvas.width, canvas.height);

    function idleLoop() {
        if (!idleRunning) return;

        ctx.clearRect(0, 0, W, H);

        // 1. Fondo
        drawField();

        // 2. Redes de las porterías
        drawGoalNet(leftGoal);
        drawGoalNet(rightGoal);

        // 3. Palos de las porterías
        drawGoalPosts(leftGoal);
        drawGoalPosts(rightGoal);

        idleAnimationId = requestAnimationFrame(idleLoop);
    }

    idleLoop();
};

// Detener el fondo del menú
window.Game.stopIdle = function () {
    idleRunning = false;
    if (idleAnimationId) cancelAnimationFrame(idleAnimationId);
};

// iniciar juego básico
// parámetros: { canvas, ctx, scoreEl, onExit }
window.Game.startBasicGame = function ({canvas, ctx, scoreEl, onExit, bot = false}) {
    // Detener el modo menú antes de jugar
    window.Game.stopIdle();
    window.Game.stopBasicGame();

    onExitCallback = onExit;
    botEnabled = !!bot;

    // APLICAR TAMAÑO Y POSICIONAR PORTERÍAS
    window.Game.resize(canvas.width, canvas.height);

    // Inicializar jugadores
    p1 = makePlayer(180, FLOOR_Y - 90, "P1");
    p2 = makePlayer(W - 180, FLOOR_Y - 90, "P2");

    // Reiniciar valores
    score = {left: 0, right: 0};
    gameTime = 60;
    updateScore();
    resetRound();

    // Arrancar bucle
    gameRunning = true;
    lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
};

window.Game.stopBasicGame = function () {
    gameRunning = false;
    gamePaused = false;
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    keys.clear();
};

function endGame() {
    window.Game.stopBasicGame();
    // Llamar a la función de main.js para mostrar la pantalla de fin
    if (window.showEndScreen) {
        window.showEndScreen(score.left, score.right);
    }
}

// pausa y reanuda sin perder el estado
window.Game.pauseGame = function () {
    if (!gameRunning || gamePaused) return;
    gamePaused = true;
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    document.dispatchEvent(new Event('game-paused'));
};

window.Game.resumeGame = function () {
    if (!gameRunning || !gamePaused) return;
    gamePaused = false;
    lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
    document.dispatchEvent(new Event('game-resumed'));
};

function gameLoop(time) {
    if (!gameRunning || gamePaused) return;

    let dt = (time - lastTime) / 1000;
    lastTime = time;
    dt = Math.min(dt, DT_MAX);

    update(dt);
    dibujar();

    animationId = requestAnimationFrame(gameLoop);
}

function update(dt) {
    // 1. Controles
    controlPlayer(p1, dt, "KeyA", "KeyD", "KeyW");
    if (botEnabled) {
        controlBot(p2, dt);
    } else {
        controlPlayer(p2, dt, "ArrowLeft", "ArrowRight", "ArrowUp");
    }

    // 2. Física jugadores
    updatePlayer(p1, dt);
    updatePlayer(p2, dt);

    // 2.1 Colisiones entre jugadores
    collidePlayers(p1, p2);

    // 3. Física pelota
    updateBall(dt);

    // 4. Colisiones jugador-pelota
    collidePlayerBall(p1);
    collidePlayerBall(p2);

    // 5. Colisiones con las porterías (largueros)
    checkGoalCollisions();

    // 6. Gol
    checkGoal();

    // 7. Tiempo
    if (!gamePaused) {
        gameTime -= dt;
        if (gameTime <= 0) {
            gameTime = 0;
            endGame();
        }
    }
    updateScore();
}

function controlPlayer(p, dt, leftKey, rightKey, jumpKey) {
    let dir = 0;
    if (keys.has(leftKey)) dir -= 1;
    if (keys.has(rightKey)) dir += 1;

    p.vx = dir * p.speed;

    if (keys.has(jumpKey) && p.onGround) {
        p.vy = -p.jump;
        p.onGround = false;
    }
}

function updatePlayer(p, dt) {
    p.vy += GRAV * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // límites horizontales
    p.x = clamp(p.x, p.w / 2, W - p.w / 2);

    // suelo
    if (p.y + p.h / 2 >= FLOOR_Y) {
        p.y = FLOOR_Y - p.h / 2;
        p.vy = 0;
        p.onGround = true;
    } else {
        p.onGround = false;
    }
}

function updateBall(dt) {
    ball.vy += GRAV * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // paredes
    if (ball.x - ball.r < 0) {
        ball.x = ball.r;
        ball.vx = -ball.vx * RESTITUTION;
    }
    if (ball.x + ball.r > W) {
        ball.x = W - ball.r;
        ball.vx = -ball.vx * RESTITUTION;
    }

    // techo
    if (ball.y - (ball.r) < 0) {
        ball.y = ball.r;
        ball.vy = -ball.vy * RESTITUTION;
    }

    // suelo
    if (ball.y + ball.r > FLOOR_Y) {
        ball.y = FLOOR_Y - ball.r;
        ball.vy = -ball.vy * RESTITUTION;

        // fricción al tocar suelo
        ball.vx *= FRICTION;

        // evitar vibraciones
        if (Math.abs(ball.vy) < 60) ball.vy = 0;
        if (Math.abs(ball.vx) < 12) ball.vx = 0;
    }
}

function collidePlayerBall(p) {
    // colisión círculo (ball) con AABB (player)
    const left = p.x - p.w / 2;
    const right = p.x + p.w / 2;
    const top = p.y - p.h / 2;
    const bottom = p.y + p.h / 2;

    const closestX = clamp(ball.x, left, right);
    const closestY = clamp(ball.y, top, bottom);

    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    const dist2 = dx * dx + dy * dy;

    if (dist2 < ball.r * ball.r) {
        const dist = Math.sqrt(dist2) || 0.0001;
        const nx = dx / dist;
        const ny = dy / dist;

        // sacar la pelota fuera del jugador
        const overlap = ball.r - dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;

        // impulso mejorado para crear una parábola
        const hitStrength = 520;
        const upwardBoost = 300; // Impulso vertical adicional fijo
        ball.vx += nx * hitStrength;
        ball.vy += ny * hitStrength - upwardBoost; // Asegurar que el balón se eleve

        // extra: si el jugador está moviéndose, transfiere velocidad
        ball.vx += p.vx * 0.35;

        // limitar la velocidad máxima del balón
        const maxSpeed = 900;
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed > maxSpeed) {
            const scale = maxSpeed / speed;
            ball.vx *= scale;
            ball.vy *= scale;
        }
    }
}

function checkGoalCollisions() {
    const postSize = 8;

    // Hitboxes de los Largueros
    const leftCrossbar = { x: leftGoal.x, y: leftGoal.y, w: leftGoal.w, h: postSize };
    const rightCrossbar = { x: rightGoal.x, y: rightGoal.y, w: rightGoal.w, h: postSize };

    const hitboxes = [leftCrossbar, rightCrossbar];

    for (let box of hitboxes) {
        // Colisión con la pelota
        collideBallStaticRect(box);

        // Colisión con los jugadores
        collidePlayerStaticRect(p1, box);
        collidePlayerStaticRect(p2, box);
    }
}

function collideBallStaticRect(rect) {
    // Buscar el punto del rectángulo más cercano al centro de la pelota
    const closestX = clamp(ball.x, rect.x, rect.x + rect.w);
    const closestY = clamp(ball.y, rect.y, rect.y + rect.h);

    // Calcular la distancia entre la pelota y ese punto
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    const dist2 = dx * dx + dy * dy;

    // Si la distancia es menor al radio, hay colisión
    if (dist2 < ball.r * ball.r) {
        const dist = Math.sqrt(dist2) || 0.0001;
        const nx = dx / dist; // Vector normal en X
        const ny = dy / dist; // Vector normal en Y

        // 1. Sacar la pelota del larguero (resolver superposición)
        const overlap = ball.r - dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;

        // 2. Calcular el rebote (Física)
        const dotProduct = ball.vx * nx + ball.vy * ny;
        if (dotProduct < 0) {
            // Invertir la velocidad en la dirección del impacto aplicando el rebote
            ball.vx -= (1 + RESTITUTION) * dotProduct * nx;
            ball.vy -= (1 + RESTITUTION) * dotProduct * ny;
        }
    }
}

function collidePlayerStaticRect(p, rect) {
    // Calcular los bordes del jugador (el punto x,y está en su centro)
    const pLeft = p.x - p.w / 2;
    const pRight = p.x + p.w / 2;
    const pTop = p.y - p.h / 2;
    const pBottom = p.y + p.h / 2;

    // Calcular los bordes de la hitbox estática (el punto x,y está en la esquina superior izquierda)
    const rLeft = rect.x;
    const rRight = rect.x + rect.w;
    const rTop = rect.y;
    const rBottom = rect.y + rect.h;

    // Comprobar si hay superposición
    if (pRight <= rLeft || pLeft >= rRight || pBottom <= rTop || pTop >= rBottom) {
        return; // No hay colisión
    }

    // Si hay colisión, calcular cuánto se han solapado en cada dirección
    const overlapLeft = pRight - rLeft;
    const overlapRight = rRight - pLeft;
    const overlapTop = pBottom - rTop;
    const overlapBottom = rBottom - pTop;

    // Encontrar el solapamiento más pequeño para saber por dónde chocó
    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

    if (minOverlap === overlapTop) {
        // Choca desde arriba (aterriza en el larguero)
        p.y -= overlapTop;
        p.vy = 0;
        p.onGround = true;
    }
    else if (minOverlap === overlapBottom) {
        // Choca desde abajo (se da con la cabeza)
        p.y += overlapBottom;
        if (p.vy < 0) p.vy = 0;
    }
    else if (minOverlap === overlapLeft) {
        // Choca por la izquierda
        p.x -= overlapLeft;
        p.vx = 0;
    }
    else if (minOverlap === overlapRight) {
        // Choca por la derecha
        p.x += overlapRight;
        p.vx = 0;
    }
}

function checkGoal() {
    // Si ya se ha marcado un gol, no seguimos comprobando hasta que se reinicie
    if (isGoalScored) return;

    // Líneas de gol (donde están los postes frontales)
    const leftGoalLine = leftGoal.x + leftGoal.w;
    const rightGoalLine = rightGoal.x;

    // Gol en la portería izquierda (marca el derecho)
    // Entra "más de la mitad" porque comprobamos el CENTRO de la pelota (ball.x)
    if (ball.x < leftGoalLine && ball.y > leftGoal.y) {
        score.right += 1;
        updateScore();
        isGoalScored = true; // Bloqueamos nuevos goles
        setTimeout(() => resetRound("right"), 2000); // Esperamos 2 segundos
    }

    // Gol en la portería derecha (marca el izquierdo)
    else if (ball.x > rightGoalLine && ball.y > rightGoal.y) {
        score.left += 1;
        updateScore();
        isGoalScored = true; // Bloqueamos nuevos goles
        setTimeout(() => resetRound("left"), 2000); // Esperamos 2 segundos
    }
}

function collidePlayers(p1, p2) {
    // Verificar si los rectángulos de los jugadores se superponen
    const overlapX = Math.max(0, Math.min(p1.x + p1.w / 2, p2.x + p2.w / 2) - Math.max(p1.x - p1.w / 2, p2.x - p2.w / 2));
    const overlapY = Math.max(0, Math.min(p1.y + p1.h / 2, p2.y + p2.h / 2) - Math.max(p1.y - p1.h / 2, p2.y - p2.h / 2));

    if (overlapX > 0 && overlapY > 0) {
        // Resolver la colisión separando a los jugadores
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.0001;

        const nx = dx / distance; // Normal en X
        const ny = dy / distance; // Normal en Y

        const resolveFactor = overlapX / 2; // Separar a ambos jugadores por igual
        p1.x -= nx * resolveFactor;
        p2.x += nx * resolveFactor;

        // Ajustar velocidades para simular rebote
        const bounceFactor = 0.5; // Factor de rebote (puedes ajustarlo)
        const relativeVelocityX = p2.vx - p1.vx;
        const impulseX = relativeVelocityX * bounceFactor;

        p1.vx += impulseX;
        p2.vx -= impulseX;
    }
}


/* ==========================================================================
   DIBUJADO (RENDER)
   ========================================================================== */

function dibujar() {
    ctx.clearRect(0, 0, W, H);

    // 1. Fondo (lo más profundo)
    drawField();

    // 2. Jugadores y pelota (al fondo, detrás de la portería)
    drawPlayer(p1, "#ffffff");
    drawPlayer(p2, "#ffd700");
    drawBall();

    // 3. Redes de las porterías (nivel intermedio)
    drawGoalNet(leftGoal);
    drawGoalNet(rightGoal);

    // 4. Palos de las porterías (al frente de todo)
    drawGoalPosts(leftGoal);
    drawGoalPosts(rightGoal);
}

function drawField() {
    // DIBUJAR LA IMAGEN DE FONDO
    if (bgImage.complete) {
        ctx.drawImage(bgImage, 0, 0, W, H);
    }
}

function drawPlayer(p, color) {
    ctx.fillStyle = color;
    ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);

    // cabeza (círculo) para “head soccer vibes”
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.h / 2 - 18, 22, 0, Math.PI * 2);
    ctx.fill();

    // etiqueta
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.font = "16px Arial";
    ctx.fillText(p.label, p.x - 12, p.y + 6);
}

function drawBall() {
    ctx.beginPath();
    ctx.fillStyle = "white";
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawGoalNet(g) {
    // Guardamos el contexto para poder aplicar un recorte (clip) a la red
    ctx.save();

    // Fondo de la red (semitransparente)
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(g.x, g.y, g.w, g.h);

    // Patrón de la red (rombos cruzados)
    ctx.beginPath();
    ctx.rect(g.x, g.y, g.w, g.h);
    ctx.clip(); // Limitamos el dibujo solo al interior de la portería

    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1.5;
    const step = 14; // Tamaño de los rombos de la red

    ctx.beginPath();
    // Diagonales en un sentido
    for (let i = -g.h; i < g.w + g.h; i += step) {
        ctx.moveTo(g.x + i, g.y);
        ctx.lineTo(g.x + i + g.h, g.y + g.h);
    }
    // Diagonales en el sentido opuesto
    for (let i = -g.h; i < g.w + g.h; i += step) {
        ctx.moveTo(g.x + i, g.y + g.h);
        ctx.lineTo(g.x + i + g.h, g.y);
    }
    ctx.stroke();

    ctx.restore(); // Restauramos el contexto
}

function drawGoalPosts(g) {
    // Detectamos si es la portería izquierda o derecha
    const isLeft = g.x < W / 2;
    const postSize = 8;

    // Estructura de los postes
    ctx.fillStyle = "#e0e0e0"; // Color blanco/gris claro metálico

    // Larguero (parte superior)
    ctx.fillRect(g.x, g.y, g.w, postSize);

    // Postes laterales
    if (isLeft) {
        // Poste frontal (hacia el centro del campo)
        ctx.fillRect(g.x + g.w - postSize, g.y, postSize, g.h);
    }
    else {
        // Poste frontal
        ctx.fillRect(g.x, g.y, postSize, g.h);
    }

    // Sombras interiores para darle volumen 3D a los postes
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";

    // Sombra debajo del larguero
    ctx.fillRect(g.x, g.y + postSize - 3, g.w, 3);

    // Sombra en el poste frontal
    if (isLeft) {
        ctx.fillRect(g.x + g.w - postSize + 3, g.y + postSize, postSize - 3, g.h - postSize);
    } else {
        ctx.fillRect(g.x + 3, g.y + postSize, postSize - 3, g.h - postSize);
    }
}

/* ==========================================================================
   UTILIDADES
   ========================================================================== */

function makePlayer(x, y, label) {
    return {
        label,
        x,
        y,
        w: 56,
        h: 90,
        vx: 0,
        vy: 0,
        speed: 420,
        jump: 760,
        onGround: false
    };
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
    if (scoreEl) {
        const minutes = Math.floor(gameTime / 60);
        const seconds = Math.floor(gameTime % 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        scoreEl.textContent = `${score.left} - ${score.right} | ${timeStr}`;
    }
}

function circleRectOverlap(c, r) {
    const closestX = clamp(c.x, r.x, r.x + r.w);
    const closestY = clamp(c.y, r.y, r.y + r.h);
    const dx = c.x - closestX;
    const dy = c.y - closestY;
    return (dx * dx + dy * dy) <= (c.r * c.r);
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function controlBot(bot, dt) {
    // === CONFIG IA ===
    const reaction = 0.12;
    const maxSpeedFactor = 0.9;

    // === 1. PREDICCIÓN DE BALÓN ===
    const futureX = ball.x + ball.vx * reaction;
    const futureY = ball.y + ball.vy * reaction;

    const isBallComing = (ball.vx > 0 && bot.x < ball.x) || (ball.vx < 0 && bot.x > ball.x);

    // === 2. ZONAS Y DISTANCIAS ===
    const isBallOnBotSide = ball.x > W / 2;
    const distanceToBall = Math.abs(ball.x - bot.x);

    // === 3. POSICIONAMIENTO INTELIGENTE (FIX ATAQUE) ===
    let targetX;

    const isBallFree =
        Math.abs(ball.vx) < 200 ||       // balón lento
        distanceToBall < 250;            // o cercano

    const canAttack =
        isBallOnBotSide ||
        (isBallFree && isBallComing);

    if (canAttack) {
        // ATACA → puede cruzar campo
        targetX = futureX;
    } else {
        // DEFENSA → pero no se queda atrás del todo
        targetX = W * 0.65;
    }

    // Ajuste fino para posicionarse mejor respecto al balón
    const offset = 10;
    if (ball.x < bot.x) targetX -= offset;
    else targetX += offset;

    // === 4. MOVIMIENTO ===
    const dir = Math.sign(targetX - bot.x);
    bot.vx = dir * bot.speed * maxSpeedFactor;

    // Frenado suave (más natural)
    if (Math.abs(targetX - bot.x) < 10) {
        bot.vx *= 0.3;
    }

    // === 5. SALTO INTELIGENTE ===
    const shouldJump =
        bot.onGround &&
        distanceToBall < 180 &&
        (
            ball.y < bot.y - 40 ||                  // balón en el aire
            (isBallComing && ball.vy > 0)           // o cayendo hacia él
        );

    if (shouldJump) {
        bot.vy = -bot.jump * 0.95;
        bot.onGround = false;
    }

    // === 6. REMATE / ATAQUE ===
    if (distanceToBall < 80 && Math.abs(ball.y - bot.y) < 60) {
        // impulso hacia balón (golpeo)
        bot.vx *= 1.2;

        // mini salto ofensivo si el balón está bajo
        if (bot.onGround && ball.y > FLOOR_Y - 120) {
            bot.vy = -bot.jump * 0.6;
            bot.onGround = false;
        }
    }

    // === 7. LÍMITES ===
    if (bot.x < bot.w / 2) bot.x = bot.w / 2;
    if (bot.x > W - bot.w / 2) bot.x = W - bot.w / 2;
}