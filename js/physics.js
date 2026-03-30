// physics.js - Detección de colisiones y límites

function collidePlayerBall(p, ball) {
    // colisión círculo (ball) con AABB (player)
    const left = p.x - p.w / 2;
    const right = p.x + p.w / 2;
    const top = p.y - p.h / 2;
    const bottom = p.y + p.h / 2;

    const closestX = clamp(ball.x, left, right);
    const closestY = clamp(ball.y, top, bottom);

    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    const dist2 = dx * dx + dy * dy;

    if (dist2 < ball.r * ball.r) {
        const dist = Math.sqrt(dist2);

        // Caso degenerado: el centro de la pelota está dentro del jugador
        if (dist < 0.001) {
            ball.y = top - ball.r - 1;
            ball.vy = -Math.abs(ball.vy) - 300;
            return;
        }

        const nx = dx / dist;
        const ny = dy / dist;

        // Separar la pelota completamente (solo se mueve ella, no el jugador)
        const overlap = ball.r - dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;

        // Respuesta de velocidad: usar velocidad relativa pelota-jugador
        const rvx = ball.vx - p.vx;
        const rvy = ball.vy - p.vy;
        const velAlongNormal = rvx * nx + rvy * ny;

        // Solo resolver si se están acercando
        if (velAlongNormal >= 0) return;

        const j = -(1 + RESTITUTION) * velAlongNormal;
        ball.vx += j * nx;
        ball.vy += j * ny;

        // Limitar velocidad máxima del balón para evitar que dobles colisiones
        // consecutivas amplifiquen la velocidad hasta niveles imposibles
        const MAX_BALL_SPEED = 950;
        const spd = Math.hypot(ball.vx, ball.vy);
        if (spd > MAX_BALL_SPEED) {
            ball.vx = ball.vx * MAX_BALL_SPEED / spd;
            ball.vy = ball.vy * MAX_BALL_SPEED / spd;
        }
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

function applyKickForce(p, ball) {
    if (p.justKicked) {
        p.justKicked = false; // Apagamos el interruptor inmediatamente

        // Calcular distancia centro a centro
        const dx = ball.x - p.x;
        const dy = ball.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Rango de chute: mitad del ancho del jugador + radio de la bola + un margen de 40px
        const kickRange = (p.w / 2) + ball.r + 40;

        if (dist < kickRange) {
            // Direccion en X dependiendo de a dónde mire
            let dirX = p.isRightFacing ? 1 : -1;

            // Fuerza base mínima + Fuerza extra escalada por la carga (0 a 1)
            let baseForceX = 400;
            let extraForceX = 700 * p.kickForce;

            let baseForceY = -350; // Hacia arriba
            let extraForceY = -450 * p.kickForce;

            // Aplicar velocidad bruscamente
            ball.vx = (baseForceX + extraForceX) * dirX;
            ball.vy = baseForceY + extraForceY;
        }
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

function collidePlayerStaticRect(p, rect) {
    // Calcular los bordes del jugador (el punto x,y está en su centro)
    const pLeft = p.x - p.w / 2;
    const pRight = p.x + p.w / 2;
    const pTop = p.y - p.h / 2;
    const pBottom = p.y + p.h / 2;

    // Calcular los bordes de la hitbox estática (el punto x,y está en la esquina superior izquierda)
    const rLeft = rect.x;
    const rRight = rect.x + rect.w;
    const rTop = rect.y;
    const rBottom = rect.y + rect.h;

    // Comprobar si hay superposición
    if (pRight <= rLeft || pLeft >= rRight || pBottom <= rTop || pTop >= rBottom) {
        return; // No hay colisión
    }

    // Si hay colisión, calcular cuánto se han solapado en cada dirección
    const overlapLeft = pRight - rLeft;
    const overlapRight = rRight - pLeft;
    const overlapTop = pBottom - rTop;
    const overlapBottom = rBottom - pTop;

    // Encontrar el solapamiento más pequeño para saber por dónde chocó
    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

    if (minOverlap === overlapTop) {
        // Chocó por arriba
        p.y = rTop - p.h / 2;
        p.vy = 0;
    } else if (minOverlap === overlapBottom) {
        // Chocó por abajo
        p.y = rBottom + p.h / 2;
        p.vy = 0;
        p.onGround = true;
    } else if (minOverlap === overlapLeft) {
        // Chocó por la izquierda
        p.x = rLeft - p.w / 2;
        p.vx = 0;
    } else if (minOverlap === overlapRight) {
        // Chocó por la derecha
        p.x = rRight + p.w / 2;
        p.vx = 0;
    }
}

function collidePlayers(p1, p2) {
    // Verificar si los rectángulos de los jugadores se superponen
    const overlapX = Math.max(0, Math.min(p1.x + p1.w / 2, p2.x + p2.w / 2) - Math.max(p1.x - p1.w / 2, p2.x - p2.w / 2));
    const overlapY = Math.max(0, Math.min(p1.y + p1.h / 2, p2.y + p2.h / 2) - Math.max(p1.y - p1.h / 2, p2.y - p2.h / 2));

    if (overlapX > 0 && overlapY > 0) {
        // Hay colisión, separar en la dirección del solapamiento menor
        if (overlapX < overlapY) {
            // Separar horizontalmente
            const dir = p1.x < p2.x ? -1 : 1;
            p1.x += dir * overlapX / 2;
            p2.x -= dir * overlapX / 2;
            p1.vx = 0;
            p2.vx = 0;
        } else {
            // Separar verticalmente
            const dir = p1.y < p2.y ? -1 : 1;
            p1.y += dir * overlapY / 2;
            p2.y -= dir * overlapY / 2;
            p1.vy = 0;
            p2.vy = 0;
        }
    }
}

// Colisión de la cabeza del jugador (círculo) con un rectángulo estático
// function collidePlayerHeadStaticRect(p, rect) {
//     const headCx = p.x;
//     const headCy = p.y - p.h / 2 - 18; // centro de la cabeza
//     const headR = 22;
//
//     const closestX = clamp(headCx, rect.x, rect.x + rect.w);
//     const closestY = clamp(headCy, rect.y, rect.y + rect.h);
//     const dx = headCx - closestX;
//     const dy = headCy - closestY;
//     const dist2 = dx * dx + dy * dy;
//
//     if (dist2 < headR * headR) {
//         const dist = Math.sqrt(dist2);
//         if (dist < 0.001) {
//             p.y += headR;
//             p.vy = Math.max(p.vy, 0);
//             return;
//         }
//         const nx = dx / dist;
//         const ny = dy / dist;
//         const overlap = headR - dist;
//         p.x += nx * overlap;
//         p.y += ny * overlap;
//         if (ny > 0) p.vy = Math.max(p.vy, 0); // frenar si rebota hacia abajo
//     }
// }

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

// function circleRectOverlap(c, r) {
//     const closestX = clamp(c.x, r.x, r.x + r.w);
//     const closestY = clamp(c.y, r.y, r.y + r.h);
//     const dx = c.x - closestX;
//     const dy = c.y - closestY;
//     return (dx * dx + dy * dy) <= (c.r * c.r);
// }

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}