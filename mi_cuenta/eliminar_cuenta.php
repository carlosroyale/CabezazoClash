<?php
require_once 'config_sesion.php';

// 1. SEGURIDAD: Verificar que el usuario está logueado
if (!isset($_SESSION['usuario'])) {
    header("Location: login.html");
    exit;
}

$idUsuario = $_SESSION['usuario']['id_usuario'];
global $metodosDML;

// 2. Intentar eliminar la cuenta de la Base de Datos
if ($metodosDML->eliminarCuentaTotal($idUsuario)) {

    // --- SI SE BORRÓ CORRECTAMENTE ---

    // A. Borrar cookie del navegador con soporte dinámico (Localhost / Railway)
    if (isset($_COOKIE['remember_token'])) {
        $es_local = (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false || strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false);
        setcookie('remember_token', '', time() - 3600, '/', $es_local ? '' : 'cabezazoclash-production.up.railway.app', !$es_local, true);
    }

    // B. Destruir la sesión
    session_unset();
    session_destroy();

    // C. Redirigir a la pantalla de login
    header("Location: login.html");
    exit;

} else {
    // --- SI FALLÓ EL BORRADO ---
    header("Location: mi_cuenta.php?error=no_se_pudo_eliminar");
    exit;
}