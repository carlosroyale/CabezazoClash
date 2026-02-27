# ⚽ Cabezazo Clash

**Juego de fútbol arcade 1v1 en navegador**, desarrollado en HTML5, CSS3 y JavaScript vanilla.

> **Estado:** Base funcional (Nivel BÁSICO jugable) | Arquitectura lista para expandir

---

## 🎮 Características

✅ **Menú interactivo** con navegación fluida entre pantallas  
✅ **Nivel BÁSICO** jugable con física arcade  
✅ **2 jugadores locales** con controles independientes  
✅ **Sistema de goles** con reinicio automático  
✅ **Música de fondo** con control ON/OFF y volumen  
✅ **Menú Opciones** con ajustes guardados en localStorage  
✅ **Código modular** separado UI/lógica de juego  
✅ **Responsive** adaptado a diferentes tamaños de pantalla  

---

## 📁 Estructura del proyecto

```
CabezazoClash/
├── index.html              # HTML principal (pantallas, canvas, audio)
├── styles.css              # Estilos de UI (menús, HUD, canvas)
├── main.js                 # Lógica de interfaz (pantallas, opciones)
├── game.js                 # Motor del juego (física, colisiones)
├── README.md               # Este archivo
└── assets/
    ├── img/
        ├── stadium-background1.avif  # Alternativa de fondo (no usada)
    │   └── stadium-background2.jpeg  # Fondo del estadio
    └── audio/
        ├── SoundTrackHS.mp3          # Música de menú (MP3)
        └── SoundTrackHS.ogg          # Música de menú (OGG, opcional)
```

---

## 🎯 Cómo jugar

### Pantalla de inicio
- **Jugar** → Avanza a selección de nivel
- **Opciones** → Abre panel de configuración

### Selección de nivel
- **BÁSICO** → Inicia juego simple (implementado)
- **AVANZADO** → En desarrollo

### Gameplay (BÁSICO)

#### Controles

**Jugador 1 (izquierda, blanco)**
- `A` / `D` → Mover izquierda/derecha
- `W` → Saltar
- Colisionar con la pelota → Impulso automático

**Jugador 2 (derecha, amarillo)**
- `←` / `→` → Mover izquierda/derecha
- `↑` → Saltar
- Colisionar con la pelota → Impulso automático

**Durante el juego**
- `ESC` → Volver al menú
- `R` → Reiniciar ronda

#### Objetivo
- Golpear la pelota hacia la portería del rival
- Marcar goles: la pelota entra en la zona de gol (fondo izquierda/derecha)
- El marcador se actualiza automáticamente

#### Mecánicas
- **Gravedad** y **rebotes** realistas
- **Colisión jugador-pelota** con impulso arcade
- **Fricción en suelo** para evitar movimiento infinito
- **Reinicio automático** tras cada gol

---

## ⚙️ Configuración

### Música

Para activar música de menú, coloca los archivos en `assets/audio/`:

```
assets/audio/
├── SoundTrackHS.mp3   (obligatorio)
└── SoundTrackHS.ogg   (opcional, mejor soporte)
```

El reproductor respeta los ajustes de "Música" (ON/OFF) y volumen desde Opciones.

### Fondo del estadio

Actualmente carga desde `assets/img/stadium-background2.jpeg`. Si quieres cambiar:

1. Abre `styles.css`
2. Busca `background: url("assets/img/stadium-background2.jpeg")`
3. Reemplaza con tu ruta preferida

Para mejor resultado, usa imágenes:
- Dimensiones: 16:9 (ej. 1920×1080)
- Formato: JPEG, PNG o AVIF
- Búsqueda recomendada: "cartoon football stadium background"

---

## 🏗️ Arquitectura (Código)

### Separación UI vs Lógica

El código se divide en **dos responsabilidades claras**:

#### `main.js` (Interfaz de Usuario)
- Maneja todas las **pantallas** (inicio, nivel, opciones, juego)
- Controla el **audio del menú** (música, volumen, fade in/out)
- Obtiene referencias del **DOM** (canvas, scoreEl) una sola vez
- Llama a `window.Game.startBasicGame({...})` al iniciar juego
- Gestiona **navegación** entre pantallas  
- Guarda/carga **preferencias** (localStorage)

#### `game.js` (Motor del juego)
- Define el **motor del nivel básico** (física, colisiones, goles)
- **NO busca elementos del DOM**; recibe referencias como parámetros
- Expone un único **namespace global** `window.Game.startBasicGame`
- Controla **ciclo de vida**: detiene juego anterior si existe
- Limpia **event listeners** al salir (ESC)
- Independiente de UI: completamente reutilizable

### Beneficios de esta arquitectura

| Aspecto | Beneficio |
|---------|-----------|
| **Bajo acoplamiento** | game.js no sabe de HTML/CSS |
| **Reutilizable** | Mismo motor en otra UI sin cambios |
| **Testeable** | Sin effectos secundarios en el DOM |
| **Escalable** | Fácil agregar AVANZADO, Online, etc. |
| **Mantenible** | Cambios en UI no afectan lógica |

---

## 🔧 Instalación

### Requisitos
- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Servidor web local (para evitar CORS)

### Pasos

1. **Clona o descarga** este repositorio
2. **Coloca la música** en `assets/audio/SoundTrackHS.mp3`
3. **Servidor local** (elige uno):
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js
   npx http-server
   
   # O usa VS Code Live Server
   ```
4. **Abre** `http://localhost:8000` en tu navegador

---

## 📋 Próximas mejoras

### 🎮 Nivel AVANZADO
- Velocidad aumentada
- Rebotes más impredecibles
- Power-ups/habilidades especiales

### 🌐 Multijugador Online
- WebSockets para sincronización
- Salas de espera
- Ranking global

### 🎨 Gráficos mejorados
- Sprites en lugar de rectángulos
- Animaciones (salto, celebración, gol)
- Efectos de partículas

### 🔊 Audio mejorado
- Sonidos de gol, rebote, saque
- Música dinámica (menú vs juego)
- Control de SFX independiente

### 📱 Responsividad
- Controles táctiles para móviles
- Ajuste dinámico del canvas

---

## 💡 Tips para contribuidores

1. **Motor de juego**: Modifica `game.js` para cambiar física/colisiones. No toca el DOM.
2. **UI/Opciones**: Modifica `main.js` y `styles.css` para cambiar menús.
3. **Nuevo nivel**: Copia `game.js` → `game-advanced.js`, ajusta constantes y expón en `window.Game.startAdvancedGame`.
4. **Testing**: El motor es testeable sin dependencias de navegador (mínimos cambios).

---

## 📝 Licencia

Proyecto de práctica educativa. Libre para uso y modificación.

---

**Fecha de creación**: 27 de febrero de 2026  
**Versión**: 0.1.0 (Beta)  
**Estado**: En desarrollo activo

