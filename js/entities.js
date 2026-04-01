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
        canJump: true,

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
        if (!p.onGround && p.vy > 100) {
            window.playSound('sfx-land');
        }
        p.y = FLOOR_Y - p.h / 2;
        p.vy = 0;
        p.onGround = true;
    }
    else p.onGround = false;
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
        // Solo suena si el bote es contundente (evita zumbidos si va rodando)
        if (ball.vy > 80) {
            window.playSound('sfx-ball-grass');
        }
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

    // Si la tecla no está presionada, recargamos la capacidad de saltar
    if (!keys.has(jumpKey)) {
        p.canJump = true;
    }

    // Solo salta si tiene la tecla, está en el suelo, Y tiene el salto recargado
    if (keys.has(jumpKey) && p.onGround && p.canJump) {
        p.vy = -p.jump;
        p.onGround = false;
        window.playSound('sfx-jump');
    }

    // --- LÓGICA DE CARGA DE PIERNA ---
    if (keys.has(kickKey)) {
        p.isKicking = true;
        p.kickAngle += p.kickSpeed * dt;
        // Topar en el ángulo máximo
        if (p.kickAngle > p.maxKickAngle) p.kickAngle = p.maxKickAngle;
    }
    else {
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
    const REACTION_TIME  = 0.18;  // segundos de anticipación para predecir la posición futura de la pelota
    const APPROACH_DIST  = 120;   // distancia a partir de la cual el bot considera que la pelota está "cerca"
    const KICK_DIST      = 90;    // distancia entre el bot y la pelota para activar la patada (px)
    const KICK_COOLDOWN  = 0.4;   // segundos entre patadas, para evitar bucle infinito
    const KICK_EXIT_DIST = 110;   // distancia que la pelota debe alejarse del punto de la última patada para permitir otra patada (px)

    // === INICIALIZACIÓN DE VARIABLES DE ESTADO ===
    // Propiedades para gestionar el bot. El bot se crea con una estructura simple en makePlayer
    if (bot.kickCooldown  === undefined) bot.kickCooldown  = 0;      // tiempo restante para poder volver a patear
    if (bot.lastKickBallX === undefined) bot.lastKickBallX = ball.x; // posición X de la pelota en el momento de la última patada
    if (bot.lastKickBallY === undefined) bot.lastKickBallY = ball.y; // posición Y de la pelota en el momento de la última patada
    if (bot.ballEscaped   === undefined) bot.ballEscaped   = true;   // indicador de que la pelota se ha alejado lo suficiente desde la última patada para permitir otra

    // === 1. PREDICCIÓN DE BALÓN ===
    // El bot no reacciona a la posición actual de la pelota, sino que predice dónde estará dentro de un pequeño intervalo de tiempo (REACTION_TIME). 
    const futureX = ball.x + ball.vx * REACTION_TIME;
    const futureY = ball.y + ball.vy * REACTION_TIME;

    // === 2. ATACAR O DEFENDER ===
    // Si la pelota esta a su lado del campo, intenta atacarla. 
    // Si esta en el otro lado, intenta posicionarse para defender.
    const isBallOnBotSide = ball.x > W / 2;
    const distToBall      = Math.abs(bot.x - ball.x);

    let targetX;
    if (isBallOnBotSide || distToBall < APPROACH_DIST) {
        targetX = futureX; // atacar: ir hacia la posición futura de la pelota
    } else {
        targetX = W - 180; // defender: posición fija cerca de su portería
    }

    // === 3. MOVIMIENTO HORIZONTAL SUAVE ===
    // El bot ajusta su velocidad horizontal para moverse hacia targetX.
    // Hay tres rangos: lejos (velocidad máxima), cerca (velocidad reducida) y muy cerca (detenerse para no sobrepasar).
    const dx = targetX - bot.x;
    const absDx = Math.abs(dx);

    // bot.vx: velocidad actual del bot
    if (absDx > 40) {
        // Lejos: velocidad máxima hacia la posicion objetivo
        const targetVx = Math.sign(dx) * bot.speed * 0.9;
        bot.vx += (targetVx - bot.vx) * Math.min(1, dt * 8);
    } else if (absDx > 15) {
        // Cerca: velocidad reducida para evitar pasar por alto la posición objetivo
        const targetVx = (dx / 40) * bot.speed * 0.9;
        bot.vx += (targetVx - bot.vx) * Math.min(1, dt * 8);
    } else {
        // Muy cerca: detenerse para no sobrepasar la posición objetivo
        bot.vx += (0 - bot.vx) * Math.min(1, dt * 8);
    }

    // === 4. DECISIÓN DE SALTO ===
    /*
    El bot salta en dos casos principales relacionados con la pelota:
    1) Para cabecear: si la pelota está por encima de su cabeza, cerca, viniendo hacia él, y bajando
    2) Para disparar: si la pelota está muy alta (por ejemplo, un rebote alto)
    */
    const ballIsAboveBot    = ball.y < bot.y - bot.h * 0.3;                                       // balon claramente por encima de la cabeza del bot
    const ballIsClose       = distToBall < APPROACH_DIST;                                         // balon dentro del rango de ataque
    const ballComingTowards = (ball.vx > 0 && bot.x > ball.x) || (ball.vx < 0 && bot.x < ball.x); // balon se acerca al bot
    const ballFalling       = ball.vy > 0;                                                        // balon se mueve hacia abajo
    const ballIsVeryHigh    = ball.y < bot.y - bot.h;                                             // balon muy alto

    // 1) Para cabecear
    const shouldJumpForHeader = ballIsAboveBot && ballIsClose && ballFalling && ballComingTowards;
    // 2) Para disparar
    const shouldJumpForShot   = ballIsVeryHigh && ballIsClose;

    // Si se cumple alguna de las condiciones de salto, y el bot está en el suelo y tiene el salto recargado, entonces salta.
    if ((shouldJumpForHeader || shouldJumpForShot) && bot.onGround && bot.canJump) {
        bot.vy       = -bot.jump;
        bot.onGround = false;
        bot.canJump  = false; // evitar doble salto
        window.playSound('sfx-jump');
    }

    // Recargar salto cuando el bot esta en el suelo
    // Misma logica que para los jugadores humanos, para que el bot no pueda saltar de nuevo hasta que su pie toque el suelo
    if (!keys.has("ArrowUp") && bot.onGround) {
        bot.canJump = true;
    }

    // === 5. PATADA (evitar bucles) ===
    /* 
    Problema: la pelota se quedava pegada al bot y el bot la pateaba constantemente sin que esta se alejara, lo que resultaba en un bucle infinito de patadas.
    Solución: introducimos un cooldown entre patadas y una distancia mínima que la pelota debe alejarse del punto de la última patada para permitir otra.
    */

    // Reducir cooldown de patada
    if (bot.kickCooldown > 0) {
        bot.kickCooldown -= dt;
    }

    // Calcular la distancia desde la última patada
    const distFromLastKick = Math.hypot(ball.x - bot.lastKickBallX, ball.y - bot.lastKickBallY);
    if (!bot.ballEscaped && distFromLastKick > KICK_EXIT_DIST) {
        bot.ballEscaped = true;
    }

    // Condiciones de patada: el bot quiere patear, el cooldown ha terminado, y la pelota se ha alejado lo suficiente desde la última patada.
    const distToBallFull = Math.hypot(bot.x - ball.x, bot.y - ball.y);
    const canKick        = bot.kickCooldown <= 0 && bot.ballEscaped;
    const wantsToKick    = distToBallFull < KICK_DIST && isBallOnBotSide;

    if (wantsToKick && canKick) {
        // Activar patada
        bot.isKicking  = true;
        bot.kickAngle += bot.kickSpeed * dt;

        // Comprobar si se ha alcanzado el ángulo máximo de patada
        if (bot.kickAngle >= bot.maxKickAngle) {
            bot.kickAngle     = bot.maxKickAngle;
            bot.kickCooldown  = KICK_COOLDOWN;
            bot.lastKickBallX = ball.x;
            bot.lastKickBallY = ball.y;
            bot.ballEscaped   = false; // Ha de fugir abans de poder tornar a xutar
        }
    } else {
        // Sin patada: retorno progresivo de la pierna a reposo
        bot.isKicking = false;
        if (bot.kickAngle > 0) {
            bot.kickAngle -= (bot.kickSpeed / 3) * dt;
            if (bot.kickAngle < 0) bot.kickAngle = 0;
        }
    }
}

// Función de utilidad para limitar un valor entre un mínimo y un máximo
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}