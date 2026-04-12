<?php
class Database {
    public function getConnection() {
        // Valores locales por defecto (XAMPP) y override por variables de entorno.
        $host = getenv('RAILWAY_TCP_PROXY_DOMAIN') ?: '127.0.0.1';
        $user = getenv('MYSQLUSER') ?: 'root';
        $pass = getenv('MYSQL_ROOT_PASSWORD') ?: '';
        $db   = getenv('MYSQL_DATABASE') ?: 'cabezazo_clash';
        $port = getenv('RAILWAY_TCP_PROXY_PORT') ?: 3306;
        echo getenv('RAILWAY_TCP_PROXY_DOMAIN') . $user . $pass . $db . $port;

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