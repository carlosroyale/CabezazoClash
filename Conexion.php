<?php
class Database {
    public function getConnection() {
        // 1. Primero, intentamos cargar los secretos locales (si existen)
        $this->loadLocalEnv();

        // 2. Ahora buscamos las variables.
        // Si estamos en local, las cogerá del .env.
        // Si estamos en Railway, el .env no existirá y las cogerá de Railway.
        $host = getenv('RAILWAY_TCP_PROXY_DOMAIN') ?: '127.0.0.1';
        $user = getenv('MYSQLUSER') ?: 'root';
        $pass = getenv('MYSQL_ROOT_PASSWORD') ?: '';
        $db   = getenv('MYSQL_DATABASE') ?: 'cabezazo_clash';
        $port = getenv('RAILWAY_TCP_PROXY_PORT') ?: 3306;

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

    // Función para leer el archivo .env en local
    private function loadLocalEnv(): void {
        // Buscamos el archivo .env en el mismo directorio
        $envPath = __DIR__ . '/.env';

        if (file_exists($envPath)) {
            $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                // Separar la clave y el valor
                list($name, $value) = explode('=', $line, 2);
                $name = trim($name);
                $value = trim($value);

                // Inyectarlo en la memoria de PHP si no existe ya
                if (!isset($_SERVER[$name]) && !isset($_ENV[$name])) {
                    putenv(sprintf('%s=%s', $name, $value));
                    $_ENV[$name] = $value;
                    $_SERVER[$name] = $value;
                }
            }
        }
    }
}