// entities.js - Creación y lógica de Player, Ball y Bot

function makePlayer(x, y, label, isRightFacing) {
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
        onGround: false,

        isRightFacing: isRightFacing, // true = mira a la derecha (P1), false = izquierda (P2)
        kickAngle: 0,                 // Ángulo actual de la pierna en radianes
        maxKickAngle: Math.PI / 1.8,  // Límite máximo (aprox 100 grados)
        kickSpeed: 16,                 // Velocidad a la que sube la pierna (radianes/segundo)
        justKicked: false,            // Interruptor que avisa que acaba de soltar la tecla
        kickForce: 0                  // Porcentaje de fuerza acumulada (0 a 1)
    };
}

function updatePlayer(p, dt, W, FLOOR_Y) {
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

function updateBall(ball, dt, W, FLOOR_Y) {
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
    if (ball.y - ball.r < 0) {
        ball.y = ball.r;
        ball.vy = -ball.vy * RESTITUTION;
    }

    // suelo
    if (ball.y + ball.r > FLOOR_Y) {
        ball.y = FLOOR_Y - ball.r;
        ball.vy = -ball.vy * RESTITUTION;
        ball.vx *= FRICTION;
    }

    // Fórmula: Ángulo = (Velocidad * Tiempo) / Radio
    ball.angle += (ball.vx * dt) / ball.r;
}

function controlPlayer(p, dt, leftKey, rightKey, jumpKey, kickKey, keys) {
    let dir = 0;
    if (keys.has(leftKey)) dir -= 1;
    if (keys.has(rightKey)) dir += 1;

    p.vx = dir * p.speed;

    if (keys.has(jumpKey) && p.onGround) {
        p.vy = -p.jump;
        p.onGround = false;
    }

    // --- LÓGICA DE CARGA DE PIERNA ---
    if (keys.has(kickKey)) {
        p.isKicking = true;
        p.kickAngle += p.kickSpeed * dt;
        // Topar en el ángulo máximo
        if (p.kickAngle > p.maxKickAngle) p.kickAngle = p.maxKickAngle;
    }
    else {
        // Si suelta la tecla y estaba cargando, marcamos el flag para disparar
        if (p.isKicking) {
            p.kickForce = p.kickAngle / p.maxKickAngle; // Guarda un valor de 0.0 a 1.0
            p.justKicked = true;
        }
        p.isKicking = false;

        // RETORNO PROGRESIVO DE LA PIERNA
        if (p.kickAngle > 0) {
            // Dividimos por 3 para que baje el triple de lento de lo que subió
            p.kickAngle -= (p.kickSpeed / 3) * dt;

            // Si nos pasamos de cero, lo clavamos en cero para que no gire hacia atrás
            if (p.kickAngle < 0) {
                p.kickAngle = 0;
            }
        }
    }
}

function controlBot(bot, dt, ball, W, FLOOR_Y, keys) {
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
        Math.abs(ball.vx) < 200 ||
        Math.abs(ball.vy) < 200 ||
        distanceToBall < 250;            // o cercano

    const canAttack =
        isBallOnBotSide ||
        (isBallFree && isBallComing);

    if (canAttack) {
        // ATACAR: Ir hacia la pelota
        targetX = futureX;
    } else {
        // DEFENDER: Volver a la portería
        targetX = W - 180; // Posición defensiva
    }

    // === 4. MOVIMIENTO ===
    const dx = targetX - bot.x;
    const moveSpeed = bot.speed * maxSpeedFactor;
    if (Math.abs(dx) > 10) { // Umbral para evitar vibración
        bot.vx = Math.sign(dx) * Math.min(moveSpeed, Math.abs(dx) / dt);
    } else {
        bot.vx = 0;
    }

    // === 5. SALTO ===
    const shouldJump =
        (futureY > bot.y - bot.h / 2 && futureY < bot.y + bot.h / 2) || // Pelota a la altura del bot
        (bot.y > FLOOR_Y - 100 && Math.abs(dx) < 50); // Saltar para despejar

    if (shouldJump && bot.onGround) {
        bot.vy = -bot.jump;
        bot.onGround = false;
    }
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}