// constants.js - Valores fijos y configuración del juego

const GRAV = 2200;           // px/s^2
const RESTITUTION = 0.7;     // rebote pelota
const FRICTION = 0.88;       // fricción en suelo (pelota)
const DT_MAX = 1 / 30;
const GOAL_W = 80;
const GOAL_H = 200;

// --- EXPORTACIÓN PARA NODE.JS ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GRAV, RESTITUTION, FRICTION, DT_MAX, GOAL_W, GOAL_H };
}