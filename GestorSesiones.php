<?php
class GestorSesiones implements SessionHandlerInterface {
    private ?mysqli $link;

    /*
     Tú escribes en tu código...,PHP llama internamente a...,¿Para qué?
session_start();,1. open()  2. read($id),"Abre la conexión y busca si hay datos guardados para ese ID. Lo que devuelve read, PHP lo mete en $_SESSION."
(El script termina)  o exit;,"3. write($id, $data)  4. close()","PHP toma todo lo que hay en $_SESSION, lo convierte a texto y usa tu función write para guardarlo en la BD antes de cerrar."
session_destroy();,5. destroy($id),"Tú pides destruir la sesión, PHP ejecuta tu código SQL DELETE FROM...."
(Aleatoriamente),6. gc($maxlifetime),"A veces (según la configuración session.gc_probability), al iniciar sesión, PHP llama al ""Garbage Collector"" para borrar sesiones viejas de la BD."
     */

    // RECIBIMOS LA CONEXIÓN EN EL CONSTRUCTOR
    public function __construct($conexionExistente) {
        $this->link = $conexionExistente;
    }

    public function open($path, $name): bool {
        // Ya tenemos la conexión, no hacemos nada aquí
        if ($this->link) {
            return true;
        }
        return false;
    }

    public function close(): bool {
        // No cerramos la conexión aquí porque MetodosDML podría necesitarla después
        return true;
    }

    public function read($id): false|string {
        // Usamos la conexión heredada
        $stmt = $this->link->prepare("SELECT data FROM sesion WHERE id_sesion = ?");
        $stmt->bind_param("s", $id);
        if ($stmt->execute()) {
            $result = $stmt->get_result();
            if ($result->num_rows === 1) {
                $record = $result->fetch_assoc();
                return $record['data'];
            }
        }
        return '';
    }

    public function write($id, $data): bool {
        $access = time();
        $id_usuario = NULL; // Por defecto es anónimo

        // Generamos la fecha visual para Madrid
        $fecha_madrid = date('Y-m-d H:i:s');

        // MEJORA: Esta Regex captura el ID tanto si es int (i:5) como string (s:1:"5")
        // Explicación:
        // 1. "id_usuario";  -> Busca la clave
        // 2. (?: ... )      -> Grupo no captura (para el OR)
        // 3. i:(\d+)        -> Opción A: es entero (i:número)
        // 4. |              -> Ó
        // 5. s:\d+:"(\d+)"  -> Opción B: es string (s:largo:"número")
        if (preg_match('/"id_usuario";(?:i:(\d+)|s:\d+:"(\d+)")/', $data, $matches)) {
            // Si encontró la Opción A (entero), está en $matches[1]
            // Si encontró la Opción B (string), está en $matches[2]
            // array_filter limpia los vacíos y reset toma el primero que encuentre.
            $array = array_filter(array_slice($matches, 1));
            $id_usuario = reset($array);
        }

        // 2. GUARDAMOS TODO (DATA + TU COLUMNA EXTRA)
        // Usamos el id_usuario detectado (o NULL si no hay)
        $stmt = $this->link->prepare("
        REPLACE INTO sesion (id_sesion, access, data, id_usuario, fecha_acceso) 
        VALUES (?, ?, ?, ?, ?)
    ");
        $stmt->bind_param("sisis", $id, $access, $data, $id_usuario, $fecha_madrid);

        return $stmt->execute();
    }

    public function destroy($id): bool {
        $stmt = $this->link->prepare("DELETE FROM sesion WHERE id_sesion = ?");
        $stmt->bind_param("s", $id);
        return $stmt->execute();
    }

    // Garbage collector
    public function gc($max_lifetime): false|int {
        $old = time() - $max_lifetime;
        $stmt = $this->link->prepare("DELETE FROM sesion WHERE access < ?");
        $stmt->bind_param("i", $old);
        return $stmt->execute();
    }
}