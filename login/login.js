const formCorreo = document.getElementById('form-correo');
const formCodigo = document.getElementById('form-codigo');
const pasoCorreo = document.getElementById('paso-correo');
const pasoCodigo = document.getElementById('paso-codigo');
const inputCorreo = document.getElementById('correo');
const inputCodigo = document.getElementById('codigo-otp');
const correoMostrado = document.getElementById('correo-mostrado');

let correoActual = '';

// PASO 1: Enviar correo
formCorreo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const correo = inputCorreo.value.trim();
    const btn = document.getElementById('btn-enviar-codigo');
    const errorDiv = document.getElementById('error-correo');

    errorDiv.innerText = '';
    btn.disabled = true;
    btn.innerText = 'Enviando...';

    try {
        const formData = new FormData();
        formData.append('accion', 'enviar_codigo');
        formData.append('correo', correo);

        const response = await fetch('login.php', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            // Cambiar a la vista de código
            correoActual = correo;
            correoMostrado.innerText = correo;
            pasoCorreo.classList.add('hidden');
            pasoCodigo.classList.remove('hidden');
            inputCodigo.focus();
        } else {
            errorDiv.innerText = result.message || 'Error al enviar el código.';
        }
    } catch (error) {
        errorDiv.innerText = 'Error de conexión con el servidor.';
    } finally {
        btn.disabled = false;
        btn.innerText = 'Enviar Código de Acceso';
    }
});

// PASO 2: Verificar código
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

        const response = await fetch('login.php', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            // ¡ÉXITO! Redirigir al juego
            btn.style.backgroundColor = "#2e7d32";
            btn.innerText = '¡Correcto! Entrando...';
            setTimeout(() => {
                window.location.href = 'index.html'; // Redirige a tu juego
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

// Botón para volver atrás y cambiar de correo
document.getElementById('btn-volver').addEventListener('click', () => {
    pasoCodigo.classList.add('hidden');
    pasoCorreo.classList.remove('hidden');
    inputCodigo.value = '';
    document.getElementById('error-codigo').innerText = '';
});