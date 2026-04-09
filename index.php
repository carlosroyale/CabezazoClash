<?php
// index.php

// 1. Iniciamos la sesión y la conexión
require_once 'config_sesion.php';

// 2. ESCUDO DE SEGURIDAD: Si no hay usuario logueado, lo mandamos al login
if (!isset($_SESSION['id_usuario'])) {
    header("Location: login/login.html");
    exit;
}

// 3. CREAMOS LA LLAVE SECRETA
// Definimos una constante para indicar que el usuario ha pasado el control de seguridad
const ACCESO_PERMITIDO = true;

// 4. CARGAMOS LA VISTA DEL JUEGO
// Como pasó el control, insertamos aquí el archivo con el HTML
require_once 'juego/juego.php';