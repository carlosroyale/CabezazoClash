// input.js - Gestión del teclado

const keys = new Set();

const onKeyDown = (e) => {
    keys.add(e.code);

    if (e.code === "Escape") {
        // Pausar el juego si está corriendo
        if (window.Game && window.Game.pauseGame) {
            window.Game.pauseGame();
        }
    }
    if (e.code === "KeyR") {
        // Reiniciar ronda
        if (window.Game && window.Game.resetRound) {
            window.Game.resetRound();
        }
    }
};

const onKeyUp = (e) => keys.delete(e.code);

// Los listeners se añaden globalmente
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);