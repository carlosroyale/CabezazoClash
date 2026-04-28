<?php
require_once 'config_sesion.php';

header('Content-Type: application/json');

// 1. Instanciar clase de acceso a datos
$metodos = new MetodosDML();

if (!isset($_SESSION['usuario'])) {
    http_response_code(401);
    echo json_encode(['exito' => false, 'error' => 'No autorizado']);
    exit;
}

$idUsuario = $_SESSION['usuario']['id_usuario'];


$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';

switch ($accion) {
    case 'obtener_puntos':
        $puntos = $metodos->obtenerPuntosUsuario($idUsuario);

        echo json_encode([
            'exito' => true,
            'puntos' => $puntos,
        ]);
        exit;

    case 'registrar_victoria_bot':
        $progreso = $metodos->registrarVictoriaBotYActualizarTipo($idUsuario);
        $_SESSION['tipo_usuario'] = $progreso['id_tipo_usuario'];
        if (isset($_SESSION['usuario'])) {
            $_SESSION['usuario']['id_tipo_usuario'] = $progreso['id_tipo_usuario'];
            $_SESSION['usuario']['victorias_bot'] = $progreso['victorias_bot'];
        }

        echo json_encode([
            'exito' => true,
            'progreso' => $progreso,
        ]);
        exit;

    case 'progreso_online':
        $progreso = $metodos->obtenerProgresoDesbloqueoOnline($idUsuario);
        $_SESSION['tipo_usuario'] = $progreso['id_tipo_usuario'];
        if (isset($_SESSION['usuario'])) {
            $_SESSION['usuario']['id_tipo_usuario'] = $progreso['id_tipo_usuario'];
            $_SESSION['usuario']['victorias_bot'] = $progreso['victorias_bot'];
        }

        echo json_encode([
            'exito' => true,
            'progreso' => $progreso,
        ]);
        exit;

    default:
        http_response_code(400);
        echo json_encode(['exito' => false, 'error' => 'Accion no valida']);
        exit;
}
