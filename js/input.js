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

const onKeyUp = (e) => keys.delete(e.code);

// Añadimos { passive: false } para que el preventDefault del espacio funcione correctamente
window.addEventListener("keydown", onKeyDown, { passive: false });
window.addEventListener("keyup", onKeyUp);