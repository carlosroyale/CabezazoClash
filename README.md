# Cabezazo Clash

Proyecto académico de Laboratori de Software: videojuego de fútbol 1vs1 con frontend en HTML/CSS/JavaScript y backend en PHP + MySQL para login, sesiones, cuenta de usuario y ranking.

## Modificaciones y estado actual

El proyecto evolucionó desde una versión estática a una versión con backend completo.

Actualmente incluye:

- Autenticación por correo con código OTP.
- Registro de usuarios y persistencia en base de datos.
- Gestión de sesión en base de datos (handler personalizado).
- Cookie de recuerdo (autologin).
- Juego local 1vs1 y 1vsBot.
- Ranking y módulo de gestión de cuenta.

Pendiente/mejorable:

- Modo online 1vs1 (visible en la interfaz, sin implementación completa).
- Limpieza y unificación de algunos comentarios/mensajes.

## Controles del juego

Jugador 1:

- A / D: mover
- W: saltar
- Espacio: chutar

Jugador 2:

- Flecha izquierda / derecha: mover
- Flecha arriba: saltar
- P: chutar

General:

- R o botón de pausa: pausar/reanudar

## Estructura actual del proyecto

```text
CabezazoClash/
├── composer.json
├── Conexion.php
├── config_sesion.php
├── GestorSesiones.php
├── index.php
├── logout.php
├── manifest.json
├── MetodosDML.php
├── MetodosPHP.php
├── README.md
├── assets/
│   ├── audio/
│   ├── icon/
│   └── img/
├── juego/
│   ├── juego.css
│   ├── juego.php
│   └── js/
│       ├── constants.js
│       ├── entities.js
│       ├── game.js
│       ├── input.js
│       ├── main.js
│       ├── physics.js
│       └── renderer.js
├── login/
│   ├── login.css
│   ├── login.html
│   ├── login.js
│   └── login.php
├── mi_cuenta/
│   ├── check_disponibilidad.php
│   ├── eliminar_cuenta.php
│   ├── enviar_codigo_correo.php
│   ├── guardar_dato_ajax.php
│   ├── mi_cuenta.css
│   ├── mi_cuenta.html
│   ├── mi_cuenta.js
│   └── mi_cuenta.php
├── ranking/
│   ├── ranking.css
│   ├── ranking.html
│   └── ranking.php
└── sql/
     ├── CrowsFoot.drawio
     └── local.sql
```

## Requisitos

- PHP 8.0 o superior.
- Extensiones PHP: mysqli, pdo_mysql y curl.
- MySQL o MariaDB.
- XAMPP (recomendado para entorno local en Windows).

Nota: los requisitos PHP están definidos en composer.json.

## Cómo arrancar el proyecto

### Opción recomendada (XAMPP)

1. Copia o mantiene el proyecto en htdocs:

    C:/xampp/htdocs/uib/LaboratorioPS/CabezazoClash

2. Arranca Apache y MySQL desde el panel de XAMPP.

3. Crea la base de datos local:

    - Abre phpMyAdmin.
    - Importa el script sql/local.sql.

4. Configura la conexión si vas a trabajar en local:

    - Revisa Conexion.php y ajusta host, usuario, contraseña, nombre de BD y puerto para tu entorno local.
    - Alternativamente, define variables de entorno DB_HOST, DB_USER, DB_PASS, DB_NAME.

5. Abre el proyecto en el navegador:

    http://localhost/uib/LaboratorioPS/CabezazoClash/

6. El flujo normal redirige a login/login.html cuando no hay sesión activa.

### Opción alternativa (servidor embebido de PHP)

Desde la raíz del proyecto:

```bash
php -S localhost:8000
```

Y abre:

http://localhost:8000/

Importante: esta opción también necesita MySQL operativo y la conexión correctamente configurada.

## Notas técnicas

- index.php protege el acceso y redirige al login cuando no existe sesión.
- config_sesion.php registra un SessionHandler personalizado (GestorSesiones.php) para guardar sesiones en BD.
- MetodosPHP.php integra envío de OTP por correo mediante API externa.
- sql/local.sql crea las tablas base de usuarios, OTP, sesiones, partidas y ranking.

## Licencia

Proyecto académico con fines educativos.