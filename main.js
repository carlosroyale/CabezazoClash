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

// elementos de la pantalla de juego
const screenGame = document.getElementById("screen-game");
const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
let game = null; // instancia activa del juego básico

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
  startBasicGame();
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

// funciones del juego básico
function startBasicGame() {
  if (game) game.stop();
  game = createBasicGame({ canvas, ctx, scoreEl });
  game.start();
}

function backToMenuFromGame() {
  if (game) game.stop();
  showScreen(screenStart);
}

function createBasicGame({ canvas, ctx, scoreEl }) {
  const W = canvas.width;
  const H = canvas.height;

  // Constantes físicas (nivel BÁSICO)
  const GRAV = 1800;           // px/s^2
  const FLOOR_Y = H - 70;      // suelo
  const RESTITUTION = 0.7;     // rebote pelota
  const FRICTION = 0.88;       // fricción en suelo (pelota)
  const DT_MAX = 1 / 30;

  // Porterías (zonas de gol)
  const GOAL_W = 60;
  const GOAL_H = 160;
  const leftGoal = { x: 0, y: FLOOR_Y - GOAL_H, w: GOAL_W, h: GOAL_H };
  const rightGoal = { x: W - GOAL_W, y: FLOOR_Y - GOAL_H, w: GOAL_W, h: GOAL_H };

  // Entidades
  const ball = {
    x: W / 2,
    y: FLOOR_Y - 200,
    r: 18,
    vx: 220,
    vy: -200
  };

  const p1 = makePlayer(180, FLOOR_Y - 90, "P1");
  const p2 = makePlayer(W - 180, FLOOR_Y - 90, "P2");

  function makePlayer(x, y, label) {
    return {
      label,
      x,
      y,
      w: 56,
      h: 90,
      vx: 0,
      vy: 0,
      speed: 420,
      jump: 760,
      onGround: false
    };
  }

  let score = { left: 0, right: 0 };
  updateScore();

  // Input
  const keys = new Set();
  const onKeyDown = (e) => {
    keys.add(e.code);

    if (e.code === "Escape") backToMenuFromGame();
    if (e.code === "KeyR") resetRound();
  };
  const onKeyUp = (e) => keys.delete(e.code);

  // Bucle
  let running = false;
  let rafId = null;
  let last = performance.now();

  function start() {
    running = true;
    last = performance.now();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  }

  function tick(now) {
    if (!running) return;
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, DT_MAX);

    step(dt);
    draw();

    rafId = requestAnimationFrame(tick);
  }

  function step(dt) {
    // Controles
    // P1: A/D mover, W saltar
    controlPlayer(p1, dt, "KeyA", "KeyD", "KeyW");

    // P2: Flechas
    controlPlayer(p2, dt, "ArrowLeft", "ArrowRight", "ArrowUp");

    // Física jugadores
    updatePlayer(p1, dt);
    updatePlayer(p2, dt);

    // Física pelota
    updateBall(dt);

    // Colisiones jugador-pelota
    collidePlayerBall(p1);
    collidePlayerBall(p2);

    // Gol
    checkGoal();
  }

  function controlPlayer(p, dt, leftKey, rightKey, jumpKey) {
    let dir = 0;
    if (keys.has(leftKey)) dir -= 1;
    if (keys.has(rightKey)) dir += 1;

    p.vx = dir * p.speed;

    if (keys.has(jumpKey) && p.onGround) {
      p.vy = -p.jump;
      p.onGround = false;
    }
  }

  function updatePlayer(p, dt) {
    p.vy += GRAV * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // límites horizontales
    p.x = clamp(p.x, p.w / 2, W - p.w / 2);

    // suelo
    if (p.y + p.h / 2 >= FLOOR_Y) {
      p.y = FLOOR_Y - p.h / 2;
      p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
    }
  }

  function updateBall(dt) {
    ball.vy += GRAV * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // paredes
    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx = -ball.vx * RESTITUTION;
    }
    if (ball.x + ball.r > W) {
      ball.x = W - ball.r;
      ball.vx = -ball.vx * RESTITUTION;
    }

    // techo
    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy = -ball.vy * RESTITUTION;
    }

    // suelo
    if (ball.y + ball.r > FLOOR_Y) {
      ball.y = FLOOR_Y - ball.r;
      ball.vy = -ball.vy * RESTITUTION;

      // fricción al tocar suelo
      ball.vx *= FRICTION;

      // evitar vibraciones
      if (Math.abs(ball.vy) < 60) ball.vy = 0;
      if (Math.abs(ball.vx) < 12) ball.vx = 0;
    }
  }

  function collidePlayerBall(p) {
    // colisión círculo (ball) con AABB (player)
    const left = p.x - p.w / 2;
    const right = p.x + p.w / 2;
    const top = p.y - p.h / 2;
    const bottom = p.y + p.h / 2;

    const closestX = clamp(ball.x, left, right);
    const closestY = clamp(ball.y, top, bottom);

    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    const dist2 = dx * dx + dy * dy;

    if (dist2 < ball.r * ball.r) {
      const dist = Math.sqrt(dist2) || 0.0001;
      const nx = dx / dist;
      const ny = dy / dist;

      // sacar la pelota fuera del jugador
      const overlap = ball.r - dist;
      ball.x += nx * overlap;
      ball.y += ny * overlap;

      // impulso simple (arcade)
      const hitStrength = 520;
      ball.vx += nx * hitStrength;
      ball.vy += ny * hitStrength;

      // extra: si el jugador está moviéndose, transfiere velocidad
      ball.vx += p.vx * 0.35;
    }
  }

  function checkGoal() {
    // gol izquierda (marca el derecho) si la pelota entra en la portería izquierda
    if (circleRectOverlap(ball, leftGoal)) {
      score.right += 1;
      updateScore();
      resetRound("right");
    }

    // gol derecha (marca el izquierdo)
    if (circleRectOverlap(ball, rightGoal)) {
      score.left += 1;
      updateScore();
      resetRound("left");
    }
  }

  function resetRound(lastScorer = null) {
    // reset posiciones
    p1.x = 180; p1.y = FLOOR_Y - p1.h / 2; p1.vx = 0; p1.vy = 0;
    p2.x = W - 180; p2.y = FLOOR_Y - p2.h / 2; p2.vx = 0; p2.vy = 0;

    ball.x = W / 2;
    ball.y = FLOOR_Y - 200;
    ball.vx = lastScorer === "left" ? 220 : -220;
    ball.vy = -220;
  }

  function updateScore() {
    scoreEl.textContent = `${score.left} - ${score.right}`;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // fondo simple (se ve el estadio detrás por el body, pero el canvas también pinta algo)
    drawField();

    // porterías
    drawGoal(leftGoal);
    drawGoal(rightGoal);

    // jugadores
    drawPlayer(p1, "#ffffff");
    drawPlayer(p2, "#ffd700");

    // pelota
    drawBall();
  }

  function drawField() {
    // césped
    ctx.fillStyle = "rgba(40, 170, 90, 0.85)";
    ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

    // línea central
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(W / 2, FLOOR_Y);
    ctx.lineTo(W / 2, H);
    ctx.stroke();

    // suelo
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y);
    ctx.lineTo(W, FLOOR_Y);
    ctx.stroke();
  }

  function drawGoal(g) {
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(g.x, g.y, g.w, g.h);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 3;
    ctx.strokeRect(g.x, g.y, g.w, g.h);
  }

  function drawPlayer(p, color) {
    ctx.fillStyle = color;
    ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);

    // cabeza (círculo) para “head soccer vibes”
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.h / 2 - 18, 22, 0, Math.PI * 2);
    ctx.fill();

    // etiqueta
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.font = "16px Arial";
    ctx.fillText(p.label, p.x - 12, p.y + 6);
  }

  function drawBall() {
    ctx.beginPath();
    ctx.fillStyle = "white";
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function circleRectOverlap(c, r) {
    const closestX = clamp(c.x, r.x, r.x + r.w);
    const closestY = clamp(c.y, r.y, r.y + r.h);
    const dx = c.x - closestX;
    const dy = c.y - closestY;
    return (dx * dx + dy * dy) <= (c.r * c.r);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  return { start, stop };
}

