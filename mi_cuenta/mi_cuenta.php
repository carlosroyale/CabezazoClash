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

$tabInicial = $_GET['tab'] ?? 'tab-perfil';
$html = file_get_contents('mi_cuenta.html');

$html = str_replace('{{TAB_INICIAL}}', $tabInicial, $html);

// Reemplazo automático de columnas de la BD (Nombre, Apellidos, etc.)
foreach ($datos as $columna => $valor) {
    $placeholder = '{{' . strtoupper($columna) . '}}';
    $html = str_replace($placeholder, htmlspecialchars($valor ?? ''), $html);
}

// Limpiar etiquetas sobrantes si las hay
$html = preg_replace('/{{.*?}}/', '', $html);

echo $html;