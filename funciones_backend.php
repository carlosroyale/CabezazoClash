<?php
require_once 'config_sesion.php';

header('Content-Type: application/json');

if (!isset($_SESSION['usuario'])) {
    http_response_code(401);
    echo json_encode(['exito' => false, 'error' => 'No autorizado']);
    exit;
}

$accion = $_GET['accion'] ?? $_POST['accion'] ?? '';

switch ($accion) {
    case 'obtener_puntos_absolutos_usuarios':
        $leftUserId = intval($_GET['left_user_id'] ?? $_POST['left_user_id'] ?? 0);
        $rightUserId = intval($_GET['right_user_id'] ?? $_POST['right_user_id'] ?? 0);

        $metodosDML = new MetodosDML();
        $puntos = $metodosDML->obtenerPuntosUsuarios($leftUserId, $rightUserId);

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
