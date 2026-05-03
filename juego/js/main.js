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
const screenOnlineLocked = document.getElementById("screen-online-locked");
const screenOnlineWaiting = document.getElementById("screen-online-waiting");
const screenVersus = document.getElementById("screen-versus");
const touchControls = document.getElementById("touch-controls");
const badWifiIcon = document.getElementById('bad-connection-warning');
const versusNameLeft = document.getElementById("versus-name-left");
const versusNameRight = document.getElementById("versus-name-right");
const versusLabelLeft = document.getElementById("versus-label-left");
const versusLabelRight = document.getElementById("versus-label-right");

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
const btn1v1Local = document.getElementById("btn-1v1");
const btn1vBot = document.getElementById("btn-1vbot");
const btn1v1Online = document.getElementById("btn-1v1Online");
const btnModeBack = document.getElementById("btn-mode-back");
const btnTouchWarningOk = document.getElementById("btn-touch-warning-ok");
const btnOnlineLockedOk = document.getElementById("btn-online-locked-ok");
const onlineLockedTitle = document.getElementById("online-locked-title");
const onlineLockedMessage = document.getElementById("online-locked-message");
const onlineLockedLoading = document.getElementById("online-locked-loading");
const screenOpponentLeft = document.getElementById("screen-opponent-left");
const btnOpponentLeftOk = document.getElementById("btn-opponent-left-ok");

// Elementos de opciones
const sliderMusica = document.getElementById("slider-musica");
const valorMusicaTx = document.getElementById("valor-musica");
const sliderEfectos = document.getElementById("slider-efectos");
const valorEfectosTx = document.getElementById("valor-efectos");

const switchFps = document.getElementById('switch-fps');
const contadorFpsDiv = document.getElementById('contador-fps');
const switchPing = document.getElementById('switch-ping');
const debugPanel = document.getElementById('debug-panel');
const btnRestablecerConfig = document.getElementById("btn-restablecer-config");
const btnEntendido = document.getElementById("btn-entendido");

// Elementos del juego
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");
const scoreboardEl = document.getElementById("scoreboard");
const teamLeftNameEl = document.getElementById("team-left-name");
const teamRightNameEl = document.getElementById("team-right-name");
const teamLeftPointsValueEl = document.getElementById("team-left-points-value");
const teamRightPointsValueEl = document.getElementById("team-right-points-value");

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
let versusTimeoutId = null;
let onlineAccessCheckInProgress = false;
const DEFAULT_LOCAL_SCOREBOARD_LABELS = { left: "J1", right: "J2" };


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
  if(screenOnlineWaiting) screenOnlineWaiting.classList.remove("active"); // NUEVO
  if(screenOnlineLocked) screenOnlineLocked.classList.add("hidden");
  if(screenOpponentLeft) screenOpponentLeft.classList.remove("active");   // NUEVO
  hideVersusScreen();

  screenToShow.classList.add("active");
  if (btnMiCuenta) {
    if (screenToShow !== screenStart) btnMiCuenta.classList.add("hidden");
    else btnMiCuenta.classList.remove("hidden");
  }
  if (btnRanking) {
    if (screenToShow !== screenStart) btnRanking.classList.add("hidden");
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

function getVersusName(name, fallback) {
  if (typeof name !== "string") return fallback;
  const limpio = name.trim();
  return limpio ? limpio : fallback;
}

function getScoreboardAbbreviation(name, fallback) {
  if (typeof name !== "string") return fallback;
  const limpio = name.trim().replace(/\s+/g, "");
  if (!limpio) return fallback;
  return limpio.slice(0, 3).toUpperCase();
}

function setVersusLabel(element, text) {
  if (!element) return;
  const contenido = typeof text === "string" ? text.trim() : "";
  element.textContent = contenido;
  element.hidden = !contenido;
}

function updateLocalScoreboardLabels(labels = DEFAULT_LOCAL_SCOREBOARD_LABELS) {
  if (teamLeftNameEl) teamLeftNameEl.textContent = labels.left || DEFAULT_LOCAL_SCOREBOARD_LABELS.left;
  if (teamRightNameEl) teamRightNameEl.textContent = labels.right || DEFAULT_LOCAL_SCOREBOARD_LABELS.right;
  if (teamLeftPointsValueEl) teamLeftPointsValueEl.textContent = "0";
  if (teamRightPointsValueEl) teamRightPointsValueEl.textContent = "0";
  if (scoreboardEl) scoreboardEl.classList.remove("is-online");
  if (scoreboardEl && scoreboardEl.parentElement) scoreboardEl.parentElement.classList.remove("is-online");
  const leftPointsEl = document.getElementById("team-left-points");
  const rightPointsEl = document.getElementById("team-right-points");
  if (leftPointsEl) leftPointsEl.classList.remove("pause-unavailable");
  if (rightPointsEl) rightPointsEl.classList.remove("pause-unavailable");
  if (btnPause) btnPause.classList.remove("hidden");
}

function hideVersusScreen() {
  if (versusTimeoutId) {
    clearTimeout(versusTimeoutId);
    versusTimeoutId = null;
  }
  if (screenVersus) screenVersus.classList.remove("active");
}

function playVersusIntro({ leftName, rightName, leftLabel = "", rightLabel = "", duration = 2000, onComplete } = {}) {
  hideVersusScreen();

  if (versusNameLeft) versusNameLeft.textContent = getVersusName(leftName, "Jugador 1");
  if (versusNameRight) versusNameRight.textContent = getVersusName(rightName, "Jugador 2");
  setVersusLabel(versusLabelLeft, leftLabel);
  setVersusLabel(versusLabelRight, rightLabel);
  if (screenVersus) screenVersus.classList.add("active");

  versusTimeoutId = setTimeout(() => {
    versusTimeoutId = null;
    if (screenVersus) screenVersus.classList.remove("active");
    if (typeof onComplete === "function") onComplete();
  }, duration);
}

async function iniciarCuentaAtrasInicio(callback) {
  if (cuentaAtrasActiva) return;
  cuentaAtrasActiva = true;

  // 1. Ocultamos la interfaz de pausa al instante
  hidePauseMenu();

  await countdownAudioWarmup;

  // 2. Volvemos a encender el ambiente del estadio que la pausa había cortado
  playMatchAmbient();

  contadorPausa.classList.remove("hidden");
  let cuenta = 3;
  contadorPausa.textContent = cuenta;
  window.playSound('sfx-jump', 0.3); // Sonido del número 3

  const intervaloCuenta = setInterval(() => {
    cuenta--;
    if (cuenta > 0) {
      contadorPausa.textContent = cuenta;
      window.playSound('sfx-jump', 0.3); // Sonido del 2 y el 1
    } else {
      clearInterval(intervaloCuenta);
      contadorPausa.classList.add("hidden");
      cuentaAtrasActiva = false;
      window.playSound('sfx-whistle'); // Pitido de inicio
      if (typeof callback === "function") callback();
    }
  }, 1000);
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

async function obtenerProgresoOnline() {
  const response = await fetch('../funciones_backend.php?accion=progreso_online', {
    credentials: 'same-origin'
  });
  const datos = await response.json();

  if (!response.ok || !datos.exito) {
    throw new Error(datos.error || "No se pudo comprobar el acceso online.");
  }

  return datos.progreso;
}

function mostrarMensajeOnlineBloqueado(victoriasRestantes) {
  const restantes = Math.max(0, Number.parseInt(victoriasRestantes, 10) || 0);
  const textoRestantes = restantes === 1
      ? "Te queda 1 victoria contra el bot."
      : `Te quedan ${restantes} victorias contra el bot.`;

  if (onlineLockedLoading) onlineLockedLoading.classList.add("hidden");
  if (onlineLockedTitle) onlineLockedTitle.classList.remove("hidden");
  if (btnOnlineLockedOk) btnOnlineLockedOk.classList.remove("hidden");
  if (onlineLockedMessage) {
    onlineLockedMessage.classList.remove("hidden");
    onlineLockedMessage.innerHTML = `
      Necesitas ganar 10 partidas contra el bot para desbloquear el modo online.<br><br>
      ${textoRestantes}
    `;
  }

  if (screenOnlineLocked) screenOnlineLocked.classList.remove("hidden");
}

function mostrarMensajeOnlineNoVerificado() {
  if (onlineLockedLoading) onlineLockedLoading.classList.add("hidden");
  if (onlineLockedTitle) onlineLockedTitle.classList.remove("hidden");
  if (btnOnlineLockedOk) btnOnlineLockedOk.classList.remove("hidden");
  if (onlineLockedMessage) {
    onlineLockedMessage.classList.remove("hidden");
    onlineLockedMessage.textContent = "No se pudo comprobar si tienes el modo online desbloqueado. Inténtalo de nuevo en unos segundos.";
  }

  if (screenOnlineLocked) screenOnlineLocked.classList.remove("hidden");
}

function mostrarComprobandoAccesoOnline() {
  if (onlineLockedTitle) onlineLockedTitle.classList.add("hidden");
  if (btnOnlineLockedOk) btnOnlineLockedOk.classList.add("hidden");
  if (onlineLockedMessage) {
    onlineLockedMessage.textContent = "";
    onlineLockedMessage.classList.add("hidden");
  }
  if (onlineLockedLoading) onlineLockedLoading.classList.remove("hidden");
  if (screenOnlineLocked) screenOnlineLocked.classList.remove("hidden");
}

async function registrarVictoriaContraBot() {
  try {
    const formData = new FormData();
    formData.append('accion', 'registrar_victoria_bot');

    const response = await fetch('../funciones_backend.php', {
      method: 'POST',
      body: formData,
      credentials: 'same-origin'
    });
    const datos = await response.json();

    if (!response.ok || !datos.exito) {
      throw new Error(datos.error || "No se pudo registrar la victoria contra el bot.");
    }

    const progreso = datos.progreso || {};
    window.victoriasBot = progreso.victorias_bot;
    window.tipoUsuario = progreso.id_tipo_usuario;
  } catch (error) {
    console.warn("Error registrando la victoria contra el bot:", error);
  }
}

// Asignar navegación
function beginBasicGame() {
  btnRestart.classList.remove("hidden");
  lastGameParams = {
    canvas,
    ctx,
    scoreEl,
    timerEl,
    scoreboardLabels: { ...DEFAULT_LOCAL_SCOREBOARD_LABELS },
    playerNames: { left: "Jugador 1", right: "Jugador 2" },
    onExit: () => {
      updateLocalScoreboardLabels();
      showScreen(screenStart);
      window.Game.startIdle({ canvas, ctx });
      playMenuMusic();
    }
  };
  updateLocalScoreboardLabels(lastGameParams.scoreboardLabels);
  showScreen(screenGame);
  playVersusIntro({
    leftName: "Jugador 1",
    rightName: "Jugador 2",
    onComplete: () => {
      playMatchAmbient();
      // Arrancamos el motor para que dibuje el campo y los personajes
      window.Game.startBasicGame(lastGameParams);
      // Lo pausamos de inmediato para que no se puedan mover
      window.Game.pauseGame();

      if (window.Game.forceRedraw) window.Game.forceRedraw(ctx);

      // Iniciamos la cuenta atrás, y al terminar, reanudamos
      iniciarCuentaAtrasInicio(() => {
        window.Game.resumeGame();
      });
    }
  });
}

function beginBotGame() {
  btnRestart.classList.remove("hidden");

  lastGameParams = {
    canvas,
    ctx,
    scoreEl,
    timerEl,
    bot: true,
    scoreboardLabels: {
      left: getScoreboardAbbreviation(window.currentUsername, "J1"),
      right: "BOT"
    },
    playerNames: {
      left: getVersusName(window.currentUsername, "Jugador 1"),
      right: "BOT"
    },
    onExit: () => {
      touchControls.classList.add("hidden"); // Ocultar al salir
      updateLocalScoreboardLabels();
      showScreen(screenStart);
      window.Game.startIdle({ canvas, ctx });
      playMenuMusic();
    }
  };

  // Mostrar controles si es móvil
  if (isTouchDevice()) {
    touchControls.classList.remove("hidden");
  }

  updateLocalScoreboardLabels(lastGameParams.scoreboardLabels);
  showScreen(screenGame);
  playVersusIntro({
    leftName: getVersusName(window.currentUsername, "Jugador 1"),
    rightName: "BOT",
    onComplete: () => {
      playMatchAmbient();
      window.Game.startBasicGame(lastGameParams);
      window.Game.pauseGame();

      if (window.Game.forceRedraw) window.Game.forceRedraw(ctx);

      iniciarCuentaAtrasInicio(() => {
        window.Game.resumeGame();
      });
    }
  });
}

function showEndScreen(leftName, leftScore, rightName, rightScore, pointsDelta) {
  hideVersusScreen();
  finalScoreEl.textContent = `${leftScore} - ${rightScore}`;

  let winnerMessage = "";
  if (leftScore > rightScore) winnerMessage = `¡Gana ${leftName}!`;
  else if (rightScore > leftScore) winnerMessage = `¡Gana ${rightName}!`;
  else winnerMessage = "¡Empate!";

  if (lastGameParams?.bot && leftScore > rightScore) {
    registrarVictoriaContraBot();
  }

  // Verificamos si hay variación de puntos (online)
  if (pointsDelta !== undefined && pointsDelta !== null) {
    const sign = pointsDelta >= 0 ? "+" : ""; // Ahora incluimos el 0 aquí

    // Elegimos color: Verde si gana, Rojo si pierde, Amarillo si es 0
    let color = "#FFE138"; // Amarillo para empate (+0)
    if (pointsDelta > 0) color = "#0DFF72";      // Verde neón
    else if (pointsDelta < 0) color = "#FF0D72"; // Rojo neón

    winnerMessageEl.innerHTML = `
        ${winnerMessage}
        <br>
        <span style="color: ${color}; font-size: 1.4rem; font-weight: bold; margin-top: 10px; display: inline-block;">
            ${sign}${pointsDelta} Puntos
        </span>
      `;
  }
  else {
    // Caso offline o contra Bot sin sistema de puntos
    winnerMessageEl.textContent = winnerMessage;
  }

  // Mostramos la pantalla final
  screenEnd.classList.add("active");
}

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
asignarBoton(btn1v1Local, () => {
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
asignarBoton(btnOnlineLockedOk, () => {
  if (screenOnlineLocked) screenOnlineLocked.classList.add("hidden");
});
asignarBoton(btn1vBot, () => {
  beginBotGame();
});

// REEMPLAZAR EL BOTÓN JUGAR ONLINE (Ahora enciende el socket)
asignarBoton(btn1v1Online, async () => {
  if (onlineAccessCheckInProgress) return;

  onlineAccessCheckInProgress = true;
  if (btn1v1Online) btn1v1Online.disabled = true;
  mostrarComprobandoAccesoOnline();

  try {
    const progreso = await obtenerProgresoOnline();

    if (!progreso.es_avanzado) {
      mostrarMensajeOnlineBloqueado(progreso.victorias_restantes);
      return;
    }

    btnRestart.classList.add("hidden");
    // Solo conectamos si estábamos desconectados, evitando arrastrar partidas
    if (typeof socket !== 'undefined' && !socket.connected) {
      socket.connect();
    }
    showScreen(screenOnlineWaiting);
    window.Game.startOnlineGame({
      canvas,
      ctx,
      scoreEl,
      timerEl
    });
  } catch (error) {
    console.warn("Error comprobando el acceso al online:", error);
    mostrarMensajeOnlineNoVerificado();
  } finally {
    onlineAccessCheckInProgress = false;
    if (btn1v1Online) btn1v1Online.disabled = false;
  }
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

asignarBoton(btnOpponentLeftOk, () => {
  // Escondemos la pantalla
  screenOpponentLeft.classList.remove("active");

  // Forzamos a que nuestro socket se reinicie para salir de la "sala rota"
  if (typeof socket !== 'undefined') {
    socket.disconnect(); // Cortamos conexión
  }

  // Ocultamos el icono de mala conexión
  if (badWifiIcon) {
    badWifiIcon.classList.add('hidden');
  }

  // Paramos todo usando tus propias funciones
  window.Game.stopBasicGame();
  stopAllSounds();
  hideVersusScreen();
  if (isTouchDevice()) {
    touchControls.classList.add("hidden");
  }

  // Volvemos al menú principal
  showScreen(screenStart);
  window.Game.startIdle({ canvas, ctx });
  playMenuMusic();
});

// Al darle a Continuar tras el partido, nos aseguramos de que el socket
// esté listo para una nueva conexión futura si el usuario quiere volver a jugar.
asignarBoton(btnContinue, () => {
  screenEnd.classList.remove("active"); // Quitamos el modal de victoria
  window.Game.stopBasicGame();
  stopAllSounds();
  hideVersusScreen();
  touchControls.classList.add("hidden");

  // Ocultamos el icono de mala conexión por si se quedó encendido
  if (badWifiIcon) {
    badWifiIcon.classList.add('hidden');
  }

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
  // Bloquear clic si la cuenta atrás ya se está ejecutando
  if (contadorPausa && !contadorPausa.classList.contains("hidden")) return;

  if (window.isOnlineMode && typeof socket !== 'undefined') {
    // En online, pedimos al servidor que cambie el estado
    socket.emit('requestTogglePause');
  } else {
    // Lógica local original
    if (screenPause && !screenPause.classList.contains('hidden')) {
      iniciarCuentaAtrasReanudar();
    } else {
      if (cuentaAtrasActiva) return;
      window.Game.pauseGame();
      showPauseMenu();
    }
  }
});
asignarBoton(btnResume, () => {
  if (window.isOnlineMode && typeof socket !== 'undefined') {
    socket.emit('requestTogglePause');
  } else {
    iniciarCuentaAtrasReanudar();
  }
});
asignarBoton(btnRestart, () => {
  hidePauseMenu();
  if (lastGameParams) {
    document.getElementById('game-wrap').classList.remove('is-paused');
    updateLocalScoreboardLabels(lastGameParams.scoreboardLabels);

    playVersusIntro({
      leftName: lastGameParams.bot ? getVersusName(window.currentUsername, "Jugador 1") : "Jugador 1",
      rightName: lastGameParams.bot ? "BOT" : "Jugador 2",
      onComplete: () => {
        playMatchAmbient();
        window.Game.startBasicGame(lastGameParams);
        window.Game.pauseGame();

        // Forzamos a repintar el frame congelado
        if (window.Game.forceRedraw) window.Game.forceRedraw(ctx);

        iniciarCuentaAtrasInicio(() => {
          window.Game.resumeGame();
        });
      }
    });
  }
});
// El botón de salir en el menú de pausa
asignarBoton(btnExitPause, () => {
  hidePauseMenu();

  // Si estamos en online, avisamos que es voluntario y nos desconectamos limpiamente
  if (window.isOnlineMode && typeof socket !== 'undefined') {
    // Pedimos al servidor que confirme, pero si en 1 segundo no hay respuesta
    // (porque no hay internet), nos desconectamos de todos modos.
    socket.timeout(1000).emit('explicitAbandon', (err) => {
      if (socket.connected) socket.disconnect();
    });
  }

  window.Game.stopBasicGame();
  stopAllSounds();
  hideVersusScreen();
  touchControls.classList.add("hidden");
  updateLocalScoreboardLabels();
  showScreen(screenStart);
  window.Game.startIdle({ canvas, ctx });
  if (audio) audio.resume().then();
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
  mostrarFPS: false,
  mostrarPing: false
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
      if (typeof parsed.mostrarPing === "boolean") settings.mostrarPing = parsed.mostrarPing;
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

  if (switchPing) switchPing.checked = settings.mostrarPing;
  if (debugPanel) {
    if (settings.mostrarPing && window.isOnlineMode) debugPanel.classList.remove('hidden');
    else debugPanel.classList.add('hidden');
  }
}


/* ==========================================================================
   SISTEMA DE AUDIO WEB (ALTO RENDIMIENTO)
   ========================================================================== */
let musicUnlocked = false;
let audio = null;
let activeSFXNodes = new Set();
let countdownAudioWarmup = Promise.resolve();

const MENU_AUDIO_WARMUP_IDS = [
  'bg-music'
];

const COUNTDOWN_AUDIO_WARMUP_IDS = [
  'sfx-crowd-ambient',
  'sfx-jump',
  'sfx-whistle'
];

const AUDIO_WARMUP_IDS = [
  'bg-music',
  'sfx-crowd-ambient',
  'sfx-whistle',
  'sfx-goal',
  'sfx-rebound',
  'sfx-ball-post',
  'sfx-ball-grass',
  'sfx-jump',
  'sfx-land',
  'sfx-player-collide',
  'sfx-player-kick'
];

const audioReady = import('../AudioManager.js?v=3').then(({ AudioManager }) => {
  audio = new AudioManager({
    musicVolume: settings.musicVolume,
    effectsVolume: settings.sfxVolume
  });
  return audio;
});

async function loadSound(id, url) {
  const audioManager = await audioReady;
  return audioManager.load(id, url);
}

function warmupAudio(ids = AUDIO_WARMUP_IDS) {
  return audioReady
      .then(audioManager => Promise.all(ids.map(id => audioManager.getBuffer(id))))
      .catch(e => {
        console.warn('No se pudo precalentar el audio', e);
      });
}

function applyVolumes() {
  if (!audio) return;

  audio.setMusicVolume(settings.musicVolume);
  audio.setEffectsVolume(settings.sfxVolume);
  audio.setLoopVolume('bg-music', 0.4);
  audio.setLoopVolume('sfx-crowd-ambient', 0.5);
}

function stopAllSounds() {
  if (audio) {
    audio.stopLoop('bg-music');
    audio.stopLoop('sfx-crowd-ambient');
  }

  // Parar todos los efectos de Web Audio API
  activeSFXNodes.forEach(source => {
    try { source.stop(); } catch(e){}
  });
  activeSFXNodes.clear();
}

function playMenuMusic() {
  if (!musicUnlocked || !audio) return;

  audio.stopLoop('sfx-crowd-ambient');
  audio.stopLoop('bg-music');
  audio.play('bg-music', { volume: 0.4, loop: true, type: 'music' }).then();
}

function playMatchAmbient() {
  if (!musicUnlocked || !audio) return;

  audio.stopLoop('bg-music');
  audio.stopLoop('sfx-crowd-ambient');
  audio.play('sfx-crowd-ambient', { volume: 0.5, loop: true }).then();
}

/* ==========================================================================
   EVENTOS DE INTERFAZ DE OPCIONES
   ========================================================================== */

btnRestablecerConfig.addEventListener('click', () => {
  // 1. Valores base
  settings.musicVolume = 0.5;
  settings.sfxVolume = 1.0;
  settings.mostrarFPS = false;
  settings.mostrarPing = false;
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

switchPing.addEventListener('change', (e) => {
  settings.mostrarPing = e.target.checked;
  saveSettings();
  if (settings.mostrarPing && window.isOnlineMode) debugPanel.classList.remove('hidden');
  else debugPanel.classList.add('hidden');
  switchPing.blur();
});

// Desbloqueo inicial (Tap to Start)
screenTapToStart.addEventListener('click', async () => {
  if (musicUnlocked) return;
  musicUnlocked = true;

  // Reactivar el contexto de audio (Política obligatoria de los navegadores)
  const audioManager = await audioReady;
  await audioManager.unlock();
  await warmupAudio(MENU_AUDIO_WARMUP_IDS);
  countdownAudioWarmup = warmupAudio(COUNTDOWN_AUDIO_WARMUP_IDS);
  countdownAudioWarmup.then(() => warmupAudio());

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
  if (settings.sfxVolume <= 0 || !musicUnlocked || !audio) return;

  // SEGURIDAD: Evitar saturación acústica al conducir el balón o en rebotes ultrarrápidos
  if (soundId === 'sfx-rebound') {
    const now = Date.now();
    // Requerimos que pasen al menos 90ms entre rebotes audibles
    if (window._lastReboundSoundAt && now - window._lastReboundSoundAt < 90) return;
    window._lastReboundSoundAt = now;
  }

  if (soundId === 'sfx-ball-grass') {
    const now = Date.now();
    // Requerimos que pasen al menos 500ms entre sonido y sonido
    if (window._lastGrassSoundAt && now - window._lastGrassSoundAt < 200) return;
    window._lastGrassSoundAt = now;
  }

  if (soundId === 'sfx-ball-post') {
    const now = Date.now();
    if (window._lastPostSoundAt && now - window._lastPostSoundAt < 140) return;
    window._lastPostSoundAt = now;
  }

  audio.play(soundId, { volume }).then((item) => {
    if (!item) return;

    activeSFXNodes.add(item.source);
    item.source.onended = () => {
      activeSFXNodes.delete(item.source);
    };
  });
};


/* ==========================================================================
   INICIALIZACIÓN
   ========================================================================== */

loadSettings();
updateOptionsUI();
audioReady.then(() => applyVolumes());

const RESIZE_RETRY_DELAYS = [80, 250, 600];
let resizeRetryTimeouts = [];

function getViewportSize() {
  const visualViewport = window.visualViewport;
  const width = Math.round(visualViewport?.width || document.documentElement.clientWidth || window.innerWidth);
  const height = Math.round(visualViewport?.height || document.documentElement.clientHeight || window.innerHeight);
  const offsetLeft = Math.round(visualViewport?.offsetLeft || 0);
  const offsetTop = Math.round(visualViewport?.offsetTop || 0);

  return { width, height, offsetLeft, offsetTop };
}

function scheduleResizeCanvas() {
  resizeRetryTimeouts.forEach(clearTimeout);
  resizeRetryTimeouts = [];

  resizeCanvas();
  requestAnimationFrame(resizeCanvas);

  resizeRetryTimeouts = RESIZE_RETRY_DELAYS.map((delay) => setTimeout(resizeCanvas, delay));
}

// Listener de redimensión para el Canvas y la UI
function resizeCanvas() {
  const wrap = document.getElementById('game-wrap');
  const baseW = 1845;
  const baseH = 1038;
  const viewport = getViewportSize();

  // 1. Calcular la escala necesaria (zoom)
  const scale = Math.min(viewport.width / baseW, viewport.height / baseH);

  // 2. Centrado matemático exacto (evita el bug de CSS translate(-50%, -50%) con anchos estrechos)
  const leftOffset = viewport.offsetLeft + (viewport.width - (baseW * scale)) / 2;
  const topOffset = viewport.offsetTop + (viewport.height - (baseH * scale)) / 2;

  // 3. Aplicar el desplazamiento exacto y el zoom desde la esquina superior izquierda
  wrap.style.transformOrigin = 'top left';
  wrap.style.transform = `translate(${leftOffset}px, ${topOffset}px) scale(${scale})`;

  // 4. Fijamos la resolución interna
  canvas.width = baseW;
  canvas.height = baseH;

  // 5. Le avisamos al motor para que recalcule las porterías
  if (window.Game && window.Game.resize) {
    window.Game.resize(canvas.width, canvas.height);
  }

  // Como redimensionar borra el canvas, si el juego está pausado (el bucle no corre),
  // se queda en negro. Necesitamos forzar un dibujado usando el estado actual.
  if (window.Game && window.Game.forceRedraw) {
    window.Game.forceRedraw(ctx);
  }

  // En online no forzamos jamás la pausa automática por orientación.
  // El aviso visual puede mostrarse, pero la partida debe seguir viva.
  if (!window.isOnlineMode && viewport.height > viewport.width && screenGame.classList.contains("active")) {
    // Evitamos pausar si ya hay una cuenta atrás para reanudar (previene bugs visuales)
    if (!cuentaAtrasActiva && window.Game && window.Game.pauseGame) {
      window.Game.pauseGame();
    }
  }
}

//Escuchar cambios de tamaño de ventana
window.addEventListener('resize', scheduleResizeCanvas);
window.addEventListener('orientationchange', scheduleResizeCanvas);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', scheduleResizeCanvas);
  window.visualViewport.addEventListener('scroll', scheduleResizeCanvas);
}
if (window.screen?.orientation?.addEventListener) {
  window.screen.orientation.addEventListener('change', scheduleResizeCanvas);
}

// Forzar un primer ajuste al arrancar
scheduleResizeCanvas();

// Arrancar el modo reposo para ver las porterías de fondo
if (window.Game && window.Game.startIdle) {
  window.Game.startIdle({ canvas, ctx });
}

/* ==========================================================================
   AUTO-PAUSE CUANDO EL JUEGO PIERDE EL FOCO
   ========================================================================== */

// Función auxiliar para forzar la pausa
function forcePauseIfPlaying() {
  // Si estamos online, ignoramos el auto-pause al cambiar de pestaña
  if (window.isOnlineMode) return;

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
    if (audio) audio.suspend();

    // IMPORTANTE: Hemos borrado stopAllSounds() aquí para no destruir las pistas.
  }
  else {
    if (!musicUnlocked) return;

    // Despertamos el motor de audio al volver a la pestaña. Todo sigue por donde iba.
    if (audio) audio.resume().then();

    // IMPORTANTE: Hemos borrado los playMenuMusic() y playMatchAmbient()
    // porque las pistas siguen ahí, solo estaban congeladas.
  }
});

// 2. Cuando el navegador pierde el foco (hace clic en otra ventana/monitor)
window.addEventListener("blur", () => {
  forcePauseIfPlaying();

  // También congelamos el audio si pincha fuera de la ventana
  if (audio) audio.suspend();
});

// 3. Cuando la ventana recupera el foco
window.addEventListener("focus", () => {
  if (!musicUnlocked) return;
  if (audio) audio.resume().then();
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
// API pública del motor para game.js
window.Main = {
  isTouchDevice,
  playVersusIntro,
  hideVersusScreen,
  playMatchAmbient,
  stopAllSounds,
  showScreen,
  showEndScreen,
  updateOptionsUI
};

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