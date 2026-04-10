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

// Configuración Dinámica para Cookies (¡Magia para Railway y Localhost!)
$es_seguro = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');

session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'domain'   => '', // Vacío permite que el navegador use el dominio actual automáticamente
    'secure'   => $es_seguro, // true en Railway, false en localhost
    'httponly' => true,
    'samesite' => 'Lax'
]);

session_start();

// -------------------------------------------------------------------------
// 3. SISTEMA DE AUTOLOGIN
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
                $_SESSION['tipo_usuario'] = $datosUsuario['id_tipo_usuario'] ?? null;

                // Registramos que ha entrado gracias a la cookie
                $metodosDML->actualizarUltimaConexion($idUsuario);
            }
        }
        else {
            // El token es falso o expiró: borramos la cookie corrupta
            setcookie('remember_token', '', time() - 3600, '/', '', $es_seguro, true);
        }
    }
}