// physics.js - Detección de colisiones y límites
//
// Este archivo concentra la parte "dura" de la física del minijuego Cabezazo:
// - Construye las hitboxes matemáticas de cada jugador.
// - Resuelve colisiones jugador-pelota, jugador-jugador y jugador-portería.
// - Aplica rebotes arcade, sonidos de impacto y reglas anti-atasco.
//
// La mayoría de funciones trabajan en coordenadas de pantalla:
// x crece hacia la derecha, y crece hacia abajo. Por eso una velocidad vertical
// negativa significa que algo sube y una normal con ny < 0 empuja hacia arriba.
// Los jugadores usan p.x/p.y como centro visual aproximado, mientras que la
// pelota y las hitboxes circulares usan x/y como centro real del círculo.

// Grosor físico del larguero. Solo colisiona la parte superior visible de la portería.
const GOAL_POST_SIZE = 8;

// Centro local del zapato respecto al centro del jugador antes de aplicar giro.
// Se refleja en X para el jugador que mira al lado contrario.
const PHYSICS_SHOE_LOCAL_CENTER_X = -3.5;
const PHYSICS_SHOE_LOCAL_CENTER_Y = 35;

// Radio usado para tratar cada zapato como círculo, lo que simplifica choques
// contra balón, cabeza, cuerpo y porterías.
const PHYSICS_SHOE_RADIUS = 14;

// Margen para decidir que ambos jugadores han llegado al balón "a la vez".
// Si sus puntuaciones de contacto difieren menos que esto, se alterna el orden.
const BALL_CONTACT_TIE_EPSILON = 0.5;

// Hasta que la pierna no se separa de verdad, el zapato de golpeo no se evalúa
// como una hitbox independiente; así se evita duplicar el pie en reposo.
const KICK_SHOE_SEPARATION_ANGLE = 0.0;
let fairBallCollisionTieBreaker = false;

/**
 * Actualiza el origen del barrido continuo de la pelota.
 *
 * El barrido usa ball.prevX/prevY para reconstruir el segmento recorrido por la
 * pelota en el frame actual. Cuando una colisión recoloca la pelota, estos
 * valores deben sincronizarse para que la siguiente prueba no vuelva a barrer
 * desde una posición anterior ya corregida.
 */
function syncBallSweepOrigin(ball) {
    ball.prevX = ball.x;
    ball.prevY = ball.y;
}

function syncBallStaticSweepOrigin(ball) {
    ball.staticPrevX = ball.x;
    ball.staticPrevY = ball.y;
}

/**
 * Antispam para el sonido de rebote de la pelota.
 *
 * Varias hitboxes pueden tocar la pelota en el mismo frame o en frames
 * consecutivos. Guardar la última reproducción en la propia pelota permite
 * compartir el cooldown entre cuerpo, cabeza, pie, suelo y otros rebotes.
 */
function canPlayBallReboundSound(ball, cooldownMs = 200) {
    const now = Date.now();
    if (ball._lastReboundSoundAt && now - ball._lastReboundSoundAt < cooldownMs) return false;

    ball._lastReboundSoundAt = now;
    return true;
}

/**
 * Antispam separado para impactos contra los postes/largueros.
 *
 * Usa otra marca de tiempo para que el golpe contra portería no bloquee ni sea
 * bloqueado por los sonidos normales de rebote jugador-pelota.
 */
function canPlayBallPostSound(ball, cooldownMs = 180) {
    const now = Date.now();
    if (ball._lastPostSoundAt && now - ball._lastPostSoundAt < cooldownMs) return false;

    ball._lastPostSoundAt = now;
    return true;
}

/**
 * Calcula la hitbox circular del zapato aplicando espejo y rotación.
 *
 * El offset del zapato está definido en un sistema local del jugador. Para el
 * jugador que mira a la izquierda se invierte el eje X; para el que mira a la
 * derecha se invierte el signo del ángulo de patada. El resultado siempre queda
 * expresado en coordenadas globales de pantalla.
 */
function getMirroredShoeHitboxAt(p, x, y, kickAngle = p.kickAngle) {
    const localShoeX = p.isRightFacing ? PHYSICS_SHOE_LOCAL_CENTER_X : -PHYSICS_SHOE_LOCAL_CENTER_X;
    const localShoeY = PHYSICS_SHOE_LOCAL_CENTER_Y;
    const rot = p.isRightFacing ? -kickAngle : kickAngle;

    return {
        x: x + (localShoeX * Math.cos(rot) - localShoeY * Math.sin(rot)),
        y: y + (localShoeX * Math.sin(rot) + localShoeY * Math.cos(rot)),
        r: PHYSICS_SHOE_RADIUS
    };
}

function getMirroredShoeHitbox(p, kickAngle = p.kickAngle) {
    return getMirroredShoeHitboxAt(p, p.x, p.y, kickAngle);
}

/**
 * Devuelve todas las hitboxes físicas de un jugador.
 *
 * Se divide el jugador en piezas simples:
 * - body: rectángulo AABB para el torso.
 * - head: círculo para la cabeza.
 * - shoe: círculo del pie que puede patear y rotar.
 * - supportShoe: círculo del pie en reposo, siempre presente.
 *
 * Mantener esta función centralizada es importante: render, depuración y física
 * deben usar los mismos tamaños para que la colisión coincida con lo dibujado.
 */
function getPlayerHitboxesAt(p, x = p.x, y = p.y, kickAngle = p.kickAngle) {
    const bodyW = p.w - 28;
    const bodyH = p.h - 55;
    const bodyY = y + 10;
    const bodyX = x - 5;
    const rectX = p.isRightFacing ? bodyX - bodyW / 2 : bodyX - (bodyW / 2) + 10;

    const headX = bodyX + 4;
    const headY = bodyY - bodyH;
    const headR = 21;

    return {
        body: { x: rectX, y: bodyY - bodyH / 2, w: bodyW, h: bodyH },
        head: { x: headX, y: headY, r: headR },
        shoe: getMirroredShoeHitboxAt(p, x, y, kickAngle),
        supportShoe: getMirroredShoeHitboxAt(p, x, y, 0),
        kickShoeSeparated: kickAngle > KICK_SHOE_SEPARATION_ANGLE
    };
}

function getPlayerHitboxes(p) {
    return getPlayerHitboxesAt(p);
}

/**
 * Detecta la postura concreta en la que ambos jugadores se dan la espalda.
 *
 * Este caso recibe tratamiento especial porque sus cuerpos pueden formar una
 * pinza horizontal que encierra la pelota entre las dos espaldas.
 */
function arePlayersBackToBack(p1, p2) {
    const leftPlayer = p1.x < p2.x ? p1 : p2;
    const rightPlayer = p1.x < p2.x ? p2 : p1;

    return !leftPlayer.isRightFacing && rightPlayer.isRightFacing;
}

/**
 * Comprueba si el balón está comprimido entre las espaldas de dos jugadores.
 *
 * No basta con que los jugadores estén de espaldas: la pelota también tiene que
 * estar entre los bordes interiores de los cuerpos y dentro de su rango vertical.
 * Si se cumple, otras rutinas de colisión se saltan temporalmente para no
 * introducir impulsos contradictorios.
 */
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

/**
 * Busca el primer contacto entre un segmento y un círculo.
 *
 * Se usa para colisión continua: en vez de mirar solo la posición final de la
 * pelota, se analiza todo el tramo desde prevX/prevY hasta x/y. El radio que
 * recibe esta función suele ser la suma de radios pelota+hitbox, de forma que el
 * centro de la pelota se trata como un punto contra un círculo expandido.
 *
 * Devuelve:
 * - t: momento normalizado del impacto dentro del segmento, entre 0 y 1.
 * - x/y: posición del centro de la pelota en el instante de contacto.
 * - nx/ny: normal desde la hitbox hacia la pelota.
 */
function findSegmentCircleContact(startX, startY, endX, endY, centerX, centerY, radius) {
    const segX = endX - startX;
    const segY = endY - startY;
    const relX = startX - centerX;
    const relY = startY - centerY;
    const a = segX * segX + segY * segY;

    if (a < 0.0001) return null;

    const b = 2 * (relX * segX + relY * segY);
    const c = relX * relX + relY * relY - radius * radius;

    // Si el centro ya empieza dentro del radio expandido, no podemos delegar
    // siempre en la colisión discreta: con mucha velocidad puede terminar fuera
    // por el lado opuesto y parecer que atraviesa el jugador. En ese caso se
    // trata como contacto inicial.
    if (c <= 0) {
        const dist = Math.hypot(relX, relY);
        const segLen = Math.sqrt(a);
        const deepInside = dist < radius * 0.55;
        let nx;
        let ny;

        if (dist >= 0.0001 && !deepInside) {
            nx = relX / dist;
            ny = relY / dist;
        }
        else {
            nx = -segX / segLen;
            ny = -segY / segLen;
        }

        const movingIntoCircle = segX * nx + segY * ny < -0.0001;
        if (!movingIntoCircle && !deepInside) return null;

        // Calculamos el punto de escape en el perímetro del círculo
        // en lugar de devolver startX y startY que dejaban la pelota atascada.
        return {
            t: 0,
            x: centerX + nx * radius,
            y: centerY + ny * radius,
            nx,
            ny
        };
    }

    const disc = b * b - 4 * a * c;

    if (disc < 0) return null;

    const sqrtDisc = Math.sqrt(disc);
    const invDen = 1 / (2 * a);

    // La raíz con signo negativo es la entrada al círculo expandido. La otra
    // raíz sería la salida, que no interesa para resolver el primer impacto.
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

function getRectEscapePoint(x, y, rect, radius, nx, ny) {
    if (Math.abs(nx) >= Math.abs(ny)) {
        return {
            x: nx < 0 ? rect.x - radius : rect.x + rect.w + radius,
            y
        };
    }

    return {
        x,
        y: ny < 0 ? rect.y - radius : rect.y + rect.h + radius
    };
}

/**
 * Busca el primer contacto entre un segmento y un rectángulo expandido.
 *
 * Es la versión continua de círculo contra rectángulo. En vez de mover un
 * círculo contra el cuerpo, se expande el rectángulo por el radio de la pelota
 * (suma de Minkowski) y se barre el centro de la pelota como si fuera un punto.
 *
 * La parte central usa el método de "slabs": se calcula el intervalo de t en el
 * que el segmento está dentro de las franjas X e Y del rectángulo expandido. Si
 * ambos intervalos se cruzan, el primer t común es el impacto.
 */
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
    const startInsideExpanded = startX >= minX && startX <= maxX && startY >= minY && startY <= maxY;

    if (startInsideExpanded) {
        // Si el barrido empieza ya dentro del rectángulo expandido, se trata
        // como contacto inicial cuando el movimiento entra todavía más o cuando
        // la pelota ya está muy dentro. Si no, la colisión discreta puede no ver
        // nada porque el centro acaba fuera por el otro lado del torso.
        const closestStartX = clamp(startX, rect.x, rect.x + rect.w);
        const closestStartY = clamp(startY, rect.y, rect.y + rect.h);
        let nx = startX - closestStartX;
        let ny = startY - closestStartY;
        const dist = Math.hypot(nx, ny);
        const startInsideRect = startX >= rect.x && startX <= rect.x + rect.w && startY >= rect.y && startY <= rect.y + rect.h;
        const deepInside = startInsideRect || dist < radius * 0.55;

        if (dist < radius) {
            if (dist >= 0.0001 && !deepInside) {
                nx /= dist;
                ny /= dist;
            }
            else {
                const dirLen = Math.hypot(dirX, dirY);
                if (dirLen >= 0.0001) {
                    nx = -dirX / dirLen;
                    ny = -dirY / dirLen;
                }
                else {
                    const left = Math.abs(startX - rect.x);
                    const right = Math.abs(rect.x + rect.w - startX);
                    const top = Math.abs(startY - rect.y);
                    const bottom = Math.abs(rect.y + rect.h - startY);
                    const minSide = Math.min(left, right, top, bottom);

                    if (minSide === left) {
                        nx = -1;
                        ny = 0;
                    }
                    else if (minSide === right) {
                        nx = 1;
                        ny = 0;
                    }
                    else if (minSide === top) {
                        nx = 0;
                        ny = -1;
                    }
                    else {
                        nx = 0;
                        ny = 1;
                    }
                }
            }

            const movingIntoRect = dirX * nx + dirY * ny < -0.0001;
            if (!movingIntoRect && !deepInside) return null;

            if (startInsideRect) {
                const escape = getRectEscapePoint(startX, startY, rect, radius, nx, ny);
                return {
                    t: 0,
                    x: escape.x,
                    y: escape.y,
                    nx,
                    ny
                };
            }

            return {
                t: 0,
                x: closestStartX + nx * radius,
                y: closestStartY + ny * radius,
                nx,
                ny
            };
        }
    }

    if (Math.abs(dirX) < 0.0001) {
        // Segmento casi vertical: si su X ni siquiera atraviesa el rectángulo
        // expandido, no puede haber contacto.
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
        // Segmento casi horizontal: mismo descarte, pero para la franja Y.
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
        // Impacto contra una cara plana: la normal depende de la dirección de
        // entrada porque el punto proyectado cae justo sobre el borde.
        nx = dirX > 0 ? -1 : 1;
        ny = 0;
    }
    else {
        nx = 0;
        ny = dirY > 0 ? -1 : 1;
    }

    return { t: tMin, x, y, nx, ny };
}

function findMovingCircleBallContact(startX, startY, endX, endY, prevCircle, currCircle, radius) {
    const relStartX = startX - prevCircle.x;
    const relStartY = startY - prevCircle.y;
    const relEndX = endX - currCircle.x;
    const relEndY = endY - currCircle.y;
    const contact = findSegmentCircleContact(relStartX, relStartY, relEndX, relEndY, 0, 0, radius);

    if (!contact) return null;

    const centerX = prevCircle.x + (currCircle.x - prevCircle.x) * contact.t;
    const centerY = prevCircle.y + (currCircle.y - prevCircle.y) * contact.t;

    return {
        ...contact,
        x: centerX + contact.x,
        y: centerY + contact.y
    };
}

function findMovingRectBallContact(startX, startY, endX, endY, prevRect, currRect, radius) {
    const rectMoveX = currRect.x - prevRect.x;
    const rectMoveY = currRect.y - prevRect.y;
    const relEndX = endX - rectMoveX;
    const relEndY = endY - rectMoveY;
    const contact = findSegmentExpandedRectContact(startX, startY, relEndX, relEndY, prevRect, radius);

    if (!contact) return null;

    return {
        ...contact,
        x: contact.x + rectMoveX * contact.t,
        y: contact.y + rectMoveY * contact.t
    };
}

/**
 * Calcula el primer contacto continuo entre la pelota y cualquier hitbox del jugador.
 *
 * Reúne candidatos contra cuerpo, cabeza y zapatos. Luego ordena por t para
 * resolver la primera hitbox alcanzada durante el frame. Esto reduce el efecto
 * de "tunneling", donde la pelota atraviesa una hitbox cuando va muy rápida.
 */
function findSweptPlayerBallContact(p, ball, h) {
    const startX = ball.prevX !== undefined ? ball.prevX : ball.x;
    const startY = ball.prevY !== undefined ? ball.prevY : ball.y;
    const endX = ball.x;
    const endY = ball.y;
    const prevX = p.prevX !== undefined ? p.prevX : p.x;
    const prevY = p.prevY !== undefined ? p.prevY : p.y;
    const prevKickAngle = p.prevKickAngle !== undefined ? p.prevKickAngle : p.kickAngle;
    const prevH = getPlayerHitboxesAt(p, prevX, prevY, prevKickAngle);

    // Excepción de fluidez para caídas casi verticales sobre el balón.
    // Si el jugador apenas avanza en X, no usamos el pie de apoyo como obstáculo
    // móvil: dejamos que la colisión discreta antigua haga que el balón resbale.
    // const playerMoveX = p.x - prevX;
    // const playerMoveY = p.y - prevY;
    // const mostlyVerticalFall = playerMoveY > 0 && Math.abs(playerMoveX) < 0;

    const contacts = [];
    const bodyContact = findMovingRectBallContact(startX, startY, endX, endY, prevH.body, h.body, ball.r);
    if (bodyContact) contacts.push({ ...bodyContact, shape: 'body' });

    const headContact = findMovingCircleBallContact(startX, startY, endX, endY, prevH.head, h.head, ball.r + h.head.r);
    if (headContact) contacts.push({ ...headContact, shape: 'head', shapeR: h.head.r });

    // const supportShoeContact = mostlyVerticalFall
    //     ? findSegmentCircleContact(startX, startY, endX, endY, h.supportShoe.x, h.supportShoe.y, ball.r + h.supportShoe.r)
    //     : findMovingCircleBallContact(startX, startY, endX, endY, prevH.supportShoe, h.supportShoe, ball.r + h.supportShoe.r);
    // const supportShoeContact = findMovingCircleBallContact(startX, startY, endX, endY, prevH.supportShoe, h.supportShoe, ball.r + h.supportShoe.r);
    const supportShoeContact = findSegmentCircleContact(startX, startY, endX, endY, h.supportShoe.x, h.supportShoe.y, ball.r + h.supportShoe.r);
    if (supportShoeContact) contacts.push({ ...supportShoeContact, shape: 'supportShoe', shapeR: h.supportShoe.r });

    if (h.kickShoeSeparated || prevH.kickShoeSeparated) {
        const shoeContact = findMovingCircleBallContact(startX, startY, endX, endY, prevH.shoe, h.shoe, ball.r + h.shoe.r);
        if (shoeContact) contacts.push({ ...shoeContact, shape: 'shoe', shapeR: h.shoe.r });
    }

    if (!contacts.length) return null;

    contacts.sort((a, b) => a.t - b.t);
    return contacts[0];
}

/**
 * Resuelve la colisión de un jugador contra la pelota.
 *
 * Orden de trabajo:
 * 1. Gestionar estado de contacto para audio/IA.
 * 2. Intentar colisión continua con el segmento recorrido por la pelota.
 * 3. Si no hubo contacto barrido, aplicar pruebas discretas por solapamiento.
 *
 * El barrido se evalúa antes porque es el único capaz de detectar impactos que
 * ocurren entre la posición anterior y la actual de la pelota.
 */
function collidePlayerBall(p, ball) {
    if (window.currentPlayers && isBackToBackBallSqueeze(ball, window.currentPlayers[0], window.currentPlayers[1])) {
        // En la pinza espalda-espalda la pelota se estabiliza en otra rutina.
        // Resolver aquí añadiría rebotes laterales que pueden expulsarla mal.
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
        // "skin" separa la pelota una fracción mínima tras el impacto para que
        // no quede exactamente sobre la superficie y vuelva a colisionar por
        // error en la siguiente comprobación del mismo frame.
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

            // Si el impacto barrido fue contra el zapato de chute...
            if (sweptContact.shape === 'shoe') {
                // 1. Aplicamos la fuerza y el rebote especial del latigazo.
                applyShoeBounce(ball, p, sweptContact.nx, sweptContact.ny);

                // 2. SAFEGUARD: Como el zapato es cinemático y se mueve instantáneamente
                // a su nueva posición final en este frame, forzamos la extracción
                // física de la pelota. Esto evita que la bota se "coma" la pelota.
                separateBallFromFinalShoe(ball, h.shoe, sweptContact.nx, sweptContact.ny);
            }
            else {
                // Para cabeza y pie de apoyo, el rebote estándar es suficiente.
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

/**
 * Extrae de forma segura la pelota si ha quedado atrapada dentro de la
 * posición final de la bota de chute tras el barrido continuo.
 * Sirve como escudo anti-clipping para animaciones cinemáticas rápidas.
 */
function separateBallFromFinalShoe(ball, shoe, fallbackNx, fallbackNy) {
    // Calculamos la distancia actual entre el centro de la pelota y la bota
    const dx = ball.x - shoe.x;
    const dy = ball.y - shoe.y;
    const minDist = ball.r + shoe.r; // La distancia mínima permitida (suma de radios)
    const dist2 = dx * dx + dy * dy;

    // Si la distancia al cuadrado es mayor o igual a la mínima, están separados. Salimos.
    if (dist2 >= minDist * minDist) return false;

    const dist = Math.sqrt(dist2);

    // Por defecto, usamos la normal del impacto inicial (del barrido) como salvavidas.
    // Esto evita que el cálculo explote (división por cero) si los centros coinciden exactamente.
    let nx = fallbackNx;
    let ny = fallbackNy;

    // Si hay una distancia mínima real, calculamos la dirección exacta de escape (la normal geométrica)
    if (dist >= 0.001) {
        nx = dx / dist;
        ny = dy / dist;
    }

    // Un margen extra de seguridad (skin) ligeramente más agresivo (0.6px).
    // Garantiza que en el siguiente substep del motor físico no vuelvan a detectarse como solapados.
    const skin = 0.6;

    // Empujamos la pelota justo al borde exterior de la bota + el margen de seguridad
    ball.x = shoe.x + nx * (minDist + skin);
    ball.y = shoe.y + ny * (minDist + skin);

    return true;
}

function getCircleBallContactScore(circle, ball) {
    // Valor negativo significa solapamiento. Cuanto menor sea, más "dentro"
    // está la pelota de esa hitbox circular.
    return Math.hypot(ball.x - circle.x, ball.y - circle.y) - (ball.r + circle.r);
}

function getRectBallContactScore(rect, ball) {
    // Para rectángulos se mide desde el punto más cercano del AABB al centro de
    // la pelota. Es la misma base geométrica que se usa para resolver el choque.
    const closestX = clamp(ball.x, rect.x, rect.x + rect.w);
    const closestY = clamp(ball.y, rect.y, rect.y + rect.h);
    return Math.hypot(ball.x - closestX, ball.y - closestY) - ball.r;
}

/**
 * Devuelve la puntuación de contacto más intensa entre un jugador y el balón.
 *
 * Se usa para decidir qué jugador debe resolver primero cuando ambos están
 * cerca de la pelota. La menor puntuación indica el contacto más profundo.
 */
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

/**
 * Resuelve jugador-pelota de forma equilibrada entre ambos jugadores.
 *
 * Resolver siempre P1 antes que P2 introduce ventaja en contactos simultáneos.
 * Aquí se calcula quién está más cerca del balón y, en empates, se alterna el
 * primer turno. El jugador que empieza se evalúa dos veces para corregir el
 * pequeño cambio de posición que puede provocar la resolución del rival.
 */
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

/**
 * Corrige un solapamiento pelota-rectángulo y aplica rebote.
 *
 * dx/dy apuntan desde el punto más cercano del rectángulo hacia el centro de la
 * pelota. Al normalizarlos obtenemos la normal de salida. Si la pelota está
 * exactamente en un punto degenerado se usa una normal horizontal de respaldo.
 */
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

/**
 * Corrige un solapamiento pelota-círculo y aplica rebote normal.
 *
 * Sirve para cabeza y pie de apoyo. El zapato de golpeo usa otra función porque
 * tiene velocidad propia derivada del ángulo de patada.
 */
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

/**
 * Aplica un rebote arcade entre pelota y jugador sobre una normal dada.
 *
 * mathVelAlongNormal usa las velocidades jugables, que pueden estar capadas o
 * corregidas por la lógica arcade. realVelAlongNormal usa la velocidad medida
 * del frame para el sonido; así no suenan impactos cuando dos cuerpos están
 * pegados pero realmente no se mueven.
 */
function applyBounce(ball, p, nx, ny) {
    // AVISAMOS QUE HAY CONTACTO ESTE FRAME
    p.isTouchingBall = true;
    p.touchedBallSinceLastAI = true;

    // 1. MATEMÁTICAS ARCADE
    const mathRvx = ball.vx - p.vx;
    const mathRvy = ball.vy - p.vy;
    const mathVelAlongNormal = mathRvx * nx + mathRvy * ny;

    // Si la velocidad relativa no entra contra la superficie con suficiente
    // fuerza, solo se mantiene la separación ya aplicada y no se añade impulso.
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
    // Impulso escalar de un choque elástico simplificado. No hay masa explícita:
    // se asume masa 1 y todo el impulso se aplica a la pelota.
    const j = -(1 + RESTITUTION) * mathVelAlongNormal;
    ball.vx += j * nx;
    ball.vy += j * ny;

    // Límite de seguridad para que varias colisiones encadenadas no creen
    // velocidades imposibles y rompan la jugabilidad.
    const MAX_BALL_SPEED = 950;
    const spd = Math.hypot(ball.vx, ball.vy);
    if (spd > MAX_BALL_SPEED) {
        ball.vx = ball.vx * MAX_BALL_SPEED / spd;
        ball.vy = ball.vy * MAX_BALL_SPEED / spd;
    }
}

/**
 * Aplica el rebote especial del zapato de golpeo.
 *
 * El zapato no tiene una velocidad física real independiente, así que se
 * sintetiza una velocidad a partir del movimiento del jugador y del estado de
 * la pierna. Cuando la pierna sube se añade fuerza hacia delante y hacia arriba
 * para que el chut tenga sensación de latigazo.
 */
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
        // El jugador que mira a la derecha empuja en X positiva; el que mira a
        // la izquierda empuja en X negativa. La Y negativa da elevación.
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
        // Al bajar la pierna el pie arrastra menos hacia portería y más hacia
        // abajo, de modo que no todos los contactos con el zapato son disparos.
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

/**
 * Comprueba la pelota contra los largueros de ambas porterías.
 *
 * Los postes laterales no se crean aquí; el juego usa el larguero superior como
 * rectángulo estático principal para los rebotes de la pelota.
 */
function checkGoalCollisions(ball, leftGoal, rightGoal) {
    const hitboxes = getGoalCrossbarRects(leftGoal, rightGoal);

    for (let box of hitboxes) {
        collideBallStaticRectSwept(ball, box);
    }
}

/**
 * Versión discreta del choque pelota-zapato.
 *
 * Primero separa geométricamente la pelota con la normal real del solapamiento y
 * después delega en applyShoeBounce para reutilizar la misma respuesta que en el
 * barrido continuo.
 */
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

/**
 * Resuelve colisión de pelota contra un rectángulo estático.
 *
 * Se usa para los largueros: se proyecta el centro de la pelota al punto más
 * cercano del rectángulo, se separa por la normal y se refleja la velocidad.
 */
function resolveBallStaticRectBounce(ball, nx, ny) {
    const velAlongNormal = ball.vx * nx + ball.vy * ny;

    // Sonido contra poste/larguero usando velocidad real cuando está disponible.
    const realVelAlongNormal = (ball.realVx || 0) * nx + (ball.realVy || 0) * ny;
    if (realVelAlongNormal < -40 && canPlayBallPostSound(ball)) {
        window.playSound('sfx-ball-post');
    }

    // Si la pelota ya se está separando de la superficie, solo dejamos la
    // corrección geométrica. Reflejar aquí podría reintroducirla en el larguero.
    if (velAlongNormal >= 0) return;

    ball.vx -= 2 * velAlongNormal * nx * RESTITUTION;
    ball.vy -= 2 * velAlongNormal * ny * RESTITUTION;
}

function getStaticRectFallbackNormal(ball, rect) {
    const startX = ball.staticPrevX !== undefined ? ball.staticPrevX : (ball.prevX !== undefined ? ball.prevX : ball.x);
    const startY = ball.staticPrevY !== undefined ? ball.staticPrevY : (ball.prevY !== undefined ? ball.prevY : ball.y);

    if (startX < rect.x) return { nx: -1, ny: 0 };
    if (startX > rect.x + rect.w) return { nx: 1, ny: 0 };
    if (startY < rect.y) return { nx: 0, ny: -1 };
    if (startY > rect.y + rect.h) return { nx: 0, ny: 1 };

    const moveX = ball.x - startX;
    const moveY = ball.y - startY;
    if (Math.abs(moveX) > Math.abs(moveY) && Math.abs(moveX) > 0.0001) {
        return { nx: moveX > 0 ? -1 : 1, ny: 0 };
    }
    if (Math.abs(moveY) > 0.0001) {
        return { nx: 0, ny: moveY > 0 ? -1 : 1 };
    }

    const left = Math.abs(ball.x - rect.x);
    const right = Math.abs(rect.x + rect.w - ball.x);
    const top = Math.abs(ball.y - rect.y);
    const bottom = Math.abs(rect.y + rect.h - ball.y);
    const minSide = Math.min(left, right, top, bottom);

    if (minSide === left) return { nx: -1, ny: 0 };
    if (minSide === right) return { nx: 1, ny: 0 };
    if (minSide === top) return { nx: 0, ny: -1 };
    return { nx: 0, ny: 1 };
}

function resolveBallStaticRectDiscrete(ball, rect) {
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
        let nx;
        let ny;

        if (dist < 0.001) {
            ({ nx, ny } = getStaticRectFallbackNormal(ball, rect));
            const escape = getRectEscapePoint(ball.x, ball.y, rect, ball.r, nx, ny);
            ball.x = escape.x;
            ball.y = escape.y;
        }
        else {
            nx = dx / dist;
            ny = dy / dist;

            // Separar
            const overlap = ball.r - dist;
            ball.x += nx * overlap;
            ball.y += ny * overlap;
        }

        resolveBallStaticRectBounce(ball, nx, ny);
        syncBallSweepOrigin(ball);
        syncBallStaticSweepOrigin(ball);
        return true;
    }

    return false;
}

function collideBallStaticRectSwept(ball, rect) {
    const startX = ball.staticPrevX !== undefined ? ball.staticPrevX : (ball.prevX !== undefined ? ball.prevX : ball.x);
    const startY = ball.staticPrevY !== undefined ? ball.staticPrevY : (ball.prevY !== undefined ? ball.prevY : ball.y);
    const contact = findSegmentExpandedRectContact(startX, startY, ball.x, ball.y, rect, ball.r);

    if (contact) {
        // Calculamos a qué distancia real está el punto de contacto continuo
        // del rectángulo físico original.
        const closestX = clamp(contact.x, rect.x, rect.x + rect.w);
        const closestY = clamp(contact.y, rect.y, rect.y + rect.h);
        const dist2 = (contact.x - closestX) ** 2 + (contact.y - closestY) ** 2;

        // Si la distancia al cuadrado es mayor que el radio al cuadrado, significa
        // que el barrido ha chocado con la "repisa invisible" (la esquina puntiaguda
        // de la expansión matemática).
        if (dist2 > ball.r * ball.r + 0.1) {
            // Ignoramos este falso positivo y dejamos que la función discreta
            // gestione la caída redondeada de forma natural.
            resolveBallStaticRectDiscrete(ball, rect);
            return;
        }

        const skin = 0.2;
        ball.x = contact.x + contact.nx * skin;
        ball.y = contact.y + contact.ny * skin;
        resolveBallStaticRectBounce(ball, contact.nx, contact.ny);
        syncBallSweepOrigin(ball);
        syncBallStaticSweepOrigin(ball);
        return;
    }

    resolveBallStaticRectDiscrete(ball, rect);
}

function collideBallStaticRect(ball, rect) {
    collideBallStaticRectSwept(ball, rect);
}

/**
 * Crea las hitboxes físicas del larguero de cada portería.
 *
 * allowStand=false indica que los jugadores no deberían poder quedarse apoyados
 * encima de estos rectángulos como si fueran plataformas.
 */
function getGoalCrossbarRects(leftGoal, rightGoal) {
    return [
        { x: leftGoal.x, y: leftGoal.y, w: leftGoal.w, h: GOAL_POST_SIZE, allowStand: false },
        { x: rightGoal.x, y: rightGoal.y, w: rightGoal.w, h: GOAL_POST_SIZE, allowStand: false }
    ];
}

/**
 * Añade bloqueadores invisibles sobre las porterías para los jugadores.
 *
 * Los largueros detienen la pelota, pero los jugadores también necesitan una
 * barrera vertical que impida atravesar el espacio por encima de la portería.
 * preferHorizontalExit fuerza que la salida sea lateral y no hacia arriba/abajo.
 */
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

/**
 * Resuelve todas las colisiones de un jugador contra las porterías.
 */
function collidePlayerGoals(p, leftGoal, rightGoal) {
    const hitboxes = getGoalPlayerCollisionRects(leftGoal, rightGoal);

    for (const hitbox of hitboxes) {
        collidePlayerStaticRect(p, hitbox);
    }
}

// --- SISTEMA DE COLISIÓN: JUGADOR VS PORTERÍA (Largueros) ---

/**
 * Comprueba cuerpo, cabeza y zapatos contra un rectángulo estático.
 *
 * Las hitboxes se recalculan después de cada resolución porque mover el cuerpo
 * también desplaza cabeza y zapatos. Si se usaran las coordenadas antiguas, la
 * segunda prueba podría resolver desde una posición ya obsoleta.
 */
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

/**
 * Resuelve cuerpo rectangular contra un rectángulo estático.
 *
 * Calcula cuánto se solapan en cada dirección y empuja por el eje más adecuado.
 * Si el rectángulo no permite apoyo, o si es un bloqueador de aire, se prioriza
 * la salida horizontal para que el jugador no pueda usar la portería como suelo.
 */
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
        // El jugador cae desde arriba sobre una superficie pisable.
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

/**
 * Empuja un jugador fuera de un rectángulo por el lado horizontal más cercano.
 */
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

/**
 * Resuelve una hitbox circular del jugador contra un rectángulo estático.
 *
 * Para cabeza y zapatos se vuelve a usar la proyección al punto más cercano del
 * rectángulo. Cuando el rectángulo no admite apoyo, se fuerza salida lateral si
 * el círculo está en la mitad superior del bloqueador.
 */
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

/**
 * Resuelve las colisiones entre los dos jugadores.
 *
 * El orden es deliberado:
 * 1. Cuerpo-cuerpo para el empuje principal.
 * 2. Cabeza-cabeza para choques aéreos.
 * 3. Zapato-cabeza para patadas o bloqueos con el pie.
 * 4. Cabeza-cuerpo para evitar atravesar espalda/nuca.
 * 5. Zapato-cuerpo para apoyos o empujes con el pie.
 *
 * Tras cada bloque se recalculan hitboxes, porque cada resolución puede mover a
 * un jugador y dejar inválidas las coordenadas calculadas antes.
 */
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
    // El pie de chute levantado no colisiona contra el rival.
    // Así evitamos que un jugador pueda retener la pelota contra el césped
    // usando la pierna como una pared que empuja al otro jugador.
    h1 = getPlayerHitboxes(p1);
    h2 = getPlayerHitboxes(p2);
    // Le pasamos el atacante y el objetivo
    //if (h1.kickShoeSeparated) resolveShoeHeadPlayer(h1.shoe, p1, p2, h2.head, true);
    resolveShoeHeadPlayer(h1.supportShoe, p1, p2, h2.head, false);
    // if (h2.kickShoeSeparated) resolveShoeHeadPlayer(h2.shoe, p2, p1, h1.head, true);
    resolveShoeHeadPlayer(h2.supportShoe, p2, p1, h1.head, false);

    // D. CABEZA vs CUERPO (Evita atravesar nuca contra espalda)
    h1 = getPlayerHitboxes(p1);
    h2 = getPlayerHitboxes(p2);
    resolveHeadBodyPlayer(p1, p2, h1.head, h2.body);
    resolveHeadBodyPlayer(p2, p1, h2.head, h1.body);

    // E. ZAPATO vs CUERPO (La magia para subirse encima del pie del otro)
    // Solo el pie de apoyo bloquea al rival. El pie de chute sigue golpeando
    // la pelota, pero deja de actuar como una barrera física contra jugadores.
    h1 = getPlayerHitboxes(p1);
    h2 = getPlayerHitboxes(p2);
    // Le pasamos el jugador atacante como segundo parámetro
    // if (h1.kickShoeSeparated) resolveCircRectPlayer(h1.shoe, p1, p2, h2.body, true);
    resolveCircRectPlayer(h1.supportShoe, p1, p2, h2.body, false);
    // if (h2.kickShoeSeparated) resolveCircRectPlayer(h2.shoe, p2, p1, h1.body, true);
    resolveCircRectPlayer(h2.supportShoe, p2, p1, h1.body, false);
}

// 3. Resoluciones físicas específicas para Jugador vs Jugador

/**
 * Marca que un jugador está apoyado sobre el rival, no sobre el suelo real.
 *
 * groundedByPlayer permite distinguir este apoyo de tocar el FLOOR_Y. Así otras
 * rutinas pueden decidir si permitir salto, resetear estados o evitar saltos
 * encadenados raros al deslizarse por encima del otro jugador.
 */
function markGroundedOnRival(player) {
    player.onGround = true;
    player.groundedByPlayer = true;
}

/**
 * Mueve a un jugador por una resolución de contacto con el rival.
 *
 * La elevación vertical se limita con rivalLiftBudget para que varios contactos
 * del mismo frame (cuerpo, cabeza, pie) no sumen elevación excesiva y lancen al
 * jugador hacia arriba.
 */
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

/**
 * Comprueba si un rectángulo estaba encima de un círculo en el frame anterior.
 *
 * Esta prueba temporal evita interpretar como "apoyo" un choque lateral que en
 * la posición final parece vertical. Solo se permite sostener al jugador si ya
 * venía claramente desde arriba.
 */
function wasRectAboveCircle(player, rect, circleOwner, circle, tolerance = 2) {
    const prevPlayerY = player.prevY !== undefined ? player.prevY : player.y;
    const prevCircleOwnerY = circleOwner.prevY !== undefined ? circleOwner.prevY : circleOwner.y;
    const prevRectBottom = rect.y + rect.h - (player.y - prevPlayerY);
    const prevCircleTop = circle.y - circle.r - (circleOwner.y - prevCircleOwnerY);

    return prevRectBottom <= prevCircleTop + tolerance;
}

/**
 * Variante círculo-círculo de la comprobación de apoyo del frame anterior.
 *
 * Se usa, por ejemplo, para decidir si la cabeza puede quedar apoyada sobre el
 * zapato de otro jugador en lugar de recibir un empuje lateral.
 */
function wasCircleAboveCircle(player, playerCircle, circleOwner, ownerCircle, tolerance = 2) {
    const prevPlayerY = player.prevY !== undefined ? player.prevY : player.y;
    const prevCircleOwnerY = circleOwner.prevY !== undefined ? circleOwner.prevY : circleOwner.y;
    const prevPlayerCircleBottom = playerCircle.y + playerCircle.r - (player.y - prevPlayerY);
    const prevOwnerCircleTop = ownerCircle.y - ownerCircle.r - (circleOwner.y - prevCircleOwnerY);

    return prevPlayerCircleBottom <= prevOwnerCircleTop + tolerance;
}

/**
 * Aplica el desplazamiento de un contacto zapato-rival.
 * Ahora reparte el empuje horizontal entre ambos para evitar
 * el efecto "Bulldozer" de masa infinita con la pierna levantada.
 */
function movePlayerByShoeContact(pTarget, pAttacker, nx, ny, overlap, allowVerticalLift) {
    const dx = -nx * overlap;
    const dy = -ny * overlap;

    // Si el impacto empuja en horizontal (y no está permitido usarlo como plataforma)
    if (dy < 0 && !allowVerticalLift) {
        const fallbackDir = pTarget.x < pAttacker.x ? -1 : 1;
        const horizontalDir = Math.abs(dx) > 0.001 ? Math.sign(dx) : fallbackDir;

        // Dividimos el empuje máximo entre 2 para repartirlo
        const horizontalPush = Math.max(Math.abs(dx), Math.min(overlap, 8)) / 2;

        // Separamos a AMBOS jugadores
        pTarget.x += horizontalDir * horizontalPush;
        pAttacker.x -= horizontalDir * horizontalPush; // Novedad: el atacante retrocede

        // Frenamos la velocidad de ambos si están yendo en contra del empuje
        if (pTarget.vx * horizontalDir < 0) pTarget.vx = 0;
        if (pAttacker.vx * -horizontalDir < 0) pAttacker.vx = 0;
        return;
    }

    // Si hay elevación (el target se sube al pie), el Target sube (dy),
    // pero el impacto horizontal (dx) se sigue repartiendo a partes iguales.
    movePlayerByRivalContact(pTarget, dx / 2, dy);
    movePlayerByRivalContact(pAttacker, -dx / 2, 0); // El atacante no se eleva, pero cede en X
}

/**
 * Resuelve el solapamiento entre los cuerpos rectangulares de ambos jugadores.
 *
 * Por defecto separa horizontalmente, que es lo más estable para choques de
 * carrera. Solo resuelve verticalmente cuando el frame anterior demuestra que un
 * jugador estaba claramente encima y cayendo sobre el otro.
 */
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

/**
 * Resuelve choques entre dos hitboxes circulares de jugadores.
 *
 * Principalmente cabeza-cabeza. Si el choque era lateral, separa en X para no
 * generar apoyos falsos. Si había apilamiento vertical, reparte el empuje sobre
 * ambos jugadores y puede marcar como apoyado al que cae encima.
 */
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

/**
 * Resuelve cabeza de un jugador contra cuerpo rectangular del rival.
 *
 * Protege los casos donde la cabeza queda metida en el torso contrario. Los
 * choques laterales se sacan horizontalmente para no levantar al jugador; los
 * contactos desde arriba/abajo usan la normal real.
 */
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

/**
 * Resuelve zapato circular contra cuerpo rectangular del rival.
 *
 * Esta función cubre tanto el pie de golpeo como el pie de apoyo. Si el zapato
 * está realmente debajo del rival y este cae sobre él, puede actuar como apoyo.
 * En otros ángulos se usa como empuje para evitar atraviesos sin crear saltos.
 */
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

/**
 * Resuelve zapato contra cabeza del rival.
 *
 * Además de separar las hitboxes, registra si la pierna levantada ha golpeado al
 * rival para disparar el sonido adecuado y para que la IA pueda saber que hubo
 * contacto ofensivo.
 */
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

/**
 * Estabiliza la pelota cuando queda entre dos jugadores espalda contra espalda.
 *
 * En ese caso se elimina la velocidad y se recentra la pelota en el hueco entre
 * los cuerpos. Es una regla de estabilidad: mejor congelar la pelota un instante
 * que permitir que una doble resolución la dispare o la meta dentro de un torso.
 */
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

/**
 * Detecta y corrige una pelota atrapada entre dos jugadores.
 *
 * Funciona cuando los cuerpos comprimen la pelota horizontalmente. Si todavía
 * existe hueco, recoloca la pelota dentro de una zona segura entre ambos. Si no
 * hay hueco suficiente, delega en una salida vertical hacia arriba.
 */
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

/**
 * Escapa de una pinza horizontal sin hueco suficiente.
 *
 * La pelota se coloca justo por encima de la parte común de los cuerpos y se le
 * da una velocidad vertical mínima hacia arriba. También separa un poco a los
 * jugadores para que en el frame siguiente no vuelvan a cerrar la pinza.
 */
function resolveBallVerticalPinchEscape(ball, leftPlayer, rightPlayer, leftHitbox, rightHitbox) {
    const leftBodyRight = leftHitbox.body.x + leftHitbox.body.w;
    const rightBodyLeft = rightHitbox.body.x;
    const sharedHeadTop = Math.min(
        leftHitbox.head.y - leftHitbox.head.r,
        rightHitbox.head.y - rightHitbox.head.r
    );
    const centerX = (leftBodyRight + rightBodyLeft) / 2;

    ball.x = centerX;
    ball.y = Math.min(ball.y, sharedHeadTop - ball.r - 3);
    ball.vx = 0;
    ball.vy = Math.min(ball.vy || 0, -360);

    leftPlayer.x -= 10;
    rightPlayer.x += 10;

    if (leftPlayer.vx > 0) leftPlayer.vx = 0;
    if (rightPlayer.vx < 0) rightPlayer.vx = 0;

    syncBallSweepOrigin(ball);
}

/**
 * Evita que la pelota quede aplastada entre un jugador y el suelo.
 *
 * Cuando la pelota está casi en el suelo y una o dos hitboxes de jugador la
 * cubren por encima durante varios frames, se levanta ligeramente. El contador
 * _floorCrushFrames evita activar la corrección por contactos instantáneos.
 */
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

    // La salida lateral completa queda comentada más abajo. La corrección activa
    // actual es conservadora: sube la pelota unos píxeles y reinicia el barrido.
    ball.y = floorY - ball.r - 3;

    // if (crushingPlayers.length === 2) {
    //     const leftPlayer = p1.x <= p2.x ? p1 : p2;
    //     const rightPlayer = p1.x <= p2.x ? p2 : p1;
    //
    //     const trapLeft = Math.min(crushingPlayers[0].minX, crushingPlayers[1].minX);
    //     const trapRight = Math.max(crushingPlayers[0].maxX, crushingPlayers[1].maxX);
    //     const pairCenter = (leftPlayer.x + rightPlayer.x) / 2;
    //     let escapeDir = ball.x < pairCenter ? -1 : 1;
    //
    //     if (Math.abs(ball.x - pairCenter) < 1) {
    //         escapeDir = ball._lastFloorCrushEscapeDir === 1 ? -1 : 1;
    //     }
    //     if (worldW && escapeDir < 0 && trapLeft - ball.r - 4 < 0) escapeDir = 1;
    //     if (worldW && escapeDir > 0 && trapRight + ball.r + 4 > worldW) escapeDir = -1;
    //
    //     ball.x = escapeDir < 0 ? trapLeft - ball.r - 4 : trapRight + ball.r + 4;
    //     ball.vx = escapeDir * Math.max(Math.abs(ball.vx || 0), 380);
    //     ball.vy = Math.min(ball.vy || 0, -220);
    //     ball._lastFloorCrushEscapeDir = escapeDir;
    //
    //     leftPlayer.x -= 14;
    //     rightPlayer.x += 14;
    //     if (leftPlayer.vx > 0) leftPlayer.vx = 0;
    //     if (rightPlayer.vx < 0) rightPlayer.vx = 0;
    // }
    // else {
    //     const crusher = crushingPlayers[0];
    //     const player = crusher.player;
    //     let escapeDir = ball.x < player.x ? -1 : 1;
    //
    //     if (Math.abs(ball.x - player.x) < 1) {
    //         escapeDir = ball._lastFloorCrushEscapeDir === 1 ? -1 : 1;
    //     }
    //     if (worldW && escapeDir < 0 && crusher.minX - ball.r - 4 < 0) escapeDir = 1;
    //     if (worldW && escapeDir > 0 && crusher.maxX + ball.r + 4 > worldW) escapeDir = -1;
    //
    //     ball.x = escapeDir < 0 ? crusher.minX - ball.r - 4 : crusher.maxX + ball.r + 4;
    //     ball.vx = escapeDir * Math.max(Math.abs(ball.vx || 0), 320);
    //     ball.vy = Math.min(ball.vy || 0, -180);
    //     ball._lastFloorCrushEscapeDir = escapeDir;
    //
    //     player.x -= escapeDir * 8;
    //     if (player.vx * escapeDir > 0) player.vx = 0;
    // }

    ball._floorCrushFrames = 0;
    syncBallSweepOrigin(ball);
}

/**
 * Determina si un jugador está aplastando la pelota contra el suelo.
 *
 * Devuelve el rango horizontal total de sus hitboxes relevantes. Ese rango se
 * conserva para posibles estrategias de escape lateral y para saber desde dónde
 * se está cerrando la trampa.
 */
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

/**
 * Limita v al intervalo [min, max].
 */
function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

/**
 * Reproduce el sonido de patada entre jugadores con filtros de repetición.
 *
 * Solo suena si el contacto no venía ya del frame anterior y si hay movimiento
 * real suficiente, o si la pierna está en pleno gesto de golpeo. Se guarda el
 * cooldown en el objetivo para no repetir el audio cada frame de contacto.
 */
function playPlayerKickSound(pAttacker, pTarget) {
    // Si ya venía golpeando al rival en el frame anterior, ignoramos el sonido.
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

/**
 * Reproduce el sonido de choque entre jugadores con cooldown y umbral físico.
 *
 * Usa velocidades reales del último frame para diferenciar un impacto de dos
 * jugadores simplemente empujándose. El cooldown se marca en ambos cuerpos para
 * que el sonido no se duplique al resolver varias hitboxes en cadena.
 */
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
    // Export mínimo para pruebas o simulaciones en Node. En navegador estas
    // funciones quedan disponibles en el ámbito global al cargar el script.
    module.exports = {
        getPlayerHitboxes, arePlayersBackToBack, isBackToBackBallSqueeze,
        collidePlayerBall, collidePlayersBallFair, checkGoalCollisions, collidePlayerStaticRect, collidePlayerGoals,
        collidePlayers, resolveBackToBackBallSqueeze, resolveBallSqueezeUp, resolveBallFloorCrush
    };
}