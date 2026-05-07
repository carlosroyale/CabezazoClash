// entities.js - Creación y lógica de Player, Ball y Bot

function makePlayer(x, y, label, isRightFacing) {
    return {
        label,
        x,
        y,
        prevX: x,
        prevY: y,
        w: 56,
        h: 90,
        vx: 0,
        vy: 0,
        speed: 420,
        jump: 760,
        onGround: false,
        groundedByPlayer: false,
        canJump: true,

        isRightFacing: isRightFacing, // true = mira a la derecha (P1), false = izquierda (P2)
        kickAngle: 0,                 // Ángulo actual de la pierna en radianes
        prevKickAngle: 0,             // Ángulo de la pierna antes del substep actual
        maxKickAngle: Math.PI / 1.8,  // Límite máximo (aprox 100 grados)
        kickSpeed: 16,                 // Velocidad a la que sube la pierna (radianes/segundo)
        justKicked: false,            // Interruptor que avisa que acaba de soltar la tecla
        kickForce: 0                  // Porcentaje de fuerza acumulada (0 a 1)
    };
}

function updatePlayer(p, dt, W, FLOOR_Y) {
    p.prevX = p.x;
    p.prevY = p.y;

    p.vy += GRAV * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // límites horizontales
    p.x = clamp(p.x, p.w / 2, W - p.w / 2);

    // suelo
    if (p.y + p.h / 2 >= FLOOR_Y) {
        if (!p.onGround && p.vy > 100) {
            window.playSound('sfx-land', 0.5);
        }
        p.y = FLOOR_Y - p.h / 2;
        p.vy = 0;
        p.onGround = true;
        p.groundedByPlayer = false;
    }
    else {
        p.onGround = false;
        p.groundedByPlayer = false;
    }
}

function canPlayBallReboundSound(ball, cooldownMs = 140) {
    const now = Date.now();
    if (ball._lastReboundSoundAt && now - ball._lastReboundSoundAt < cooldownMs) return false;

    ball._lastReboundSoundAt = now;
    return true;
}

function updateBall(ball, dt, W, FLOOR_Y) {
    ball.prevX = ball.x;
    ball.prevY = ball.y;
    ball.staticPrevX = ball.x;
    ball.staticPrevY = ball.y;

    ball.vy += GRAV * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // chivato para saber si toca la pared
    let isTouchingWall = false;

    // paredes
    if (ball.x - ball.r < 0) {
        ball.x = ball.r;
        ball.vx = -ball.vx * RESTITUTION;
        isTouchingWall = true; // Avisamos que está tocando
    }
    if (ball.x + ball.r > W) {
        ball.x = W - ball.r;
        ball.vx = -ball.vx * RESTITUTION;
        isTouchingWall = true; // Avisamos que está tocando
    }

    // techo
    if (ball.y - ball.r < 0) {
        ball.y = ball.r;
        ball.vy = -ball.vy * RESTITUTION;
    }

    // suelo
    // el suelo lo hacemos directamente en el bucle de game

    // Fórmula: Ángulo = (Velocidad * Tiempo) / Radio
    // Si está presionado contra la pared, bloqueamos la rotación horizontal
    if (!isTouchingWall) {
        ball.angle += (ball.vx * dt) / ball.r;
    }
}

function resolveBallFloor(ball, FLOOR_Y) {
    if (ball.y + ball.r > FLOOR_Y) {
        const floorImpactSpeed = ball.vy;

        // Solo suena si el bote es contundente (tiene velocidad vertical)
        if (floorImpactSpeed > 180 && canPlayBallReboundSound(ball)) {
            window.playSound('sfx-rebound',0.5);
        }
        ball.y = FLOOR_Y - ball.r;
        ball.vy = -ball.vy * RESTITUTION;
        ball.vx *= FRICTION;
    }
}

const RETURN_SHOE_LOCAL_CENTER_X = -3.5;
const RETURN_SHOE_LOCAL_CENTER_Y = 35;
const RETURN_SHOE_RADIUS = 14;
const RETURN_BALL_BLOCK_MARGIN = 1.5;
const KICK_ADVANCE_BLOCK_MARGIN = 1.5;
const CONTROL_KICK_SHOE_SEPARATION_ANGLE = 0.12;

/**
 * Calcula el centro físico del zapato para un ángulo concreto de pierna.
 *
 * Esta función replica la misma geometría que usa la física del zapato: el
 * centro local del zapato se rota alrededor del centro del jugador y se espeja
 * según el lado al que mira. Se usa aquí, en control de entrada, porque las
 * decisiones de "puede subir/bajar la pierna" ocurren antes del solver de
 * colisiones. Así podemos impedir que la animación de la pierna atraviese el
 * balón en vez de esperar a corregirlo cuando ya hay solapamiento.
 */
function getReturnShoeCenterAtAngle(p, kickAngle) {
    const localShoeX = p.isRightFacing ? RETURN_SHOE_LOCAL_CENTER_X : -RETURN_SHOE_LOCAL_CENTER_X;
    const localShoeY = RETURN_SHOE_LOCAL_CENTER_Y;
    const rot = p.isRightFacing ? -kickAngle : kickAngle;

    return {
        x: p.x + (localShoeX * Math.cos(rot) - localShoeY * Math.sin(rot)),
        y: p.y + (localShoeX * Math.sin(rot) + localShoeY * Math.cos(rot))
    };
}

/**
 * Bloquea el RETORNO de la pierna cuando el zapato tiene el balón debajo.
 *
 * Problema que evita:
 * - El jugador suelta la tecla de chute.
 * - La pierna empieza a bajar hacia reposo.
 * - Si hay un balón justo debajo, el zapato cinemático seguiría bajando aunque
 *   la pelota esté ocupando ese espacio.
 * - Visualmente parece que el zapato atraviesa el balón.
 *
 * La comprobación se hace mirando el siguiente ángulo posible:
 * - Solo actúa si el ángulo va a disminuir, es decir, la pierna vuelve.
 * - Solo actúa si el centro del zapato bajaría en pantalla.
 * - Solo actúa si el balón está por debajo del zapato actual.
 * - Solo bloquea si el siguiente centro del zapato invadiría el radio combinado
 *   zapato + balón, con un pequeño margen.
 */
function shouldBlockKickReturnOnBall(p, ball, nextKickAngle) {
    // Sin balón, sin pierna levantada o sin reducción real de ángulo no hay retorno que bloquear.
    if (!ball || p.kickAngle <= 0 || nextKickAngle >= p.kickAngle) return false;

    const currentShoe = getReturnShoeCenterAtAngle(p, p.kickAngle);
    const nextShoe = getReturnShoeCenterAtAngle(p, nextKickAngle);

    // En canvas, Y crece hacia abajo. Si el siguiente centro no baja, no es el caso problemático.
    if (nextShoe.y <= currentShoe.y) return false;

    // Esta protección solo aplica cuando el balón está debajo del zapato, no a contactos laterales o por arriba.
    if (ball.y < currentShoe.y) return false;

    const dx = ball.x - nextShoe.x;
    const dy = ball.y - nextShoe.y;
    const blockDist = (ball.r || 0) + RETURN_SHOE_RADIUS + RETURN_BALL_BLOCK_MARGIN;

    // Si el siguiente paso metería el zapato dentro del balón, no dejamos bajar la pierna este frame.
    return dx * dx + dy * dy < blockDist * blockDist;
}

/**
 * Devuelve el ángulo de retorno permitido para este frame.
 *
 * Normalmente reduce el ángulo a la velocidad de recuperación. Si el siguiente
 * paso atravesaría un balón colocado debajo del zapato, conserva el ángulo
 * actual y produce el efecto de que el pie se queda apoyado contra el balón.
 */
// function getKickReturnAngle(p, dt, ball) {
//     const nextKickAngle = Math.max(0, p.kickAngle - (p.kickSpeed / 3) * dt);
//     return shouldBlockKickReturnOnBall(p, ball, nextKickAngle) ? p.kickAngle : nextKickAngle;
// }
/**
 * Devuelve el ángulo de retorno permitido para este frame.
 * MODIFICADO: Quitamos el bloqueo para que la pierna baje siempre y
 * obligue al motor de físicas a escupir la pelota hacia los lados.
 */
function getKickReturnAngle(p, dt, ball) {
    // Calculamos el siguiente ángulo bajando la pierna
    const nextKickAngle = Math.max(0, p.kickAngle - (p.kickSpeed / 3) * dt);

    // Devolvemos el ángulo directamente, ignorando el bloqueo
    return nextKickAngle;
}
/**
 * Construye una versión mínima de las hitboxes del jugador para controles.
 *
 * No reutiliza directamente physics.js porque este archivo también se ejecuta
 * en Node desde Match.js, y aquí necesitamos decidir si la pierna puede avanzar
 * antes de que el solver de físicas resuelva colisiones. Las medidas coinciden
 * con las hitboxes principales: cuerpo, cabeza, pie de apoyo y zapato de chute.
 */
function getControlHitboxesAt(player, kickAngle = player.kickAngle) {
    const bodyW = player.w - 28;
    const bodyH = player.h - 55;
    const bodyY = player.y + 10;
    const bodyX = player.x - 5;
    const rectX = player.isRightFacing ? bodyX - bodyW / 2 : bodyX - (bodyW / 2) + 10;

    return {
        body: { x: rectX, y: bodyY - bodyH / 2, w: bodyW, h: bodyH },
        head: { x: bodyX + 4, y: bodyY - bodyH, r: 21 },
        supportShoe: { ...getReturnShoeCenterAtAngle(player, 0), r: RETURN_SHOE_RADIUS },
        shoe: { ...getReturnShoeCenterAtAngle(player, kickAngle), r: RETURN_SHOE_RADIUS },
        kickShoeSeparated: kickAngle > CONTROL_KICK_SHOE_SEPARATION_ANGLE
    };
}

/**
 * Detecta si un rectángulo está bloqueando el balón por arriba.
 *
 * Se usa para saber si el balón no tiene salida vertical cuando el zapato de
 * chute intenta subir desde abajo. dy > 0 significa que el centro del balón está
 * por debajo del punto más cercano del rectángulo, por tanto el obstáculo está
 * por encima del balón.
 */
function isBallBlockedAboveByRect(ball, rect) {
    const closestX = clamp(ball.x, rect.x, rect.x + rect.w);
    const closestY = clamp(ball.y, rect.y, rect.y + rect.h);
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;

    return dy > 0 && dx * dx + dy * dy < ball.r * ball.r;
}

/**
 * Detecta si una hitbox circular está bloqueando el balón por arriba.
 *
 * Sirve para cabezas y zapatos. Igual que en el rectángulo, dy > 0 indica que
 * el centro del balón está por debajo del centro de la hitbox que lo solapa.
 */
function isBallBlockedAboveByCircle(ball, circle) {
    const dx = ball.x - circle.x;
    const dy = ball.y - circle.y;
    const radSum = ball.r + circle.r;

    return dy > 0 && dx * dx + dy * dy < radSum * radSum;
}

/**
 * Comprueba si el balón está pinzado por arriba por cualquier jugador.
 *
 * Esta es la condición que distingue un chute normal de un caso peligroso. Si
 * el balón puede escapar hacia arriba, dejamos que el zapato suba y el solver lo
 * impulse. Si ya hay cabeza, cuerpo o zapato encima, subir más el pie solo
 * comprimiría el balón y puede acabar en atravesamiento.
 *
 * El zapato de chute del propio atacante se ignora aquí para no contarse a sí
 * mismo como obstáculo superior. El zapato de chute del rival sí puede bloquear.
 */
function isBallBlockedAbove(ball, players = [], attacker = null) {
    if (!ball || !Array.isArray(players)) return false;

    for (const player of players) {
        if (!player) continue;

        const h = getControlHitboxesAt(player);
        if (isBallBlockedAboveByRect(ball, h.body)) return true;
        if (isBallBlockedAboveByCircle(ball, h.head)) return true;
        if (isBallBlockedAboveByCircle(ball, h.supportShoe)) return true;
        if (player !== attacker && h.kickShoeSeparated && isBallBlockedAboveByCircle(ball, h.shoe)) return true;
    }

    return false;
}

/**
 * Bloquea la SUBIDA de la pierna cuando el balón está pinzado por arriba.
 *
 * Problema que evita:
 * - El jugador pulsa chute y el zapato sube desde abajo.
 * - El balón tiene una cabeza, cuerpo o zapato encima, así que no puede salir en
 *   la dirección opuesta al impacto.
 * - Como el zapato es cinemático, seguiría subiendo dentro del balón y parecería
 *   que lo atraviesa.
 *
 * Para no matar chutes normales, el bloqueo solo se activa cuando:
 * - El balón está realmente bloqueado por arriba.
 * - El siguiente paso del zapato sube en pantalla.
 * - El balón está por encima del zapato actual.
 * - El siguiente paso acercaría más el zapato al balón y entraría en su radio.
 */
function shouldBlockKickAdvanceOnPinnedBall(p, ball, nextKickAngle, players) {
    // Sin balón, sin aumento real de ángulo o sin obstáculo superior, el chute avanza normal.
    if (!ball || nextKickAngle <= p.kickAngle || !isBallBlockedAbove(ball, players, p)) return false;

    const currentShoe = getReturnShoeCenterAtAngle(p, p.kickAngle);
    const nextShoe = getReturnShoeCenterAtAngle(p, nextKickAngle);

    // En canvas, subir significa que Y disminuye. Si no sube, este no es el caso de chute desde abajo.
    if (nextShoe.y >= currentShoe.y) return false;

    // Esta protección solo aplica cuando el balón está encima del zapato de chute.
    if (ball.y > currentShoe.y) return false;

    const currentDx = ball.x - currentShoe.x;
    const currentDy = ball.y - currentShoe.y;
    const nextDx = ball.x - nextShoe.x;
    const nextDy = ball.y - nextShoe.y;
    const blockDist = (ball.r || 0) + RETURN_SHOE_RADIUS + KICK_ADVANCE_BLOCK_MARGIN;
    const nextDist2 = nextDx * nextDx + nextDy * nextDy;

    if (nextDist2 >= blockDist * blockDist) return false;

    const currentDist2 = currentDx * currentDx + currentDy * currentDy;

    // Solo bloqueamos si el siguiente paso mete el zapato más dentro del balón que el estado actual.
    return nextDist2 < currentDist2;
}

/**
 * Devuelve el ángulo de avance permitido para este frame de chute.
 *
 * Normalmente aumenta el ángulo hasta el máximo. Si el balón está pinzado por
 * arriba y el siguiente paso del zapato lo atravesaría, conserva el ángulo
 * actual para que el pie se quede detenido contra el balón.
 */
function getKickAdvanceAngle(p, dt, ball, players) {
    const nextKickAngle = Math.min(p.maxKickAngle, p.kickAngle + p.kickSpeed * dt);
    return shouldBlockKickAdvanceOnPinnedBall(p, ball, nextKickAngle, players) ? p.kickAngle : nextKickAngle;
}

function controlPlayer(p, dt, leftKey, rightKey, jumpKey, kickKey, keys, ball = null, players = []) {
    p.prevKickAngle = p.kickAngle;

    let dir = 0;
    if (keys.has(leftKey)) dir -= 1;
    if (keys.has(rightKey)) dir += 1;

    p.vx = dir * p.speed;

    // Permite saltar de nuevo nada más tocar el suelo aunque la tecla siga pulsada.
    if (keys.has(jumpKey) && p.onGround && !p.groundedByPlayer) {
        p.vy = -p.jump;
        p.onGround = false;
        p.groundedByPlayer = false;
        window.playSound('sfx-jump', 0.5);
    }

    // --- LÓGICA DE CARGA DE PIERNA ---
    if (keys.has(kickKey)) {
        // Sumamos el tiempo que lleva pulsada la tecla
        p.kickHoldTime = (p.kickHoldTime || 0) + dt;

        // Si lleva 3 segundos o menos, la pierna funciona normal
        if (p.kickHoldTime <= 3) {
            p.isKicking = true;
            p.kickAngle = getKickAdvanceAngle(p, dt, ball, players);
        } else {
            // Si supera los 3 segundos, se "cansa" y la pierna baja obligatoriamente
            p.isKicking = false;
            if (p.kickAngle > 0) {
                p.kickAngle = getKickReturnAngle(p, dt, ball);
            }
        }
    }
    else {
        // Al soltar la tecla, reseteamos el tiempo para que pueda volver a chutar
        p.kickHoldTime = 0;
        p.isKicking = false;

        // RETORNO PROGRESIVO DE LA PIERNA
        if (p.kickAngle > 0) {
            p.kickAngle = getKickReturnAngle(p, dt, ball);
        }
    }
}

const BOT_AI_CONFIG = {
    REACTION_TIME: 0.18,
    APPROACH_DIST: 120,
    KICK_DIST: 90,
    KICK_COOLDOWN: 0.4,
    KICK_EXIT_DIST: 110,
    MAX_NO_TOUCH_TIME_WHEN_LOSING: 3,
    OPPONENT_FAR_FROM_BALL_RATIO: 0.25,
    BLOCKED_ATTACK_MIN_INTENDED_SPEED: 180,
    BLOCKED_ATTACK_MAX_REAL_SPEED_RATIO: 0.35,
    BLOCKED_ATTACK_OPPONENT_DIST: 95,
    BLOCKED_ATTACK_TIME: 0.18,
    BLOCKED_ATTACK_JUMP_COOLDOWN: 0.75,
    BEHIND_RECOVERY_ENTER: 35,
    BEHIND_RECOVERY_OFFSET: 110,
    BEHIND_RECOVERY_CLEARANCE: 45,
    BEHIND_RECOVERY_JUMP_DIST: 130,
    BEHIND_RECOVERY_LOW_BALL_HEIGHT: 105,
    HEADER_SETUP_X_RANGE: 85,
    HEADER_SETUP_BACKSTEP_OFFSET: 52,
    HEADER_SETUP_READY_OFFSET: 28,
    HEADER_SETUP_LOW_TOWARDS_SPEED: 160,
    HEADER_SETUP_MIN_HEIGHT: 24,
    HEADER_SETUP_MAX_HEIGHT: 260,
    HEADER_SETUP_JUMP_DIST: 115,
    JUMP_HEADER_MIN_HEIGHT: 65,
    JUMP_HEADER_MAX_HEIGHT: 230
};

class BotState {
    enter(bot) {}
    execute(bot, ball, dt) {}
    exit(bot) {}
}

class BotAIUtils {
    static predictBallPosition(ball) {
        return {
            x: ball.x + ball.vx * BOT_AI_CONFIG.REACTION_TIME,
            y: ball.y + ball.vy * BOT_AI_CONFIG.REACTION_TIME
        };
    }

    static buildContext(bot, ball, opponent) {
        const futureBall = BotAIUtils.predictBallPosition(ball);
        const distToBall = Math.abs(bot.x - ball.x);
        const distToBallFull = Math.hypot(bot.x - ball.x, bot.y - ball.y);
        const botSideLine = bot.aiFieldWidth * 0.52;
        const playerSideLine = bot.aiFieldWidth * 0.48;
        const opponentGoalLine = bot.aiFieldWidth * 0.12;

        // Opponent awareness
        const distOpponentToBall = opponent ? Math.hypot(opponent.x - ball.x, opponent.y - ball.y) : Infinity;
        const isBallCloserToBot = distToBallFull < distOpponentToBall;
        const isOpponentOnBotSide = opponent ? opponent.x > botSideLine : false;
        const isBotOnOpponentSide = bot.x < bot.aiFieldWidth * 0.52;        const isOpponentNearOwnGoal = opponent ? opponent.x < bot.aiFieldWidth * 0.28 : false;
        const isOpponentDeepOnPlayerSide = opponent ? opponent.x < bot.aiFieldWidth * 0.28 : false;
        const isOpponentFarFromBall = distOpponentToBall > bot.aiFieldWidth * BOT_AI_CONFIG.OPPONENT_FAR_FROM_BALL_RATIO;
        const ballHeightAboveBot = bot.y - ball.y;
        const ballIsJumpHeaderHeight =
            ballHeightAboveBot > BOT_AI_CONFIG.JUMP_HEADER_MIN_HEIGHT &&
            ballHeightAboveBot < BOT_AI_CONFIG.JUMP_HEADER_MAX_HEIGHT;

        return {
            futureBall,
            distToBall,
            distToBallFull,
            isBallOnBotSide: ball.x > botSideLine,
            isBallOnPlayerSide: ball.x < playerSideLine,
            isBallDeepInOpponentGoalArea: ball.x < opponentGoalLine,
            isBallFarFromBot: ball.x < bot.aiFieldWidth * 0.35,
            ballThreatensGoal: ball.x > bot.aiFieldWidth * 0.75 && Math.abs(ball.vx) > 50,
            ballGoingWrong: ball.vx < -200,
            shouldJumpForHeader: ballIsJumpHeaderHeight &&
                distToBall < BOT_AI_CONFIG.APPROACH_DIST &&
                ball.vy > 0 &&
                ((ball.vx > 0 && bot.x > ball.x) || (ball.vx < 0 && bot.x < ball.x)),
            shouldJumpForShot: ballIsJumpHeaderHeight && distToBall < BOT_AI_CONFIG.APPROACH_DIST,
            // Opponent-aware logic
            isBallCloserToBot,
            isOpponentOnBotSide,
            isBotOnOpponentSide,
            isOpponentNearOwnGoal,
            isOpponentDeepOnPlayerSide,
            isOpponentFarFromBall,
            distOpponentToBall
        };
    }

    static resolveState(bot, ball, opponent) {
        if (bot.isServeChasing) {
            return bot.serveState;
        }

        const context = BotAIUtils.buildContext(bot, ball, opponent);

        // Servicio rival -> presion
        if (bot.opponentServing) {
            return bot.attackState;
        }

        // Pelota en la porteria rival -> no perseguir
        // if (context.isBallDeepInOpponentGoalArea) {
        //     return bot.defendState;
        // }

        // Pelota en mi campo -> siempre atacar
        if (context.isBallOnBotSide) {
            return bot.attackState;
        }

        // Si esta al centro y nadie va -> ir a por ella
        const ballIsNeutral =
            ball.x > bot.aiFieldWidth * 0.4 &&
            ball.x < bot.aiFieldWidth * 0.6;

        if (ballIsNeutral && context.isBallCloserToBot) {
            return bot.attackState;
        }

        // Si el jugador esta muy atras -> atacar
        if (context.isOpponentNearOwnGoal && context.isBotOnOpponentSide) {
            return bot.attackState;
        }

        // Si el jugador tiene la pelota lejos -> atacar
        if (context.isOpponentFarFromBall) {
            return bot.attackState;
        }

        // Si el bot esta mas cerca de la pelota -> ir a por ella
        if (context.isBallCloserToBot) {
            return bot.attackState;
        }

        // sino -> defender
        return bot.defendState;
    }

    static applyLosingNoTouchLimit(bot, desiredState, dt) {
        const touchedBall = bot.touchedBallSinceLastAI === true || bot.isTouchingBall === true;

        if (!bot.isLosing) {
            bot.losingNoTouchTimer = 0;
            bot.losingForcedAttackUntilTouch = false;
            bot.touchedBallSinceLastAI = false;
            return desiredState;
        }

        if (touchedBall) {
            bot.losingNoTouchTimer = 0;
            bot.losingForcedAttackUntilTouch = false;
            bot.touchedBallSinceLastAI = false;
            return desiredState;
        }

        if (bot.losingForcedAttackUntilTouch) {
            return bot.attackState;
        }

        bot.losingNoTouchTimer += dt;
        if (bot.losingNoTouchTimer >= BOT_AI_CONFIG.MAX_NO_TOUCH_TIME_WHEN_LOSING) {
            bot.losingForcedAttackUntilTouch = true;
            return bot.attackState;
        }

        return desiredState;
    }

    static moveTowards(bot, targetX, dt) {
        const dx = targetX - bot.x;
        const absDx = Math.abs(dx);

        if (absDx > 40) {
            const targetVx = Math.sign(dx) * bot.speed * 0.9;
            bot.vx += (targetVx - bot.vx) * Math.min(1, dt * 6);
        } else if (absDx > 15) {
            const targetVx = (dx / 40) * bot.speed * 0.9;
            bot.vx += (targetVx - bot.vx) * Math.min(1, dt * 8);
        } else {
            bot.vx += (0 - bot.vx) * Math.min(1, dt * 8);
        }
    }

    static recoverKick(bot, dt, ball = null) {
        bot.isKicking = false;

        if (bot.kickAngle > 0) {
            bot.kickAngle = getKickReturnAngle(bot, dt, ball);
        }
    }

    static refreshFrameState(bot, ball, dt, opponent) {
        if (bot.kickCooldown > 0) {
            bot.kickCooldown -= dt;
        }

        if (bot.blockedAttackJumpCooldown > 0) {
            bot.blockedAttackJumpCooldown -= dt;
        }

        const distFromLastKick = Math.hypot(ball.x - bot.lastKickBallX, ball.y - bot.lastKickBallY);
        if (!bot.ballEscaped && distFromLastKick > BOT_AI_CONFIG.KICK_EXIT_DIST) {
            bot.ballEscaped = true;
        }

        if (bot.onGround && !bot.groundedByPlayer) {
            bot.canJump = true;
        }

        const ballSpeed = Math.hypot(ball.vx || 0, ball.vy || 0);
        const opponentSpeed = opponent ? Math.hypot(opponent.vx || 0, opponent.vy || 0) : Infinity;
        const opponentBallDist = opponent ? Math.hypot(opponent.x - ball.x, opponent.y - ball.y) : Infinity;
    }

    static tryJump(bot, allowGroundedByPlayer = false) {
        // Prevent jumping during serve phase (either chasing own serve or opponent serve pressure)
        if (bot.isServeChasing || bot.opponentServing) return false;
        if (!bot.onGround || (!allowGroundedByPlayer && bot.groundedByPlayer) || !bot.canJump) return false;

        bot.vy = -bot.jump;
        bot.onGround = false;
        bot.groundedByPlayer = false;
        bot.canJump = false;
        window.playSound('sfx-jump');
        return true;
    }

    static tryJumpIfBlockedInAttack(bot, targetX, opponent, dt) {
        const targetDir = Math.sign(targetX - bot.x);
        const opponentDir = opponent ? Math.sign(opponent.x - bot.x) : 0;
        const intendedSpeed = Math.abs(bot.vx || 0);
        const realSpeedTowardsTarget = (bot.realVx || 0) * targetDir;
        const opponentAhead =
            opponent &&
            targetDir !== 0 &&
            opponentDir === targetDir &&
            Math.abs(opponent.x - bot.x) < BOT_AI_CONFIG.BLOCKED_ATTACK_OPPONENT_DIST &&
            Math.abs(opponent.y - bot.y) < bot.h;
        const touchingRival =
            bot.isTouchingRival === true ||
            bot.wasTouchingRival === true;
        const touchingRivalAhead =
            opponent &&
            touchingRival &&
            targetDir !== 0 &&
            opponentDir === targetDir &&
            Math.abs(opponent.y - bot.y) < bot.h;

        const blockedByOpponent = opponentAhead || touchingRivalAhead;

        const slowedDown =
            intendedSpeed >= BOT_AI_CONFIG.BLOCKED_ATTACK_MIN_INTENDED_SPEED &&
            realSpeedTowardsTarget < intendedSpeed * BOT_AI_CONFIG.BLOCKED_ATTACK_MAX_REAL_SPEED_RATIO;
        const blockedMovement = slowedDown || touchingRivalAhead;

        if (!blockedByOpponent || !blockedMovement || bot.blockedAttackJumpCooldown > 0) {
            bot.blockedAttackTimer = 0;
            return false;
        }

        bot.blockedAttackTimer = (bot.blockedAttackTimer || 0) + dt;
        if (bot.blockedAttackTimer < BOT_AI_CONFIG.BLOCKED_ATTACK_TIME) {
            return false;
        }

        bot.blockedAttackTimer = 0;
        if (!BotAIUtils.tryJump(bot, touchingRivalAhead)) return false;

        bot.blockedAttackJumpCooldown = BOT_AI_CONFIG.BLOCKED_ATTACK_JUMP_COOLDOWN;
        return true;
    }

    static handleKickLogic(bot, ball, dt, context, opponent = null) {
        const canKick = bot.kickCooldown <= 0 && bot.ballEscaped;
        const wantsToKick = context.distToBallFull < BOT_AI_CONFIG.KICK_DIST && !context.ballGoingWrong;

        if (!wantsToKick || !canKick) {
            BotAIUtils.recoverKick(bot, dt, ball);
            return;
        }

        bot.isKicking = true;
        bot.kickAngle = getKickAdvanceAngle(bot, dt, ball, [bot, opponent]);

        if (bot.kickAngle >= bot.maxKickAngle) {
            bot.kickAngle = bot.maxKickAngle;
            bot.kickCooldown = BOT_AI_CONFIG.KICK_COOLDOWN;
            bot.lastKickBallX = ball.x;
            bot.lastKickBallY = ball.y;
            bot.ballEscaped = false;
        }
    }

    static shouldPrepareForwardHeader(bot, ball) {
        const relX = ball.x - bot.x;
        const ballHeightAboveBot = bot.y - ball.y;
        const ballIsHeaderHeight =
            ballHeightAboveBot > BOT_AI_CONFIG.HEADER_SETUP_MIN_HEIGHT &&
            ballHeightAboveBot < BOT_AI_CONFIG.HEADER_SETUP_MAX_HEIGHT;

        return (
            ballIsHeaderHeight &&
            Math.abs(relX) < BOT_AI_CONFIG.HEADER_SETUP_X_RANGE &&
            relX <= BOT_AI_CONFIG.BEHIND_RECOVERY_ENTER &&
            ball.vy > -120 &&
            ball.vx < BOT_AI_CONFIG.HEADER_SETUP_LOW_TOWARDS_SPEED
        );
    }
}

class DefendState extends BotState {
    enter(bot) {
        bot.state = 'defend';
    }

    execute(bot, ball, dt, opponent) {
        // If opponent is serving, apply light pressure towards the ball
        if (bot.opponentServing) {
            // Stay offset from the ball so we don't sit on top of it or shove the player
            let offset = 40;
            let targetX = ball.x - Math.sign(ball.x - bot.x) * offset;
            // Keep inside field bounds and avoid coming too close to opponent
            targetX = clamp(targetX, 20, bot.aiFieldWidth - 60);
            if (opponent && Math.abs(opponent.x - targetX) < 50) {
                // move slightly away from opponent
                targetX += Math.sign(targetX - opponent.x) * 60;
                targetX = clamp(targetX, 20, bot.aiFieldWidth - 60);
            }
            BotAIUtils.moveTowards(bot, targetX, dt);
            BotAIUtils.recoverKick(bot, dt, ball);
            return;
        }

        BotAIUtils.moveTowards(bot, bot.aiFieldWidth - 180, dt);
        BotAIUtils.recoverKick(bot, dt, ball);
    }
}

class AttackState extends BotState {
    enter(bot) {
        bot.state = 'attack';
    }

    execute(bot, ball, dt, opponent) {
        if (bot.isServeChasing) {
            bot.changeState(bot.serveState);
            return;
        }
        const context = BotAIUtils.buildContext(bot, ball, opponent);

        // La pelota esta detras del bot solo si queda claramente hacia su porteria.
        // Una pelota justo delante no debe activar saltos de recolocacion.
        const ballClearlyBehind = ball.x > bot.x + BOT_AI_CONFIG.BEHIND_RECOVERY_ENTER;
        if (ballClearlyBehind) {
            bot.recoveringBehindBall = true;
        } else if (bot.x > ball.x + BOT_AI_CONFIG.BEHIND_RECOVERY_CLEARANCE) {
            bot.recoveringBehindBall = false;
        }

        let targetX;

        if (bot.recoveringBehindBall) {
            targetX = clamp(
                ball.x + BOT_AI_CONFIG.BEHIND_RECOVERY_OFFSET,
                bot.w / 2,
                bot.aiFieldWidth - bot.w / 2
            );

            const distToBall = Math.abs(bot.x - ball.x);
            const stillOnWrongSide = bot.x < ball.x + BOT_AI_CONFIG.BEHIND_RECOVERY_CLEARANCE;
            const ballIsLow = ball.y > bot.aiFloorY - BOT_AI_CONFIG.BEHIND_RECOVERY_LOW_BALL_HEIGHT;
            if (
                ballClearlyBehind &&
                ballIsLow &&
                stillOnWrongSide &&
                bot.onGround &&
                bot.canJump &&
                distToBall < BOT_AI_CONFIG.BEHIND_RECOVERY_JUMP_DIST
            ) {
                bot.vy = -bot.jump;
                bot.vx = bot.speed * 0.95;
                bot.onGround = false;
                bot.canJump = false;
                window.playSound('sfx-jump', 0.5);
            }

            BotAIUtils.moveTowards(bot, targetX, dt);
            BotAIUtils.tryJumpIfBlockedInAttack(bot, targetX, opponent, dt);
            BotAIUtils.recoverKick(bot, dt, ball);
            return;
        } else if (BotAIUtils.shouldPrepareForwardHeader(bot, ball)) {
            targetX = clamp(
                ball.x + BOT_AI_CONFIG.HEADER_SETUP_BACKSTEP_OFFSET,
                bot.w / 2,
                bot.aiFieldWidth - bot.w / 2
            );

            BotAIUtils.moveTowards(bot, targetX, dt);
            BotAIUtils.tryJumpIfBlockedInAttack(bot, targetX, opponent, dt);
            BotAIUtils.recoverKick(bot, dt, ball);

            const headerOffset = bot.x - ball.x;
            const readyToHeadForward =
                headerOffset >= BOT_AI_CONFIG.HEADER_SETUP_READY_OFFSET &&
                headerOffset < BOT_AI_CONFIG.HEADER_SETUP_JUMP_DIST;

            if (readyToHeadForward && bot.onGround && bot.canJump) {
                BotAIUtils.tryJump(bot);
            }

            return;
        } else if (Math.abs(bot.x - ball.x) < 60 && Math.abs(ball.vx) < 80) {
            // Controlando la pelota -> atacar porteria contraria
            targetX = 20;
        } else {
            // Aproximacion normal: colocarse ligeramente detras de la pelota
            targetX = ball.x - 25;
        }

        BotAIUtils.moveTowards(bot, targetX, dt);
        BotAIUtils.tryJumpIfBlockedInAttack(bot, targetX, opponent, dt);

        if (context.shouldJumpForHeader || context.shouldJumpForShot) {
            BotAIUtils.tryJump(bot);
        }

        BotAIUtils.handleKickLogic(bot, ball, dt, context, opponent);
    }
}

class ServeState extends BotState {
    enter(bot) {
        bot.state = 'serve';
    }

    execute(bot, ball, dt, opponent) {
        const futureBall = BotAIUtils.predictBallPosition(ball);
        BotAIUtils.moveTowards(bot, futureBall.x, dt);
        BotAIUtils.recoverKick(bot, dt, ball);
    }
}

class Bot {
    constructor(x, y, label, isRightFacing) {
        Object.assign(this, makePlayer(x, y, label, isRightFacing));

        this.aiFieldWidth = 0;
        this.aiFloorY = 0;
        this.isServeChasing = false;
        this.isLosing = false;
        this.losingNoTouchTimer = 0;
        this.losingForcedAttackUntilTouch = false;
        this.touchedBallSinceLastAI = false;
        this.blockedAttackTimer = 0;
        this.blockedAttackJumpCooldown = 0;
        this.recoveringBehindBall = false;
        this.kickCooldown = 0;
        this.lastKickBallX = x;
        this.lastKickBallY = y;
        this.ballEscaped = true;

        this.defendState = new DefendState();
        this.attackState = new AttackState();
        this.serveState = new ServeState();
        this.currentState = null;

        this.changeState(this.defendState);
    }

    setArenaContext(W, FLOOR_Y) {
        this.aiFieldWidth = W;
        this.aiFloorY = FLOOR_Y;
    }

    resetAI(ball) {
        this.kickCooldown = 0;
        this.lastKickBallX = ball ? ball.x : this.x;
        this.lastKickBallY = ball ? ball.y : this.y;
        this.ballEscaped = true;
        this.isServeChasing = false;
        this.isLosing = false;
        this.losingNoTouchTimer = 0;
        this.losingForcedAttackUntilTouch = false;
        this.touchedBallSinceLastAI = false;
        this.isTouchingBall = false;
        this.blockedAttackTimer = 0;
        this.blockedAttackJumpCooldown = 0;
        this.recoveringBehindBall = false;
        this.isKicking = false;

        if (this.currentState) {
            this.currentState.exit(this);
        }

        this.currentState = null;
        this.changeState(this.defendState);
    }

    changeState(newState) {
        if (!newState || this.currentState === newState) return;

        if (this.currentState) {
            this.currentState.exit(this);
        }

        this.currentState = newState;
        this.currentState.enter(this);
    }

    update(ball, dt, opponent) {
        const desiredState = BotAIUtils.applyLosingNoTouchLimit(
            this,
            BotAIUtils.resolveState(this, ball, opponent),
            dt
        );
        this.changeState(desiredState);

        this.currentState.execute(this, ball, dt, opponent);
    }
}

function controlBot(bot, dt, ball, W, FLOOR_Y, keys, opponent = null, serveChaseMode = false, opponentServeMode = false, botIsLosing = false) {
    if (!(bot instanceof Bot)) return;

    bot.prevKickAngle = bot.kickAngle;
    bot.setArenaContext(W, FLOOR_Y);
    bot.isServeChasing = serveChaseMode;
    // Flag usable by AI to pressure when the opponent is serving
    bot.opponentServing = opponentServeMode;
    bot.isLosing = botIsLosing;
    BotAIUtils.refreshFrameState(bot, ball, dt, opponent);
    bot.update(ball, dt, opponent);
}

// Función de utilidad para limitar un valor entre un mínimo y un máximo
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

// --- EXPORTACIÓN PARA NODE.JS ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        makePlayer,
        BotState,
        DefendState,
        AttackState,
        ServeState,
        BotAIUtils,
        Bot,
        updatePlayer,
        updateBall,
        resolveBallFloor,
        controlPlayer,
        controlBot,
        clamp
    };
}