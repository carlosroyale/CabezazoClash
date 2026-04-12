<?php
// ranking/ranking.php
require_once '../config_sesion.php';

// 1. Seguridad: Si no hay usuario, al inicio
if (!isset($_SESSION['usuario'])) {
    header("Location: ../index.php");
    exit;
}

$metodosDML = new MetodosDML();
$ranking = $metodosDML->obtenerRankingGlobal();

// 2. Cargar la plantilla visual
$html = file_get_contents('ranking.html');

// 3. Construir la lista de tarjetas de jugadores
$cardsHTML = '';
if (empty($ranking)) {
    $cardsHTML = '
        <div class="ranking-empty">
            <i class="bi bi-emoji-frown"></i><br>
            Aún no hay jugadores con puntos.<br>¡Juega una partida y sé el primero!
        </div>';
}
else {
    $posicionActual = 1;
    foreach ($ranking as $jugador) {
        $claseMedalla = '';
        if ($posicionActual == 1) $claseMedalla = 'oro';
        elseif ($posicionActual == 2) $claseMedalla = 'plata';
        elseif ($posicionActual == 3) $claseMedalla = 'bronce';

        $puntosFormateados = number_format($jugador['puntos_globales']);
        $username = htmlspecialchars($jugador['username']);

        // LÓGICA DE TENDENCIA (FLECHAS)
        $pos_anterior = $jugador['posicion_anterior'] ?? null;
        $trendIcon = '<i class="bi bi-dash"></i>'; // Igual (Gris) por defecto
        $trendClass = 'trend-neutral';
        $trendText = '';

        if ($pos_anterior !== null) {
            $diferencia = $pos_anterior - $posicionActual;

            if ($diferencia > 0) {
                // Subió (ej: estaba 5, ahora es 2 -> +3)
                $trendIcon = '<i class="bi bi-caret-up-fill"></i>';
                $trendClass = 'trend-up';
                $trendText = $diferencia;
            }
            elseif ($diferencia < 0) {
                // Bajó (ej: estaba 2, ahora es 5 -> -3)
                $trendIcon = '<i class="bi bi-caret-down-fill"></i>';
                $trendClass = 'trend-down';
                $trendText = abs($diferencia);
            }
        }
        else {
            // No estaba en la foto de ayer (jugador nuevo)
            $trendIcon = '<span class="trend-new">NUEVO</span>';
            $trendClass = '';
        }

        $cardsHTML .= "
            <div class='ranking-card $claseMedalla'>
                <div class='rank-pos'>$posicionActual</div>
                
                <div class='rank-trend $trendClass' title='Cambio respecto a ayer'>
                    $trendIcon <span class='trend-number'>$trendText</span>
                </div>
                
                <div class='rank-info'>
                    <span class='rank-name'>@$username</span>
                </div>
                <div class='rank-points'>$puntosFormateados pts</div>
            </div>";

        $posicionActual++;
    }
}

// 4. Inyectar los datos en el HTML y mostrar la página
echo str_replace('{{RANKING_CARDS}}', $cardsHTML, $html);