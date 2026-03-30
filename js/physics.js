// physics.js - Detección de colisiones y límites

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

function collidePlayerBall(p, ball) {
    // 1. Obtenemos las hitboxes centralizadas con una sola línea de código
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
    const rvx = ball.vx - p.vx;
    const rvy = ball.vy - p.vy;
    const velAlongNormal = rvx * nx + rvy * ny;

    if (velAlongNormal >= 0) return;

    const j = -(1 + RESTITUTION) * velAlongNormal;
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
    const postSize = 8;

    // Hitboxes de los Largueros
    const leftCrossbar = { x: leftGoal.x, y: leftGoal.y, w: leftGoal.w, h: postSize };
    const rightCrossbar = { x: rightGoal.x, y: rightGoal.y, w: rightGoal.w, h: postSize };

    const hitboxes = [leftCrossbar, rightCrossbar];

    for (let box of hitboxes) {
        collideBallStaticRect(ball, box);
    }
}

function resolveShoeToCircle(ball, p, dx, dy, dist2, shapeR) {
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

    } else if (isLegMovingDown) {
        shoeVx += (p.isRightFacing ? -1 : 1) * 200;
        shoeVy += 300;
    }

    // 3. Aplicar el rebote con las nuevas velocidades y el nuevo ángulo
    const rvx = ball.vx - shoeVx;
    const rvy = ball.vy - shoeVy;
    const velAlongNormal = rvx * nx + rvy * ny;

    if (velAlongNormal >= 0) return;

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
        ball.vx -= 2 * velAlongNormal * nx * RESTITUTION;
        ball.vy -= 2 * velAlongNormal * ny * RESTITUTION;
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
    // bodyBox devuelve x,y desde la esquina superior izquierda
    const bLeft = bodyBox.x;
    const bRight = bodyBox.x + bodyBox.w;
    const bTop = bodyBox.y;
    const bBottom = bodyBox.y + bodyBox.h;

    const rLeft = rect.x;
    const rRight = rect.x + rect.w;
    const rTop = rect.y;
    const rBottom = rect.y + rect.h;

    if (bRight <= rLeft || bLeft >= rRight || bBottom <= rTop || bTop >= rBottom) {
        return; // No hay colisión
    }

    const overlapLeft = bRight - rLeft;
    const overlapRight = rRight - bLeft;
    const overlapTop = bBottom - rTop;    // El jugador aterriza sobre el larguero
    const overlapBottom = rBottom - bTop; // El jugador se golpea la cabeza desde abajo

    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

    if (minOverlap === overlapTop) {
        // 1. Chocó por ARRIBA (pisando el larguero)
        p.y -= overlapTop;
        p.vy = 0;
        p.onGround = true; // ¡AHORA SÍ! Le permitimos saltar si está subido a la portería
    } else if (minOverlap === overlapBottom) {
        // 2. Chocó por ABAJO (choca con el larguero al saltar)
        p.y += overlapBottom;
        p.vy = Math.max(0, p.vy); // Le cortamos el salto para que empiece a caer
        // BUG ARREGLADO: Ya no ponemos onGround = true aquí, así no puede hacer doble salto.
    } else if (minOverlap === overlapLeft) {
        // 3. Chocó por la izquierda
        p.x -= overlapLeft;
        p.vx = 0;
    } else if (minOverlap === overlapRight) {
        // 4. Chocó por la derecha
        p.x += overlapRight;
        p.vx = 0;
    }
}

// Helper: Círculo (Cabeza/Zapato) vs Rectángulo Estático (Portería)
function resolveCircStaticRectPlayer(p, circ, rect) {
    const closestX = clamp(circ.x, rect.x, rect.x + rect.w);
    const closestY = clamp(circ.y, rect.y, rect.y + rect.h);

    const dx = circ.x - closestX;
    const dy = circ.y - closestY;
    const dist2 = dx * dx + dy * dy;

    if (dist2 < circ.r * circ.r) {
        const dist = Math.sqrt(dist2);
        if (dist < 0.001) return;

        const nx = dx / dist; // Vector normal: del larguero HACIA la cabeza/zapato
        const ny = dy / dist;
        const overlap = circ.r - dist;

        // Separamos al jugador de la portería
        p.x += nx * overlap;
        p.y += ny * overlap;

        // Lógica vertical (Saltos y caídas)
        if (ny < -0.5) {
            // El círculo está apoyado ENCIMA del larguero
            p.vy = 0;
            p.onGround = true; // Permite saltar
        } else if (ny > 0.5) {
            // El círculo golpeó por DEBAJO del larguero
            p.vy = Math.max(0, p.vy); // Frena la subida bruscamente
        }
    }
}

// 2. La nueva función principal
function collidePlayers(p1, p2) {
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
    resolveCircRectPlayer(h1.shoe, p2, h2.body);
    resolveCircRectPlayer(h2.shoe, p1, h1.body);

    // D. ZAPATO vs CABEZA (Para que la cabeza no atraviese los pies)
    h1 = getPlayerHitboxes(p1);
    h2 = getPlayerHitboxes(p2);
    resolveShoeHeadPlayer(h1.shoe, p2, h2.head);
    resolveShoeHeadPlayer(h2.shoe, p1, h1.head);
}

// 3. Resoluciones físicas específicas para Jugador vs Jugador

function resolveBodyBody(p1, p2, b1, b2) {
    const overlapX = Math.max(0, Math.min(b1.x + b1.w, b2.x + b2.w) - Math.max(b1.x, b2.x));
    const overlapY = Math.max(0, Math.min(b1.y + b1.h, b2.y + b2.h) - Math.max(b1.y, b2.y));

    if (overlapX > 0 && overlapY > 0) {
        if (overlapX < overlapY) {
            // Separación horizontal (Se empujan)
            const dir = (b1.x + b1.w/2) < (b2.x + b2.w/2) ? -1 : 1;
            p1.x += dir * overlapX / 2;
            p2.x -= dir * overlapX / 2;
            p1.vx = 0;
            p2.vx = 0;
        } else {
            // Separación vertical (Uno se sube encima del otro)
            const dir = (b1.y + b1.h/2) < (b2.y + b2.h/2) ? -1 : 1;
            if (dir < 0) {
                p1.y -= overlapY; p1.vy = 0; p1.onGround = true;
            } else {
                p2.y -= overlapY; p2.vy = 0; p2.onGround = true;
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
        const dist = Math.sqrt(dist2);
        const overlap = radSum - dist;
        const nx = dx / dist;
        const ny = dy / dist;

        // Separación horizontal
        p1.x -= nx * overlap / 2;
        p2.x += nx * overlap / 2;

        // Separación vertical: el que esté más arriba se queda apoyado en la cabeza
        if (p1.y < p2.y) {
            p1.y -= Math.max(0, ny * overlap); p1.vy = 0; p1.onGround = true;
        } else {
            p2.y += Math.max(0, ny * overlap); p2.vy = 0; p2.onGround = true;
        }
    }
}

function resolveCircRectPlayer(circ, pTarget, rect) {
    const closestX = clamp(circ.x, rect.x, rect.x + rect.w);
    const closestY = clamp(circ.y, rect.y, rect.y + rect.h);

    const dx = circ.x - closestX;
    const dy = circ.y - closestY;
    const dist2 = dx*dx + dy*dy;

    if (dist2 < circ.r * circ.r) {
        const dist = Math.sqrt(dist2);
        if (dist < 0.001) return;

        const nx = dx / dist; // Apunta DEL cuerpo HACIA el zapato
        const ny = dy / dist;
        const overlap = circ.r - dist;

        // Empujamos al jugador objetivo LEJOS del zapato
        pTarget.x -= nx * overlap;

        // Si el zapato está debajo del cuerpo (ny > 0), lo levantamos
        if (ny > 0) {
            pTarget.y -= ny * overlap;
            pTarget.vy = 0;
            pTarget.onGround = true; // ¡Permite que el jugador pueda saltar estando subido al zapato!
        } else {
            pTarget.y -= ny * overlap;
        }
    }
}

// Círculo (Zapato) contra Círculo (Cabeza) - Solo se empuja al jugador dueño de la cabeza
function resolveShoeHeadPlayer(shoe, pTarget, head) {
    // Calculamos distancia entre el centro de la cabeza y el zapato
    const dx = shoe.x - head.x;
    const dy = shoe.y - head.y;
    const dist2 = dx * dx + dy * dy;
    const radSum = shoe.r + head.r;

    // Si hay colisión (se solapan)
    if (dist2 < radSum * radSum && dist2 > 0) {
        const dist = Math.sqrt(dist2);
        const overlap = radSum - dist;

        // Vector normal que apunta desde la cabeza HACIA el zapato
        const nx = dx / dist;
        const ny = dy / dist;

        // Empujamos al jugador objetivo LEJOS del zapato
        pTarget.x -= nx * overlap;

        // Si el zapato está por debajo de la cabeza (ny > 0), levantamos al jugador
        if (ny > 0) {
            pTarget.y -= ny * overlap;
            pTarget.vy = 0;
            pTarget.onGround = true; // Se puede apoyar en el zapato con la cabeza
        } else {
            // Si el zapato le da desde arriba (por ejemplo, un remate de chilena al rival), lo empuja abajo
            pTarget.y -= ny * overlap;
        }
    }
}

// Detecta si la pelota está atrapada entre dos jugadores y la lanza hacia arriba.
// Usa proximidad entre jugadores para detectarlo de forma fiable,
// ya que las colisiones individuales ya habrán separado el solapamiento exacto.
function resolveBallSqueezeUp(ball, p1, p2) {
    // Los dos jugadores deben estar frente a frente (menos de la suma de sus medios anchos + diámetro del balón)
    const playerDist = Math.abs(p1.x - p2.x);
    const squeezeDist = (p1.w + p2.w) / 2 + ball.r * 2;
    if (playerDist > squeezeDist) return;

    // El balón debe estar entre ellos horizontalmente
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    if (ball.x < minX - ball.r || ball.x > maxX + ball.r) return;

    // El balón debe estar a altura de los cuerpos
    const topY = Math.min(p1.y - p1.h / 2, p2.y - p2.h / 2) - 22; // incluye cabeza
    const botY = Math.max(p1.y + p1.h / 2, p2.y + p2.h / 2);
    if (ball.y < topY || ball.y > botY) return;

    // Pelota atrapada: cancelar velocidad horizontal y lanzar hacia arriba suavemente
    ball.vx = 0;
    if (ball.vy > -350) ball.vy = -350;
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}