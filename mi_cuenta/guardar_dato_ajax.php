<?php
require_once '../config_sesion.php';
require_once '../MetodosPHP.php';

header('Content-Type: application/json');

if (!isset($_SESSION['usuario'])) {
    echo json_encode(['exito' => false, 'error' => 'No autorizado']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $metodosDML = new MetodosDML();
    $idUsuario = $_SESSION['usuario']['id_usuario'];
    $tipo = $_POST['tipo'] ?? '';

    // Obtenemos todos tus datos actuales para rellenar los huecos y no borrar nada por accidente
    $datosActuales = $metodosDML->obtenerDatosUsuario($idUsuario);
    if (!$datosActuales) {
        echo json_encode(['exito' => false, 'error' => 'Usuario no encontrado']);
        exit;
    }

    // Ponemos como base tus datos actuales
    $user  = $datosActuales['username'];
    $nom   = $datosActuales['nombre'];
    $ap1   = $datosActuales['primer_apellido'];
    $ap2   = $datosActuales['segundo_apellido'];
    $mail  = $datosActuales['correo_electronico'];
    $fecha = $datosActuales['fecha_nacimiento'];
    $passFinal = null;

    // Dependiendo del modal que se haya usado, cambiamos una cosa u otra
    switch ($tipo) {
        case 'username':
            $user = strtolower(trim($_POST['nuevo_username']));
            if (strlen($user) < 3 || !preg_match('/^[a-zA-Z0-9._]+$/', $user)) {
                echo json_encode(['exito' => false, 'error' => 'Nombre de usuario inválido']); exit;
            }
            if (!$metodosDML->comprobarUsuarioDisponible($user, $idUsuario)) {
                echo json_encode(['exito' => false, 'error' => 'Ese usuario ya está en uso']); exit;
            }
            break;

        case 'nombre':
            $nom = trim($_POST['nombre']);
            $ap1 = trim($_POST['primer_apellido']);
            $ap2 = trim($_POST['segundo_apellido'] ?? '');
            if(empty($nom) || empty($ap1)){
                echo json_encode(['exito' => false, 'error' => 'Nombre y primer apellido son obligatorios']); exit;
            }
            break;

        case 'fecha':
            // Recogemos las tres partes del selector triple
            $d = $_POST['dia'] ?? '';
            $m = $_POST['mes'] ?? '';
            $a = $_POST['anio'] ?? '';

            if (empty($d) || empty($m) || empty($a)) {
                echo json_encode(['exito' => false, 'error' => 'Fecha incompleta']); exit;
            }

            // Unimos en formato YYYY-MM-DD
            $fecha = "$a-$m-$d";

            if (!edadValida($fecha)) {
                echo json_encode(['exito' => false, 'error' => 'Debes tener al menos 10 años']); exit;
            }
            break;

        case 'password':
            $passActual = $_POST['pass_actual'];
            $passNueva = $_POST['pass_nueva'];
            $passRepite = $_POST['pass_repite'];

            // Comprobaciones de seguridad de la contraseña
            if (!password_verify($passActual, $datosActuales['password'])) {
                echo json_encode(['exito' => false, 'error' => 'La contraseña actual no es correcta']); exit;
            }
            if ($passNueva !== $passRepite) {
                echo json_encode(['exito' => false, 'error' => 'Las nuevas contraseñas no coinciden']); exit;
            }
            if (!passwordRobusta($passNueva)) {
                echo json_encode(['exito' => false, 'error' => 'La contraseña no es lo suficientemente segura']); exit;
            }
            $passFinal = $passNueva;
            break;

        default:
            echo json_encode(['exito' => false, 'error' => 'Acción desconocida']); exit;
    }

    // Llamamos a tu función original para guardar todo en la base de datos
    $resultado = $metodosDML->actualizarUsuario($idUsuario, $user, $nom, $ap1, $ap2, $mail, $fecha, $passFinal);

    if ($resultado) {
        // Actualizamos las variables de sesión por si acaso
        $_SESSION['usuario']['nombre'] = $nom;
        $_SESSION['usuario']['username'] = $user;
        echo json_encode(['exito' => true]);
    } else {
        echo json_encode(['exito' => false, 'error' => 'Error al guardar. Puede que haya datos duplicados.']);
    }
}