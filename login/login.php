<?php
// login.php

// Requerimos tu configuración de sesión y dependencias
require_once 'config_sesion.php';
require_once 'MetodosPHP.php';

// Indicamos que vamos a devolver JSON para que JavaScript lo entienda
header('Content-Type: application/json');

// Comprobar si es una petición POST válida
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['accion'])) {
    echo json_encode(['success' => false, 'message' => 'Petición no válida']);
    exit;
}

$accion = $_POST['accion'];
$metodosPHP = new MetodosPHP();
global $metodosDML; // Viene de config_sesion.php

try {
    // ==========================================
    // ACCIÓN 1: ENVIAR CÓDIGO AL CORREO
    // ==========================================
    if ($accion === 'enviar_codigo') {
        $correo = filter_var($_POST['correo'], FILTER_SANITIZE_EMAIL);

        if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => false, 'message' => 'Correo no válido']);
            exit;
        }

        // 1. Generar código de 6 dígitos
        $codigo = $metodosPHP->generarCodigoOTP();

        // 2. Guardar en la base de datos (Requiere que crees este método en MetodosDML.php)
        $guardado = $metodosDML->guardarCodigoOTP($correo, $codigo);

        if (!$guardado) {
            echo json_encode(['success' => false, 'message' => 'Error al preparar el código.']);
            exit;
        }

        // 3. Enviar por Brevo
        $enviado = $metodosPHP->enviarCorreoOTP($correo, $codigo);

        if ($enviado) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Error al enviar el correo. Intenta de nuevo.']);
        }
        exit;
    }

    // ==========================================
    // ACCIÓN 2: VERIFICAR CÓDIGO E INICIAR SESIÓN
    // ==========================================
    if ($accion === 'verificar_codigo') {
        $correo = filter_var($_POST['correo'], FILTER_SANITIZE_EMAIL);
        $codigo = trim($_POST['codigo']);

        // 1. Validar el código contra la base de datos (Requiere método en MetodosDML)
        $esValido = $metodosDML->verificarCodigoOTP($correo, $codigo);

        if ($esValido) {
            // 2. Comprobar si el usuario ya existe, si no, registrarlo
            $usuario = $metodosDML->obtenerUsuarioPorCorreo($correo);

            if (!$usuario) {
                // Es un usuario nuevo, lo registramos
                // Puedes extraer la parte antes del @ para darle un username temporal
                $partes = explode('@', $correo);
                $usernameTemporal = $partes[0] . rand(100, 999);

                $idNuevoUsuario = $metodosDML->registrarNuevoUsuarioPasswordless($correo, $usernameTemporal);
                $usuario = $metodosDML->obtenerDatosUsuario($idNuevoUsuario);
            }

            // 3. Crear la sesión
            $_SESSION['usuario'] = $usuario;
            $_SESSION['id_usuario'] = $usuario['id_usuario'];
            $_SESSION['tipo_usuario'] = $usuario['id_tipo_usuario'];

            // 4. (Opcional) Generar token de recuerdo para que no tenga que loguearse en 30 días
            $tokenRecuerdo = bin2hex(random_bytes(32));
            $metodosDML->guardarTokenRecuerdo($usuario['id_usuario'], $tokenRecuerdo);

            $es_local = (strpos($_SERVER['HTTP_HOST'], 'localhost') !== false || strpos($_SERVER['HTTP_HOST'], '127.0.0.1') !== false);
            setcookie('remember_token', $tokenRecuerdo, time() + (86400 * 30), '/', $es_local ? '' : 'paginaroyale.com', !$es_local, true);

            // 5. Borrar el código OTP usado para que no se pueda reusar
            $metodosDML->borrarCodigosOTP($correo);

            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Código incorrecto o caducado.']);
        }
        exit;
    }

} catch (Exception $e) {
    error_log("Error en login.php: " . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Ocurrió un error inesperado.']);
}