<?php
// juego.php

// Comprobamos si existe la llave secreta que genera el index.php
// Si alguien intenta entrar directamente a tudominio.com/juego.php, lo devolvemos al inicio
if (!defined('ACCESO_PERMITIDO')) {
    header("Location: ../index.php");
    exit;
}

$basePath = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/');
$asset = static function (string $path) use ($basePath): string {
    return ($basePath === '' ? '' : $basePath) . '/' . ltrim($path, '/');
};
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <title>Cabezazo Clash</title>
    <link rel="manifest" href="<?= htmlspecialchars($asset('manifest.json'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="apple-touch-icon" href="<?= htmlspecialchars($asset('assets/img/logo192.png'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="icon" type="image/x-icon" href="<?= htmlspecialchars($asset('assets/icon/favicon.ico'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="stylesheet" href="<?= htmlspecialchars($asset('juego/juego.css?v=9'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
</head>
<body>
<div id="viewport-tester" style="position: absolute; top: 0; left: 0; width: 100vw; height: 100dvh; pointer-events: none; visibility: hidden; z-index: -9999;"></div>
<div id="game-wrap" class="game-wrap">
    <a href="mi_cuenta/mi_cuenta.php" id="btn-mi-cuenta" class="btn-mi-cuenta hidden" title="Mi Cuenta">
        <i class="bi bi-person-circle"></i>
    </a>
    <a href="ranking/ranking.php" id="btn-ranking" class="btn-ranking hidden" title="Ranking Global">
        <i class="bi bi-trophy-fill"></i>
    </a>
    <section id="screen-tap-to-start" class="screen hidden" style="z-index: 999; background: #000; cursor: pointer;">
        <div class="card" style="background: transparent; box-shadow: none; backdrop-filter: none;">
            <h1 class="title" style="font-size: 3rem; animation: pulse-text 1.5s infinite alternate ease-in-out;">TOCA PARA EMPEZAR</h1>
        </div>
    </section>

    <div id="pantalla-carga" class="screen" style="z-index: 10000; background-color: #000; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <h2 id="titulo-carga" style="color: white; font-family: 'Arial', sans-serif; letter-spacing: 2px;">CARGANDO...</h2>
        <div class="spinner"></div>
    </div>

    <div id="contador-pausa" class="hidden">3</div>
    <canvas id="game-canvas"></canvas>

    <div id="bad-connection-warning" class="hidden">
        <i class="bi bi-wifi-1"></i><span class="warning-exclamation">!</span>
    </div>

    <section id="screen-opponent-left" class="screen">
        <div class="card info-card" style="border: 3px solid #ff0d72; box-shadow: 0 0 30px rgba(255, 13, 114, 0.4);">
            <i class="bi bi-person-x-fill" style="font-size: 6rem; color: #ff0d72; margin-bottom: 1rem;"></i>
            <h2 class="subtitle">¡CONEXIÓN PERDIDA!</h2>
            <p class="info-description">Tu rival se ha desconectado o ha abandonado la partida.</p>
            <button id="btn-opponent-left-ok" class="btn large-got-it-btn" style="margin-top: 1rem;">SALIR</button>
        </div>
    </section>

    <section id="screen-already-connected" class="screen">
        <div class="card info-card" style="border: 3px solid #ff9800; box-shadow: 0 0 30px rgba(255, 152, 0, 0.4);">
            <i class="bi bi-exclamation-triangle-fill" style="font-size: 6rem; color: #ff9800; margin-bottom: 1rem;"></i>
            <h2 class="subtitle">¡CUENTA EN USO!</h2>
            <p class="info-description">Esta cuenta ya está jugando o esperando partida en otro dispositivo o pestaña.</p>
            <button id="btn-already-connected-ok" class="btn large-got-it-btn" style="margin-top: 1rem;">RECARGA</button>
        </div>
    </section>

    <div id="touch-controls" class="hidden">
        <div class="touch-left">
            <button id="btn-touch-left" class="touch-btn"><i class="bi bi-arrow-left"></i></button>
            <button id="btn-touch-right" class="touch-btn"><i class="bi bi-arrow-right"></i></button>
        </div>

        <div class="touch-right">
            <button id="btn-touch-jump" class="touch-btn jump-btn"><i class="bi bi-arrow-up"></i></button>
            <button id="btn-touch-kick" class="touch-btn kick-btn"><i class="bi bi-record-circle-fill"></i></button>
        </div>
    </div>

    <!-- Pantalla 1: Inicio -->
    <section id="screen-start" class="screen">
        <button id="btn-info" class="info-btn"><i class="bi bi-question-lg"></i></button>
        <div class="card">
            <h1 class="title">Cabezazo Clash</h1>

            <div class="buttons">
                <button id="btn-play" class="btn">Jugar</button>
                <button id="btn-options" class="btn btn-secondary">Opciones</button>
                <button id="btn-how-to-play" class="btn btn-secondary">Cómo Jugar</button>
            </div>
        </div>
    </section>

    <!-- Pantalla 2: Modo de juego -->
    <section id="screen-mode-select" class="screen">
        <div class="card">
            <h2 class="subtitle">MODO DE JUEGO</h2>

            <div class="buttons-row">
                <button id="btn-1v1" class="btn">1 VS 1 LOCAL</button>
                <button id="btn-1vbot" class="btn">1 VS BOT LOCAL</button>
                <button id="btn-1v1Online" class="btn">1 VS 1 ONLINE</button>
            </div>
            <button id="btn-mode-back" class="btn btn large-got-it-btn" style="margin-top: 1rem;">Volver</button>
        </div>
    </section>

    <!-- Pantalla 3: Opciones -->
    <section id="screen-options" class="screen">
        <div class="card large-options-card">
            <h2 class="subtitle">AJUSTES</h2>

            <div class="options-scroll-area">
                <div class="seccion-ajustes">
                    <h3><i class="bi bi-volume-up-fill"></i> AUDIO</h3>

                    <div class="control-row">
                        <div class="control-info">
                            <span class="control-label">Música</span>
                            <span id="valor-musica" class="control-percentage">50%</span>
                        </div>
                        <input type="range" id="slider-musica" class="custom-slider" min="0" max="1" step="0.05" value="0.5">
                    </div>

                    <div class="control-row">
                        <div class="control-info">
                            <span class="control-label">Efectos de sonido</span>
                            <span id="valor-efectos" class="control-percentage">100%</span>
                        </div>
                        <input type="range" id="slider-efectos" class="custom-slider" min="0" max="1" step="0.05" value="1.0">
                    </div>
                </div>

                <div class="seccion-ajustes">
                    <h3><i class="bi bi-display"></i> VISUALIZACIÓN</h3>

                    <div class="control-row inline">
                        <span class="control-label">Mostrar FPS</span>
                        <label class="rocker-switch">
                            <input type="checkbox" id="switch-fps">
                            <span class="switch-state"></span>
                        </label>
                    </div>

                    <div class="control-row inline">
                        <span class="control-label">Mostrar Ping</span>
                        <label class="rocker-switch">
                            <input type="checkbox" id="switch-ping">
                            <span class="switch-state"></span>
                        </label>
                    </div>
                </div>
            </div>
            <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">

                <button id="btn-restablecer-config" class="btn large-got-it-btn" style="background: linear-gradient(180deg, #4b5563 0%, #374151 100%); border: 1px solid #6b7280; color: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                    RESTABLECER
                </button>

                <button id="btn-entendido" class="btn large-got-it-btn">
                    CERRAR
                </button>

            </div>
        </div>
    </section>

    <div id="contador-fps" class="hidden">FPS: 0</div>

    <div id="debug-panel" class="hidden" style="position: absolute; top: 50px; left: 10px; background: rgba(0,0,0,0.7); color: lime; padding: 10px; font-family: monospace; z-index: 9999; font-size: 14px;">
        Ping: <span id="debug-ping">0</span> ms<br>
        Descarga: <span id="debug-bytes">0</span> B/s
    </div>

    <!-- Pantalla 4: Como jugar -->
    <section id="screen-how-to-play" class="screen">
        <div class="card large-options-card">
            <h2 class="subtitle">CÓMO JUGAR</h2>

            <div class="large-controls-box" style="margin-top: 0;">
                <h3 class="large-controls-title">Controles</h3>
                <ul class="large-controls-list">
                    <li><b>Jugador 1:</b> A/D mover · W saltar · Espacio chutar</li>
                    <li><b>Jugador 2:</b> ←/→ mover · ↑ saltar · P chutar</li>
                    <li><b>Pausa:</b> R o pulsar el botón</li>
                </ul>
            </div>

            <button id="btn-close-how-to-play" class="btn large-got-it-btn">CERRAR</button>
        </div>
    </section>

    <!-- Pantalla 5: Acerca de -->
    <section id="screen-info" class="pause-menu hidden">
        <div class="card info-card">
            <img src="<?= htmlspecialchars($asset('assets/img/logo129.png'), ENT_QUOTES, 'UTF-8') ?>" alt="Logo Cabezazo Clash" class="info-logo">
            <h2 class="subtitle">Acerca de</h2>
            <p class="info-description">
                ¡Bienvenido a <b>Cabezazo Clash</b>!<br><br>
                Enfréntate a tus amigos o a la IA en un frenético partido de fútbol cabezón.
                Salta, chuta, defiende tu portería y marca más goles que tu rival antes de que se acabe el tiempo.<br><br>
                <i>¿Tienes lo necesario para ser el campeón?</i>
            </p>
            <button id="btn-close-info" class="btn">ENTENDIDO</button>
        </div>
    </section>

    <section id="screen-touch-warning" class="pause-menu hidden">
        <div class="card info-card">
            <h2 class="subtitle">Aviso Táctil</h2>
            <p class="info-description">
                El modo <b>1 VS 1 LOCAL</b> requiere el uso de un teclado para que dos personas puedan jugar en el mismo dispositivo.<br><br>
                Actualmente no está disponible usando controles táctiles. ¡Prueba el modo contra el BOT!
            </p>
            <button id="btn-touch-warning-ok" class="btn">ACEPTAR</button>
        </div>
    </section>

    <!-- Pantalla 6: Juego -->
    <section id="screen-game" class="screen">
        <div class="hud">
            <button id="btn-pause" class="pause-btn"><i class="bi bi-pause-fill"></i></button>

            <div class="tv-scoreboard" id="scoreboard">
                <div class="sb-time" id="timer">60</div>
                <div class="sb-team" id="team-left">P1</div>
                <div class="sb-score" id="score">0 - 0</div>
                <div class="sb-team" id="team-right">P2</div>

                <div class="sb-goal-overlay">¡GOOOOOOOL!</div>
            </div>
        </div>
    </section>

    <section id="screen-online-waiting" class="screen">
        <div class="card waiting-card">
            <h2 class="subtitle">BUSCANDO PARTIDA</h2>
            <div class="searching-container">
                <div class="radar"></div>
                <div class="ball-spinner"></div>
            </div>
            <p class="info-description">Esperando a un rival digno...</p>
            <button id="btn-cancel-online" class="btn btn-secondary" style="margin-top: 2rem;">CANCELAR</button>
        </div>
    </section>

    <!-- Pantalla 7: Fin del partido -->
    <section id="screen-end" class="screen">
        <div class="card">
            <h2 class="subtitle">¡Fin del Partido!</h2>
            <div id="final-score" class="final-score">0 - 0</div>
            <div id="winner-message" class="winner-message"></div>
            <button id="btn-continue" class="btn">Continuar</button>
        </div>
    </section>

    <!-- Pantalla 8: Menú de pausa -->
    <section id="pause-menu" class="pause-menu hidden">
        <div class="card">
            <h2 class="subtitle">Pausa</h2>
            <div class="buttons">
                <button id="btn-resume" class="btn">Reanudar</button>
                <button id="btn-restart" class="btn">Reiniciar</button>
                <button id="btn-pause-options" class="btn">Opciones</button>
                <button id="btn-pause-how-to-play" class="btn btn-secondary">Cómo Jugar</button>
                <button id="btn-exit" class="btn btn-secondary">Salir</button>
            </div>
        </div>
    </section>

</div>

<div id="orientation-warning">
    <div class="orientation-content">
        <i class="bi bi-phone-landscape"></i>
        <h2>¡Gira tu dispositivo!</h2>
        <p>Este juego está diseñado para jugarse en modo horizontal.</p>
    </div>
</div>
<script src="<?= htmlspecialchars($asset('/socket.io/socket.io.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>

<script>
    let socket;

    // Leemos el ID directamente de la sesión de PHP de forma segura.
    // Si no hay sesión, será null.
    const miUsuarioId = <?= isset($_SESSION['id_usuario']) ? json_encode($_SESSION['id_usuario']) : 'null' ?>;
    const miUsername = <?= isset($_SESSION['usuario']['username']) ? json_encode($_SESSION['usuario']['username']) : 'null' ?>;

    if (typeof io !== 'undefined') {
        if (!miUsuarioId) {
            console.error("No estás logueado. No puedes conectar al online.");
            // Aquí podrías redirigir al login
        }
        else {
            // 1. Apuntamos a tu dominio principal
            // 2. Le indicamos por qué 'ruta' debe meterse para encontrar el Node.js
            socket = io('https://confident-energy-production-c6ea.up.railway.app', {
            // socket = io('http://localhost:3000', {
                transports: ['websocket'],
                upgrade: false,
                autoConnect: false,
                auth: {
                    userId: miUsuarioId,
                    username: miUsername,
                }
            });

            socket.on('connect', () => {
                console.log('Conectado al servidor de WebSockets con el ID:', socket.id);
            });

            socket.on('connect_error', (err) => {
                if (err.message === "already_connected") {
                    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                    const tapScreen = document.getElementById('screen-tap-to-start');
                    if (tapScreen) {
                        tapScreen.classList.remove('active');
                        tapScreen.classList.add('hidden');
                        tapScreen.style.pointerEvents = 'none';
                    }
                    document.getElementById('screen-already-connected').classList.add('active');
                }
            });

            // Lógica del botón para salir si la cuenta está en uso
            const btnAlreadyConnected = document.getElementById('btn-already-connected-ok');
            if (btnAlreadyConnected) {
                btnAlreadyConnected.addEventListener('click', () => {
                    window.location.reload();
                });
            }

            // Exponer el socket globalmente si lo usan otros scripts
            window.socket = socket;
        }
    }
    else console.error("No se pudo cargar la librería Socket.io desde la CDN");
</script>
<script src="<?= htmlspecialchars($asset('juego/js/constants.js?v=4'), ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="<?= htmlspecialchars($asset('juego/js/entities.js?v=4'), ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="<?= htmlspecialchars($asset('juego/js/physics.js?v=6'), ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="<?= htmlspecialchars($asset('juego/js/renderer.js?v=3'), ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="<?= htmlspecialchars($asset('juego/js/input.js?v=5'), ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="<?= htmlspecialchars($asset('juego/js/game.js?v=8'), ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="<?= htmlspecialchars($asset('juego/js/online.js?v=13'), ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="<?= htmlspecialchars($asset('juego/js/main.js?v=27'), ENT_QUOTES, 'UTF-8') ?>"></script>
</body>
</html>
