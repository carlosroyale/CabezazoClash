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
    <link rel="stylesheet" href="<?= htmlspecialchars($asset('juego/juego.css?v=2'), ENT_QUOTES, 'UTF-8') ?>">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
</head>
<body>
<div id="game-wrap" class="game-wrap">
    <a href="mi_cuenta/mi_cuenta.php" id="btn-mi-cuenta" class="btn-mi-cuenta hidden" title="Mi Cuenta">
        <i class="bi bi-person-circle"></i>
    </a>
    <a href="ranking/ranking.php" id="btn-ranking" class="btn-ranking hidden" title="Ranking Global">
        <i class="bi bi-trophy-fill"></i>
    </a>
    <section id="screen-tap-to-start" class="screen active" style="z-index: 999; background: #000; cursor: pointer;">
        <div class="card" style="background: transparent; box-shadow: none; backdrop-filter: none;">
            <h1 class="title" style="font-size: 3rem; animation: pulse-text 1.5s infinite alternate ease-in-out;">TOCA PARA EMPEZAR</h1>
        </div>
    </section>

    <div id="contador-pausa" class="hidden">3</div>
    <canvas id="game-canvas"></canvas>

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
            <button id="btn-mode-back" class="btn btn-secondary" style="margin-top: 1rem;">Volver</button>
        </div>
    </section>

    <!-- Pantalla 3: Opciones -->
    <section id="screen-options" class="screen">
        <div class="card large-options-card">
            <h2 class="subtitle">OPCIONES</h2>

            <div class="large-option-row">
                <label for="music-volume" class="large-label">MÚSICA</label>
                <div class="audio-control-group">
                    <input id="music-volume" class="large-slider" type="range" min="0" max="100" value="70">
                    <span id="music-volume-value" class="large-small">70%</span>
                </div>
            </div>

            <div class="large-option-row">
                <label for="sfx-volume" class="large-label">EFECTOS DE SONIDO</label>
                <div class="audio-control-group">
                    <input id="sfx-volume" class="large-slider" type="range" min="0" max="100" value="85">
                    <span id="sfx-volume-value" class="large-small">85%</span>
                </div>
            </div>

            <button id="btn-entendido" class="btn large-got-it-btn">CERRAR</button>
        </div>
    </section>

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
                <div class="sb-team">P1</div>
                <div class="sb-score" id="score">0 - 0</div>
                <div class="sb-team">P2</div>

                <div class="sb-goal-overlay">¡GOOOOOOOL!</div>
            </div>
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

<!-- música de fondo -->
<audio id="bg-music" loop preload="auto">
    <source src="<?= htmlspecialchars($asset('assets/audio/menu_music.mp3'), ENT_QUOTES, 'UTF-8') ?>" type="audio/mpeg">
</audio>

<audio id="sfx-crowd-ambient" loop preload="auto">
    <source src="<?= htmlspecialchars($asset('assets/audio/crowd_ambient.mp3'), ENT_QUOTES, 'UTF-8') ?>" type="audio/mpeg">
</audio>

<script src="<?= htmlspecialchars($asset('juego/js/constants.js?v=2'), ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="<?= htmlspecialchars($asset('juego/js/entities.js?v=2'), ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="<?= htmlspecialchars($asset('juego/js/physics.js?v=2'), ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="<?= htmlspecialchars($asset('juego/js/renderer.js?v=1'), ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="<?= htmlspecialchars($asset('juego/js/input.js?v=2'), ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="<?= htmlspecialchars($asset('juego/js/game.js?v=2'), ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="<?= htmlspecialchars($asset('juego/js/main.js?v=9'), ENT_QUOTES, 'UTF-8') ?>"></script>
</body>
</html>