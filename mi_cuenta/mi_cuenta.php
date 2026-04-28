<?php
require_once '../config_sesion.php';
require_once '../MetodosPHP.php';

// 1. Seguridad
if (!isset($_SESSION['usuario'])) {
    header("Location: ../index.php");
    exit;
}

$metodosDML = new MetodosDML();
$idUsuario = $_SESSION['usuario']['id_usuario'];

// 2. Obtener datos actuales de la BD
$datos = $metodosDML->obtenerDatosUsuario($idUsuario);
if (!$datos) {
    die("Error al cargar datos del usuario.");
}

$partidas = $metodosDML->obtenerPartidasUsuario($idUsuario);
$historialPartidasHtml = '';

if (empty($partidas)) {
    $historialPartidasHtml = '
        <div class="match-history-empty">
            <i class="bi bi-clock-history"></i>
            <strong>Aún no hay partidas</strong>
            <span>Cuando juegues online, tus resultados aparecerán aquí.</span>
        </div>';
}
else {
    foreach ($partidas as $partida) {
        // 1. Identificar en qué lado jugó el usuario actual
        $esIzquierda = (intval($partida['id_usuario_izquierda']) === intval($idUsuario));

        // 2. Extraer datos crudos de ambos lados
        $nombreIzq = htmlspecialchars($partida['username_izquierda'] ?? '---', ENT_QUOTES, 'UTF-8');
        $nombreDer = htmlspecialchars($partida['username_derecha'] ?? '---', ENT_QUOTES, 'UTF-8');

        $golesIzq = intval($partida['golesIzquierda']);
        $golesDer = intval($partida['golesDerecha']);

        $puntosIzq = intval($partida['puntosIzquierda']);
        $puntosDer = intval($partida['puntosDerecha']);

        // 3. Lógica de perspectiva (¿He ganado yo?)
        // Si soy izquierda, comparo mis goles (Izq) con los del rival (Der)
        $misGoles = $esIzquierda ? $golesIzq : $golesDer;
        $susGoles = $esIzquierda ? $golesDer : $golesIzq;
        $miDelta  = $esIzquierda ? intval($partida['puntosDeltaIzquierda']) : intval($partida['puntosDeltaDerecha']);

        $resultadoTexto = 'Empate';
        $resultadoClase = 'empate';
        $resultadoIcono = 'bi-dash-circle-fill';

        if ($misGoles > $susGoles) {
            $resultadoTexto = 'Victoria';
            $resultadoClase = 'victoria';
            $resultadoIcono = 'bi-trophy-fill';
        } elseif ($misGoles < $susGoles) {
            $resultadoTexto = 'Derrota';
            $resultadoClase = 'derrota';
            $resultadoIcono = 'bi-x-circle-fill';
        }

        // 4. Formato de puntos ganados/perdidos
        $deltaClase = 'neutral';
        if ($miDelta > 0) $deltaClase = 'positivo';
        elseif ($miDelta < 0) $deltaClase = 'negativo';

        $deltaTexto = ($miDelta > 0 ? '+' : '') . $miDelta;

        // 5. Manejo de fecha
        $fechaTexto = 'Sin fecha';
        $horaTexto = '--:--';
        if (!empty($partida['fecha'])) {
            try {
                $fecha = new DateTime($partida['fecha']);
                $fechaTexto = $fecha->format('d/m/Y');
                $horaTexto = $fecha->format('H:i');
            } catch (Exception $e) {
                $fechaTexto = htmlspecialchars($partida['fecha'], ENT_QUOTES, 'UTF-8');
            }
        }

        // Opcional: Añadir una clase CSS o estilo para resaltar cuál de los dos nombres eres tú
        $claseYoIzq = $esIzquierda ? "style='color: var(--secondary-color); font-weight: 900;'" : "";
        $claseYoDer = !$esIzquierda ? "style='color: var(--secondary-color); font-weight: 900;'" : "";

        // 6. GENERACIÓN DEL HTML
        $historialPartidasHtml .= "
        <article class='match-history-card $resultadoClase'>
            
            <div class='match-row-result'>
                <div class='match-result-badge'>
                    <i class='bi $resultadoIcono'></i>
                    <span>$resultadoTexto</span>
                </div>
            </div>

            <div class='match-row-players'>
                <div class='player-info left'>
                    <span class='player-name' $claseYoIzq>@$nombreIzq</span>
                    <span class='player-points'>$puntosIzq pts</span>
                </div>

                <div class='match-score'>
                    <span>$golesIzq</span>
                    <small>-</small>
                    <span>$golesDer</span>
                </div>

                <div class='player-info right'>
                    <span class='player-name' $claseYoDer>@$nombreDer</span>
                    <span class='player-points'>$puntosDer pts</span>
                </div>
            </div>

            <div class='match-row-footer'>
                <span class='match-date'>$fechaTexto · $horaTexto</span>
                <span class='points-delta $deltaClase'>$deltaTexto pts</span>
            </div>

        </article>";
    }
}

$tabInicial = $_GET['tab'] ?? 'tab-perfil';
$html = file_get_contents('mi_cuenta.html');

$html = str_replace('{{TAB_INICIAL}}', $tabInicial, $html);
$html = str_replace('{{HISTORIAL_PARTIDAS}}', $historialPartidasHtml, $html);

// Reemplazo automático de columnas de la BD (Nombre, Apellidos, etc.)
foreach ($datos as $columna => $valor) {
    $placeholder = '{{' . strtoupper($columna) . '}}';
    $html = str_replace($placeholder, htmlspecialchars($valor ?? ''), $html);
}

// Limpiar etiquetas sobrantes si las hay
$html = preg_replace('/{{.*?}}/', '', $html);

echo $html;
