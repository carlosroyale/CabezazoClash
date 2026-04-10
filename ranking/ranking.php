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
} else {
    $posicion = 1;
    foreach ($ranking as $jugador) {
        $claseMedalla = '';
        if ($posicion == 1) $claseMedalla = 'oro';
        elseif ($posicion == 2) $claseMedalla = 'plata';
        elseif ($posicion == 3) $claseMedalla = 'bronce';

        $puntosFormateados = number_format($jugador['puntos_globales']);
        $username = htmlspecialchars($jugador['username']);

        $cardsHTML .= "
            <div class='ranking-card $claseMedalla'>
                <div class='rank-pos'>$posicion</div>
                <div class='rank-info'>
                    <span class='rank-name'>@$username</span>
                </div>
                <div class='rank-points'>$puntosFormateados pts</div>
            </div>";
        $posicion++;
    }
}

// 4. Inyectar los datos en el HTML y mostrar la página
echo str_replace('{{RANKING_CARDS}}', $cardsHTML, $html);