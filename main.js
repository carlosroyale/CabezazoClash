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

function showScreen(screenToShow) {
  screenStart.classList.remove("active");
  screenLevel.classList.remove("active");
  screenOptions.classList.remove("active");
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
  // Aquí lanzarías el juego en modo básico
  alert("Nivel BÁSICO seleccionado");
  // startGame({ difficulty: "basic" });
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
});
