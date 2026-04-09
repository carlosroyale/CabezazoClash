<?php
// config_sesion.php

// 1. ZONA HORARIA
date_default_timezone_set('Europe/Madrid');

require_once 'MetodosDML.php';
require_once 'GestorSesiones.php';

// 2. INICIAR CONEXIÓN Y GESTOR
$metodosDML = new MetodosDML();
$conexion = $metodosDML->getConexion();

$handler = new GestorSesiones($conexion);
session_set_save_handler($handler, true);

// Configuración básica
ini_set('session.gc_maxlifetime', 60 * 60 * 24 * 7); // 7 días en BD
// Detectar si estamos en localhost
$es_local = (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false || strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false);
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'domain'   => $es_local ? '' : 'paginaroyale.com', // Si es local, lo deja vacío (automático)
    'secure'   => !$es_local, // En local no suele haber HTTPS (false), en producción sí (true)
    'httponly' => true,
    'samesite' => 'Lax'
]);

session_start();

// -------------------------------------------------------------------------
// 3. SISTEMA DE AUTOLOGIN (La solución a tus problemas con Render)
// -------------------------------------------------------------------------

// Si el usuario NO está logueado en la sesión...
if (!isset($_SESSION['usuario'])) {

    // ...pero tiene la cookie de "recuérdame"
    if (isset($_COOKIE['remember_token'])) {

        $token = $_COOKIE['remember_token'];

        // Preguntamos a la base de datos si este token es válido
        $idUsuario = $metodosDML->verificarTokenRecuerdo($token);

        if ($idUsuario) {
            // ¡TOKEN VÁLIDO! Recuperamos los datos del usuario y lo logueamos
            $datosUsuario = $metodosDML->obtenerDatosUsuario($idUsuario);

            if ($datosUsuario) {
                // Regeneramos la sesión como si hubiera puesto la contraseña
                $_SESSION['usuario'] = $datosUsuario;
                $_SESSION['id_usuario'] = $datosUsuario['id_usuario'];
                $_SESSION['tipo_usuario'] = $datosUsuario['id_tipo_usuario']; // Asegúrate que esta columna existe o ajusta el nombre

                // Opcional: Renovar el token para que dure otros 30 días más
                // (Podrías implementar esto para mayor seguridad, pero así ya funciona)
            }
        }
        else {
            // El token es falso o expiró: borramos la cookie corrupta
            setcookie('remember_token', '', time() - 3600, '/', 'paginaroyale.com', true, true);
        }
    }
}