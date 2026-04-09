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

    // ==========================================
    // MÉTODOS PARA EL LOGIN OTP (MAGIC CODE)
    // ==========================================

    public function guardarCodigoOTP($correo, $codigo): bool {
        // 1. Por limpieza, borramos cualquier código anterior que tuviera este correo
        $this->borrarCodigosOTP($correo);

        // 2. Calculamos la expiración (5 minutos desde ahora)
        $expiracion = date('Y-m-d H:i:s', strtotime('+5 minutes'));

        $sql = "INSERT INTO otp_login (correo_electronico, codigo, expiracion) VALUES (?, ?, ?)";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("sss", $correo, $codigo, $expiracion);
            $exito = $stmt->execute();
            $stmt->close();
            return $exito;
        }
        return false;
    }

    public function verificarCodigoOTP($correo, $codigo): bool {
        $ahora = date('Y-m-d H:i:s');
        // Buscamos si existe la combinación de correo + código y que NO haya caducado
        $sql = "SELECT id_otp FROM otp_login WHERE correo_electronico = ? AND codigo = ? AND expiracion > ?";

        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("sss", $correo, $codigo, $ahora);
            $stmt->execute();
            $stmt->store_result();
            // Si hay al menos una fila, el código es válido
            $esValido = $stmt->num_rows > 0;
            $stmt->close();
            return $esValido;
        }
        return false;
    }

    public function borrarCodigosOTP($correo): void {
        $sql = "DELETE FROM otp_login WHERE correo_electronico = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("s", $correo);
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

    public function registrarNuevoUsuarioPasswordless($correo, $usernameTemporal): int|false {
        /*
         * NOTA IMPORTANTE: En tu BD 'local.sql', los campos password, nombre y
         * primer_apellido son NOT NULL. Como en este registro rápido solo pedimos
         * el correo, rellenamos esos campos obligatorios con valores por defecto.
         * Luego en el juego el usuario podrá editar su perfil.
         */

        // Generamos una contraseña basura y segura que nadie (ni el usuario) conocerá
        $passwordBasura = password_hash(bin2hex(random_bytes(10)), PASSWORD_DEFAULT);
        $nombrePorDefecto = 'Jugador';
        $apellidoPorDefecto = 'Clash';
        $idTipoUsuario = 1; // Asumimos que 1 es el ID en la tabla 'tipo_usuario' para un jugador normal

        $sql = "INSERT INTO usuario (username, password, nombre, primer_apellido, correo_electronico, id_tipo_usuario)
                VALUES (?, ?, ?, ?, ?, ?)";

        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("sssssi", $usernameTemporal, $passwordBasura, $nombrePorDefecto, $apellidoPorDefecto, $correo, $idTipoUsuario);
            if ($stmt->execute()) {
                $nuevoId = $stmt->insert_id; // Obtenemos el ID del usuario recién creado
                $stmt->close();
                return $nuevoId;
            }
            $stmt->close();
        }
        return false;
    }

    public function guardarTokenRecuerdo($idUsuario, $token): bool {
        // Expira en 30 días
        $expiracion = date('Y-m-d H:i:s', strtotime('+30 days'));

        $sql = "INSERT INTO recuerdo (token, expiracion, id_usuario) VALUES (?, ?, ?)";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("ssi", $token, $expiracion, $idUsuario);
            $exito = $stmt->execute();
            $stmt->close();
            return $exito;
        }
        return false;
    }

    public function borrarTokenRecuerdo($token): void {
        $sql = "DELETE FROM recuerdo WHERE token = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("s", $token);
            $stmt->execute();
            $stmt->close();
        }
    }

    public function borrarTodosTokensRecuerdo($idUsuario): void {
        $sql = "DELETE FROM recuerdo WHERE id_usuario = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("i", $idUsuario);
            $stmt->execute();
            $stmt->close();
        }
    }

    public function borrarTodasSesionesUsuario($idUsuario): void {
        // Esto cierra la sesión del jugador en TODOS sus dispositivos
        $sql = "DELETE FROM sesion WHERE id_usuario = ?";
        if ($stmt = $this->conexion->prepare($sql)) {
            $stmt->bind_param("i", $idUsuario);
            $stmt->execute();
            $stmt->close();
        }
    }
}