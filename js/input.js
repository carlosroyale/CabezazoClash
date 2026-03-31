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
        } else {
            // Si está cerrado, pausamos normalmente
            if (window.Game && window.Game.pauseGame) {
                window.Game.pauseGame();
            }
        }
    }

    keys.add(e.code);
};

/* ==========================================================================
   SISTEMA DE CONTROLES TÁCTILES
   ========================================================================== */
const setupTouchButton = (id, keyCode) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    // Al poner el dedo, simulamos que se pulsa la tecla
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Evita clics fantasma del ratón
        keys.add(keyCode);
    }, { passive: false });

    // Al levantar el dedo (o salir del botón), soltamos la tecla
    const releaseKey = (e) => {
        e.preventDefault();
        keys.delete(keyCode);
    };

    btn.addEventListener('touchend', releaseKey, { passive: false });
    btn.addEventListener('touchcancel', releaseKey, { passive: false });
};

// Vinculamos los botones a las teclas del Jugador 1
// Si el HTML de los botones existe, se activarán
window.addEventListener('DOMContentLoaded', () => {
    setupTouchButton("btn-touch-left", "KeyA");
    setupTouchButton("btn-touch-right", "KeyD");
    setupTouchButton("btn-touch-jump", "KeyW");
    setupTouchButton("btn-touch-kick", "Space");
});

const onKeyUp = (e) => keys.delete(e.code);

// Añadimos { passive: false } para que el preventDefault del espacio funcione correctamente
window.addEventListener("keydown", onKeyDown, { passive: false });
window.addEventListener("keyup", onKeyUp);