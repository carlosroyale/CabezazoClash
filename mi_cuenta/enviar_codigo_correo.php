<?php
// enviar_codigo_correo.php
require_once '../config_sesion.php';
require_once '../MetodosPHP.php';

header('Content-Type: application/json');

if (!isset($_SESSION['usuario'])) {
    echo json_encode(['exito' => false, 'error' => 'No autorizado']);
    exit;
}

$nuevo_correo = trim($_POST['nuevo_correo'] ?? '');

if (!filter_var($nuevo_correo, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['exito' => false, 'error' => 'Formato de correo inválido.']);
    exit;
}

$metodosPHP = new MetodosPHP();

// 1. Generar código de 6 dígitos usando tu metodo seguro (random_int)
$codigo_seguridad = $metodosPHP->generarCodigoOTP();

// 2. Guardarlo en la sesión para validarlo en el paso 2
$_SESSION['codigo_cambio_correo'] = $codigo_seguridad;
$_SESSION['correo_pendiente'] = $nuevo_correo;

// 3. Enviar el correo usando tu integración con Brevo
$enviado = $metodosPHP->enviarCorreoCambio($nuevo_correo, $codigo_seguridad);

if ($enviado) echo json_encode(['exito' => true]);
else echo json_encode(['exito' => false, 'error' => 'No se pudo enviar el correo de verificación. Inténtalo más tarde.']);