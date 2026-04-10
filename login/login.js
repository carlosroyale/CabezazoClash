const formCorreo = document.getElementById('form-correo');
const formRegistro = document.getElementById('form-registro');
const formCodigo = document.getElementById('form-codigo');

const pasoCorreo = document.getElementById('paso-correo');
const pasoRegistro = document.getElementById('paso-registro');
const pasoCodigo = document.getElementById('paso-codigo');

const inputCorreo = document.getElementById('correo');
const inputCodigo = document.getElementById('codigo-otp');
const correoMostrado = document.getElementById('correo-mostrado');

let correoActual = '';

// FUNCIONES DE AYUDA PARA CAMBIAR PANTALLAS
function mostrarPaso(pasoMostrar) {
    pasoCorreo.classList.add('hidden');
    pasoRegistro.classList.add('hidden');
    pasoCodigo.classList.add('hidden');
    pasoMostrar.classList.remove('hidden');
}

function prepararPasoCodigo(correo) {
    correoActual = correo;
    correoMostrado.innerText = correo;
    mostrarPaso(pasoCodigo);
    inputCodigo.focus();
}

// PASO 1: Comprobar Correo
formCorreo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const correo = inputCorreo.value.trim();
    const btn = document.getElementById('btn-comprobar-correo');
    const errorDiv = document.getElementById('error-correo');

    errorDiv.innerText = '';
    btn.disabled = true;
    btn.innerText = 'Comprobando...';

    try {
        const formData = new FormData();
        formData.append('accion', 'comprobar_correo');
        formData.append('correo', correo);

        const response = await fetch('login.php', { method: 'POST', body: formData });
        const result = await response.json();

        if (result.success) {
            if (result.existe) {
                // Existe -> Va directo a pedir el código
                prepararPasoCodigo(correo);
            } else {
                // No existe -> Va al formulario de registro
                correoActual = correo; // Guardamos el correo en memoria
                mostrarPaso(pasoRegistro);
            }
        } else {
            errorDiv.innerText = result.message || 'Error al procesar el correo.';
        }
    } catch (error) {
        errorDiv.innerText = 'Error de conexión con el servidor.';
    } finally {
        btn.disabled = false;
        btn.innerText = 'Continuar';
    }
});

// ==========================================
// COMPROBACIÓN DE USUARIO EN TIEMPO REAL
// ==========================================
const inputUsername = document.getElementById('reg-username');
const feedbackUsername = document.getElementById('feedback-username');
const btnRegistrar = document.getElementById('btn-registrar');

let timeoutUsername = null;

inputUsername.addEventListener('input', () => {
    // 1. Limpiamos el temporizador anterior si el usuario sigue escribiendo
    clearTimeout(timeoutUsername);

    const username = inputUsername.value.trim();

    // Si el campo está vacío, limpiamos los mensajes y salimos
    if (username.length === 0) {
        feedbackUsername.innerText = '';
        btnRegistrar.disabled = false; // Lo dejamos activo por defecto hasta que escriba
        return;
    }

    // 2. Mostramos un estado de "Cargando..."
    feedbackUsername.style.color = '#666';
    feedbackUsername.innerText = 'Comprobando...';

    // Bloqueamos el botón temporalmente para que no envíe el formulario sin comprobar
    btnRegistrar.disabled = true;

    // 3. Esperamos 500ms (Medio segundo) después de que deje de teclear
    timeoutUsername = setTimeout(async () => {
        try {
            const formData = new FormData();
            formData.append('accion', 'comprobar_username');
            formData.append('username', username);

            const response = await fetch('login.php', { method: 'POST', body: formData });
            const result = await response.json();

            if (result.success) {
                if (result.existe) {
                    // El usuario ya existe
                    feedbackUsername.style.color = '#d32f2f'; // Rojo
                    feedbackUsername.innerText = 'Este usuario ya está en uso.';
                    btnRegistrar.disabled = true; // Mantenemos bloqueado el botón
                } else {
                    // El usuario está libre
                    feedbackUsername.style.color = '#2e7d32'; // Verde
                    feedbackUsername.innerText = 'Usuario disponible.';
                    btnRegistrar.disabled = false; // Desbloqueamos el botón
                }
            }
        } catch (error) {
            // Si falla la red, borramos el mensaje para no confundir
            feedbackUsername.innerText = '';
            btnRegistrar.disabled = false;
        }
    }, 500); // 500 milisegundos de espera
});

// PASO 1b: Procesar Registro de Usuario Nuevo
formRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-registrar');
    const errorDiv = document.getElementById('error-registro');

    errorDiv.innerText = '';
    btn.disabled = true;
    btn.innerText = 'Creando cuenta...';

    try {
        const formData = new FormData();
        formData.append('accion', 'registrar_y_enviar');
        formData.append('correo', correoActual);
        formData.append('username', document.getElementById('reg-username').value);
        formData.append('nombre', document.getElementById('reg-nombre').value);
        formData.append('apellido1', document.getElementById('reg-apellido1').value);
        formData.append('apellido2', document.getElementById('reg-apellido2').value);

        const response = await fetch('login.php', { method: 'POST', body: formData });
        const result = await response.json();

        if (result.success) {
            // Cuenta creada y código enviado -> Vamos a pedir el código
            prepararPasoCodigo(correoActual);
        } else {
            errorDiv.innerText = result.message || 'Error al registrar el usuario.';
        }
    } catch (error) {
        errorDiv.innerText = 'Error de conexión con el servidor.';
    } finally {
        btn.disabled = false;
        btn.innerText = 'Crear Cuenta y Enviar Código';
    }
});

// PASO 2: Verificar Código OTP final
formCodigo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = inputCodigo.value.trim();
    const btn = document.getElementById('btn-entrar');
    const errorDiv = document.getElementById('error-codigo');

    errorDiv.innerText = '';
    btn.disabled = true;
    btn.innerText = 'Verificando...';

    try {
        const formData = new FormData();
        formData.append('accion', 'verificar_codigo');
        formData.append('correo', correoActual);
        formData.append('codigo', codigo);

        const response = await fetch('login.php', { method: 'POST', body: formData });
        const result = await response.json();

        if (result.success) {
            btn.style.backgroundColor = "#2e7d32";
            btn.innerText = '¡Correcto! Entrando...';
            setTimeout(() => {
                window.location.href = '../index.php';
            }, 1000);
        } else {
            errorDiv.innerText = result.message || 'Código incorrecto o caducado.';
            btn.disabled = false;
            btn.innerText = 'Entrar al Juego';
        }
    } catch (error) {
        errorDiv.innerText = 'Error de conexión con el servidor.';
        btn.disabled = false;
        btn.innerText = 'Entrar al Juego';
    }
});

// Botones de "Volver atrás"
document.getElementById('btn-volver-registro').addEventListener('click', () => {
    mostrarPaso(pasoCorreo);
});

document.getElementById('btn-volver-codigo').addEventListener('click', () => {
    mostrarPaso(pasoCorreo);
    inputCodigo.value = '';
    document.getElementById('error-codigo').innerText = '';
});