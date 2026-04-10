<?php
// login.php

require_once '../config_sesion.php';
require_once '../MetodosPHP.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['accion'])) {
    echo json_encode(['success' => false, 'message' => 'Petición no válida']);
    exit;
}

$accion = $_POST['accion'];
$metodosPHP = new MetodosPHP();
global $metodosDML;

try {
    // ==========================================
    // PASO 1: COMPROBAR CORREO
    // ==========================================
    if ($accion === 'comprobar_correo') {
        $correo = filter_var($_POST['correo'], FILTER_SANITIZE_EMAIL);

        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'message' => 'Correo no válido']);
            exit;
        }

        $usuario = $metodosDML->obtenerUsuarioPorCorreo($correo);

        if ($usuario) {
            // EL USUARIO EXISTE: Generamos y enviamos el código
            $codigo = $metodosPHP->generarCodigoOTP();
            $guardado = $metodosDML->guardarCodigoOTP($usuario['id_usuario'], $codigo);

            if ($guardado && $metodosPHP->enviarCorreoOTP($correo, $codigo)) {
                echo json_encode(['success' => true, 'existe' => true]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Error al enviar el código.']);
            }
        } else {
            // EL USUARIO NO EXISTE: Le indicamos al frontend que muestre el formulario de registro
            echo json_encode(['success' => true, 'existe' => false]);
        }
        exit;
    }

    // ==========================================
    // PASO 1.5: COMPROBAR USERNAME EN TIEMPO REAL
    // ==========================================
    if ($accion === 'comprobar_username') {
        $username = trim($_POST['username']);

        // Si nos envían algo vacío, decimos que no existe
        if (empty($username)) {
            echo json_encode(['success' => true, 'existe' => false]);
            exit;
        }

        $existe = $metodosDML->verificarUsernameExiste($username);

        echo json_encode(['success' => true, 'existe' => $existe]);
        exit;
    }

    // ==========================================
    // PASO 1b: REGISTRAR NUEVO USUARIO Y ENVIAR CÓDIGO
    // ==========================================
    if ($accion === 'registrar_y_enviar') {
        $correo = filter_var($_POST['correo'], FILTER_SANITIZE_EMAIL);
        $username = trim($_POST['username']);
        $nombre = trim($_POST['nombre']);
        $apellido1 = trim($_POST['apellido1']);
        $apellido2 = trim($_POST['apellido2']); // Este puede estar vacío

        // 1. Validar que el username no esté cogido
        if ($metodosDML->verificarUsernameExiste($username)) {
            echo json_encode(['success' => false, 'message' => 'El nombre de usuario ya está en uso. Elige otro.']);
            exit;
        }

        // 2. Crear el usuario en la base de datos primero
        $idNuevoUsuario = $metodosDML->registrarNuevoUsuarioCompleto($username, $nombre, $apellido1, $apellido2, $correo);

        if ($idNuevoUsuario) {
            // 3. Ahora que existe, generamos y enviamos su código OTP
            $codigo = $metodosPHP->generarCodigoOTP();
            $guardado = $metodosDML->guardarCodigoOTP($idNuevoUsuario, $codigo);

            if ($guardado && $metodosPHP->enviarCorreoOTP($correo, $codigo)) {
                echo json_encode(['success' => true]);
            } else {
                echo json_encode(['success' => false, 'message' => 'Cuenta creada pero falló el envío del correo.']);
            }
        }
        else {
            echo json_encode(['success' => false, 'message' => 'Error al guardar los datos en la base de datos.']);
        }
        exit;
    }

    // ==========================================
    // PASO 2: VERIFICAR CÓDIGO E INICIAR SESIÓN
    // ==========================================
    if ($accion === 'verificar_codigo') {
        $correo = filter_var($_POST['correo'], FILTER_SANITIZE_EMAIL);
        $codigo = trim($_POST['codigo']);

        // Recuperamos el ID del usuario
        $usuario = $metodosDML->obtenerUsuarioPorCorreo($correo);

        if (!$usuario) {
            echo json_encode(['success' => false, 'message' => 'Error crítico: Usuario no encontrado.']);
            exit;
        }

        // Validamos el código usando su ID
        $esValido = $metodosDML->verificarCodigoOTP($usuario['id_usuario'], $codigo);

        if ($esValido) {
            // Crear la sesión
            $_SESSION['usuario'] = $usuario;
            $_SESSION['id_usuario'] = $usuario['id_usuario'];
            $_SESSION['tipo_usuario'] = $usuario['id_tipo_usuario'];

            // Registramos la hora de conexión en la base de datos
            $metodosDML->actualizarUltimaConexion($usuario['id_usuario']);

            // Generar token de recuerdo
            $tokenRecuerdo = bin2hex(random_bytes(32));
            $metodosDML->guardarTokenRecuerdo($usuario['id_usuario'], $tokenRecuerdo);

            $es_local = (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false || strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false);
            setcookie('remember_token', $tokenRecuerdo, time() + (86400 * 30), '/', $es_local ? '' : 'cabezazoclash-production.up.railway.app', !$es_local, true);

            // Borrar los códigos para que no se reusen
            $metodosDML->borrarCodigosOTP($usuario['id_usuario']);

            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Código incorrecto o caducado.']);
        }
        exit;
    }

}
catch (Exception $e) {
    error_log("Error en login.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Ocurrió un error inesperado en el servidor.']);
}