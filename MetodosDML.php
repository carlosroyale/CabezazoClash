<?php

use Random\RandomException;

require_once __DIR__ . '/Conexion.php';

class MetodosDML {
    private ?mysqli $conexion;

    public function __construct() {
        $database = new Database();
        $this->conexion = $database->getConnection();
    }

    public function getConexion(): ?mysqli {
        return $this->conexion;
    }

    // Obtenemos todos los datos del usuario logueado
    public function obtenerDatosUsuario($idUsuario): false|array|null {
        $sql = "SELECT * FROM usuario WHERE id_usuario = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("i", $idUsuario);
            $stmt->execute();
            $resultado = $stmt->get_result();
            return $resultado->fetch_assoc();
        }
        return null;
    }

    // verificamos token (Al entrar a la web sin sesión)
    public function verificarTokenRecuerdo($token): ?int {
        $ahora = date('Y-m-d H:i:s');

        // Buscamos si existe ese token y si NO ha caducado
        $sql = "SELECT id_usuario FROM recuerdo WHERE token = ? AND expiracion > ?";

        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("ss", $token, $ahora);
            $stmt->execute();
            $res = $stmt->get_result();

            if ($fila = $res->fetch_assoc()) {
                $stmt->close();
                return $fila['id_usuario']; // Devolvemos el ID del usuario dueño del token
            }
            $stmt->close();
        }
        return null;
    }

    public function guardarCodigoOTP($idUsuario, $codigo): bool {
        // 1. Limpiamos códigos anteriores de este usuario
        $this->borrarCodigosOTP($idUsuario);

        // 2. Expiración (5 minutos)
        $expiracion = date('Y-m-d H:i:s', strtotime('+5 minutes'));

        $sql = "INSERT INTO otp_login (codigo, expiracion, id_usuario) VALUES (?, ?, ?)";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("ssi", $codigo, $expiracion, $idUsuario);
            $exito = $stmt->execute();
            $stmt->close();
            return $exito;
        }
        return false;
    }

    public function verificarCodigoOTP($idUsuario, $codigo): bool {
        $ahora = date('Y-m-d H:i:s');
        $sql = "SELECT id_otp FROM otp_login WHERE id_usuario = ? AND codigo = ? AND expiracion > ?";

        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("iss", $idUsuario, $codigo, $ahora);
            $stmt->execute();
            $stmt->store_result();
            $esValido = $stmt->num_rows > 0;
            $stmt->close();
            return $esValido;
        }
        return false;
    }

    public function borrarCodigosOTP($idUsuario): void {
        $sql = "DELETE FROM otp_login WHERE id_usuario = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("i", $idUsuario);
            $stmt->execute();
            $stmt->close();
        }
    }

    public function obtenerUsuarioPorCorreo($correo): false|array|null {
        $sql = "SELECT * FROM usuario WHERE correo_electronico = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("s", $correo);
            $stmt->execute();
            $resultado = $stmt->get_result();
            $usuario = $resultado->fetch_assoc();
            $stmt->close();
            return $usuario;
        }
        return null;
    }

    public function verificarUsernameExiste($username): bool {
        $sql = "SELECT id_usuario FROM usuario WHERE username = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("s", $username);
            $stmt->execute();
            $stmt->store_result();
            $existe = $stmt->num_rows > 0;
            $stmt->close();
            return $existe;
        }
        return true; // Por seguridad, si falla la consulta asumimos que existe
    }

    public function registrarNuevoUsuarioCompleto($username, $nombre, $apellido1, $apellido2, $correo): int|false {
        $idTipoUsuario = 1; // 1 = Usuario normal
        $sql = "INSERT INTO usuario (username, nombre, primer_apellido, segundo_apellido, correo_electronico, id_tipo_usuario)
                VALUES (?, ?, ?, ?, ?, ?)";

        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("sssssi", $username, $nombre, $apellido1, $apellido2, $correo, $idTipoUsuario);
            if ($stmt->execute()) {
                $nuevoId = $stmt->insert_id;
                $stmt->close();
                return $nuevoId;
            }
            $stmt->close();
        }
        return false;
    }

    public function guardarTokenRecuerdo($idUsuario, $token): bool {
        // Calculamos la fecha de caducidad: 30 días a partir de hoy
        $expiracion = date('Y-m-d H:i:s', strtotime('+30 days'));

        $sql = "INSERT INTO recuerdo (token, expiracion, id_usuario) VALUES (?, ?, ?)";

        if ($stmt = $this->conexion->prepare($sql)) {
            // "ssi" significa: String (token), String (expiracion), Integer (id_usuario)
            $stmt->bind_param("ssi", $token, $expiracion, $idUsuario);
            $exito = $stmt->execute();
            $stmt->close();
            return $exito;
        }
        return false;
    }

    // Comprueba si un username está libre, ignorando al propio usuario que lo está pidiendo
    public function comprobarUsuarioDisponible($username, $idUsuarioActual): bool {
        $sql = "SELECT id_usuario FROM usuario WHERE username = ? AND id_usuario != ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("si", $username, $idUsuarioActual);
            $stmt->execute();
            $stmt->store_result();
            $estaOcupado = $stmt->num_rows > 0;
            $stmt->close();
            return !$estaOcupado; // Devuelve true si está libre
        }
        return false;
    }

    // Actualiza solo el nombre de usuario
    public function actualizarUsername($idUsuario, $username): bool {
        $sql = "UPDATE usuario SET username = ? WHERE id_usuario = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("si", $username, $idUsuario);
            $exito = $stmt->execute();
            $stmt->close();
            return $exito;
        }
        return false;
    }

    // Actualiza solo el correo electrónico
    public function actualizarCorreo($idUsuario, $correo): bool {
        $sql = "UPDATE usuario SET correo_electronico = ? WHERE id_usuario = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("si", $correo, $idUsuario);
            $exito = $stmt->execute();
            $stmt->close();
            return $exito;
        }
        return false;
    }

    // Actualiza solo los datos de text
    public function actualizarPerfilUsuario($idUsuario, $nombre, $apellido1, $apellido2): bool {
        $sql = "UPDATE usuario SET nombre = ?, primer_apellido = ?, segundo_apellido = ? WHERE id_usuario = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("sssi", $nombre, $apellido1, $apellido2, $idUsuario);
            $exito = $stmt->execute();
            $stmt->close();
            return $exito;
        }
        return false;
    }

    // Borra la cuenta. Gracias a "ON DELETE CASCADE", borrará las sesiones, los OTP y los recuerdos.
    public function eliminarCuentaTotal($idUsuario): bool {
        $sql = "DELETE FROM usuario WHERE id_usuario = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("i", $idUsuario);
            $exito = $stmt->execute();
            $stmt->close();
            return $exito;
        }
        return false;
    }

    // Comprueba si un valor ya existe en una columna específica de la tabla de usuarios.
    public function comprobarSiExiste($columna, $valor): bool {
        // Lista blanca de columnas permitidas por seguridad para evitar Inyección SQL
        $columnasPermitidas = ['username', 'correo_electronico'];

        if (!in_array($columna, $columnasPermitidas)) {
            return false; // Si intentan buscar en otra columna, lo denegamos
        }

        // Preparamos la consulta
        $sql = "SELECT id_usuario FROM usuario WHERE $columna = ?";

        if ($stmt = $this->conexion->prepare($sql)) {
            // Pasamos el valor de forma segura
            $stmt->bind_param("s", $valor);
            $stmt->execute();
            $stmt->store_result();

            // Si hay más de 0 filas, significa que ya existe alguien con ese dato
            $existe = $stmt->num_rows > 0;
            $stmt->close();

            return $existe;
        }

        // En caso de error, decimos que existe para bloquear el registro por precaución
        return true;
    }

    // Borra un token de recuerdo específico (Cierre de sesión normal)
    public function borrarTokenRecuerdo($token): void {
        $sql = "DELETE FROM recuerdo WHERE token = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("s", $token);
            $stmt->execute();
            $stmt->close();
        }
    }

    // Borra TODOS los tokens de recuerdo de un usuario (Cerrar sesión en todos los dispositivos)
    public function borrarTodosTokensRecuerdo($idUsuario): void {
        $sql = "DELETE FROM recuerdo WHERE id_usuario = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("i", $idUsuario);
            $stmt->execute();
            $stmt->close();
        }
    }

    // Borra TODAS las sesiones activas de un usuario en la tabla `sesion`
    public function borrarTodasSesionesUsuario($idUsuario): void {
        $sql = "DELETE FROM sesion WHERE id_usuario = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("i", $idUsuario);
            $stmt->execute();
            $stmt->close();
        }
    }

    // Actualiza la fecha y hora de la última conexión del usuario
    public function actualizarUltimaConexion($idUsuario): void {
        $ahora = date('Y-m-d H:i:s');
        $sql = "UPDATE usuario SET ultima_conexion = ? WHERE id_usuario = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("si", $ahora, $idUsuario);
            $stmt->execute();
            $stmt->close();
        }
    }

    // Obtiene la lista de jugadores ordenada por puntos para el Ranking Global
    public function obtenerRankingGlobal(): array {
        $sql = "SELECT username, puntos_globales FROM usuario WHERE puntos_globales > 0 ORDER BY puntos_globales DESC";
        $ranking = [];

        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->execute();
            $resultado = $stmt->get_result();

            while ($fila = $resultado->fetch_assoc()) {
                $ranking[] = $fila;
            }
            $stmt->close();
        }
        return $ranking;
    }
}