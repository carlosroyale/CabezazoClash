// main.js - Control de UI, menús y ajustes
// Estructurado al estilo de volador.js

/* ==========================================================================
   CONFIGURACIÓN Y ELEMENTOS DEL DOM
   ========================================================================== */

// Pantallas
const screenStart = document.getElementById("screen-start");
const screenLevel = document.getElementById("screen-level");
const screenOptions = document.getElementById("screen-options");
const screenGame = document.getElementById("screen-game");

// Botones de navegación
const btnPlay = document.getElementById("btn-play");
const btnBack = document.getElementById("btn-back");
const btnBasic = document.getElementById("btn-basic");
const btnAdvanced = document.getElementById("btn-advanced");
const btnOptions = document.getElementById("btn-options");
const btnOptionsBack = document.getElementById("btn-options-back");

// Elementos de opciones
const toggleMusic = document.getElementById("toggle-music");
const toggleSfx = document.getElementById("toggle-sfx");
const volumeSlider = document.getElementById("volume");
const volumeValue = document.getElementById("volume-value");

// Elementos del juego
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bgMusic = document.getElementById("bg-music");

/* ==========================================================================
   GESTIÓN DE PANTALLAS (UI)
   ========================================================================== */

function showScreen(screenToShow) {
  screenStart.classList.remove("active");
  screenLevel.classList.remove("active");
  screenOptions.classList.remove("active");
  screenGame.classList.remove("active");
  screenToShow.classList.add("active");
}

/* ==========================================================================
   CONTROLES Y LISTENERS (Estilo robusto)
   ========================================================================== */

// Función auxiliar para botones táctiles/ratón (evita dobles clicks y problemas en móvil)
function asignarBoton(elemento, callback) {
  if (!elemento) return;
  elemento.addEventListener('click', (e) => {
    // Desbloquear audio si es la primera interacción
    if (!musicUnlocked) unlockMusicOnFirstUserGestureHandler();

    e.stopPropagation();
    callback(e);
  });
}

// Asignar navegación
asignarBoton(btnPlay, () => showScreen(screenLevel));
asignarBoton(btnBack, () => showScreen(screenStart));
asignarBoton(btnOptions, () => showScreen(screenOptions));
asignarBoton(btnOptionsBack, () => showScreen(screenStart));

// Lanzar niveles
asignarBoton(btnBasic, () => {
  showScreen(screenGame);
  window.Game.startBasicGame({
    canvas,
    ctx,
    scoreEl,
    onExit: () => {
      showScreen(screenStart);
      // Volvemos a encender el fondo del menú al salir del juego
      window.Game.startIdle({ canvas, ctx });
    }
  });
});

asignarBoton(btnAdvanced, () => {
  alert("Nivel AVANZADO seleccionado");
  // startGame({ difficulty: "advanced" });
});


/* ==========================================================================
   SISTEMA DE AJUSTES (LOCALSTORAGE)
   ========================================================================== */

const settings = {
  music: true,
  sfx: true,
  volume: 70
};

function loadSettings() {
  const saved = localStorage.getItem("cabezazo_settings");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (typeof parsed.music === "boolean") settings.music = parsed.music;
      if (typeof parsed.sfx === "boolean") settings.sfx = parsed.sfx;
      if (typeof parsed.volume === "number") settings.volume = parsed.volume;
    } catch (e) {
      console.warn("Error leyendo settings:", e);
    }
  }
}

function saveSettings() {
  localStorage.setItem("cabezazo_settings", JSON.stringify(settings));
}

function updateOptionsUI() {
  toggleMusic.textContent = settings.music ? "ON" : "OFF";
  toggleMusic.classList.toggle("off", !settings.music);

  toggleSfx.textContent = settings.sfx ? "ON" : "OFF";
  toggleSfx.classList.toggle("off", !settings.sfx);

  volumeSlider.value = settings.volume;
  volumeValue.textContent = `${settings.volume}%`;
}

// Listeners de los ajustes (usamos el evento normal para el input)
asignarBoton(toggleMusic, () => {
  settings.music = !settings.music;
  saveSettings();
  updateOptionsUI();
  applyMusicSetting();
});

asignarBoton(toggleSfx, () => {
  settings.sfx = !settings.sfx;
  saveSettings();
  updateOptionsUI();
});

volumeSlider.addEventListener("input", () => {
  settings.volume = Number(volumeSlider.value);
  saveSettings();
  updateOptionsUI();
  applyMusicSetting();
});

/* ==========================================================================
   SISTEMA DE AUDIO BGM (FADING Y POLÍTICAS DE AUTOPLAY)
   ========================================================================== */

let musicUnlocked = false;
let fadeInterval = null;

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function setMusicVolumeFromSettings() {
  bgMusic.volume = clamp01((settings.volume ?? 70) / 100);
}

function stopFade() {
  if (fadeInterval) {
    clearInterval(fadeInterval);
    fadeInterval = null;
  }
}

function fadeTo(targetVolume, durationMs = 350) {
  stopFade();
  const start = bgMusic.volume;
  const target = clamp01(targetVolume);
  const steps = Math.max(1, Math.floor(durationMs / 25));
  let i = 0;

  fadeInterval = setInterval(() => {
    i++;
    const t = i / steps;
    bgMusic.volume = start + (target - start) * t;

    if (i >= steps) {
      bgMusic.volume = target;
      stopFade();
      if (target === 0) {
        bgMusic.pause();
        bgMusic.currentTime = 0;
      }
    }
  }, 25);
}

async function tryStartMusic() {
  if (!settings.music) return;
  setMusicVolumeFromSettings();
  try {
    await bgMusic.play();
  } catch (e) {
    // Autoplay bloqueado, se desbloqueará con el primer gesto
  }
}

// Manejador extraído para poder reutilizarlo si el usuario hace click en un botón directamente
async function unlockMusicOnFirstUserGestureHandler() {
  if (musicUnlocked) return;
  musicUnlocked = true;

  // Limpiamos los listeners para que no se disparen más veces
  document.removeEventListener("pointerdown", unlockMusicOnFirstUserGestureHandler);
  document.removeEventListener("keydown", unlockMusicOnFirstUserGestureHandler);

  await tryStartMusic();
}

function applyMusicSetting() {
  setMusicVolumeFromSettings();
  if (!settings.music) {
    fadeTo(0, 250);
    return;
  }

  if (bgMusic.paused) {
    const target = clamp01((settings.volume ?? 70) / 100);
    bgMusic.volume = 0;
    tryStartMusic().then(() => fadeTo(target, 350));
  } else {
    const target = clamp01((settings.volume ?? 70) / 100);
    fadeTo(target, 150);
  }
}

// Pausar audio si cambias de pestaña (Robusted extraída de volador.js)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (!bgMusic.paused) bgMusic.pause();
  } else {
    if (settings.music && musicUnlocked) bgMusic.play().catch(()=>{});
  }
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

// Listener de redimensión para el Canvas
function resizeCanvas() {
  // 1. Fijamos la resolución interna (lógica) del juego a 1280x720 (16:9)
  canvas.width = 1845;
  canvas.height = 1038;

  // 2. Le avisamos al motor para que posicione las porterías con las nuevas medidas fijas
  if (window.Game && window.Game.resize) {
    window.Game.resize(); // Ya no le pasamos parámetros dinámicos
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