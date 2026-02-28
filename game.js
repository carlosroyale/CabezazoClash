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
const GOAL_W = 60;
const GOAL_H = 160;
let leftGoal = {};
let rightGoal = {};

// Entidades
let ball = {r: 18, x: 0, y: 0, vx: 0, vy: 0};
let p1 = {};
let p2 = {};
let score = {left: 0, right: 0};

// Variables de Juego y Bucle
let gameRunning = false;
let animationId = null;
let lastTime = 0;


/* ==========================================================================
   CONTROLES
   ========================================================================== */

const keys = new Set();

const onKeyDown = (e) => {
    keys.add(e.code);

    if (e.code === "Escape") {
        window.Game.stopBasicGame();
        if (onExitCallback) onExitCallback();
    }
    if (e.code === "KeyR") {
        resetRound();
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
    FLOOR_Y = H - 70; // 70px de grosor del césped inferior

    // Recalcular posiciones de las porterías si la pantalla cambia
    leftGoal = {x: 0, y: FLOOR_Y - GOAL_H, w: GOAL_W, h: GOAL_H};
    rightGoal = {x: W - GOAL_W, y: FLOOR_Y - GOAL_H, w: GOAL_W, h: GOAL_H};
};

// iniciar juego básico
// parámetros: { canvas, ctx, scoreEl, onExit }
window.Game.startBasicGame = function ({canvas, ctx, scoreEl, onExit}) {
    // Detener juego anterior si existe
    window.Game.stopBasicGame();

    // APLICAR TAMAÑO Y POSICIONAR PORTERÍAS
    window.Game.resize(canvas.width, canvas.height);

    // Inicializar jugadores
    p1 = makePlayer(180, FLOOR_Y - 90, "P1");
    p2 = makePlayer(W - 180, FLOOR_Y - 90, "P2");

    // Reiniciar valores
    score = {left: 0, right: 0};
    updateScore();
    resetRound();

    // Arrancar bucle
    gameRunning = true;
    lastTime = performance.now();
    animationId = requestAnimationFrame(gameLoop);
};

window.Game.stopBasicGame = function () {
    gameRunning = false;
    if (animationId) cancelAnimationFrame(animationId);
};

function gameLoop(time) {
    if (!gameRunning) return;

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
    controlPlayer(p2, dt, "ArrowLeft", "ArrowRight", "ArrowUp");

    // 2. Física jugadores
    updatePlayer(p1, dt);
    updatePlayer(p2, dt);

    // 3. Física pelota
    updateBall(dt);

    // 4. Colisiones jugador-pelota
    collidePlayerBall(p1);
    collidePlayerBall(p2);

    // 5. Gol
    checkGoal();
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

        // impulso simple (arcade)
        const hitStrength = 520;
        ball.vx += nx * hitStrength;
        ball.vy += ny * hitStrength;

        // extra: si el jugador está moviéndose, transfiere velocidad
        ball.vx += p.vx * 0.35;
    }
}

function checkGoal() {
    // gol izquierda (marca el derecho) si la pelota entra en la portería izquierda
    if (circleRectOverlap(ball, leftGoal)) {
        score.right += 1;
        updateScore();
        resetRound("right");
    }

    // gol derecha (marca el izquierdo)
    if (circleRectOverlap(ball, rightGoal)) {
        score.left += 1;
        updateScore();
        resetRound("left");
    }
}


/* ==========================================================================
   DIBUJADO (RENDER)
   ========================================================================== */

function dibujar() {
    ctx.clearRect(0, 0, W, H);

    // fondo simple
    drawField();

    // porterías
    drawGoal(leftGoal);
    drawGoal(rightGoal);

    // jugadores
    drawPlayer(p1, "#ffffff");
    drawPlayer(p2, "#ffd700");

    // pelota
    drawBall();
}

function drawField() {
    // césped
    ctx.fillStyle = "rgba(40, 170, 90, 0.85)";
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

    // línea central
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(W / 2, FLOOR_Y);
    ctx.lineTo(W / 2, H);
    ctx.stroke();

    // suelo
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(W, FLOOR_Y);
    ctx.stroke();
}

function drawGoal(g) {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 3;
    ctx.strokeRect(g.x, g.y, g.w, g.h);
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
        scoreEl.textContent = `${score.left} - ${score.right}`;
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