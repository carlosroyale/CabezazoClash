const screenStart = document.getElementById("screen-start");
const screenLevel = document.getElementById("screen-level");
const screenOptions = document.getElementById("screen-options");

const btnPlay = document.getElementById("btn-play");
const btnBack = document.getElementById("btn-back");
const btnBasic = document.getElementById("btn-basic");
const btnAdvanced = document.getElementById("btn-advanced");

const btnOptions = document.getElementById("btn-options");
const btnOptionsBack = document.getElementById("btn-options-back");

const toggleMusic = document.getElementById("toggle-music");
const toggleSfx = document.getElementById("toggle-sfx");
const volumeSlider = document.getElementById("volume");
const volumeValue = document.getElementById("volume-value");

// elementos de la pantalla de juego (UI management)
const screenGame = document.getElementById("screen-game");
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");

function showScreen(screenToShow) {
  screenStart.classList.remove("active");
  screenLevel.classList.remove("active");
  screenOptions.classList.remove("active");
  screenGame.classList.remove("active");
  screenToShow.classList.add("active");
}

btnPlay.addEventListener("click", () => {
  showScreen(screenLevel);
});

btnBack.addEventListener("click", () => {
  showScreen(screenStart);
});

btnOptions.addEventListener("click", () => {
  showScreen(screenOptions);
});

btnOptionsBack.addEventListener("click", () => {
  showScreen(screenStart);
});

btnBasic.addEventListener("click", () => {
  showScreen(screenGame);
  // pasar referencias de UI al motor de juego
  window.Game.startBasicGame({
    canvas,
    ctx,
    scoreEl,
    onExit: () => showScreen(screenStart)
  });
});

btnAdvanced.addEventListener("click", () => {
  // Aquí lanzarías el juego en modo avanzado
  alert("Nivel AVANZADO seleccionado");
  // startGame({ difficulty: "advanced" });
});

// opciones con guardado en localStorage
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
    } catch {}
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

loadSettings();
updateOptionsUI();

toggleMusic.addEventListener("click", () => {
  settings.music = !settings.music;
  saveSettings();
  updateOptionsUI();
  applyMusicSetting(); // cambiar reproducción al instante
});

toggleSfx.addEventListener("click", () => {
  settings.sfx = !settings.sfx;
  saveSettings();
  updateOptionsUI();
});

volumeSlider.addEventListener("input", () => {
  settings.volume = Number(volumeSlider.value);
  saveSettings();
  updateOptionsUI();
  applyMusicSetting(); // actualizar música de fondo
});

// audio de fondo y funciones de control (autoplay via gesto)
const bgMusic = document.getElementById("bg-music");

let musicUnlocked = false; // para cumplir autoplay policies
let fadeInterval = null;

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function setMusicVolumeFromSettings() {
  const v = clamp01((settings.volume ?? 70) / 100);
  bgMusic.volume = v;
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
    // autoplay blocked, se desbloqueará con gesto
  }
}

function unlockMusicOnFirstUserGesture() {
  if (musicUnlocked) return;
  const handler = async () => {
    musicUnlocked = true;
    document.removeEventListener("pointerdown", handler);
    document.removeEventListener("keydown", handler);
    await tryStartMusic();
  };
  document.addEventListener("pointerdown", handler, { once: true });
  document.addEventListener("keydown", handler, { once: true });
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

// iniciar desbloqueo y intentar reproducción
unlockMusicOnFirstUserGesture();
tryStartMusic();

