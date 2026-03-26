// renderer.js - Todo lo relacionado con el Canvas y ctx

// Imagen fondo
const bgImage = new Image();
bgImage.src = 'assets/img/fotoEstadio.png';

// Global ctx for drawing functions
let drawingCtx;

function dibujar(ctx, W, H, p1, p2, ball, leftGoal, rightGoal) {
    drawingCtx = ctx;
    ctx.clearRect(0, 0, W, H);

    // 1. Fondo (lo más profundo)
    drawField(W, H);

    // 2. Jugadores y pelota (al fondo, detrás de la portería)
    drawPlayer(p1, "#ffffff");
    drawPlayer(p2, "#ffd700");
    drawBall(ball);

    // 3. Redes de las porterías (nivel intermedio)
    drawGoalNet(leftGoal);
    drawGoalNet(rightGoal);

    // 4. Palos de las porterías (al frente de todo)
    drawGoalPosts(leftGoal, W);
    drawGoalPosts(rightGoal, W);
}

function drawField(W, H) {
    // DIBUJAR LA IMAGEN DE FONDO
    if (bgImage.complete) {
        drawingCtx.drawImage(bgImage, 0, 0, W, H);
    }
}

function drawPlayer(p, color) {
    drawingCtx.fillStyle = color;
    drawingCtx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);

    // cabeza (círculo) para "head soccer vibes"
    drawingCtx.beginPath();
    drawingCtx.arc(p.x, p.y - p.h / 2 - 18, 22, 0, Math.PI * 2);
    drawingCtx.fill();

    // etiqueta
    drawingCtx.fillStyle = "rgba(0,0,0,0.6)";
    drawingCtx.font = "16px Arial";
    drawingCtx.fillText(p.label, p.x - 12, p.y + 6);
}

function drawBall(ball) {
    drawingCtx.beginPath();
    drawingCtx.fillStyle = "white";
    drawingCtx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    drawingCtx.fill();

    drawingCtx.strokeStyle = "rgba(0,0,0,0.35)";
    drawingCtx.lineWidth = 2;
    drawingCtx.stroke();
}

function drawGoalNet(g) {
    // Guardamos el contexto para poder aplicar un recorte (clip) a la red
    drawingCtx.save();

    // Fondo de la red (semitransparente)
    drawingCtx.fillStyle = "rgba(255, 255, 255, 0.08)";
    drawingCtx.fillRect(g.x, g.y, g.w, g.h);

    // Patrón de la red (rombos cruzados)
    drawingCtx.beginPath();
    drawingCtx.rect(g.x, g.y, g.w, g.h);
    drawingCtx.clip(); // Limitamos el dibujo solo al interior de la portería

    drawingCtx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    drawingCtx.lineWidth = 1.5;
    const step = 14; // Tamaño de los rombos de la red

    drawingCtx.beginPath();
    // Diagonales en un sentido
    for (let i = -g.h; i < g.w + g.h; i += step) {
        drawingCtx.moveTo(g.x + i, g.y);
        drawingCtx.lineTo(g.x + i + g.h, g.y + g.h);
    }
    // Diagonales en el sentido opuesto
    for (let i = -g.h; i < g.w + g.h; i += step) {
        drawingCtx.moveTo(g.x + i, g.y + g.h);
        drawingCtx.lineTo(g.x + i + g.h, g.y);
    }
    drawingCtx.stroke();

    drawingCtx.restore(); // Restauramos el contexto
}

function drawGoalPosts(g, W) {
    // Detectamos si es la portería izquierda o derecha
    const isLeft = g.x < W / 2;
    const postSize = 8;

    // Estructura de los postes
    drawingCtx.fillStyle = "#e0e0e0"; // Color blanco/gris claro metálico

    // Larguero (parte superior)
    drawingCtx.fillRect(g.x, g.y, g.w, postSize);

    // Postes laterales
    if (isLeft) {
        // Poste frontal (hacia el centro del campo)
        drawingCtx.fillRect(g.x + g.w - postSize, g.y, postSize, g.h);
    }
    else {
        // Poste frontal
        drawingCtx.fillRect(g.x, g.y, postSize, g.h);
    }

    // Sombras interiores para darle volumen 3D a los postes
    drawingCtx.fillStyle = "rgba(0, 0, 0, 0.25)";

    // Sombra debajo del larguero
    drawingCtx.fillRect(g.x, g.y + postSize - 3, g.w, 3);

    // Sombra en el poste frontal
    if (isLeft) {
        drawingCtx.fillRect(g.x + g.w - postSize + 3, g.y + postSize, postSize - 3, g.h - postSize);
    } else {
        drawingCtx.fillRect(g.x + 3, g.y + postSize, postSize - 3, g.h - postSize);
    }
}