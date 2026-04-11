<?php
class Database {
    public function getConnection() {
        // Valores locales por defecto (XAMPP) y override por variables de entorno.
        $host = getenv('DB_HOST') ?: '127.0.0.1';
        $user = getenv('DB_USER') ?: 'root';
        $pass = getenv('DB_PASS');
        $db   = getenv('DB_NAME') ?: 'cabezazo_clash';
        $port = (int)(getenv('DB_PORT') ?: 3306);

        // En la mayoría de instalaciones XAMPP la contraseña de root está vacía.
        if ($pass === false) {
            $pass = '';
        }

        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

        try {
            // Conexión simplificada y directa
            $conn = new mysqli($host, $user, $pass, $db, $port);

            $conn->set_charset("utf8mb4");
            // Sincronizamos la zona horaria
            $conn->query("SET time_zone = '" . date('P') . "'");

            return $conn;

        }
        catch (mysqli_sql_exception $e) {
            error_log("Error crítico de BD: " . $e->getMessage());
            die('
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px; color: #333;">
                    <h2 style="color: #d9534f;">Servicio no disponible temporalmente</h2>
                    <p>Lo sentimos, estamos teniendo problemas para conectar con nuestros servidores.</p>
                    <p>Por favor, <strong>inténtalo de nuevo en unos minutos</strong>.</p>
                </div>
            ');
        }
    }
}