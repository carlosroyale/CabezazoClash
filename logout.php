<?php
require_once 'config_sesion.php';

$metodosDML = new MetodosDML();

// Verificamos que el usuario está logueado para poder identificarle
if (isset($_SESSION['usuario']['id_usuario'])) {
    $idUsuario = $_SESSION['usuario']['id_usuario'];

    // ¿Es un cierre global? (?all=1)
    if (isset($_GET['all']) && $_GET['all'] == '1') {
        // 1. Borramos TODOS los tokens de recuerdo de este usuario
        $metodosDML->borrarTodosTokensRecuerdo($idUsuario);

        // 2. Borramos TODAS las sesiones activas de este usuario en la BD
        $metodosDML->borrarTodasSesionesUsuario($idUsuario);
    }
    // Es un cierre normal (solo este dispositivo)
    else {
        if (isset($_COOKIE['remember_token'])) {
            $metodosDML->borrarTokenRecuerdo($_COOKIE['remember_token']);
        }
    }
}

// 3. Borrar cookie del navegador actual (siempre)
if (isset($_COOKIE['remember_token'])) {
    setcookie('remember_token', '', time() - 3600, '/', 'paginaroyale.com', true, true);
}

// 4. Destruir sesión normal actual (siempre)
session_unset();
session_destroy();

header("Location: login/login.php");
exit;