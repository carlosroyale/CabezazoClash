// renderer.js - Todo lo relacionado con el Canvas y ctx

// Imagen fondo
const bgImage = new Image();
bgImage.src = 'assets/img/fotoEstadio.png';

const imgP1Body = new Image();
imgP1Body.src = 'assets/img/jugador1.png';

const imgP1Shoe = new Image();
imgP1Shoe.src = 'assets/img/jugador1Bota.png';

const imgP2Body = new Image();
imgP2Body.src = 'assets/img/jugador2.png';

const imgP2Shoe = new Image();
imgP2Shoe.src = 'assets/img/jugador2Bota.png';

// Global ctx for drawing functions
let drawingCtx;

function dibujar(ctx, W, H, p1, p2, ball, leftGoal, rightGoal) {
    drawingCtx = ctx;
    ctx.clearRect(0, 0, W, H);

    // 1. Fondo (lo más profundo)
    drawField(W, H);

    // 2. Jugadores y pelota (Solo se dibujan si no son null)
    if (p1) drawPlayer(p1, imgP1Body, imgP1Shoe);
    if (p2) drawPlayer(p2, imgP2Body, imgP2Shoe);

    if (ball) drawBall(ball);

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

function drawPlayer(p, bodyImg, shoeImg) {
    // 1. DIBUJAR CUERPO
    if (bodyImg && bodyImg.complete) {
        drawingCtx.drawImage(bodyImg, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    } else {
        // Fallback si la imagen no carga
        drawingCtx.fillStyle = p.isRightFacing ? "#ffffff" : "#ffd700";
        drawingCtx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    }

    // 2. DIBUJAR PIERNA ROTADA
    drawingCtx.save();

    // Calcular el punto de la cadera (El "Pivote").
    // Ajusta estos números si la pierna gira desde un punto raro.
    let hipOffsetX = p.isRightFacing ? 10 : -15;
    let hipOffsetY = 25; // Distancia hacia abajo desde el centro del jugador

    drawingCtx.translate(p.x + hipOffsetX, p.y + hipOffsetY);

    // Si mira a la derecha rota en negativo (antihorario). Si mira a la izq, positivo.
    let rotation = p.isRightFacing ? -p.kickAngle : p.kickAngle;
    drawingCtx.rotate(rotation);

    if (shoeImg && shoeImg.complete) {
        // Dibuja el zapato compensando su centro para que el (0,0) sea la unión superior
        // AJUSTA el -15 y el 0 según dónde esté el "enganche" en tu PNG del zapato
        drawingCtx.drawImage(shoeImg, -1, -2, 30, 20);
    } else {
        // Fallback zapato
        drawingCtx.fillStyle = "red";
        drawingCtx.fillRect(-10, 0, 20, 35);
    }
    drawingCtx.restore();

    // ---------------------------------------------------------
    // 3. DEBUG: DIBUJAR HITBOXES (Para que veas las colisiones)
    // ---------------------------------------------------------
    drawingCtx.lineWidth = 2;
    drawingCtx.strokeStyle = "#00ff00"; // Verde fosforito

    // Hitbox Rectangular (Cuerpo)
    drawingCtx.strokeRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);

    // Hitbox Circular (Cabeza) - Usa los mismos valores que en physics.js
    drawingCtx.beginPath();
    drawingCtx.arc(p.x, p.y - p.h / 2 - 18, 22, 0, Math.PI * 2);
    drawingCtx.stroke();

    // Punto de pivote de la cadera (Punto morado)
    drawingCtx.fillStyle = "magenta";
    drawingCtx.fillRect(p.x + hipOffsetX - 3, p.y + hipOffsetY - 3, 6, 6);
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