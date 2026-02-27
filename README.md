"# CabezazoClash"

## Fondos y recursos

Para usar la opción de imagen de estadio más realista, coloca un archivo con nombre `stadium-background.avif` en la carpeta `img/`. El CSS de `styles.css` ya está configurado para cargar la imagen desde `img/stadium-background.avif`.

Puedes buscar imágenes tipo "cartoon football stadium background" o "2D football stadium game background" y renombrarlas según corresponda.

### Música de fondo

Si quieres música de menú, añade un fichero `menu.mp3` (y opcionalmente `menu.ogg`) bajo `assets/audio/` y el HTML incluirá un `<audio id="bg-music">` que el script controla. El audio se reproduce tras la primera interacción del usuario y respeta el toggle "Música" y el volumen de las opciones.

### Estructura de código

El Javascript ahora está dividido: `main.js` contiene toda la lógica de interfaz (pantallas, menús, opciones), mientras que `game.js` alberga el motor del nivel básico con el bucle y la física. Esta separación facilita futuras mejoras y permite reutilizar `game.js` en otros modos o versiones del juego.
 
