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

    default:
        http_response_code(400);
        echo json_encode(['exito' => false, 'error' => 'Accion no valida']);
        exit;
}