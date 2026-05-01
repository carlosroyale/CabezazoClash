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

function updateBall(ball, dt, W, FLOOR_Y) {
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
    if (ball.y + ball.r > FLOOR_Y) {
        // Solo suena si el bote es contundente (tiene velocidad vertical)
        if (ball.vy > 100) {
            window.playSound('sfx-rebound',0.5);
        }
        ball.y = FLOOR_Y - ball.r;
        ball.vy = -ball.vy * RESTITUTION;
        ball.vx *= FRICTION;
    }

    // Fórmula: Ángulo = (Velocidad * Tiempo) / Radio
    // Si está presionado contra la pared, bloqueamos la rotación horizontal
    if (!isTouchingWall) {
        ball.angle += (ball.vx * dt) / ball.r;
    }
}

function controlPlayer(p, dt, leftKey, rightKey, jumpKey, kickKey, keys) {
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

const BOT_AI_CONFIG = {
    REACTION_TIME: 0.18,
    APPROACH_DIST: 120,
    KICK_DIST: 90,
    KICK_COOLDOWN: 0.4,
    KICK_EXIT_DIST: 110
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
        const isOpponentNearOwnGoal = opponent ? opponent.x < bot.aiFieldWidth * 0.28 : false;
        const isOpponentDeepOnPlayerSide = opponent ? opponent.x < bot.aiFieldWidth * 0.28 : false;

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
            shouldJumpForHeader: ball.y < bot.y - bot.h * 0.3 &&
                distToBall < BOT_AI_CONFIG.APPROACH_DIST &&
                ball.vy > 0 &&
                ((ball.vx > 0 && bot.x > ball.x) || (ball.vx < 0 && bot.x < ball.x)),
            shouldJumpForShot: ball.y < bot.y - bot.h && distToBall < BOT_AI_CONFIG.APPROACH_DIST,
            // Opponent-aware logic
            isBallCloserToBot,
            isOpponentOnBotSide,
            isOpponentNearOwnGoal,
            isOpponentDeepOnPlayerSide,
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
        if (context.isBallDeepInOpponentGoalArea) {
            return bot.defendState;
        }

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
        if (context.isOpponentNearOwnGoal) {
            return bot.attackState;
        }

        // Si el bot esta mas cerca de la pelota -> ir a por ella
        if (context.isBallCloserToBot) {
            return bot.attackState;
        }

        // sino -> defender
        return bot.defendState;
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

    static recoverKick(bot, dt) {
        bot.isKicking = false;

        if (bot.kickAngle > 0) {
            bot.kickAngle -= (bot.kickSpeed / 3) * dt;
            if (bot.kickAngle < 0) bot.kickAngle = 0;
        }
    }

    static refreshFrameState(bot, ball, dt) {
        if (bot.kickCooldown > 0) {
            bot.kickCooldown -= dt;
        }

        const distFromLastKick = Math.hypot(ball.x - bot.lastKickBallX, ball.y - bot.lastKickBallY);
        if (!bot.ballEscaped && distFromLastKick > BOT_AI_CONFIG.KICK_EXIT_DIST) {
            bot.ballEscaped = true;
        }

        if (bot.onGround && !bot.groundedByPlayer) {
            bot.canJump = true;
        }
    }

    static tryJump(bot) {
        // Prevent jumping during serve phase (either chasing own serve or opponent serve pressure)
        if (bot.isServeChasing || bot.opponentServing) return false;
        if (!bot.onGround || bot.groundedByPlayer || !bot.canJump) return false;

        bot.vy = -bot.jump;
        bot.onGround = false;
        bot.groundedByPlayer = false;
        bot.canJump = false;
        window.playSound('sfx-jump');
        return true;
    }

    static handleKickLogic(bot, ball, dt, context) {
        const canKick = bot.kickCooldown <= 0 && bot.ballEscaped;
        const wantsToKick = context.distToBallFull < BOT_AI_CONFIG.KICK_DIST && !context.ballGoingWrong;

        if (!wantsToKick || !canKick) {
            BotAIUtils.recoverKick(bot, dt);
            return;
        }

        bot.isKicking = true;
        bot.kickAngle += bot.kickSpeed * dt;

        if (bot.kickAngle >= bot.maxKickAngle) {
            bot.kickAngle = bot.maxKickAngle;
            bot.kickCooldown = BOT_AI_CONFIG.KICK_COOLDOWN;
            bot.lastKickBallX = ball.x;
            bot.lastKickBallY = ball.y;
            bot.ballEscaped = false;
        }
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
            BotAIUtils.recoverKick(bot, dt);
            return;
        }

        BotAIUtils.moveTowards(bot, bot.aiFieldWidth - 180, dt);
        BotAIUtils.recoverKick(bot, dt);
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
        const W = bot.aiFieldWidth;

        // La pelota esta detras del bot (entre el bot y su porteria)
        const ballIsBehind = ball.x > bot.x + 30;

        let targetX;

        if (ballIsBehind) {
            // Pasar por detrás: ir a la derecha de la pelota para tenerla frente
            targetX = ball.x + 60;
        } else if (Math.abs(bot.x - ball.x) < 60 && Math.abs(ball.vx) < 80) {
            // Controlando la pelota -> atacar porteria contraria
            targetX = 20;
        } else {
            // Aproximacion normal: colocarse ligeramente detras de la pelota
            targetX = ball.x - 25;
        }

        BotAIUtils.moveTowards(bot, targetX, dt);

        if (context.shouldJumpForHeader || context.shouldJumpForShot) {
            BotAIUtils.tryJump(bot);
        }

        BotAIUtils.handleKickLogic(bot, ball, dt, context);
    }
}

class ServeState extends BotState {
    enter(bot) {
        bot.state = 'serve';
    }

    execute(bot, ball, dt, opponent) {
        const futureBall = BotAIUtils.predictBallPosition(ball);
        BotAIUtils.moveTowards(bot, futureBall.x, dt);
        BotAIUtils.recoverKick(bot, dt);
    }
}

class Bot {
    constructor(x, y, label, isRightFacing) {
        Object.assign(this, makePlayer(x, y, label, isRightFacing));

        this.aiFieldWidth = 0;
        this.aiFloorY = 0;
        this.isServeChasing = false;
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
        const desiredState = BotAIUtils.resolveState(this, ball, opponent);
        this.changeState(desiredState);

        this.currentState.execute(this, ball, dt, opponent);
    }
}

function controlBot(bot, dt, ball, W, FLOOR_Y, keys, opponent = null, serveChaseMode = false, opponentServeMode = false) {
    if (!(bot instanceof Bot)) return;

    bot.setArenaContext(W, FLOOR_Y);
    bot.isServeChasing = serveChaseMode;
    // Flag usable by AI to pressure when the opponent is serving
    bot.opponentServing = opponentServeMode;
    BotAIUtils.refreshFrameState(bot, ball, dt);
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
        controlPlayer,
        controlBot,
        clamp
    };
}