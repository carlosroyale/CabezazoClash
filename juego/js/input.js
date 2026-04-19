// input.js - Gestión del teclado

const keys = new Set();

const onKeyDown = (e) => {

    // Lógica del Espacio para alternar la Pausa
    if (e.code === "KeyR") {
        const pauseMenu = document.getElementById("pause-menu");
        const btnResume = document.getElementById("btn-resume");
        const contador = document.getElementById("contador-pausa");

        // Bloquear si la cuenta atrás ya se está ejecutando
        if (contador && !contador.classList.contains("hidden")) return;

        // Si el menú de pausa está abierto, "clicamos" en reanudar
        if (pauseMenu && !pauseMenu.classList.contains("hidden")) {
            if (btnResume) btnResume.click();
        }
        else {
            // Si está cerrado, pausamos normalmente
            if (window.Game && window.Game.pauseGame) {
                window.Game.pauseGame();
            }
        }
    }

    keys.add(e.code);

    // --- MAGIA ONLINE ---
    // Si la variable global de online está activa y el socket existe, avisamos al servidor
    if (window.isOnlineMode && typeof socket !== 'undefined') {
        socket.emit('playerInput', { key: e.code, isDown: true });
    }
};

/* ==========================================================================
   SISTEMA DE CONTROLES TÁCTILES
   ========================================================================== */

// Mapa que relaciona el ID del botón con la tecla que debe simular
const touchKeyMap = {
    "btn-touch-left": "KeyA",
    "btn-touch-right": "KeyD",
    "btn-touch-jump": "KeyW",
    "btn-touch-kick": "Space"
};

const handleTouchMovement = (e) => {
    e.preventDefault(); // Evita clics fantasma y scroll

    // Aquí guardaremos las teclas que DEBEN estar pulsadas en este fotograma
    const activeKeysThisFrame = new Set();

    // Revisamos todos los dedos que están tocando la pantalla ahora mismo
    for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];

        // Magia: detecta qué elemento exacto hay debajo de esta coordenada X/Y
        const elementUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);

        if (elementUnderFinger) {
            // Buscamos si el dedo está encima de un botón táctil (o de su icono)
            const btn = elementUnderFinger.closest('.touch-btn');
            if (btn && touchKeyMap[btn.id]) {
                activeKeysThisFrame.add(touchKeyMap[btn.id]);
            }
        }
    }

    // 1. Soltar teclas táctiles que ya no estamos tocando
    for (const key of Object.values(touchKeyMap)) {
        if (keys.has(key) && !activeKeysThisFrame.has(key)) {
            keys.delete(key);

            // --- MAGIA ONLINE TÁCTIL (Soltar) ---
            if (window.isOnlineMode && typeof socket !== 'undefined') {
                socket.emit('playerInput', { key: key, isDown: false });
            }
        }
    }

    // 2. Apretar las teclas que estamos tocando
    for (const key of activeKeysThisFrame) {
        // Importante: comprobar que no estuviera ya pulsada para no saturar el servidor
        if (!keys.has(key)) {
            keys.add(key);

            // --- MAGIA ONLINE TÁCTIL (Pulsar) ---
            if (window.isOnlineMode && typeof socket !== 'undefined') {
                socket.emit('playerInput', { key: key, isDown: true });
            }
        }
    }
};

// Vinculamos los eventos globalmente al contenedor de controles
window.addEventListener('DOMContentLoaded', () => {
    const touchArea = document.getElementById("touch-controls");
    if (touchArea) {
        // Usamos el mismo handler para cuando tocas, te mueves o sueltas
        touchArea.addEventListener('touchstart', handleTouchMovement, { passive: false });
        touchArea.addEventListener('touchmove', handleTouchMovement, { passive: false });
        touchArea.addEventListener('touchend', handleTouchMovement, { passive: false });
        touchArea.addEventListener('touchcancel', handleTouchMovement, { passive: false });
    }
});

const onKeyUp = (e) => {
    keys.delete(e.code);

    // --- MAGIA ONLINE ---
    if (window.isOnlineMode && typeof socket !== 'undefined') {
        socket.emit('playerInput', { key: e.code, isDown: false });
    }
};

// Añadimos { passive: false } para que el preventDefault del espacio funcione correctamente
window.addEventListener("keydown", onKeyDown, { passive: false });
window.addEventListener("keyup", onKeyUp);