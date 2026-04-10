<?php
require_once '../config_sesion.php';

header('Content-Type: application/json');

// 1. Seguridad
if (!isset($_SESSION['usuario'])) {
    echo json_encode(['exito' => false, 'error' => 'No autorizado']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $metodosDML = new MetodosDML();
    $idUsuario = $_SESSION['usuario']['id_usuario'];
    $tipo = $_POST['tipo'] ?? '';

    switch ($tipo) {

        // --- GUARDAR NUEVO NOMBRE DE USUARIO ---
        case 'username':
            $username = trim($_POST['username'] ?? '');

            if (strlen($username) < 3) {
                echo json_encode(['exito' => false, 'error' => 'El usuario debe tener mínimo 3 caracteres.']); exit;
            }
            if (!$metodosDML->comprobarUsuarioDisponible($username, $idUsuario)) {
                echo json_encode(['exito' => false, 'error' => 'Ese usuario ya está en uso.']); exit;
            }

            if ($metodosDML->actualizarUsername($idUsuario, $username)) {
                $_SESSION['usuario']['username'] = $username;
                echo json_encode(['exito' => true]);
            } else {
                echo json_encode(['exito' => false, 'error' => 'Error al actualizar en la base de datos.']);
            }
            break;

        // --- GUARDAR NOMBRE Y APELLIDOS ---
        case 'nombre':
            $nombre = trim($_POST['nombre'] ?? '');
            $ap1 = trim($_POST['primer_apellido'] ?? '');
            $ap2 = trim($_POST['segundo_apellido'] ?? '');

            if (empty($nombre) || empty($ap1)) {
                echo json_encode(['exito' => false, 'error' => 'Nombre y primer apellido son obligatorios.']); exit;
            }

            // Recuperamos el username actual para poder usar la función que ya tenías
            $datos = $metodosDML->obtenerDatosUsuario($idUsuario);

            if ($metodosDML->actualizarPerfilUsuario($idUsuario, $nombre, $ap1, $ap2)) {
                $_SESSION['usuario']['nombre'] = $nombre;
                $_SESSION['usuario']['primer_apellido'] = $ap1;
                $_SESSION['usuario']['segundo_apellido'] = $ap2;
                echo json_encode(['exito' => true]);
            } else {
                echo json_encode(['exito' => false, 'error' => 'Error al guardar los nombres.']);
            }
            break;

        // --- GUARDAR NUEVO CORREO (CON CÓDIGO) ---
        case 'correo':
            $codigoIntroducido = trim($_POST['codigo_verificacion'] ?? '');
            $nuevoCorreo = trim($_POST['correo_confirmado'] ?? '');

            // Validar que el código coincida con el de la sesión
            if (!isset($_SESSION['codigo_cambio_correo']) || $codigoIntroducido != $_SESSION['codigo_cambio_correo']) {
                echo json_encode(['exito' => false, 'error' => 'El código de verificación es incorrecto.']);
                exit;
            }

            if ($metodosDML->actualizarCorreo($idUsuario, $nuevoCorreo)) {
                // Borramos las sesiones temporales de seguridad
                unset($_SESSION['codigo_cambio_correo']);
                unset($_SESSION['correo_pendiente']);

                $_SESSION['usuario']['correo_electronico'] = $nuevoCorreo;
                echo json_encode(['exito' => true]);
            } else {
                echo json_encode(['exito' => false, 'error' => 'Ese correo ya está en uso.']);
            }
            break;

        default:
            echo json_encode(['exito' => false, 'error' => 'Acción desconocida']);
            exit;
    }
}