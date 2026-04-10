<?php

// enviar_codigo_correo.php
require_once '../config_sesion.php';

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

// 1. Generar código de 6 dígitos
$codigo_seguridad = rand(100000, 999999);

// 2. Guardarlo en la sesión para validarlo más tarde
$_SESSION['codigo_cambio_correo'] = $codigo_seguridad;
$_SESSION['correo_pendiente'] = $nuevo_correo; // Por seguridad, guardamos a qué correo iba

// 3. Enviar el correo (Usando la función mail nativa de PHP)
$para = $nuevo_correo;
$titulo = 'Código de verificación - Cabezazo Clash';
$mensaje = "Hola,\r\n\r\n";
$mensaje .= "Has solicitado cambiar tu correo electrónico en Cabezazo Clash.\r\n";
$mensaje .= "Tu código de verificación es: " . $codigo_seguridad . "\r\n\r\n";
$mensaje .= "Si no has sido tú, ignora este mensaje.\r\n";

$cabeceras = 'From: noreply@tudominio.com' . "\r\n" .
    'Reply-To: noreply@tudominio.com' . "\r\n" .
    'X-Mailer: PHP/' . phpversion();

// Intentamos enviar el correo
$enviado = mail($para, $titulo, $mensaje, $cabeceras);

if ($enviado) {
    echo json_encode(['exito' => true]);
} else {
    // Si falla el envío (es común en servidores locales como XAMPP sin configurar)
    echo json_encode(['exito' => false, 'error' => 'No se pudo enviar el correo. Verifica la configuración de tu servidor.']);
}