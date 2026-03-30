# Cabezazo Clash

Proyecto para la asignatura de Laboratori de Software: pequeño juego de fútbol 1v1 hecho con HTML, CSS y JavaScript (sin frameworks).

La idea del proyecto era tener una base simple pero clara: menús, partida local, marcador, pausa y opciones de volumen.

## Estado actual

Ahora mismo funciona:

- Partida local 1 vs 1.
- Partida 1 vs bot (IA básica).
- Marcador + temporizador.
- Pausa con cuenta atrás para reanudar.
- Menú de opciones con volumen de música y SFX guardado en localStorage.
- Pantallas de inicio, ayuda, info y final de partido.

Cosas que todavía están a medio hacer:

- 1 vs 1 online (visible en el menú pero sin lógica).
- Algunos textos y comentarios del código todavía se tienen que limpiar/unificar.

## Controls

Jugador 1:

- A / D: mover
- W: saltar
- Espacio: chutar

Jugador 2:

- Flecha izquierda / derecha: mover
- Flecha arriba: saltar
- P: chutar

General:

- Botón de pausa o tecla R: pausar/reanudar (con cuenta atrás)

## Estructura del proyecto

```text
CabezazoClash/
├── index.html
├── login.html
├── styles.css
├── main.js
├── README.md
├── assets/
│   ├── audio/
│   └── img/
└── js/
    ├── constants.js
    ├── entities.js
    ├── game.js
    ├── input.js
    ├── physics.js
    └── renderer.js
```

Resumen rápido de responsabilidades:

- main.js: UI, pantallas, botones, opciones y audio de menú.
- js/game.js: bucle principal, tiempo, goles y flujo de partida.
- js/entities.js: jugadores, bot y utilidades de movimiento.
- js/physics.js: colisiones y respuesta física.
- js/renderer.js: dibujo en el canvas.
- js/input.js: teclado y entradas.

## Audio

La música de fondo usa estos archivos dentro de assets/audio:

- SoundTrackHS.mp3
- SoundTrackHS.ogg (opcional, compatibilidad)

Si no están, el juego arranca igual pero sin música.

## Notas del proyecto

Este repositorio es una práctica, así que la prioridad ha sido que el juego sea jugable y fácil de tocar.

No está pensado como producto final, sino como base para iterar: mejorar IA, añadir online y pulir arte/sonido.

## Licencia

Proyecto académico. Uso libre para aprender, probar y modificar. No se permite uso comercial ni distribución sin permiso.