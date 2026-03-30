// renderer.js - Todo lo relacionado con el Canvas y ctx

// Imagen fondo
const bgImage = new Image();
bgImage.src = 'assets/img/estadio.png';

const imgBall = new Image();
const svgBallString = `
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="-2500 -2500 5000 5000">
    <g stroke="#000" stroke-width="24">
        <circle fill="#fff" r="2376"/>
        <path fill="none" d="m-1643-1716 155 158m-550 2364c231 231 538 195 826 202m-524-2040c-491 351-610 1064-592 1060m1216-1008c-51 373 84 783 364 1220m-107-2289c157-157 466-267 873-329m-528 4112c-50 132-37 315-8 510m62-3883c282 32 792 74 1196 303m-404 2644c310 173 649 247 1060 180m-340-2008c-242 334-534 645-872 936m1109-2119c-111-207-296-375-499-534m1146 1281c100 3 197 44 290 141m-438 495c158 297 181 718 204 1140"/>
    </g>
    <path fill="#000" d="m-1624-1700c243-153 498-303 856-424 141 117 253 307 372 492-288 275-562 544-724 756-274-25-410-2-740-60 3-244 84-499 236-764zm2904-40c271 248 537 498 724 788-55 262-105 553-180 704-234-35-536-125-820-200-138-357-231-625-340-924 210-156 417-296 616-368zm-3273 3033a2376 2376 0 0 1-378-1392l59-7c54 342 124 674 311 928-36 179-2 323 51 458zm1197-1125c365 60 717 120 1060 180 106 333 120 667 156 1000-263 218-625 287-944 420-372-240-523-508-736-768 122-281 257-561 464-832zm3013 678a2376 2376 0 0 1-925 1147l-116-5c84-127 114-297 118-488 232-111 464-463 696-772 86 30 159 72 227 118zm-2287 1527a2376 2376 0 0 1-993-251c199 74 367 143 542 83 53 75 176 134 451 168z"/>
</svg>
`;
imgBall.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgBallString);

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
    }

    // 2. DIBUJAR PIERNA ROTADA
    drawingCtx.save();

    // Ponemos el pivote exactamente en el centro del jugador (0 de offset)
    let hipOffsetX = 0;
    let hipOffsetY = 0;

    // Movemos el origen de las coordenadas al centro del jugador
    drawingCtx.translate(p.x + hipOffsetX, p.y + hipOffsetY);

    // Si mira a la derecha rota en negativo (antihorario). Si mira a la izq, positivo.
    let rotation = p.isRightFacing ? -p.kickAngle : p.kickAngle;
    drawingCtx.rotate(rotation);

    if (shoeImg && shoeImg.complete) {
        // Como el (0,0) es la barriga, empujamos el zapato hacia abajo y a los lados
        let shoeDrawX = p.isRightFacing ? -21 : -13;
        let shoeDrawY = p.isRightFacing ? 25 : 25;

        drawingCtx.drawImage(shoeImg, shoeDrawX, shoeDrawY, 35, 20);
    }
    drawingCtx.restore();

    dibujarHitboxJugador(p);
}

function dibujarHitboxJugador(p) {
    drawingCtx.lineWidth = 2;
    drawingCtx.strokeStyle = "#00ff00"; // Verde fosforito

    // A. Hitbox Rectangular (Cuerpo)
    const bodyW = p.w - 28;
    const bodyH = p.h - 55;
    const bodyY = p.y + 10;
    const bodyX = p.x - 5;
    const rectX = p.isRightFacing ? bodyX - bodyW / 2 : bodyX - (bodyW / 2) + 10;

    drawingCtx.strokeRect(rectX, bodyY - bodyH / 2, bodyW, bodyH);

    // B. Hitbox Circular (Cabeza - Igual a physics.js)
    drawingCtx.beginPath();
    const centerX = bodyX + 4;
    const centerY = bodyY - bodyH;
    const headR = 21; // Mismo radio que en physics.js

    // Dibujamos el círculo
    drawingCtx.arc(centerX, centerY, headR, 0, Math.PI * 2);
    drawingCtx.stroke();


    // C. Hitbox Circular (Zapato rotatorio - Igual a physics.js)
    let shoeDrawX2 = p.isRightFacing ? -21 : -13;
    let shoeDrawY2 = p.isRightFacing ? 25 : 25;

    // Centro local del zapato (Ajustado para tu imagen de 35x20)
    const localShoeX = shoeDrawX2 + 17.5; // La mitad de 35
    const localShoeY = shoeDrawY2 + 10;   // La mitad de 20

    // Ángulo de rotación de la pierna
    const rot = p.isRightFacing ? -p.kickAngle : p.kickAngle;

    // Posición del centro en el mundo real
    const worldShoeX = bodyX + (localShoeX * Math.cos(rot) - localShoeY * Math.sin(rot)) + 3;
    const worldShoeY = p.y + (localShoeX * Math.sin(rot) + localShoeY * Math.cos(rot));

    // Dibujar el círculo
    drawingCtx.beginPath();
    const shoeR = 14; // Mismo radio que en physics.js

    drawingCtx.arc(worldShoeX, worldShoeY, shoeR, 0, Math.PI * 2);
    drawingCtx.stroke();

    // Punto de pivote de la barriga (Punto morado)
    drawingCtx.fillStyle = "magenta";
    const pivoteX = p.isRightFacing ? bodyX - 3 : bodyX + 7;
    drawingCtx.fillRect(pivoteX, p.y - 3, 6, 6);
}

function drawBall(ball) {
    if (imgBall && imgBall.complete) {
        drawingCtx.save(); // 1. Guardamos el estado del Canvas

        // 2. Movemos el punto (0,0) exactamente al centro de la pelota
        drawingCtx.translate(ball.x, ball.y);

        // 3. Rotamos el Canvas según el ángulo calculado en la física
        // (Si por algún motivo ball.angle no existiera, usa 0 por seguridad)
        drawingCtx.rotate(ball.angle || 0);

        const diameter = ball.r * 2;

        // 4. Dibujamos la imagen
        // Como el (0,0) ya es el centro, dibujamos desde la esquina superior izquierda
        // retrocediendo exactamente el valor del radio (-ball.r)
        drawingCtx.drawImage(
            imgBall,
            -ball.r, // Coordenada X local
            -ball.r, // Coordenada Y local
            diameter,
            diameter
        );

        drawingCtx.restore(); // 5. Devolvemos el Canvas a la normalidad
    }
    // ---------------------------------------------------------
    // 2. DEBUG: DIBUJAR HITBOX (Igual que en el jugador)
    // ---------------------------------------------------------
    // drawingCtx.beginPath();
    // // Dibujamos el círculo exacto de colisión
    // drawingCtx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    // drawingCtx.strokeStyle = "#00ff00"; // Verde fosforito
    // drawingCtx.lineWidth = 2;
    // drawingCtx.stroke();
    //
    // // Opcional: Dibujar el punto central exacto (Centro de masa)
    // drawingCtx.fillStyle = "magenta";
    // drawingCtx.fillRect(ball.x - 2, ball.y - 2, 4, 4);
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