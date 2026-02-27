# CabezazoClash

## Fondos y recursos

Para usar la opción de imagen de estadio más realista, coloca un archivo con nombre `stadium-background.avif` en la carpeta `img/`. El CSS de `styles.css` ya está configurado para cargar la imagen desde `img/stadium-background.avif`.

Puedes buscar imágenes tipo "cartoon football stadium background" o "2D football stadium game background" y renombrarlas según corresponda.

### Música de fondo

Si quieres música de menú, añade un fichero `menu.mp3` (y opcionalmente `menu.ogg`) bajo `assets/audio/` y el HTML incluirá un `<audio id="bg-music">` que el script controla. El audio se reproduce tras la primera interacción del usuario y respeta el toggle "Música" y el volumen de las opciones.

### Estructura de código

El Javascript está dividido en dos responsabilidades claras:

**main.js** (Interfaz)
- Maneja todas las pantallas (inicio, opciones, nivel, juego).
- Controla el audio de menú y opciones.
- Obtiene referencias del DOM (canvas, scoreEl) en el nivel superior.
- Llama a `window.Game.startBasicGame({canvas, ctx, scoreEl, onExit})`.

**game.js** (Lógica del juego)
- Define el motor del nivel básico (física, colisiones, goles).
- NO busca elementos del DOM; recibe referencias como parámetros.
- Expone un único namespace global `window.Game = { startBasicGame }`.
- Controla el ciclo de vida: detiene el juego anterior si está activo.
- Limpia listeners al salir (ESC).

**Ventajas de esta separación**
1. Bajo acoplamiento: game.js es agnóstico de HTML/CSS.
2. Reutilizable: el motor se puede insertar en otra UI sin cambios.
3. Testeable: no hay efectos secundarios en el DOM desde game.js.
4. Escalable: fácil agregar AVANZADO con otro motor sin contaminar global.

 
