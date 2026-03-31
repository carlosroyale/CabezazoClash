// main.js - Control de UI, menús y ajustes
// Estructurado al estilo de volador.js


/* ==========================================================================
   CONFIGURACIÓN Y ELEMENTOS DEL DOM
   ========================================================================== */

// Pantallas
const screenStart = document.getElementById("screen-start");
const screenOptions = document.getElementById("screen-options");
const screenGame = document.getElementById("screen-game");
const screenEnd = document.getElementById("screen-end");
const screenHowToPlay = document.getElementById("screen-how-to-play");
const screenInfo = document.getElementById("screen-info");
const screenModeSelect = document.getElementById("screen-mode-select");
const screenTouchWarning = document.getElementById("screen-touch-warning");
const touchControls = document.getElementById("touch-controls");

// Botones de navegación
const btnPlay = document.getElementById("btn-play");
const btnBack = document.getElementById("btn-back");
const btnBasic = document.getElementById("btn-basic");
const btnAdvanced = document.getElementById("btn-advanced");
const btnOptions = document.getElementById("btn-options");
const btnOptionsBack = document.getElementById("btn-options-back");
const btnHowToPlay = document.getElementById("btn-how-to-play");
const btnCloseHowToPlay = document.getElementById("btn-close-how-to-play");
const btnInfo = document.getElementById("btn-info");
const btnCloseInfo = document.getElementById("btn-close-info");
const btn1v1 = document.getElementById("btn-1v1");
const btn1vBot = document.getElementById("btn-1vbot");
const btnModeBack = document.getElementById("btn-mode-back");
const btnTouchWarningOk = document.getElementById("btn-touch-warning-ok");

// Elementos de opciones
const musicVolumeSlider = document.getElementById("music-volume");
const musicVolumeValue = document.getElementById("music-volume-value");
const sfxVolumeSlider = document.getElementById("sfx-volume");
const sfxVolumeValue = document.getElementById("sfx-volume-value");

// Renombramos el botón de volver
const btnEntendido = document.getElementById("btn-entendido");

// Elementos del juego
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");
const bgMusic = document.getElementById("bg-music");

// Elementos de la pantalla de fin
const finalScoreEl = document.getElementById("final-score");
const winnerMessageEl = document.getElementById("winner-message");
const btnContinue = document.getElementById("btn-continue");

// elementos de pausa
const btnPause = document.getElementById("btn-pause");
const screenPause = document.getElementById("pause-menu");
const btnResume = document.getElementById("btn-resume");
const btnRestart = document.getElementById("btn-restart");
const btnExitPause = document.getElementById("btn-exit");
const btnPauseOptions = document.getElementById("btn-pause-options");
const btnHowToPlayPause = document.getElementById("btn-pause-how-to-play");
const contadorPausa = document.getElementById("contador-pausa");
let cuentaAtrasActiva = false; // Evita que se dispare varias veces a la vez

// estado adicional
let lastGameParams = null;      // para reiniciar con los mismos parámetros
let pausedFromMenu = false;     // indicador de si volvemos desde ajustes mientras está en pausa


/* ==========================================================================
   GESTIÓN DE PANTALLAS (UI)
   ========================================================================== */

function showScreen(screenToShow) {
  screenStart.classList.remove("active");
  screenOptions.classList.remove("active");
  screenGame.classList.remove("active");
  screenEnd.classList.remove("active");
  screenHowToPlay.classList.remove("active");
  if(screenModeSelect) screenModeSelect.classList.remove("active");
  screenToShow.classList.add("active");
}

// Detecta si el usuario está usando una pantalla táctil (móvil o tablet)
function isTouchDevice() {
  return (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
}

function showPauseMenu() {
  screenPause.classList.remove("hidden");
}

function hidePauseMenu() {
  screenPause.classList.add("hidden");
}

// Función de cuenta atrás importada de tu otro juego
function iniciarCuentaAtrasReanudar() {
  if (cuentaAtrasActiva) return;
  cuentaAtrasActiva = true;

  hidePauseMenu(); // Ocultamos el overlay negro
  contadorPausa.classList.remove("hidden");
  let cuenta = 3;
  contadorPausa.textContent = cuenta;

  const intervaloCuenta = setInterval(() => {
    cuenta--;
    if (cuenta > 0) {
      contadorPausa.textContent = cuenta;
    } else {
      clearInterval(intervaloCuenta);
      contadorPausa.classList.add("hidden");
      cuentaAtrasActiva = false;
      window.Game.resumeGame(); // Reanudamos de verdad la física del juego
    }
  }, 1000);
}

/* ==========================================================================
   CONTROLES Y LISTENERS (Estilo robusto)
   ========================================================================== */

// Función auxiliar para botones táctiles/ratón (evita dobles clicks y problemas en móvil)
function asignarBoton(elemento, callback) {
  if (!elemento) return;
  elemento.addEventListener('click', (e) => {
    // Desbloquear audio si es la primera interacción
    if (!musicUnlocked) unlockMusicOnFirstUserGestureHandler().then();

    e.stopPropagation();
    callback(e);
  });
}

// Asignar navegación
function beginBasicGame() {
  lastGameParams = {
    canvas,
    ctx,
    scoreEl,
    timerEl,
    onExit: () => {
      showScreen(screenStart);
      window.Game.startIdle({ canvas, ctx });
    }
  };
  showScreen(screenGame);
  window.Game.startBasicGame(lastGameParams);
}

function beginBotGame() {
  lastGameParams = {
    canvas,
    ctx,
    scoreEl,
    timerEl,
    bot: true,
    onExit: () => {
      touchControls.classList.add("hidden"); // Ocultar al salir
      showScreen(screenStart);
      window.Game.startIdle({ canvas, ctx });
    }
  };

  // Mostrar controles si es móvil
  if (isTouchDevice()) {
    touchControls.classList.remove("hidden");
  }

  showScreen(screenGame);
  window.Game.startBasicGame(lastGameParams);
}

function showEndScreen(leftScore, rightScore) {
  finalScoreEl.textContent = `${leftScore} - ${rightScore}`;
  let winnerMessage = "";
  if (leftScore > rightScore) {
    winnerMessage = "¡Gana el Jugador 1!";
  } else if (rightScore > leftScore) {
    winnerMessage = "¡Gana el Jugador 2!";
  } else {
    winnerMessage = "¡Empate!";
  }
  winnerMessageEl.textContent = winnerMessage;
  showScreen(screenEnd);
}

// Hacer accesible desde game.js
window.showEndScreen = showEndScreen;

asignarBoton(btnPlay, () => showScreen(screenModeSelect));
// Volver desde la selección de modo al inicio
asignarBoton(btnModeBack, () => showScreen(screenStart));
// Iniciar partida 1v1 (con comprobación táctil)
asignarBoton(btn1v1, () => {
  if (isTouchDevice()) {
    // Si es táctil, mostramos el aviso
    screenTouchWarning.classList.remove("hidden");
  }
  else {
    // Si es un ordenador normal, arrancamos el juego
    beginBasicGame();
  }
});

// Cerrar el aviso táctil y volver al inicio
asignarBoton(btnTouchWarningOk, () => {
  screenTouchWarning.classList.add("hidden"); // Oculta la capa oscura
  showScreen(screenStart);                    // Te devuelve al menú inicial
});
asignarBoton(btn1vBot, () => {
  beginBotGame();
});
asignarBoton(btnBack, () => showScreen(screenStart));
asignarBoton(btnOptions, () => showScreen(screenOptions));
asignarBoton(btnOptionsBack, () => {
  if (pausedFromMenu) {
    pausedFromMenu = false;
    showPauseMenu();
    showScreen(screenGame);       // volver al juego para que el HUD+pausa se vean correctamente
  } else {
    showScreen(screenStart);
  }
});

asignarBoton(btnContinue, () => {
  showScreen(screenStart);
  window.Game.startIdle({ canvas, ctx });
});

// Lanzar niveles
asignarBoton(btnBasic, () => {
  beginBasicGame();
});

asignarBoton(btnAdvanced, () => {
  alert("Nivel AVANZADO seleccionado");
  // startGame({ difficulty: "advanced" });
});

// pause controls
asignarBoton(btnPause, () => {
  // Si el botón se pulsa desde la pausa (o pulsas espacio), inicia la cuenta atrás
  if (screenPause && !screenPause.classList.contains('hidden')) {
    iniciarCuentaAtrasReanudar();
  }
  else {
    // Si no está en pausa, bloqueamos si hay cuenta atrás activa
    if (cuentaAtrasActiva) return;
    window.Game.pauseGame();
    showPauseMenu();
  }
});
asignarBoton(btnResume, () => {
  iniciarCuentaAtrasReanudar();
});
asignarBoton(btnRestart, () => {
  hidePauseMenu();
  if (lastGameParams) {
    // En lugar de llamar a beginBasicGame(), le pasamos directamente
    // los parámetros de la última partida (que ya saben si había bot o no)
    window.Game.startBasicGame(lastGameParams);
  }
});
asignarBoton(btnExitPause, () => {
  hidePauseMenu();
  // mismo comportamiento que onExit
  window.Game.stopBasicGame();
  showScreen(screenStart);
  window.Game.startIdle({ canvas, ctx });
});
asignarBoton(btnPauseOptions, () => {
  // Abrimos ajustes manteniendo el juego y el HUD de fondo
  pausedFromMenu = true;
  hidePauseMenu();

  // IMPORTANTE: No usamos showScreen() para no ocultar la pantalla de juego
  screenOptions.classList.add("active");
  screenOptions.classList.add("overlay-mode"); // Aplicamos el filtro oscuro
});
asignarBoton(btnHowToPlayPause, () => {
  // Abrimos ajustes manteniendo el juego y el HUD de fondo
  pausedFromMenu = true;
  hidePauseMenu();

  // IMPORTANTE: No usamos showScreen() para no ocultar la pantalla de juego
  screenHowToPlay.classList.add("active");
  screenHowToPlay.classList.add("overlay-mode"); // Aplicamos el filtro oscuro
});
asignarBoton(btnEntendido, () => {
  if (pausedFromMenu) {
    // Si veníamos de la pausa, simplemente cerramos la capa de opciones
    pausedFromMenu = false;
    screenOptions.classList.remove("active");
    screenOptions.classList.remove("overlay-mode"); // Quitamos el filtro oscuro
    showPauseMenu(); // Volvemos a encender el menú de pausa original
  }
  // Si veníamos del menú principal, volvemos normal
  else showScreen(screenStart);
});

// --- NUEVOS LISTENERS ---
// Controles de "Cómo Jugar"
asignarBoton(btnHowToPlay, () => showScreen(screenHowToPlay));
asignarBoton(btnCloseHowToPlay, () => {
  if (pausedFromMenu) {
    pausedFromMenu = false;
    showPauseMenu();
    showScreen(screenGame);       // volver al juego para que el HUD+pausa se vean correctamente
  }
  else showScreen(screenStart);
});

// Controles del Pop-up de Información
asignarBoton(btnInfo, () => {
  screenInfo.classList.remove("hidden"); // Muestra el overlay oscuro
});
asignarBoton(btnCloseInfo, () => {
  screenInfo.classList.add("hidden");    // Oculta el overlay oscuro
});

// sincronizar con teclas/Esc en el motor
document.addEventListener('game-paused', () => {
  showPauseMenu();
  document.getElementById('game-wrap').classList.add('is-paused');
});

document.addEventListener('game-resumed', () => {
  hidePauseMenu();
  document.getElementById('game-wrap').classList.remove('is-paused');
});


/* ==========================================================================
   SISTEMA DE AJUSTES (LOCALSTORAGE - MODIFICADO CON DOS VOLÚMENES)
   ========================================================================== */

// Nueva estructura de ajustes: solo volúmenes del 0 al 100
const settings = {
  musicVolume: 70,
  sfxVolume: 80
};

// Cargar ajustes al arrancar
function loadSettings() {
  const saved = localStorage.getItem("cabezazo_settings");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (typeof parsed.musicVolume === "number") settings.musicVolume = parsed.musicVolume;
      if (typeof parsed.sfxVolume === "number") settings.sfxVolume = parsed.sfxVolume;
    } catch (e) {
      console.warn("Error leyendo settings:", e);
    }
  }
}

// Guardar ajustes
function saveSettings() {
  localStorage.setItem("cabezazo_settings", JSON.stringify(settings));
}

// Actualizar toda la UI de opciones con los valores cargados
function updateOptionsUI() {
  // Música
  musicVolumeSlider.value = settings.musicVolume;
  musicVolumeValue.textContent = `${settings.musicVolume}%`;

  // SFX (Nuevos elementos)
  sfxVolumeSlider.value = settings.sfxVolume;
  sfxVolumeValue.textContent = `${settings.sfxVolume}%`;
}


/* ==========================================================================
   SISTEMA DE AUDIO BGM (Básico y sin Fading)
   ========================================================================== */

let musicUnlocked = false;

// Función simple para aplicar el volumen actual de la música
function setMusicVolumeFromSettings() {
  // Asegurar que el audio existe
  if (!bgMusic) return;

  // El volumen del elemento de audio va del 0.0 al 1.0
  bgMusic.volume = settings.musicVolume / 100;
}

// Iniciar música respetando el volumen
async function tryStartMusic() {
  // Si el volumen de la música está al 0%, no la iniciamos
  if (settings.musicVolume <= 0) {
    bgMusic.pause();
    return;
  }

  // Establecer el volumen antes de reproducir
  setMusicVolumeFromSettings();

  try {
    await bgMusic.play();
  } catch (e) {
    // Autoplay bloqueado por el navegador, se desbloqueará con el primer gesto
  }
}

// Manejador para desbloquear el audio globalmente
async function unlockMusicOnFirstUserGestureHandler() {
  if (musicUnlocked) return;
  musicUnlocked = true;

  // Limpiamos los listeners para que no se disparen más veces
  document.removeEventListener("pointerdown", unlockMusicOnFirstUserGestureHandler);
  document.removeEventListener("keydown", unlockMusicOnFirstUserGestureHandler);

  await tryStartMusic();
}

// Pausar audio si cambias de pestaña
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (!bgMusic.paused) bgMusic.pause();
  } else {
    // Si la música está activada (volumen > 0) y el audio desbloqueado, reanudamos
    if (settings.musicVolume > 0 && musicUnlocked) bgMusic.play().catch(()=>{});
  }
});

// NUEVOS Listeners para los deslizadores (usamos el evento 'input' para un cambio fluido)
musicVolumeSlider.addEventListener("input", () => {
  settings.musicVolume = Number(musicVolumeSlider.value);
  saveSettings();
  updateOptionsUI();
  // Aplicar el cambio de volumen instantáneamente
  setMusicVolumeFromSettings();
});

sfxVolumeSlider.addEventListener("input", () => {
  settings.sfxVolume = Number(sfxVolumeSlider.value);
  saveSettings();
  updateOptionsUI();
  // (Aquí asignarías el volumen de los SFX si tienes esa lógica)
});


/* ==========================================================================
   INICIALIZACIÓN
   ========================================================================== */

loadSettings();
updateOptionsUI();

// Preparar el desbloqueo global del audio
document.addEventListener("pointerdown", unlockMusicOnFirstUserGestureHandler, {once: true});
document.addEventListener("keydown", unlockMusicOnFirstUserGestureHandler, {once: true});
tryStartMusic();

// Listener de redimensión para el Canvas y la UI
function resizeCanvas() {
  const wrap = document.getElementById('game-wrap');
  const baseW = 1845;
  const baseH = 1038;

  // 1. Calcular la escala necesaria (zoom)
  const scale = Math.min(window.innerWidth / baseW, window.innerHeight / baseH);

  // 2. Aplicar el zoom a TODA la caja
  wrap.style.transform = `scale(${scale})`;

  // 3. Fijamos la resolución interna
  // IMPORTANTE: Cambiar width/height borra el contenido del canvas
  canvas.width = baseW;
  canvas.height = baseH;

  // 4. Le avisamos al motor para que recalcule las porterías
  if (window.Game && window.Game.resize) {
    window.Game.resize(canvas.width, canvas.height);
  }


  // --- NUEVO: REPINTADO MANUAL SI ESTÁ EN PAUSA ---
  // Como redimensionar borra el canvas, si el juego está pausado (el bucle no corre),
  // se queda en negro. Necesitamos forzar un dibujado usando el estado actual.
  if (window.Game && window.Game.forceRedraw) {
    window.Game.forceRedraw(ctx);
  }

  // --- AUTOPAUSA AL GIRAR EL MÓVIL A VERTICAL ---
  // Si la pantalla es más alta que ancha y estamos en la pantalla de juego
  if (window.innerHeight > window.innerWidth && screenGame.classList.contains("active")) {
    // Evitamos pausar si ya hay una cuenta atrás para reanudar (previene bugs visuales)
    if (!cuentaAtrasActiva && window.Game && window.Game.pauseGame) {
      window.Game.pauseGame();
    }
  }
}

// Escuchar cambios de tamaño de ventana
window.addEventListener('resize', resizeCanvas);

// Forzar un primer ajuste al arrancar
resizeCanvas();

// Arrancar el modo reposo para ver las porterías de fondo
if (window.Game && window.Game.startIdle) {
  window.Game.startIdle({ canvas, ctx });
}

/* ==========================================================================
   AUTO-PAUSE CUANDO EL JUEGO PIERDE EL FOCO
   ========================================================================== */

// Función auxiliar para forzar la pausa
function forcePauseIfPlaying() {
  // Solo pausamos si estamos activamente en la pantalla de juego
  // y el juego no está ya en pausa.
  if (screenGame.classList.contains("active") && window.Game && window.Game.pauseGame) {
    // Importante: No pausamos si está en la cuenta atrás para reanudar
    if (!cuentaAtrasActiva) {
      window.Game.pauseGame();
    }
  }
}

// 1. Cuando el usuario cambia de pestaña o minimiza el navegador
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    forcePauseIfPlaying();
  }
});

// 2. Cuando el navegador pierde el foco (ej. hace clic en otra ventana/monitor)
window.addEventListener("blur", () => {
  forcePauseIfPlaying();
});