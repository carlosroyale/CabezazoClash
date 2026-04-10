<?php

// check_disponibilidad.php
require_once '../config_sesion.php';
require_once '../MetodosPHP.php';

header('Content-Type: application/json');

// Seguridad básica
if (!isset($_SESSION['usuario'])) {
    echo json_encode(['disponible' => false, 'error' => 'No autorizado']);
    exit;
}

$tipo = $_GET['tipo'] ?? '';
$valor = trim($_GET['valor'] ?? '');

if (empty($tipo) || empty($valor)) {
    echo json_encode(['disponible' => false]);
    exit;
}

$metodosDML = new MetodosDML();
$disponible = false;

// Comprobamos según el tipo de dato
if ($tipo === 'username') {
    $existe = $metodosDML->comprobarSiExiste('username', $valor);
    $disponible = !$existe;
}
elseif ($tipo === 'correo') {
    $existe = $metodosDML->comprobarSiExiste('correo_electronico', $valor);
    $disponible = !$existe;
}

echo json_encode(['disponible' => $disponible]);