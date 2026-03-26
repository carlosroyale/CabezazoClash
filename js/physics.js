// physics.js - Detección de colisiones y límites

import { RESTITUTION } from './constants.js';

export function collidePlayerBall(p, ball) {
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
        // Hay colisión, calcular la normal
        const dist = Math.sqrt(dist2);
        const nx = dx / dist;
        const ny = dy / dist;

        // Separar los objetos
        const overlap = ball.r - dist;
        ball.x += nx * overlap * 0.5;
        ball.y += ny * overlap * 0.5;
        p.x -= nx * overlap * 0.5;
        p.y -= ny * overlap * 0.5;

        // Calcular velocidad relativa
        const rvx = ball.vx - p.vx;
        const rvy = ball.vy - p.vy;

        // Velocidad a lo largo de la normal
        const velAlongNormal = rvx * nx + rvy * ny;

        // No resolver si se están separando
        if (velAlongNormal > 0) return;

        // Calcular impulso
        const j = -(1 + RESTITUTION) * velAlongNormal;
        const impulseX = j * nx;
        const impulseY = j * ny;

        // Aplicar impulso
        ball.vx += impulseX;
        ball.vy += impulseY;
        p.vx -= impulseX * 0.1; // El jugador se mueve menos
        p.vy -= impulseY * 0.1;
    }
}

export function checkGoalCollisions(ball, leftGoal, rightGoal) {
    const postSize = 8;

    // Hitboxes de los Largueros
    const leftCrossbar = { x: leftGoal.x, y: leftGoal.y, w: leftGoal.w, h: postSize };
    const rightCrossbar = { x: rightGoal.x, y: rightGoal.y, w: rightGoal.w, h: postSize };

    const hitboxes = [leftCrossbar, rightCrossbar];

    for (let box of hitboxes) {
        collideBallStaticRect(ball, box);
    }
}

export function collideBallStaticRect(ball, rect) {
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

export function collidePlayerStaticRect(p, rect) {
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

export function collidePlayers(p1, p2) {
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

export function circleRectOverlap(c, r) {
    const closestX = clamp(c.x, r.x, r.x + r.w);
    const closestY = clamp(c.y, r.y, r.y + r.h);
    const dx = c.x - closestX;
    const dy = c.y - closestY;
    return (dx * dx + dy * dy) <= (c.r * c.r);
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}