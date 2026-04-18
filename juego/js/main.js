// main.js - Control de UI, menús y ajustes

/* ==========================================================================
   CONFIGURACIÓN Y ELEMENTOS DEL DOM
   ========================================================================== */

// Pantallas
const screenTapToStart = document.getElementById("screen-tap-to-start");
const screenStart = document.getElementById("screen-start");
const screenOptions = document.getElementById("screen-options");
const screenGame = document.getElementById("screen-game");
const screenEnd = document.getElementById("screen-end");
const screenHowToPlay = document.getElementById("screen-how-to-play");
const screenModeSelect = document.getElementById("screen-mode-select");
const screenTouchWarning = document.getElementById("screen-touch-warning");
const touchControls = document.getElementById("touch-controls");

// Botones de navegación
const btnPlay = document.getElementById("btn-play");
const btnSalir = document.getElementById("btn-salir");
const btnBack = document.getElementById("btn-back");
const btnBasic = document.getElementById("btn-basic");
const btnAdvanced = document.getElementById("btn-advanced");
const btnOptions = document.getElementById("btn-options");
const btnOptionsBack = document.getElementById("btn-options-back");
const btnMiCuenta = document.getElementById("btn-mi-cuenta");
const btnRanking = document.getElementById("btn-ranking");
const btnHowToPlay = document.getElementById("btn-how-to-play");
const btnCloseHowToPlay = document.getElementById("btn-close-how-to-play");
const btn1v1 = document.getElementById("btn-1v1");
const btn1vBot = document.getElementById("btn-1vbot");
const btnModeBack = document.getElementById("btn-mode-back");
const btnTouchWarningOk = document.getElementById("btn-touch-warning-ok");

// Elementos de opciones
const sliderMusica = document.getElementById("slider-musica");
const valorMusicaTx = document.getElementById("valor-musica");
const sliderEfectos = document.getElementById("slider-efectos");
const valorEfectosTx = document.getElementById("valor-efectos");

const switchFps = document.getElementById('switch-fps');
const contadorFpsDiv = document.getElementById('contador-fps');
const btnRestablecerConfig = document.getElementById("btn-restablecer-config");
const btnEntendido = document.getElementById("btn-entendido");

// Elementos del juego
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");

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

// Lógica de carga de memoria
let mostrarFPS = localStorage.getItem('mostrarFPSCabezazo') === 'true';
if (switchFps) switchFps.checked = mostrarFPS;


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
  if (btnMiCuenta) {
    // Si la pantalla no es el menu inicial, lo ocultamos
    if (screenToShow !== screenStart) btnMiCuenta.classList.add("hidden");
    // Para cualquier otra pantalla (Menú, Opciones, Modos), lo mostramos
    else btnMiCuenta.classList.remove("hidden");
  }
  if (btnRanking) {
    // Si la pantalla no es el menu inicial, lo ocultamos
    if (screenToShow !== screenStart) btnRanking.classList.add("hidden");
    // Para cualquier otra pantalla (Menú, Opciones, Modos), lo mostramos
    else btnRanking.classList.remove("hidden");
  }
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
      playMenuMusic();
    }
  };
  playMatchAmbient();
  window.playSound('sfx-whistle');
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
      playMenuMusic();
    }
  };

  playMatchAmbient();
  window.playSound('sfx-whistle');

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
  if (leftScore > rightScore) winnerMessage = "¡Gana el Jugador 1!";
  else if (rightScore > leftScore) winnerMessage = "¡Gana el Jugador 2!";
  else winnerMessage = "¡Empate!";
  winnerMessageEl.textContent = winnerMessage;
  showScreen(screenEnd);
}

// Hacer accesible desde game.js
window.showEndScreen = showEndScreen;

asignarBoton(btnPlay, () => showScreen(screenModeSelect));
asignarBoton(btnSalir, () => {
  // Paramos la música si estuviera sonando
  stopAllSounds();
  // Redirigimos al inicio
  window.location.href = '../../inicio/inicio.php';
});

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
  stopAllSounds();
  touchControls.classList.add("hidden");
  showScreen(screenStart);
  window.Game.startIdle({ canvas, ctx });
  playMenuMusic();
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
  stopAllSounds(); // Silencio total antes de salir al menú
  touchControls.classList.add("hidden");
  showScreen(screenStart);
  window.Game.startIdle({ canvas, ctx });
  // --- FORZAR DESPERTAR EL AUDIO ---
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  playMenuMusic();
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

// sincronizar con teclas en el motor
document.addEventListener('game-paused', () => {
  showPauseMenu();
  stopAllSounds();
  document.getElementById('game-wrap').classList.add('is-paused');
});

document.addEventListener('game-resumed', () => {
  hidePauseMenu();
  playMatchAmbient();
  document.getElementById('game-wrap').classList.remove('is-paused');
});


/* ==========================================================================
   SISTEMA DE AJUSTES UNIFICADO (VALORES 0.0 A 1.0)
   ========================================================================== */

const settings = {
  musicVolume: 0.5,
  sfxVolume: 1.0,
  mostrarFPS: false
};

// Cargar ajustes al arrancar
function loadSettings() {
  const saved = localStorage.getItem("cabezazo_settings");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (typeof parsed.musicVolume === "number") settings.musicVolume = parsed.musicVolume;
      if (typeof parsed.sfxVolume === "number") settings.sfxVolume = parsed.sfxVolume;
      if (typeof parsed.mostrarFPS === "boolean") settings.mostrarFPS = parsed.mostrarFPS;
    } catch (e) {
      console.warn("Error leyendo settings:", e);
    }
  }
  window.mostrarFPS = settings.mostrarFPS;
}

// Guardar ajustes
function saveSettings() {
  localStorage.setItem("cabezazo_settings", JSON.stringify(settings));
}

// Actualizar toda la UI de opciones
function updateOptionsUI() {
  if (sliderMusica) sliderMusica.value = settings.musicVolume;
  if (valorMusicaTx) valorMusicaTx.textContent = Math.round(settings.musicVolume * 100) + '%';

  if (sliderEfectos) sliderEfectos.value = settings.sfxVolume;
  if (valorEfectosTx) valorEfectosTx.textContent = Math.round(settings.sfxVolume * 100) + '%';

  if (switchFps) switchFps.checked = settings.mostrarFPS;
  if (contadorFpsDiv) {
    if (settings.mostrarFPS) contadorFpsDiv.classList.remove('hidden');
    else contadorFpsDiv.classList.add('hidden');
  }
}


/* ==========================================================================
   SISTEMA DE AUDIO WEB (ALTO RENDIMIENTO)
   ========================================================================== */
let musicUnlocked = false;

const AudioContext = window.AudioContext;
const audioCtx = new AudioContext();
const sfxBuffers = {};
let activeSFXNodes = new Set();

// Variables para mantener control de las pistas en bucle (Música y Ambiente)
let bgMusicNode = null;
let bgMusicGain = null;
let ambientNode = null;
let ambientGain = null;

async function loadSound(id, url) {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    sfxBuffers[id] = await audioCtx.decodeAudioData(arrayBuffer);
  }
  catch (e) {
    console.warn("No se pudo cargar el audio:", id, e);
  }
}

function applyVolumes() {
  if (bgMusicGain) bgMusicGain.gain.value = settings.musicVolume * 0.4;
  if (ambientGain) ambientGain.gain.value = settings.sfxVolume * 0.5;
}

function stopAllSounds() {
  // Parar música de fondo
  if (bgMusicNode) {
    try { bgMusicNode.stop(); } catch(e){}
    bgMusicNode = null;
  }
  // Parar ambiente de estadio
  if (ambientNode) {
    try { ambientNode.stop(); } catch(e){}
    ambientNode = null;
  }

  // Parar todos los efectos de Web Audio API
  activeSFXNodes.forEach(source => {
    try { source.stop(); } catch(e){}
  });
  activeSFXNodes.clear();
}

function playMenuMusic() {
  if (!musicUnlocked) return;

  // Detener estadio si estaba sonando
  if (ambientNode) {
    try { ambientNode.stop(); } catch(e){}
    ambientNode = null;
  }

  // Reiniciar música si ya estaba sonando
  if (bgMusicNode) {
    try { bgMusicNode.stop(); } catch(e){}
  }

  const buffer = sfxBuffers['bg-music'];
  if (!buffer) return;

  bgMusicNode = audioCtx.createBufferSource();
  bgMusicNode.buffer = buffer;
  bgMusicNode.loop = true; // Que se repita infinitamente

  bgMusicGain = audioCtx.createGain();
  bgMusicGain.gain.value = settings.musicVolume * 0.4;

  bgMusicNode.connect(bgMusicGain);
  bgMusicGain.connect(audioCtx.destination);

  bgMusicNode.start(0);
}

function playMatchAmbient() {
  if (!musicUnlocked) return;

  // Detener música si estaba sonando
  if (bgMusicNode) {
    try { bgMusicNode.stop(); } catch(e){}
    bgMusicNode = null;
  }

  // Reiniciar ambiente si ya estaba sonando
  if (ambientNode) {
    try { ambientNode.stop(); } catch(e){}
  }

  const buffer = sfxBuffers['sfx-crowd-ambient'];
  if (!buffer) return;

  ambientNode = audioCtx.createBufferSource();
  ambientNode.buffer = buffer;
  ambientNode.loop = true; // Que se repita infinitamente

  ambientGain = audioCtx.createGain();
  ambientGain.gain.value = settings.sfxVolume * 0.5;

  ambientNode.connect(ambientGain);
  ambientGain.connect(audioCtx.destination);

  ambientNode.start(0);
}

/* ==========================================================================
   EVENTOS DE INTERFAZ DE OPCIONES
   ========================================================================== */

btnRestablecerConfig.addEventListener('click', () => {
  // 1. Valores base
  settings.musicVolume = 0.5;
  settings.sfxVolume = 1.0;
  settings.mostrarFPS = false;
  window.mostrarFPS = false;

  // 2. Guardar y sincronizar
  saveSettings();
  updateOptionsUI();
  applyVolumes();

  // 3. Sonido de confirmación
  if (window.playSound) window.playSound('sfx-player-kick', 0.5);
});

sliderMusica.addEventListener("input", (e) => {
  settings.musicVolume = parseFloat(e.target.value);
  saveSettings();
  if (valorMusicaTx) valorMusicaTx.textContent = Math.round(settings.musicVolume * 100) + '%';
  applyVolumes();
});

sliderEfectos.addEventListener("input", (e) => {
  settings.sfxVolume = parseFloat(e.target.value);
  saveSettings();
  if (valorEfectosTx) valorEfectosTx.textContent = Math.round(settings.sfxVolume * 100) + '%';
  applyVolumes();
});

// Al soltar el slider de efectos, reproducimos un sonido de prueba
sliderEfectos.addEventListener('change', () => {
  playSound('sfx-player-kick', 0.5);
});

switchFps.addEventListener('change', (e) => {
  settings.mostrarFPS = e.target.checked;
  window.mostrarFPS = settings.mostrarFPS;
  saveSettings();
  if (settings.mostrarFPS) contadorFpsDiv.classList.remove('hidden');
  else contadorFpsDiv.classList.add('hidden');
  switchFps.blur();
});

// Desbloqueo inicial (Tap to Start)
screenTapToStart.addEventListener('click', async () => {
  if (musicUnlocked) return;
  musicUnlocked = true;

  // Reactivar el contexto de audio (Política obligatoria de los navegadores)
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  // Reproducimos un pitido inaudible de 1 milisegundo. Esto obliga al
  // hardware del dispositivo a enganchar la Web Audio API permanentemente.
  const oscillator = audioCtx.createOscillator();
  const dummyGain = audioCtx.createGain();
  dummyGain.gain.value = 0; // Volumen 0 (mudo)
  oscillator.connect(dummyGain);
  dummyGain.connect(audioCtx.destination);
  oscillator.start(0);
  oscillator.stop(audioCtx.currentTime + 0.001);

  screenTapToStart.classList.remove('active');
  showScreen(screenStart);
  playMenuMusic();

  // Mostrar el botón de Mi Cuenta una vez pasado el "Tap to start"
  if (btnMiCuenta) btnMiCuenta.classList.remove("hidden");
  if (btnRanking) btnRanking.classList.remove("hidden");

  // AQUI ESTÁ LA MAGIA: Al tocar, obligamos al sistema a buscar la medida real
  // durante el próximo segundo, que es cuando iOS contraerá la barra.
  // forceAggressiveResize();
});

// 4. Función global para reproducir efectos (Latencia Cero)
window.playSound = function(soundId, volume = 1) {
  if (settings.sfxVolume <= 0 || !musicUnlocked) return;

  // SEGURIDAD: Evitar saturación acústica al conducir el balón o en rebotes ultrarrápidos
  if (soundId === 'sfx-rebound') {
    const now = Date.now();
    // Requerimos que pasen al menos 100ms entre sonido y sonido
    if (window._lastKickTime && now - window._lastKickTime < 50) return;
    window._lastKickTime = now;
  }

  if (soundId === 'sfx-ball-grass') {
    const now = Date.now();
    // Requerimos que pasen al menos 500ms entre sonido y sonido
    if (window._lastKickTime && now - window._lastKickTime < 200) return;
    window._lastKickTime = now;
  }

  const buffer = sfxBuffers[soundId];
  if (!buffer) return;

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().then();
    // Si estaba suspendido, abortamos este sonido en particular en este fotograma
    // para no causar un error interno, pero ya hemos ordenado que despierte.
    return;
  }

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;

  const gainNode = audioCtx.createGain();
  // Multiplicamos el volumen recibido por el ajuste global de la UI
  gainNode.gain.value = settings.sfxVolume * volume;

  source.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  source.start(0);

  activeSFXNodes.add(source);
  source.onended = () => {
    activeSFXNodes.delete(source);
  };
};


/* ==========================================================================
   INICIALIZACIÓN
   ========================================================================== */

loadSettings();
updateOptionsUI();

// Listener de redimensión para el Canvas y la UI
function resizeCanvas() {
  const wrap = document.getElementById('game-wrap');
  const baseW = 1845;
  const baseH = 1038;

  // 1. Calcular la escala necesaria (zoom)
  const scale = Math.min(window.innerWidth / baseW, window.innerHeight / baseH);

  // 2. Aplicar el zoom a TODA la caja, ajustando el punto central
  wrap.style.transform = `translate(-50%, -50%) scale(${scale})`;

  // 3. Fijamos la resolución interna
  canvas.width = baseW;
  canvas.height = baseH;

  // 4. Le avisamos al motor para que recalcule las porterías
  if (window.Game && window.Game.resize) {
    window.Game.resize(canvas.width, canvas.height);
  }

  // Como redimensionar borra el canvas, si el juego está pausado (el bucle no corre),
  // se queda en negro. Necesitamos forzar un dibujado usando el estado actual.
  if (window.Game && window.Game.forceRedraw) {
    window.Game.forceRedraw(ctx);
  }

  // Si la pantalla es más alta que ancha y estamos en la pantalla de juego
  if (window.innerHeight > window.innerWidth && screenGame.classList.contains("active")) {
    // Evitamos pausar si ya hay una cuenta atrás para reanudar (previene bugs visuales)
    if (!cuentaAtrasActiva && window.Game && window.Game.pauseGame) {
      window.Game.pauseGame();
    }
  }
}

//Escuchar cambios de tamaño de ventana
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
  if (screenGame.classList.contains("active") && window.Game && window.Game.pauseGame) {
    if (!cuentaAtrasActiva) {
      window.Game.pauseGame();
    }
  }
}

// 1. Cuando el usuario cambia de pestaña o minimiza el navegador
document.addEventListener('visibilitychange', () => {
  if (document.hidden){
    forcePauseIfPlaying();

    // Congelamos el motor de audio entero. Esto pausa la música
    // y el ambiente exactamente en el milisegundo en el que están.
    if (audioCtx.state === 'running') audioCtx.suspend().then();

    // IMPORTANTE: Hemos borrado stopAllSounds() aquí para no destruir las pistas.
  }
  else {
    if (!musicUnlocked) return;

    // Despertamos el motor de audio al volver a la pestaña. Todo sigue por donde iba.
    if (audioCtx.state === 'suspended') audioCtx.resume().then();

    // IMPORTANTE: Hemos borrado los playMenuMusic() y playMatchAmbient()
    // porque las pistas siguen ahí, solo estaban congeladas.
  }
});

// 2. Cuando el navegador pierde el foco (hace clic en otra ventana/monitor)
window.addEventListener("blur", () => {
  forcePauseIfPlaying();

  // También congelamos el audio si pincha fuera de la ventana
  if (audioCtx.state === 'running') audioCtx.suspend().then();
});

// 3. Cuando la ventana recupera el foco
window.addEventListener("focus", () => {
  if (!musicUnlocked) return;
  if (audioCtx.state === 'suspended') audioCtx.resume().then();
});

// --- SISTEMA DE CARGA MAESTRO ---

// Envolvemos la carga de cualquier imagen
function esperarImagen(imgObj) {
  return new Promise((resolve) => {
    if (!imgObj || imgObj.complete) {
      resolve();
    } else {
      imgObj.onload = () => resolve();
      imgObj.onerror = () => resolve(); // Si falla, resolvemos igual para no bloquear el juego
    }
  });
}

async function inicializarJuego() {
  const pantallaCarga = document.getElementById('pantalla-carga');
  const screenTapToStart = document.getElementById('screen-tap-to-start');

  // Por seguridad, forzamos que la pantalla de inicio esté oculta
  if (screenTapToStart) screenTapToStart.classList.add('hidden');

  try {
    const promesasDeCarga = [
      // 1. Imágenes del canvas
      esperarImagen(typeof bgImage !== 'undefined' ? bgImage : null),
      esperarImagen(typeof imgP1Body !== 'undefined' ? imgP1Body : null),
      esperarImagen(typeof imgP1Shoe !== 'undefined' ? imgP1Shoe : null),
      esperarImagen(typeof imgP2Body !== 'undefined' ? imgP2Body : null),
      esperarImagen(typeof imgP2Shoe !== 'undefined' ? imgP2Shoe : null),
      esperarImagen(typeof imgCrowd !== 'undefined' ? imgCrowd : null),

      // 2. Efectos de sonido Web Audio API (Latencia Cero)
      loadSound('bg-music', 'assets/audio/menu_music.mp3'),
      loadSound('sfx-crowd-ambient', 'assets/audio/crowd_ambient.mp3'),
      loadSound('sfx-whistle', 'assets/audio/whistle.mp3'),
      loadSound('sfx-goal', 'assets/audio/goal_cheer.mp3'),
      loadSound('sfx-rebound', 'assets/audio/ball_rebound.mp3'),
      loadSound('sfx-ball-post', 'assets/audio/ball_post.mp3'),
      loadSound('sfx-ball-grass', 'assets/audio/ball_grass.mp3'),
      loadSound('sfx-jump', 'assets/audio/jump.mp3'),
      loadSound('sfx-land', 'assets/audio/land.mp3'),
      loadSound('sfx-player-collide', 'assets/audio/player_collide.mp3'),
      loadSound('sfx-player-kick', 'assets/audio/player_kick.mp3')
    ];

    // Bloqueamos la pantalla hasta que TODO (imágenes y audios) esté listo
    await Promise.all(promesasDeCarga);

    // --- TODO CARGADO CON ÉXITO ---
    // if (pantallaCarga) pantallaCarga.classList.add('hidden');
    if (pantallaCarga) pantallaCarga.style.display = 'none'; // <-- ¡Y ESTO!
    if (screenTapToStart) {
      screenTapToStart.classList.remove('hidden');
      screenTapToStart.classList.add('active');
      if (mostrarFPS) contadorFpsDiv.classList.remove('hidden');
    }

  } catch (error) {
    console.error("Fallo crítico en la carga inicial:", error);
    // Si algo falla catastróficamente, quitamos el bloqueo para que se pueda intentar jugar
    // if (pantallaCarga) pantallaCarga.classList.add('hidden');
    if (pantallaCarga) pantallaCarga.style.display = 'none'; // <-- ¡Y ESTO!
    if (screenTapToStart) {
      screenTapToStart.classList.remove('hidden');
      screenTapToStart.classList.add('active');
    }
  }
}

// Arrancamos el proceso al cargar el archivo
inicializarJuego();

// ==========================================
// MODO DEBUG: CAZADOR DE DIMENSIONES
// ==========================================
// const debugDiv = document.createElement('div');
// debugDiv.style.cssText = 'position:fixed; top:0; left:0; background:rgba(200,0,0,0.9); color:#fff; z-index:99999; padding:10px; font-family:monospace; font-size:12px; pointer-events:none; border:2px solid yellow;';
// document.body.appendChild(debugDiv);
//
// function updateDebugger() {
//   const vw = window.visualViewport ? Math.round(window.visualViewport.width) : 'N/A';
//   const vh = window.visualViewport ? Math.round(window.visualViewport.height) : 'N/A';
//   const iw = window.innerWidth;
//   const ih = window.innerHeight;
//   const docW = document.documentElement.clientWidth;
//   const docH = document.documentElement.clientHeight;
//
//   // Imprimimos los 3 métodos de lectura
//   debugDiv.innerHTML = `
//     <b>Medidas detectadas:</b><br>
//     visualViewport: ${vw} x ${vh}<br>
//     innerWidth/Height: ${iw} x ${ih}<br>
//     documentElement: ${docW} x ${docH}<br>
//     <hr style="margin:5px 0">
//     Escala actual: ${document.getElementById('game-wrap').style.transform}
//   `;
//   requestAnimationFrame(updateDebugger);
// }
// updateDebugger();