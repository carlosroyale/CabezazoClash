// physics.js - Detección de colisiones y límites

const GOAL_POST_SIZE = 8;
// 1. Helper para obtener las 3 hitboxes matemáticas (Idéntico a tu dibujarHitboxJvB)
function getPlayerHitboxes(p) {
    const bodyW = p.w - 28;
    const bodyH = p.h - 55;
    const bodyY = p.y + 10;
    const bodyX = p.x - 5;
    const rectX = p.isRightFacing ? bodyX - bodyW / 2 : bodyX - (bodyW / 2) + 10;

    const headX = bodyX + 4;
    const headY = bodyY - bodyH;
    const headR = 21;

    let shoeDrawX = p.isRightFacing ? -21 : -13;
    let shoeDrawY = p.isRightFacing ? 25 : 25;
    const localShoeX = shoeDrawX + 17.5;
    const localShoeY = shoeDrawY + 10;
    const rot = p.isRightFacing ? -p.kickAngle : p.kickAngle;

    const worldShoeX = bodyX + (localShoeX * Math.cos(rot) - localShoeY * Math.sin(rot)) + 3;
    const worldShoeY = p.y + (localShoeX * Math.sin(rot) + localShoeY * Math.cos(rot));
    const shoeR = 14;

    return {
        body: { x: rectX, y: bodyY - bodyH / 2, w: bodyW, h: bodyH },
        head: { x: headX, y: headY, r: headR },
        shoe: { x: worldShoeX, y: worldShoeY, r: shoeR }
    };
}

function arePlayersBackToBack(p1, p2) {
    const leftPlayer = p1.x < p2.x ? p1 : p2;
    const rightPlayer = p1.x < p2.x ? p2 : p1;

    return !leftPlayer.isRightFacing && rightPlayer.isRightFacing;
}

function isBackToBackBallSqueeze(ball, p1, p2) {
    if (!p1 || !p2 || !arePlayersBackToBack(p1, p2)) return false;

    const h1 = getPlayerHitboxes(p1);
    const h2 = getPlayerHitboxes(p2);
    const leftHitbox = p1.x < p2.x ? h1 : h2;
    const rightHitbox = p1.x < p2.x ? h2 : h1;

    const leftBodyRight = leftHitbox.body.x + leftHitbox.body.w;
    const rightBodyLeft = rightHitbox.body.x;
    const bodyGap = rightBodyLeft - leftBodyRight;
    const squeezeMargin = 8;
    const ballBetweenBacks = ball.x + ball.r > leftBodyRight - squeezeMargin &&
        ball.x - ball.r < rightBodyLeft + squeezeMargin;
    const ballInVerticalRange = ball.y + ball.r > Math.max(leftHitbox.body.y, rightHitbox.body.y) &&
        ball.y - ball.r < Math.min(leftHitbox.body.y + leftHitbox.body.h, rightHitbox.body.y + rightHitbox.body.h);

    return bodyGap < ball.r * 2 + 14 && ballBetweenBacks && ballInVerticalRange;
}

function collidePlayerBall(p, ball) {
    if (window.currentPlayers && isBackToBackBallSqueeze(ball, window.currentPlayers[0], window.currentPlayers[1])) {
        return;
    }

    // 1. Guardamos si ya estábamos tocando el balón en el fotograma anterior
    p.wasTouchingBall = p.isTouchingBall || false;

    // 2. Lo reseteamos. Si hay choque abajo, se volverá a poner en true.
    p.isTouchingBall = false;

    // 3. Obtenemos las hitboxes centralizadas con una sola línea de código
    const h = getPlayerHitboxes(p);

    // --- A. CHOQUE CON EL CUERPO (Rectángulo AABB) ---
    const closestX = clamp(ball.x, h.body.x, h.body.x + h.body.w);
    const closestY = clamp(ball.y, h.body.y, h.body.y + h.body.h);
    const dxBody = ball.x - closestX;
    const dyBody = ball.y - closestY;
    const dist2Body = dxBody * dxBody + dyBody * dyBody;

    if (dist2Body < ball.r * ball.r) {
        resolveCircleToRect(ball, p, dxBody, dyBody, dist2Body);
    }

    // --- B. CHOQUE CON LA CABEZA (Círculo) ---
    const dxHead = ball.x - h.head.x;
    const dyHead = ball.y - h.head.y;
    const dist2Head = dxHead * dxHead + dyHead * dyHead;

    if (dist2Head < (ball.r + h.head.r) * (ball.r + h.head.r)) {
        resolveCircleToCircle(ball, p, dxHead, dyHead, dist2Head, h.head.r);
    }

    // --- C. CHOQUE CON EL ZAPATO (Círculo Rotatorio y Bateador) ---
    const dxShoe = ball.x - h.shoe.x;
    const dyShoe = ball.y - h.shoe.y;
    const dist2Shoe = dxShoe * dxShoe + dyShoe * dyShoe;

    // Si la pelota choca con el zapato, usamos la función especial que creamos
    // para darle los efectos de "bombeo" y "latigazo".
    if (dist2Shoe < (ball.r + h.shoe.r) * (ball.r + h.shoe.r)) {
        resolveShoeToCircle(ball, p, dxShoe, dyShoe, dist2Shoe, h.shoe.r);
    }
}

// --- FUNCIONES AUXILIARES DE COLISIÓN ---
// Separan la pelota y calculan el rebote para no repetir código 3 veces

function resolveCircleToRect(ball, p, dx, dy, dist2) {
    const dist = Math.sqrt(dist2);
    if (dist < 0.001) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = ball.r - dist;
    ball.x += nx * overlap;
    ball.y += ny * overlap;
    applyBounce(ball, p, nx, ny);
}

function resolveCircleToCircle(ball, p, dx, dy, dist2, shapeR) {
    const dist = Math.sqrt(dist2);
    if (dist < 0.001) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = (ball.r + shapeR) - dist;
    ball.x += nx * overlap;
    ball.y += ny * overlap;
    applyBounce(ball, p, nx, ny);
}

function applyBounce(ball, p, nx, ny) {
    // AVISAMOS QUE HAY CONTACTO ESTE FRAME
    p.isTouchingBall = true;

    // 1. MATEMÁTICAS ARCADE
    const mathRvx = ball.vx - p.vx;
    const mathRvy = ball.vy - p.vy;
    const mathVelAlongNormal = mathRvx * nx + mathRvy * ny;

    if (mathVelAlongNormal >= -40) return;

    // 2. SISTEMA DE AUDIO (Usa la velocidad REAL)
    // Si estás atascado contra un muro, realVelAlongNormal será literalmente 0
    const realRvx = (ball.realVx || 0) - (p.realVx || 0);
    const realRvy = (ball.realVy || 0) - (p.realVy || 0);
    const realVelAlongNormal = realRvx * nx + realRvy * ny;

    if (realVelAlongNormal < -120 && !p.wasTouchingBall) window.playSound('sfx-rebound', 0.6);

    // 3. RESOLUCIÓN DE REBOTE
    const j = -(1 + RESTITUTION) * mathVelAlongNormal;
    ball.vx += j * nx;
    ball.vy += j * ny;

    const MAX_BALL_SPEED = 950;
    const spd = Math.hypot(ball.vx, ball.vy);
    if (spd > MAX_BALL_SPEED) {
        ball.vx = ball.vx * MAX_BALL_SPEED / spd;
        ball.vy = ball.vy * MAX_BALL_SPEED / spd;
    }
}

function checkGoalCollisions(ball, leftGoal, rightGoal) {
    const hitboxes = getGoalCrossbarRects(leftGoal, rightGoal);

    for (let box of hitboxes) {
        collideBallStaticRect(ball, box);
    }
}

function resolveShoeToCircle(ball, p, dx, dy, dist2, shapeR) {
    // AVISAMOS QUE HAY CONTACTO ESTE FRAME
    p.isTouchingBall = true;

    const dist = Math.sqrt(dist2);
    if (dist < 0.001) return;

    // Vector de dirección del impacto (Normal)
    let nx = dx / dist;
    let ny = dy / dist;
    const overlap = (ball.r + shapeR) - dist;

    // 1. Evitar que la pelota atraviese el zapato (Usando la normal real geométrica)
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    // 2. Calcular la velocidad del zapato en este frame exacto
    let shoeVx = p.vx;
    let shoeVy = p.vy;

    // Comprobamos el estado de la pierna
    let isLegMovingUp = p.isKicking && p.kickAngle < p.maxKickAngle;
    let isLegMovingDown = !p.isKicking && p.kickAngle > 0;

    if (isLegMovingUp) {
        let kickForceX = (p.isRightFacing ? 1 : -1) * (p.kickSpeed * 50);
        let kickForceY = -p.kickSpeed * 40;

        shoeVx += kickForceX;
        shoeVy += kickForceY;

        // --- TRUCO ARCADE: ASISTENCIA DE BOMBEO ---
        // Si el golpe es muy plano (ny está cerca de 0) o golpea un poco desde arriba,
        // forzamos matemáticamente que el ángulo del rebote apunte siempre hacia arriba.
        // -0.5 significa "45 grados hacia arriba" aproximadamente.
        if (ny > -0.5) {
            ny = -0.8;

            // Recalculamos nx para que el vector siga teniendo un tamaño válido de 1
            const mag = Math.hypot(nx, ny);
            nx /= mag;
            ny /= mag;
        }

    }
    else if (isLegMovingDown) {
        shoeVx += (p.isRightFacing ? -1 : 1) * 200;
        shoeVy += 300;
    }

    // 3. Aplicar el rebote con las nuevas velocidades y el nuevo ángulo
    const rvx = ball.vx - shoeVx;
    const rvy = ball.vy - shoeVy;
    const velAlongNormal = rvx * nx + rvy * ny;

    if (velAlongNormal >= 0) return;

    // Si el impacto del zapato contra el balón es fuerte, suena el rebote
    if (velAlongNormal < -50 && (!p.wasTouchingBall || isLegMovingUp)) {
        window.playSound('sfx-rebound', 0.6);
    }

    const currentRestitution = isLegMovingUp ? 1.0 : RESTITUTION;
    const j = -(1 + currentRestitution) * velAlongNormal;

    ball.vx += j * nx;
    ball.vy += j * ny;

    // --- GARANTÍA DE ELEVACIÓN ---
    // Si la pelota iba por el suelo y la chutamos, le inyectamos elevación extra
    // bruta para asegurar el bombeo, independientemente del choque.
    if (isLegMovingUp) {
        // Limitamos para que no se sume al infinito si choca 2 frames seguidos
        if (ball.vy > -300) {
            ball.vy -= 950;
        }
    }

    // Limitador de velocidad máxima
    const MAX_BALL_SPEED = 1100;
    const spd = Math.hypot(ball.vx, ball.vy);
    if (spd > MAX_BALL_SPEED) {
        ball.vx = ball.vx * MAX_BALL_SPEED / spd;
        ball.vy = ball.vy * MAX_BALL_SPEED / spd;
    }
}

function collideBallStaticRect(ball, rect) {
    // Buscar el punto del rectángulo más cercano al centro de la pelota
    const closestX = clamp(ball.x, rect.x, rect.x + rect.w);
    const closestY = clamp(ball.y, rect.y, rect.y + rect.h);

    // Calcular la distancia entre la pelota y ese punto
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    const dist2 = dx * dx + dy * dy;

    // Si la distancia es menor al radio, hay colisión
    if (dist2 < ball.r * ball.r) {
        // Calcular la normal
        const dist = Math.sqrt(dist2);
        if (dist < 0.001) return; // Evitar división por cero

        const nx = dx / dist;
        const ny = dy / dist;

        // Separar
        const overlap = ball.r - dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;

        // Reflejar velocidad
        const velAlongNormal = ball.vx * nx + ball.vy * ny;
        //
        // // Solo suena si el golpe es un poco fuerte (evita ruidos si la pelota rueda por encima)
        // if (velAlongNormal < -40) {
        //     window.playSound('sfx-ball-post');
        // }

        // Usamos la Velocidad Real contra los postes estáticos
        const realVelAlongNormal = (ball.realVx || 0) * nx + (ball.realVy || 0) * ny;
        if (realVelAlongNormal < -40) {
            window.playSound('sfx-ball-post');
        }

        ball.vx -= 2 * velAlongNormal * nx * RESTITUTION;
        ball.vy -= 2 * velAlongNormal * ny * RESTITUTION;
    }
}

function getGoalCrossbarRects(leftGoal, rightGoal) {
    return [
        { x: leftGoal.x, y: leftGoal.y, w: leftGoal.w, h: GOAL_POST_SIZE, allowStand: false },
        { x: rightGoal.x, y: rightGoal.y, w: rightGoal.w, h: GOAL_POST_SIZE, allowStand: false }
    ];
}

function getGoalPlayerCollisionRects(leftGoal, rightGoal) {
    const crossbars = getGoalCrossbarRects(leftGoal, rightGoal);
    const airBlockers = crossbars.map((crossbar) => ({
        x: crossbar.x,
        y: 0,
        w: crossbar.w,
        h: crossbar.y,
        allowStand: false,
        preferHorizontalExit: true
    }));

    return crossbars.concat(airBlockers);
}

function collidePlayerGoals(p, leftGoal, rightGoal) {
    const hitboxes = getGoalPlayerCollisionRects(leftGoal, rightGoal);

    for (const hitbox of hitboxes) {
        collidePlayerStaticRect(p, hitbox);
    }
}

// --- SISTEMA DE COLISIÓN: JUGADOR VS PORTERÍA (Largueros) ---

function collidePlayerStaticRect(p, rect) {
    // Obtenemos las hitboxes centralizadas
    let h = getPlayerHitboxes(p);

    // A. CUERPO vs LARGUERO (Rectángulo vs Rectángulo)
    resolveRectStaticRectPlayer(p, h.body, rect);

    // B. CABEZA vs LARGUERO (Círculo vs Rectángulo)
    h = getPlayerHitboxes(p); // Recalculamos por si el cuerpo lo movió
    resolveCircStaticRectPlayer(p, h.head, rect);

    // C. ZAPATO vs LARGUERO (Círculo vs Rectángulo)
    h = getPlayerHitboxes(p); // Recalculamos por si la cabeza lo movió
    resolveCircStaticRectPlayer(p, h.shoe, rect);
}

// Helper: Rectángulo (Cuerpo) vs Rectángulo Estático (Portería)
function resolveRectStaticRectPlayer(p, bodyBox, rect) {
    const bLeft = bodyBox.x;
    const bRight = bodyBox.x + bodyBox.w;
    const bTop = bodyBox.y;
    const bBottom = bodyBox.y + bodyBox.h;

    const rLeft = rect.x;
    const rRight = rect.x + rect.w;
    const rTop = rect.y;
    const rBottom = rect.y + rect.h;

    if (bRight <= rLeft || bLeft >= rRight || bBottom <= rTop || bTop >= rBottom) return;

    const overlapLeft = bRight - rLeft;
    const overlapRight = rRight - bLeft;
    const overlapTop = bBottom - rTop;
    const overlapBottom = rBottom - bTop;
    const canStand = rect.allowStand !== false;
    const preferHorizontalExit = rect.preferHorizontalExit === true;
    const bodyCenterY = bodyBox.y + bodyBox.h / 2;
    const rectCenterY = rect.y + rect.h / 2;

    if (preferHorizontalExit || (!canStand && bodyCenterY <= rectCenterY)) {
        pushPlayerRectHorizontally(p, bodyBox, rect, overlapLeft, overlapRight);
        return;
    }

    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

    if (minOverlap === overlapTop) {
        if (canStand && p.vy >= 0) {
            p.y -= overlapTop;
            p.vy = 0;
            p.onGround = true;
        } else {
            pushPlayerRectHorizontally(p, bodyBox, rect, overlapLeft, overlapRight);
        }
    } else if (minOverlap === overlapBottom) {
        p.y += overlapBottom;
        p.vy = Math.max(0, p.vy);
    } else if (minOverlap === overlapLeft) {
        p.x -= overlapLeft; p.vx = 0;
    } else if (minOverlap === overlapRight) {
        p.x += overlapRight; p.vx = 0;
    }
}

function pushPlayerRectHorizontally(p, bodyBox, rect, overlapLeft, overlapRight) {
    const bodyCenterX = bodyBox.x + bodyBox.w / 2;
    const rectCenterX = rect.x + rect.w / 2;

    if (bodyCenterX <= rectCenterX) {
        p.x -= overlapLeft;
    } else {
        p.x += overlapRight;
    }

    p.vx = 0;
}

// Helper: Círculo (Cabeza/Zapato) vs Rectángulo Estático (Portería)
function resolveCircStaticRectPlayer(p, circ, rect) {
    const closestX = clamp(circ.x, rect.x, rect.x + rect.w);
    const closestY = clamp(circ.y, rect.y, rect.y + rect.h);
    const dx = circ.x - closestX;
    const dy = circ.y - closestY;
    const dist2 = dx * dx + dy * dy;
    const canStand = rect.allowStand !== false;

    if (dist2 < circ.r * circ.r) {
        if (rect.preferHorizontalExit === true || (!canStand && circ.y <= rect.y + rect.h / 2)) {
            const rectCenterX = rect.x + rect.w / 2;
            const targetX = circ.x <= rectCenterX ? rect.x - circ.r : rect.x + rect.w + circ.r;
            p.x += targetX - circ.x;
            p.vx = 0;
            return;
        }

        const dist = Math.sqrt(dist2);
        if (dist < 0.001) return;
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = circ.r - dist;

        p.x += nx * overlap;
        p.y += ny * overlap;

        // CORRECCIÓN: ny < -0.7 (contacto muy vertical) y cayendo (vy >= 0)
        if (canStand && ny < -0.7 && p.vy >= 0) {
            p.vy = 0;
            p.onGround = true;
        } else if (ny > 0.5) {
            p.vy = Math.max(0, p.vy);
        }
    }
}

// 2. La nueva función principal
function collidePlayers(p1, p2) {
    // 1. Guardamos si se estaban tocando en el fotograma anterior
    p1.wasTouchingRival = p1.isTouchingRival || false;
    p2.wasTouchingRival = p2.isTouchingRival || false;

    p1.wasKickingRival = p1.isKickingRival || false;
    p2.wasKickingRival = p2.isKickingRival || false;

    // 2. Reseteamos el estado actual. Si más abajo alguna hitbox choca, lo pondrán a true.
    p1.isTouchingRival = false;
    p2.isTouchingRival = false;

    p1.isKickingRival = false;
    p2.isKickingRival = false;

    let h1 = getPlayerHitboxes(p1);
    let h2 = getPlayerHitboxes(p2);

    // A. CUERPOS vs CUERPOS (El choque principal de empuje)
    resolveBodyBody(p1, p2, h1.body, h2.body);

    // B. CABEZAS vs CABEZAS (Para cuando saltan o se chocan en el aire)
    h1 = getPlayerHitboxes(p1);
    h2 = getPlayerHitboxes(p2);
    resolveCircCircPlayer(p1, p2, h1.head, h2.head);

    // C. ZAPATO vs CUERPO (La magia para subirse encima del pie del otro)
    h1 = getPlayerHitboxes(p1);
    h2 = getPlayerHitboxes(p2);
    // Le pasamos el jugador atacante como segundo parámetro
    resolveCircRectPlayer(h1.shoe, p1, p2, h2.body);
    resolveCircRectPlayer(h2.shoe, p2, p1, h1.body);

    // D. ZAPATO vs CABEZA (Para que la cabeza no atraviese los pies)
    h1 = getPlayerHitboxes(p1);
    h2 = getPlayerHitboxes(p2);
    // Le pasamos el atacante y el objetivo
    resolveShoeHeadPlayer(h1.shoe, p1, p2, h2.head);
    resolveShoeHeadPlayer(h2.shoe, p2, p1, h1.head);
}

// 3. Resoluciones físicas específicas para Jugador vs Jugador

function resolveBodyBody(p1, p2, b1, b2) {
    const overlapX = Math.max(0, Math.min(b1.x + b1.w, b2.x + b2.w) - Math.max(b1.x, b2.x));
    const overlapY = Math.max(0, Math.min(b1.y + b1.h, b2.y + b2.h) - Math.max(b1.y, b2.y));

    if (overlapX > 0 && overlapY > 0) {
        // AVISAMOS QUE HAY CONTACTO ESTE FRAME
        p1.isTouchingRival = true;
        p2.isTouchingRival = true;

        //  Sonido de choque de cuerpos (con cooldown y velocidad mínima)
        playPlayerCollideSound(p1,p2);

        const b1CenterY = b1.y + b1.h / 2;
        const b2CenterY = b2.y + b2.h / 2;
        const prevP1Y = p1.prevY !== undefined ? p1.prevY : p1.y;
        const prevP2Y = p2.prevY !== undefined ? p2.prevY : p2.y;
        const p1WasAbove = prevP1Y < prevP2Y;
        const verticalGap = Math.abs(b1CenterY - b2CenterY);
        const stackedEnough = verticalGap > Math.min(b1.h, b2.h) * 0.28;
        const fallingOntoRival = p1WasAbove ? p1.vy >= 0 : p2.vy >= 0;
        const preferVerticalResolution = overlapY <= overlapX && stackedEnough && fallingOntoRival;

        if (!preferVerticalResolution) {
            const prevP1X = p1.prevX !== undefined ? p1.prevX : p1.x;
            const prevP2X = p2.prevX !== undefined ? p2.prevX : p2.x;
            const p1WasLeft = prevP1X === prevP2X ? (b1.x + b1.w / 2) < (b2.x + b2.w / 2) : prevP1X < prevP2X;
            const dir = p1WasLeft ? -1 : 1;
            p1.x += dir * overlapX / 2;
            p2.x -= dir * overlapX / 2;
            p1.vx = 0; p2.vx = 0;
        }
        else {
            // Solo apoyarse si está cayendo
            if (p1WasAbove) {
                p1.y -= overlapY;
                if (p1.vy >= 0) { p1.vy = 0; p1.onGround = true; }
            } else {
                p2.y -= overlapY;
                if (p2.vy >= 0) { p2.vy = 0; p2.onGround = true; }
            }
        }
    }
}

function resolveCircCircPlayer(p1, p2, c1, c2) {
    const dx = c2.x - c1.x;
    const dy = c2.y - c1.y;
    const dist2 = dx*dx + dy*dy;
    const radSum = c1.r + c2.r;

    if (dist2 < radSum * radSum && dist2 > 0) {
        // AVISAMOS QUE HAY CONTACTO ESTE FRAME
        p1.isTouchingRival = true;
        p2.isTouchingRival = true;

        //  Sonido de choque de cuerpos (con cooldown y velocidad mínima)
        playPlayerCollideSound(p1,p2);

        const dist = Math.sqrt(dist2);
        const overlap = radSum - dist;
        const nx = dx / dist;
        const ny = dy / dist;

        // Separamos en ambos ejes para evitar que se enganchen
        p1.x -= nx * overlap / 2;
        p2.x += nx * overlap / 2;
        p1.y -= ny * overlap / 2;
        p2.y += ny * overlap / 2;

        // Solo si el choque es vertical (>0.7) y el de arriba cae
        if (ny > 0.7 && p1.vy >= 0) {
            p1.vy = 0; p1.onGround = true;
        } else if (ny < -0.7 && p2.vy >= 0) {
            p2.vy = 0; p2.onGround = true;
        }
    }
}

function resolveCircRectPlayer(circ, pAttacker, pTarget, rect) {
    const closestX = clamp(circ.x, rect.x, rect.x + rect.w);
    const closestY = clamp(circ.y, rect.y, rect.y + rect.h);
    const dx = circ.x - closestX;
    const dy = circ.y - closestY;
    const dist2 = dx*dx + dy*dy;

    if (dist2 < circ.r * circ.r) {
        // AVISAMOS QUE HAY CONTACTO ESTE FRAME
        pAttacker.isTouchingRival = true;
        pTarget.isTouchingRival = true;

        // Aviso exclusivo de contacto con la pierna levantada
        if (pAttacker.kickAngle > 0) {
            pAttacker.isKickingRival = true;
        }

        // Sonido de patada a otro jugador
        // ¡Solo suena si el dueño del zapato está presionando la tecla de chutar!
        if (pAttacker.isKicking) playPlayerKickSound(pAttacker, pTarget);
        //  Sonido de choque de cuerpos (con cooldown y velocidad mínima)
        else playPlayerCollideSound(pAttacker, pTarget);

        const dist = Math.sqrt(dist2);
        if (dist < 0.001) return;
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = circ.r - dist;

        pTarget.x -= nx * overlap;
        pTarget.y -= ny * overlap;

        // CORRECCIÓN: ny > 0.7 requiere que el zapato esté bien DEBAJO del objetivo
        if (ny > 0.7 && pTarget.vy >= 0) {
            pTarget.vy = 0;
            pTarget.onGround = true;
        }
        else if (ny < -0.7) pTarget.vy = Math.max(0, pTarget.vy);
    }
}

function resolveShoeHeadPlayer(shoe, pAttacker, pTarget, head) {
    const dx = shoe.x - head.x;
    const dy = shoe.y - head.y;
    const dist2 = dx * dx + dy * dy;
    const radSum = shoe.r + head.r;

    if (dist2 < radSum * radSum && dist2 > 0) {
        // AVISAMOS QUE HAY CONTACTO ESTE FRAME
        pAttacker.isTouchingRival = true;
        pTarget.isTouchingRival = true;

        // Aviso exclusivo de contacto con la pierna levantada
        if (pAttacker.kickAngle > 0) {
            pAttacker.isKickingRival = true;
        }

        //  Sonido de patada de jugadores (con cooldown y velocidad mínima)
        if (pAttacker.isKicking) playPlayerKickSound(pAttacker, pTarget);
        //  Sonido de choque de jugadores (con cooldown y velocidad mínima)
        else playPlayerCollideSound(pAttacker, pTarget);

        const dist = Math.sqrt(dist2);
        const overlap = radSum - dist;
        const nx = dx / dist;
        const ny = dy / dist;

        pTarget.x -= nx * overlap;
        pTarget.y -= ny * overlap;

        // CORRECCIÓN: Zapato debajo de la cabeza Y jugador cayendo
        if (ny > 0.7 && pTarget.vy >= 0) {
            pTarget.vy = 0;
            pTarget.onGround = true;
        }
    }
}

function resolveBackToBackBallSqueeze(ball, p1, p2) {
    if (!isBackToBackBallSqueeze(ball, p1, p2)) return;

    const h1 = getPlayerHitboxes(p1);
    const h2 = getPlayerHitboxes(p2);
    const leftHitbox = p1.x < p2.x ? h1 : h2;
    const rightHitbox = p1.x < p2.x ? h2 : h1;

    const leftBodyRight = leftHitbox.body.x + leftHitbox.body.w;
    const rightBodyLeft = rightHitbox.body.x;
    const gapCenterX = (leftBodyRight + rightBodyLeft) / 2;

    ball.vx = 0;
    ball.vy = 0;
    ball.x = gapCenterX;
}

// Detecta si la pelota está atrapada entre dos jugadores que se empujan mutuamente
// y la protege para evitar que se atraviese. Funciona de frente Y de espaldas.
function resolveBallSqueezeUp(ball, p1, p2) {
    const h1 = getPlayerHitboxes(p1);
    const h2 = getPlayerHitboxes(p2);

    // Determinar izquierdo y derecho
    const leftPlayer = p1.x < p2.x ? p1 : p2;
    const rightPlayer = p1.x < p2.x ? p2 : p1;
    const leftHitbox = p1.x < p2.x ? h1 : h2;
    const rightHitbox = p1.x < p2.x ? h2 : h1;

    // La pelota debe estar entre los dos jugadores horizontalmente
    if (!(leftPlayer.x < ball.x && ball.x < rightPlayer.x)) return;

    // DETECTAR COMPRESIÓN: Los cuerpos deben estar muy cerca o solapados
    const leftBodyRight = leftHitbox.body.x + leftHitbox.body.w;
    const rightBodyLeft = rightHitbox.body.x;
    const bodyGap = rightBodyLeft - leftBodyRight;

    // Distancia de la pelota a los bordes de los cuerpos
    const distToBallFromLeftBody = Math.max(0, leftBodyRight - (ball.x - ball.r));
    const distToBallFromRightBody = Math.max(0, (ball.x + ball.r) - rightBodyLeft);

    // ACTIVAR PROTECCIÓN si:
    // 1. Los cuerpos están muy comprimidos (gap < 40px) O
    // 2. La pelota está DENTRO de ambos cuerpos (solapada)
    const bodiesCompressed = bodyGap < 40;
    const ballOverlapped = (ball.x + ball.r > leftHitbox.body.x &&
        ball.x - ball.r < rightHitbox.body.x + rightHitbox.body.w);

    if (!(bodiesCompressed && ballOverlapped)) return;

    // Además, verificar que la pelota está verticalmente en rango
    const ballInVerticalRange = (ball.y + ball.r > Math.max(leftHitbox.body.y, rightHitbox.body.y) &&
        ball.y - ball.r < Math.min(leftHitbox.body.y + leftHitbox.body.h, rightHitbox.body.y + rightHitbox.body.h));

    if (!ballInVerticalRange) return;

    // PROTECCIÓN: Detener completamente y posicionar de forma segura
    ball.vx = 0;
    ball.vy = 0;

    const safeZoneLeft = leftBodyRight + ball.r + 2;
    const safeZoneRight = rightBodyLeft - ball.r - 2;

    // Extraer la pelota al centro seguro entre los dos cuerpos
    const centerSafeX = (safeZoneLeft + safeZoneRight) / 2;

    // Si está dentro del cuerpo izquierdo, sacarla hacia la derecha
    if (ball.x < leftBodyRight) {
        ball.x = safeZoneLeft;
    }
    // Si está dentro del cuerpo derecho, sacarla hacia la izquierda
    else if (ball.x > rightBodyLeft) {
        ball.x = safeZoneRight;
    }
    // Si está en el medio pero solapada, centrarla
    else {
        ball.x = centerSafeX;
    }
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

// Función centralizada para reproducir el sonido de patadas entre jugadores
function playPlayerKickSound(pAttacker, pTarget) {
    // Si YA estaban tenía la pierna levantada en el frame anterior, ignoramos el sonido
    if (pAttacker.wasKickingRival) return;

    if (!pTarget.lastKickHit || performance.now() - pTarget.lastKickHit > 300) {

        // 1. Leemos la velocidad real de los cuerpos en el último frame
        const rVx1 = pAttacker.realVx || 0;
        const rVy1 = pAttacker.realVy || 0;
        const rVx2 = pTarget.realVx || 0;
        const rVy2 = pTarget.realVy || 0;

        // 2. Comprobamos si la pierna se está moviendo activamente hacia arriba
        const isLegSwinging = pAttacker.kickAngle > 0 && pAttacker.kickAngle < pAttacker.maxKickAngle;

        // Suena si hay movimiento real de los cuerpos, o si la pierna está dando el latigazo
        if (Math.abs(rVx1) > 50 || Math.abs(rVx2) > 50 || Math.abs(rVy1) > 50 || Math.abs(rVy2) > 50 || isLegSwinging) {
            window.playSound('sfx-player-kick', 0.5);
            pTarget.lastKickHit = performance.now();
        }
    }
}

// Función centralizada para reproducir el sonido de impacto entre jugadores
function playPlayerCollideSound(p1, p2) {
    // Si YA estaban tocándose en el frame anterior, ignoramos el sonido
    if (p1.wasTouchingRival) return;

    if (!p1.lastBump || performance.now() - p1.lastBump > 300) {

        // Usamos la Velocidad Real para evitar el spam de sonido cuando se empujan sin moverse
        const rVx1 = p1.realVx || 0;
        const rVy1 = p1.realVy || 0;
        const rVx2 = p2.realVx || 0;
        const rVy2 = p2.realVy || 0;

        if (Math.abs(rVx1) > 50 || Math.abs(rVx2) > 50 || Math.abs(rVy1) > 50 || Math.abs(rVy2) > 50) {
            window.playSound('sfx-player-collide', 1);
            p1.lastBump = performance.now();
            p2.lastBump = performance.now();
        }
    }
}

// --- EXPORTACIÓN PARA NODE.JS ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getPlayerHitboxes, arePlayersBackToBack, isBackToBackBallSqueeze,
        collidePlayerBall, checkGoalCollisions, collidePlayerStaticRect, collidePlayerGoals,
        collidePlayers, resolveBackToBackBallSqueeze, resolveBallSqueezeUp
    };
}