// physics.js - Detección de colisiones y límites

const GOAL_POST_SIZE = 8;
const PHYSICS_SHOE_LOCAL_CENTER_X = -3.5;
const PHYSICS_SHOE_LOCAL_CENTER_Y = 35;
const PHYSICS_SHOE_RADIUS = 14;
const BALL_CONTACT_TIE_EPSILON = 0.5;
const KICK_SHOE_SEPARATION_ANGLE = 0.12;
let fairBallCollisionTieBreaker = false;

function syncBallSweepOrigin(ball) {
    ball.prevX = ball.x;
    ball.prevY = ball.y;
}

function canPlayBallReboundSound(ball, cooldownMs = 200) {
    const now = Date.now();
    if (ball._lastReboundSoundAt && now - ball._lastReboundSoundAt < cooldownMs) return false;

    ball._lastReboundSoundAt = now;
    return true;
}

function canPlayBallPostSound(ball, cooldownMs = 180) {
    const now = Date.now();
    if (ball._lastPostSoundAt && now - ball._lastPostSoundAt < cooldownMs) return false;

    ball._lastPostSoundAt = now;
    return true;
}

function getMirroredShoeHitbox(p, kickAngle = p.kickAngle) {
    const localShoeX = p.isRightFacing ? PHYSICS_SHOE_LOCAL_CENTER_X : -PHYSICS_SHOE_LOCAL_CENTER_X;
    const localShoeY = PHYSICS_SHOE_LOCAL_CENTER_Y;
    const rot = p.isRightFacing ? -kickAngle : kickAngle;

    return {
        x: p.x + (localShoeX * Math.cos(rot) - localShoeY * Math.sin(rot)),
        y: p.y + (localShoeX * Math.sin(rot) + localShoeY * Math.cos(rot)),
        r: PHYSICS_SHOE_RADIUS
    };
}

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

    return {
        body: { x: rectX, y: bodyY - bodyH / 2, w: bodyW, h: bodyH },
        head: { x: headX, y: headY, r: headR },
        shoe: getMirroredShoeHitbox(p),
        supportShoe: getMirroredShoeHitbox(p, 0),
        kickShoeSeparated: p.kickAngle > KICK_SHOE_SEPARATION_ANGLE
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

function findSegmentCircleContact(startX, startY, endX, endY, centerX, centerY, radius) {
    const segX = endX - startX;
    const segY = endY - startY;
    const relX = startX - centerX;
    const relY = startY - centerY;
    const a = segX * segX + segY * segY;

    if (a < 0.0001) return null;

    const b = 2 * (relX * segX + relY * segY);
    const c = relX * relX + relY * relY - radius * radius;

    // Si el centro ya empieza dentro del radio expandido, la colisión discreta
    // normal se encarga. El barrido solo debe capturar entradas, no salidas.
    if (c <= 0) return null;

    const disc = b * b - 4 * a * c;

    if (disc < 0) return null;

    const sqrtDisc = Math.sqrt(disc);
    const invDen = 1 / (2 * a);
    const t = (-b - sqrtDisc) * invDen;

    if (t < 0 || t > 1) return null;

    const x = startX + segX * t;
    const y = startY + segY * t;
    let nx = x - centerX;
    let ny = y - centerY;
    const len = Math.hypot(nx, ny);

    if (len < 0.0001) return null;

    nx /= len;
    ny /= len;

    return { t, x, y, nx, ny };
}

function findSegmentExpandedRectContact(startX, startY, endX, endY, rect, radius) {
    const minX = rect.x - radius;
    const maxX = rect.x + rect.w + radius;
    const minY = rect.y - radius;
    const maxY = rect.y + rect.h + radius;
    const dirX = endX - startX;
    const dirY = endY - startY;
    let tMin = 0;
    let tMax = 1;
    let hitAxis = null;

    if (Math.abs(dirX) < 0.0001) {
        if (startX < minX || startX > maxX) return null;
    }
    else {
        const invX = 1 / dirX;
        let tx1 = (minX - startX) * invX;
        let tx2 = (maxX - startX) * invX;
        let axisEntry = 'x';
        if (tx1 > tx2) {
            [tx1, tx2] = [tx2, tx1];
        }
        if (tx1 > tMin) {
            tMin = tx1;
            hitAxis = axisEntry;
        }
        tMax = Math.min(tMax, tx2);
        if (tMin > tMax) return null;
    }

    if (Math.abs(dirY) < 0.0001) {
        if (startY < minY || startY > maxY) return null;
    }
    else {
        const invY = 1 / dirY;
        let ty1 = (minY - startY) * invY;
        let ty2 = (maxY - startY) * invY;
        const axisEntry = 'y';
        if (ty1 > ty2) {
            [ty1, ty2] = [ty2, ty1];
        }
        if (ty1 > tMin) {
            tMin = ty1;
            hitAxis = axisEntry;
        }
        tMax = Math.min(tMax, ty2);
        if (tMin > tMax) return null;
    }

    if (tMin < 0 || tMin > 1 || !hitAxis) return null;

    const x = startX + dirX * tMin;
    const y = startY + dirY * tMin;
    const closestX = clamp(x, rect.x, rect.x + rect.w);
    const closestY = clamp(y, rect.y, rect.y + rect.h);
    let nx = x - closestX;
    let ny = y - closestY;
    const len = Math.hypot(nx, ny);

    if (len >= 0.0001) {
        nx /= len;
        ny /= len;
    }
    else if (hitAxis === 'x') {
        nx = dirX > 0 ? -1 : 1;
        ny = 0;
    }
    else {
        nx = 0;
        ny = dirY > 0 ? -1 : 1;
    }

    return { t: tMin, x, y, nx, ny };
}

function findSweptPlayerBallContact(p, ball, h) {
    const startX = ball.prevX !== undefined ? ball.prevX : ball.x;
    const startY = ball.prevY !== undefined ? ball.prevY : ball.y;
    const endX = ball.x;
    const endY = ball.y;
    const travel = Math.hypot(endX - startX, endY - startY);

    if (travel < 0.0001) return null;

    const contacts = [];
    const bodyContact = findSegmentExpandedRectContact(startX, startY, endX, endY, h.body, ball.r);
    if (bodyContact) contacts.push({ ...bodyContact, shape: 'body' });

    const headContact = findSegmentCircleContact(startX, startY, endX, endY, h.head.x, h.head.y, ball.r + h.head.r);
    if (headContact) contacts.push({ ...headContact, shape: 'head', shapeR: h.head.r });

    const supportShoeContact = findSegmentCircleContact(startX, startY, endX, endY, h.supportShoe.x, h.supportShoe.y, ball.r + h.supportShoe.r);
    if (supportShoeContact) contacts.push({ ...supportShoeContact, shape: 'supportShoe', shapeR: h.supportShoe.r });

    if (h.kickShoeSeparated) {
        const shoeContact = findSegmentCircleContact(startX, startY, endX, endY, h.shoe.x, h.shoe.y, ball.r + h.shoe.r);
        if (shoeContact) contacts.push({ ...shoeContact, shape: 'shoe', shapeR: h.shoe.r });
    }

    if (!contacts.length) return null;

    contacts.sort((a, b) => a.t - b.t);
    return contacts[0];
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
    const sweptContact = findSweptPlayerBallContact(p, ball, h);

    if (sweptContact) {
        const skin = 0.2;
        if (sweptContact.shape === 'body') {
            ball.x = sweptContact.x + sweptContact.nx * skin;
            ball.y = sweptContact.y + sweptContact.ny * skin;
            applyBounce(ball, p, sweptContact.nx, sweptContact.ny);
            syncBallSweepOrigin(ball);
            return;
        }
        else {
            ball.x = sweptContact.x + sweptContact.nx * skin;
            ball.y = sweptContact.y + sweptContact.ny * skin;

            if (sweptContact.shape === 'shoe') {
                applyShoeBounce(ball, p, sweptContact.nx, sweptContact.ny);
            }
            else {
                applyBounce(ball, p, sweptContact.nx, sweptContact.ny);
            }

            syncBallSweepOrigin(ball);
            return;
        }
    }

    // --- A. CHOQUE CON EL CUERPO (Rectángulo AABB) ---
    const closestX = clamp(ball.x, h.body.x, h.body.x + h.body.w);
    const closestY = clamp(ball.y, h.body.y, h.body.y + h.body.h);
    const dxBody = ball.x - closestX;
    const dyBody = ball.y - closestY;
    const dist2Body = dxBody * dxBody + dyBody * dyBody;

    if (dist2Body < ball.r * ball.r) {
        resolveCircleToRect(ball, p, dxBody, dyBody, dist2Body);
        syncBallSweepOrigin(ball);
    }

    // --- B. CHOQUE CON LA CABEZA (Círculo) ---
    const dxHead = ball.x - h.head.x;
    const dyHead = ball.y - h.head.y;
    const dist2Head = dxHead * dxHead + dyHead * dyHead;

    if (dist2Head < (ball.r + h.head.r) * (ball.r + h.head.r)) {
        resolveCircleToCircle(ball, p, dxHead, dyHead, dist2Head, h.head.r);
        syncBallSweepOrigin(ball);
    }

    // --- C. CHOQUE CON EL ZAPATO (Círculo Rotatorio y Bateador) ---
    if (h.kickShoeSeparated) {
        const dxShoe = ball.x - h.shoe.x;
        const dyShoe = ball.y - h.shoe.y;
        const dist2Shoe = dxShoe * dxShoe + dyShoe * dyShoe;

        // Si la pelota choca con el zapato, usamos la función especial que creamos
        // para darle los efectos de "bombeo" y "latigazo".
        if (dist2Shoe < (ball.r + h.shoe.r) * (ball.r + h.shoe.r)) {
            resolveShoeToCircle(ball, p, dxShoe, dyShoe, dist2Shoe, h.shoe.r);
            syncBallSweepOrigin(ball);
        }
    }

    const dxSupportShoe = ball.x - h.supportShoe.x;
    const dySupportShoe = ball.y - h.supportShoe.y;
    const dist2SupportShoe = dxSupportShoe * dxSupportShoe + dySupportShoe * dySupportShoe;

    if (dist2SupportShoe < (ball.r + h.supportShoe.r) * (ball.r + h.supportShoe.r)) {
        resolveCircleToCircle(ball, p, dxSupportShoe, dySupportShoe, dist2SupportShoe, h.supportShoe.r);
        syncBallSweepOrigin(ball);
    }
}

function getCircleBallContactScore(circle, ball) {
    return Math.hypot(ball.x - circle.x, ball.y - circle.y) - (ball.r + circle.r);
}

function getRectBallContactScore(rect, ball) {
    const closestX = clamp(ball.x, rect.x, rect.x + rect.w);
    const closestY = clamp(ball.y, rect.y, rect.y + rect.h);
    return Math.hypot(ball.x - closestX, ball.y - closestY) - ball.r;
}

function getPlayerBallContactScore(p, ball) {
    const h = getPlayerHitboxes(p);

    const scores = [
        getRectBallContactScore(h.body, ball),
        getCircleBallContactScore(h.head, ball),
        getCircleBallContactScore(h.supportShoe, ball)
    ];

    if (h.kickShoeSeparated) scores.push(getCircleBallContactScore(h.shoe, ball));

    return Math.min(...scores);
}

function collidePlayersBallFair(p1, p2, ball) {
    const p1Score = getPlayerBallContactScore(p1, ball);
    const p2Score = getPlayerBallContactScore(p2, ball);

    let p1First = p1Score < p2Score;

    if (Math.abs(p1Score - p2Score) <= BALL_CONTACT_TIE_EPSILON) {
        fairBallCollisionTieBreaker = !fairBallCollisionTieBreaker;
        p1First = fairBallCollisionTieBreaker;
    }

    if (p1First) {
        collidePlayerBall(p1, ball);
        collidePlayerBall(p2, ball);
        collidePlayerBall(p1, ball);
        return;
    }

    collidePlayerBall(p2, ball);
    collidePlayerBall(p1, ball);
    collidePlayerBall(p2, ball);
}

// --- FUNCIONES AUXILIARES DE COLISIÓN ---
// Separan la pelota y calculan el rebote para no repetir código 3 veces

function resolveCircleToRect(ball, p, dx, dy, dist2) {
    const dist = Math.sqrt(dist2);
    if (dist < 0.001) {
        const nx = ball.x < p.x ? -1 : 1;
        const ny = 0;
        ball.x += nx * ball.r;
        applyBounce(ball, p, nx, ny);
        return;
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = ball.r - dist;
    ball.x += nx * overlap;
    ball.y += ny * overlap;
    applyBounce(ball, p, nx, ny);
}

function resolveCircleToCircle(ball, p, dx, dy, dist2, shapeR) {
    const dist = Math.sqrt(dist2);
    if (dist < 0.001) {
        const nx = ball.x < p.x ? -1 : 1;
        const ny = 0;
        ball.x += nx * (ball.r + shapeR);
        applyBounce(ball, p, nx, ny);
        return;
    }

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
    p.touchedBallSinceLastAI = true;

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

    if (realVelAlongNormal < -150 && !p.wasTouchingBall && canPlayBallReboundSound(ball)) {
        window.playSound('sfx-rebound', 0.6);
    }

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

function applyShoeBounce(ball, p, nx, ny) {
    // AVISAMOS QUE HAY CONTACTO ESTE FRAME
    p.isTouchingBall = true;
    p.touchedBallSinceLastAI = true;

    // Calcular la velocidad del zapato en este frame exacto
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

    // Aplicar el rebote con las nuevas velocidades y el nuevo ángulo
    const rvx = ball.vx - shoeVx;
    const rvy = ball.vy - shoeVy;
    const velAlongNormal = rvx * nx + rvy * ny;

    if (velAlongNormal >= 0) return;

    // Si el impacto del zapato contra el balón es fuerte, suena el rebote
    if (velAlongNormal < -50 && !p.wasTouchingBall && canPlayBallReboundSound(ball)) {
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

function checkGoalCollisions(ball, leftGoal, rightGoal) {
    const hitboxes = getGoalCrossbarRects(leftGoal, rightGoal);

    for (let box of hitboxes) {
        collideBallStaticRect(ball, box);
    }
}

function resolveShoeToCircle(ball, p, dx, dy, dist2, shapeR) {
    // AVISAMOS QUE HAY CONTACTO ESTE FRAME
    p.isTouchingBall = true;
    p.touchedBallSinceLastAI = true;

    const dist = Math.sqrt(dist2);
    if (dist < 0.001) return;

    // Vector de dirección del impacto (Normal)
    let nx = dx / dist;
    let ny = dy / dist;
    const overlap = (ball.r + shapeR) - dist;

    // 1. Evitar que la pelota atraviese el zapato (Usando la normal real geométrica)
    ball.x += nx * overlap;
    ball.y += ny * overlap;

    // 2. Aplicar el rebote con la misma lógica que el barrido.
    applyShoeBounce(ball, p, nx, ny);
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
        if (realVelAlongNormal < -40 && canPlayBallPostSound(ball)) {
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
    if (h.kickShoeSeparated) resolveCircStaticRectPlayer(p, h.shoe, rect);
    resolveCircStaticRectPlayer(p, h.supportShoe, rect);
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
    p1.rivalLiftBudget = 12;
    p2.rivalLiftBudget = 12;

    let h1 = getPlayerHitboxes(p1);
    let h2 = getPlayerHitboxes(p2);

    // A. CUERPOS vs CUERPOS (El choque principal de empuje)
    resolveBodyBody(p1, p2, h1.body, h2.body);

    // B. CABEZAS vs CABEZAS (Para cuando saltan o se chocan en el aire)
    h1 = getPlayerHitboxes(p1);
    h2 = getPlayerHitboxes(p2);
    resolveCircCircPlayer(p1, p2, h1.head, h2.head);

    // C. ZAPATO vs CABEZA (El pie de apoyo bloquea antes de llegar al cuerpo)
    h1 = getPlayerHitboxes(p1);
    h2 = getPlayerHitboxes(p2);
    // Le pasamos el atacante y el objetivo
    if (h1.kickShoeSeparated) resolveShoeHeadPlayer(h1.shoe, p1, p2, h2.head, true);
    resolveShoeHeadPlayer(h1.supportShoe, p1, p2, h2.head, false);
    if (h2.kickShoeSeparated) resolveShoeHeadPlayer(h2.shoe, p2, p1, h1.head, true);
    resolveShoeHeadPlayer(h2.supportShoe, p2, p1, h1.head, false);

    // D. CABEZA vs CUERPO (Evita atravesar nuca contra espalda)
    h1 = getPlayerHitboxes(p1);
    h2 = getPlayerHitboxes(p2);
    resolveHeadBodyPlayer(p1, p2, h1.head, h2.body);
    resolveHeadBodyPlayer(p2, p1, h2.head, h1.body);

    // E. ZAPATO vs CUERPO (La magia para subirse encima del pie del otro)
    h1 = getPlayerHitboxes(p1);
    h2 = getPlayerHitboxes(p2);
    // Le pasamos el jugador atacante como segundo parámetro
    if (h1.kickShoeSeparated) resolveCircRectPlayer(h1.shoe, p1, p2, h2.body, true);
    resolveCircRectPlayer(h1.supportShoe, p1, p2, h2.body, false);
    if (h2.kickShoeSeparated) resolveCircRectPlayer(h2.shoe, p2, p1, h1.body, true);
    resolveCircRectPlayer(h2.supportShoe, p2, p1, h1.body, false);
}

// 3. Resoluciones físicas específicas para Jugador vs Jugador

function markGroundedOnRival(player) {
    player.onGround = true;
    player.groundedByPlayer = true;
}

function movePlayerByRivalContact(player, dx, dy) {
    player.x += dx;

    if (dy < 0) {
        const remainingLift = player.rivalLiftBudget !== undefined ? player.rivalLiftBudget : 12;
        const appliedLift = Math.min(-dy, remainingLift);
        player.y -= appliedLift;
        player.rivalLiftBudget = Math.max(0, remainingLift - appliedLift);
        return;
    }

    player.y += dy;
}

function wasRectAboveCircle(player, rect, circleOwner, circle, tolerance = 2) {
    const prevPlayerY = player.prevY !== undefined ? player.prevY : player.y;
    const prevCircleOwnerY = circleOwner.prevY !== undefined ? circleOwner.prevY : circleOwner.y;
    const prevRectBottom = rect.y + rect.h - (player.y - prevPlayerY);
    const prevCircleTop = circle.y - circle.r - (circleOwner.y - prevCircleOwnerY);

    return prevRectBottom <= prevCircleTop + tolerance;
}

function wasCircleAboveCircle(player, playerCircle, circleOwner, ownerCircle, tolerance = 2) {
    const prevPlayerY = player.prevY !== undefined ? player.prevY : player.y;
    const prevCircleOwnerY = circleOwner.prevY !== undefined ? circleOwner.prevY : circleOwner.y;
    const prevPlayerCircleBottom = playerCircle.y + playerCircle.r - (player.y - prevPlayerY);
    const prevOwnerCircleTop = ownerCircle.y - ownerCircle.r - (circleOwner.y - prevCircleOwnerY);

    return prevPlayerCircleBottom <= prevOwnerCircleTop + tolerance;
}

function movePlayerByShoeContact(pTarget, pAttacker, nx, ny, overlap, allowVerticalLift) {
    const dx = -nx * overlap;
    const dy = -ny * overlap;

    if (dy < 0 && !allowVerticalLift) {
        const fallbackDir = pTarget.x < pAttacker.x ? -1 : 1;
        const horizontalDir = Math.abs(dx) > 0.001 ? Math.sign(dx) : fallbackDir;
        const horizontalPush = Math.max(Math.abs(dx), Math.min(overlap, 8));

        pTarget.x += horizontalDir * horizontalPush;
        if (pTarget.vx * horizontalDir < 0) pTarget.vx = 0;
        return;
    }

    movePlayerByRivalContact(pTarget, dx, dy);
}

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
        const prevP1X = p1.prevX !== undefined ? p1.prevX : p1.x;
        const prevP2X = p2.prevX !== undefined ? p2.prevX : p2.x;
        const prevP1Y = p1.prevY !== undefined ? p1.prevY : p1.y;
        const prevP2Y = p2.prevY !== undefined ? p2.prevY : p2.y;
        const prevB1Top = b1.y - (p1.y - prevP1Y);
        const prevB2Top = b2.y - (p2.y - prevP2Y);
        const prevB1Bottom = prevB1Top + b1.h;
        const prevB2Bottom = prevB2Top + b2.h;
        const p1WasClearlyAbove = prevB1Bottom <= prevB2Top + 2;
        const p2WasClearlyAbove = prevB2Bottom <= prevB1Top + 2;
        const verticalGap = Math.abs(b1CenterY - b2CenterY);
        const stackedEnough = verticalGap > Math.min(b1.h, b2.h) * 0.28;
        const fallingOntoRival = p1WasClearlyAbove ? p1.vy >= p2.vy : p2WasClearlyAbove ? p2.vy >= p1.vy : false;
        const preferVerticalResolution = overlapY <= overlapX && stackedEnough && fallingOntoRival && (p1WasClearlyAbove || p2WasClearlyAbove);

        if (!preferVerticalResolution) {
            const p1WasLeft = prevP1X === prevP2X ? (b1.x + b1.w / 2) < (b2.x + b2.w / 2) : prevP1X < prevP2X;
            const dir = p1WasLeft ? -1 : 1;
            p1.x += dir * overlapX / 2;
            p2.x -= dir * overlapX / 2;
            p1.vx = 0; p2.vx = 0;
        }
        else {
            // Solo apoyar si en el frame anterior uno estaba claramente encima del otro.
            if (p1WasClearlyAbove) {
                movePlayerByRivalContact(p1, 0, -overlapY);
                if (p1.vy >= 0) { p1.vy = 0; markGroundedOnRival(p1); }
            } else {
                movePlayerByRivalContact(p2, 0, -overlapY);
                if (p2.vy >= 0) { p2.vy = 0; markGroundedOnRival(p2); }
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
        const prevP1X = p1.prevX !== undefined ? p1.prevX : p1.x;
        const prevP2X = p2.prevX !== undefined ? p2.prevX : p2.x;
        const prevP1Y = p1.prevY !== undefined ? p1.prevY : p1.y;
        const prevP2Y = p2.prevY !== undefined ? p2.prevY : p2.y;
        const prevP1Top = c1.y - c1.r - (p1.y - prevP1Y);
        const prevP2Top = c2.y - c2.r - (p2.y - prevP2Y);
        const prevP1Bottom = prevP1Top + c1.r * 2;
        const prevP2Bottom = prevP2Top + c2.r * 2;
        const hadVerticalStack = prevP1Bottom <= prevP2Top + 2 || prevP2Bottom <= prevP1Top + 2;

        if (Math.abs(nx) >= Math.abs(ny) && !hadVerticalStack) {
            const p1WasLeft = prevP1X === prevP2X ? c1.x < c2.x : prevP1X < prevP2X;
            const dir = p1WasLeft ? -1 : 1;
            p1.x += dir * overlap / 2;
            p2.x -= dir * overlap / 2;
        }
        else {
            movePlayerByRivalContact(p1, -nx * overlap / 2, -ny * overlap / 2);
            movePlayerByRivalContact(p2, nx * overlap / 2, ny * overlap / 2);
        }

        // Solo si el choque es vertical (>0.7) y el de arriba cae
        if (ny > 0.7 && p1.vy >= 0) {
            p1.vy = 0; markGroundedOnRival(p1);
        } else if (ny < -0.7 && p2.vy >= 0) {
            p2.vy = 0; markGroundedOnRival(p2);
        }
    }
}

function resolveHeadBodyPlayer(pHeadOwner, pBodyOwner, head, body) {
    const closestX = clamp(head.x, body.x, body.x + body.w);
    const closestY = clamp(head.y, body.y, body.y + body.h);
    const dx = head.x - closestX;
    const dy = head.y - closestY;
    const dist2 = dx * dx + dy * dy;

    if (dist2 >= head.r * head.r) return;

    pHeadOwner.isTouchingRival = true;
    pBodyOwner.isTouchingRival = true;
    playPlayerCollideSound(pHeadOwner, pBodyOwner);

    if (dist2 < 0.001) {
        const fallbackDir = pHeadOwner.x < pBodyOwner.x ? -1 : 1;
        pHeadOwner.x += fallbackDir * head.r;
        pHeadOwner.vx = 0;
        return;
    }

    const dist = Math.sqrt(dist2);
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = head.r - dist;
    const verticalPush = ny * overlap;

    if (Math.abs(nx) >= Math.abs(ny) || verticalPush < 0) {
        const fallbackDir = pHeadOwner.x < pBodyOwner.x ? -1 : 1;
        const horizontalDir = Math.abs(nx) > 0.001 ? Math.sign(nx) : fallbackDir;
        const horizontalPush = Math.max(Math.abs(nx * overlap), Math.min(overlap, 8));

        pHeadOwner.x += horizontalDir * horizontalPush;
        if (pHeadOwner.vx * horizontalDir < 0) pHeadOwner.vx = 0;
        return;
    }

    movePlayerByRivalContact(pHeadOwner, nx * overlap, verticalPush);

    if (ny > 0.7) {
        pHeadOwner.vy = Math.max(0, pHeadOwner.vy);
    }
}

function resolveCircRectPlayer(circ, pAttacker, pTarget, rect, isKickFoot = true) {
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
        if (isKickFoot && pAttacker.kickAngle > 0) {
            pAttacker.isKickingRival = true;
        }

        // Sonido de patada a otro jugador
        // ¡Solo suena si el dueño del zapato está presionando la tecla de chutar!
        if (isKickFoot && pAttacker.isKicking) playPlayerKickSound(pAttacker, pTarget);
        //  Sonido de choque de cuerpos (con cooldown y velocidad mínima)
        else playPlayerCollideSound(pAttacker, pTarget);

        const dist = Math.sqrt(dist2);
        if (dist < 0.001) return;
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = circ.r - dist;
        const canLiftTarget = ny > 0.7 && pTarget.vy >= 0 && wasRectAboveCircle(pTarget, rect, pAttacker, circ);

        movePlayerByShoeContact(pTarget, pAttacker, nx, ny, overlap, canLiftTarget);

        // CORRECCIÓN: ny > 0.7 requiere que el zapato esté bien DEBAJO del objetivo
        if (canLiftTarget) {
            pTarget.vy = 0;
            markGroundedOnRival(pTarget);
        }
        else if (ny < -0.7) pTarget.vy = Math.max(0, pTarget.vy);
    }
}

function resolveShoeHeadPlayer(shoe, pAttacker, pTarget, head, isKickFoot = true) {
    const dx = shoe.x - head.x;
    const dy = shoe.y - head.y;
    const dist2 = dx * dx + dy * dy;
    const radSum = shoe.r + head.r;

    if (dist2 < radSum * radSum && dist2 > 0) {
        // AVISAMOS QUE HAY CONTACTO ESTE FRAME
        pAttacker.isTouchingRival = true;
        pTarget.isTouchingRival = true;

        // Aviso exclusivo de contacto con la pierna levantada
        if (isKickFoot && pAttacker.kickAngle > 0) {
            pAttacker.isKickingRival = true;
        }

        //  Sonido de patada de jugadores (con cooldown y velocidad mínima)
        if (isKickFoot && pAttacker.isKicking) playPlayerKickSound(pAttacker, pTarget);
        //  Sonido de choque de jugadores (con cooldown y velocidad mínima)
        else playPlayerCollideSound(pAttacker, pTarget);

        const dist = Math.sqrt(dist2);
        const overlap = radSum - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const canLiftTarget = ny > 0.7 && pTarget.vy >= 0 && wasCircleAboveCircle(pTarget, head, pAttacker, shoe);

        movePlayerByShoeContact(pTarget, pAttacker, nx, ny, overlap, canLiftTarget);

        // CORRECCIÓN: Zapato debajo de la cabeza Y jugador cayendo
        if (canLiftTarget) {
            pTarget.vy = 0;
            markGroundedOnRival(pTarget);
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
    syncBallSweepOrigin(ball);
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

    // Si no existe hueco horizontal suficiente, colocar la pelota en X solo
    // la deja dentro de la pinza. En ese caso se libera hacia arriba.
    if (safeZoneLeft > safeZoneRight) {
        resolveBallVerticalPinchEscape(ball, leftPlayer, rightPlayer, leftHitbox, rightHitbox);
        return;
    }

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

    syncBallSweepOrigin(ball);
}

function resolveBallVerticalPinchEscape(ball, leftPlayer, rightPlayer, leftHitbox, rightHitbox) {
    const leftBodyRight = leftHitbox.body.x + leftHitbox.body.w;
    const rightBodyLeft = rightHitbox.body.x;
    const sharedBodyTop = Math.max(leftHitbox.body.y, rightHitbox.body.y);
    const centerX = (leftBodyRight + rightBodyLeft) / 2;

    ball.x = centerX;
    ball.y = Math.min(ball.y, sharedBodyTop - ball.r - 3);
    ball.vx = 0;
    ball.vy = Math.min(ball.vy || 0, -360);

    leftPlayer.x -= 10;
    rightPlayer.x += 10;

    if (leftPlayer.vx > 0) leftPlayer.vx = 0;
    if (rightPlayer.vx < 0) rightPlayer.vx = 0;

    syncBallSweepOrigin(ball);
}

function resolveBallFloorCrush(ball, p1, p2, floorY, worldW) {
    const nearFloor = ball.y + ball.r > floorY - 2;
    if (!nearFloor) {
        ball._floorCrushFrames = 0;
        return;
    }

    const h1 = getPlayerHitboxes(p1);
    const h2 = getPlayerHitboxes(p2);
    const ballTop = ball.y - ball.r;
    const ballLeft = ball.x - ball.r;
    const ballRight = ball.x + ball.r;

    const crushingPlayers = [
        getFloorCrushingPlayer(ball, p1, h1, floorY, ballTop, ballLeft, ballRight),
        getFloorCrushingPlayer(ball, p2, h2, floorY, ballTop, ballLeft, ballRight)
    ].filter(Boolean);

    if (crushingPlayers.length === 0) {
        ball._floorCrushFrames = 0;
        return;
    }

    const ballSpeed = Math.hypot(ball.vx || 0, ball.vy || 0);
    const twoPlayerTrap = crushingPlayers.length === 2;
    const isStuck = ballSpeed < 110 || twoPlayerTrap;

    ball._floorCrushFrames = isStuck ? (ball._floorCrushFrames || 0) + 1 : 0;
    if (ball._floorCrushFrames < (twoPlayerTrap ? 2 : 3)) return;

    ball.y = floorY - ball.r - 3;

    if (crushingPlayers.length === 2) {
        const leftPlayer = p1.x <= p2.x ? p1 : p2;
        const rightPlayer = p1.x <= p2.x ? p2 : p1;

        const trapLeft = Math.min(crushingPlayers[0].minX, crushingPlayers[1].minX);
        const trapRight = Math.max(crushingPlayers[0].maxX, crushingPlayers[1].maxX);
        const pairCenter = (leftPlayer.x + rightPlayer.x) / 2;
        let escapeDir = ball.x < pairCenter ? -1 : 1;

        if (Math.abs(ball.x - pairCenter) < 1) {
            escapeDir = ball._lastFloorCrushEscapeDir === 1 ? -1 : 1;
        }
        if (worldW && escapeDir < 0 && trapLeft - ball.r - 4 < 0) escapeDir = 1;
        if (worldW && escapeDir > 0 && trapRight + ball.r + 4 > worldW) escapeDir = -1;

        ball.x = escapeDir < 0 ? trapLeft - ball.r - 4 : trapRight + ball.r + 4;
        ball.vx = escapeDir * Math.max(Math.abs(ball.vx || 0), 380);
        ball.vy = Math.min(ball.vy || 0, -220);
        ball._lastFloorCrushEscapeDir = escapeDir;

        leftPlayer.x -= 14;
        rightPlayer.x += 14;
        if (leftPlayer.vx > 0) leftPlayer.vx = 0;
        if (rightPlayer.vx < 0) rightPlayer.vx = 0;
    } else {
        const crusher = crushingPlayers[0];
        const player = crusher.player;
        let escapeDir = ball.x < player.x ? -1 : 1;

        if (Math.abs(ball.x - player.x) < 1) {
            escapeDir = ball._lastFloorCrushEscapeDir === 1 ? -1 : 1;
        }
        if (worldW && escapeDir < 0 && crusher.minX - ball.r - 4 < 0) escapeDir = 1;
        if (worldW && escapeDir > 0 && crusher.maxX + ball.r + 4 > worldW) escapeDir = -1;

        ball.x = escapeDir < 0 ? crusher.minX - ball.r - 4 : crusher.maxX + ball.r + 4;
        ball.vx = escapeDir * Math.max(Math.abs(ball.vx || 0), 320);
        ball.vy = Math.min(ball.vy || 0, -180);
        ball._lastFloorCrushEscapeDir = escapeDir;

        player.x -= escapeDir * 18;
        if (player.vx * escapeDir > 0) player.vx = 0;
    }

    ball._floorCrushFrames = 0;
    syncBallSweepOrigin(ball);
}

function getFloorCrushingPlayer(ball, player, hitboxes, floorY, ballTop, ballLeft, ballRight) {
    const ranges = [
        { minX: hitboxes.body.x, maxX: hitboxes.body.x + hitboxes.body.w },
        { minX: hitboxes.head.x - hitboxes.head.r, maxX: hitboxes.head.x + hitboxes.head.r },
        { minX: hitboxes.supportShoe.x - hitboxes.supportShoe.r, maxX: hitboxes.supportShoe.x + hitboxes.supportShoe.r }
    ];

    const shapes = [
        { minX: hitboxes.body.x, maxX: hitboxes.body.x + hitboxes.body.w, minY: hitboxes.body.y, maxY: hitboxes.body.y + hitboxes.body.h },
        { minX: hitboxes.supportShoe.x - hitboxes.supportShoe.r, maxX: hitboxes.supportShoe.x + hitboxes.supportShoe.r, minY: hitboxes.supportShoe.y - hitboxes.supportShoe.r, maxY: hitboxes.supportShoe.y + hitboxes.supportShoe.r }
    ];

    if (hitboxes.kickShoeSeparated) {
        ranges.push({ minX: hitboxes.shoe.x - hitboxes.shoe.r, maxX: hitboxes.shoe.x + hitboxes.shoe.r });
        shapes.push({ minX: hitboxes.shoe.x - hitboxes.shoe.r, maxX: hitboxes.shoe.x + hitboxes.shoe.r, minY: hitboxes.shoe.y - hitboxes.shoe.r, maxY: hitboxes.shoe.y + hitboxes.shoe.r });
    }

    const isCrushing = shapes.some((shape) => {
        const horizontalOverlap = ballRight > shape.minX && ballLeft < shape.maxX;
        const verticalCrush = shape.maxY > ballTop && shape.minY < floorY;
        return horizontalOverlap && verticalCrush;
    });

    if (!isCrushing) return null;

    return {
        player,
        minX: Math.min(...ranges.map((range) => range.minX)),
        maxX: Math.max(...ranges.map((range) => range.maxX))
    };
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
        collidePlayerBall, collidePlayersBallFair, checkGoalCollisions, collidePlayerStaticRect, collidePlayerGoals,
        collidePlayers, resolveBackToBackBallSqueeze, resolveBallSqueezeUp, resolveBallFloorCrush
    };
}