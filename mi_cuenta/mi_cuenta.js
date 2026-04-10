document.addEventListener('DOMContentLoaded', () => {
    // =========================================
    // 1. MENÚ LATERAL DE CUENTA (Móvil)
    // =========================================
    const accountToggle = document.getElementById('account-menu-toggle');
    const sidebar = document.getElementById('dashboard-sidebar');
    const closeSidebar = document.getElementById('close-sidebar');

    if (accountToggle && sidebar) {
        accountToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
        });
        if (closeSidebar) {
            closeSidebar.addEventListener('click', () => {
                sidebar.classList.remove('active');
            });
        }
    }

    // =========================================
    // 2. INICIALIZACIÓN DE PESTAÑAS
    // =========================================
    const inputTab = document.getElementById('inputTabInicial');
    const tabId = inputTab ? inputTab.value : 'tab-perfil';
    const btnTab = document.querySelector(`.tab-link[onclick*="'${tabId}'"]`);

    if (btnTab) {
        btnTab.click();
    } else {
        const tabDefault = document.getElementById(tabId);
        if(tabDefault) {
            tabDefault.style.display = "block";
            tabDefault.classList.add('active');
        }
    }
});

// =========================================
// 3. FUNCIONES GLOBALES (Pestañas y Borrado)
// =========================================
function openTab(evt, tabName) {
    // Ocultar todas las pestañas
    const tabcontent = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
        tabcontent[i].classList.remove('active');
    }

    // Quitar la clase active de todos los botones
    const tablinks = document.getElementsByClassName("tab-link");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }

    // Mostrar la pestaña actual
    const currentTab = document.getElementById(tabName);
    if (currentTab) {
        currentTab.style.display = "block";
        setTimeout(() => currentTab.classList.add('active'), 10);
    }

    if (evt) evt.currentTarget.classList.add("active");

    // Actualizar URL sin recargar
    const url = new URL(window.location);
    url.searchParams.set('tab', tabName);
    window.history.replaceState({}, '', url);

    // Cerrar sidebar en móvil al seleccionar
    const sidebar = document.getElementById('dashboard-sidebar');
    if (window.innerWidth <= 900 && sidebar) {
        sidebar.classList.remove('active');
    }
}

function confirmarBorrado() {
    if(confirm("¿Estás seguro de que quieres eliminar tu cuenta? Esta acción borrará todo tu progreso y no se puede deshacer.")) {
        window.location.href = "eliminar_cuenta.php";
    }
}

// =========================================
// 4. GESTIÓN DE MODALES DE DATOS PERSONALES
// =========================================
function abrirModalDato(idModal) {
    const modal = document.getElementById(idModal);
    if (modal) modal.classList.add('active');
}

function cerrarModalDato(idModal) {
    const modal = document.getElementById(idModal);
    if (!modal) return;

    modal.classList.remove('active');

    // Resetear formulario si existe
    const form = modal.querySelector('form');
    if (form) {
        form.reset();

        // 1. Extraemos la palabra clave (ej: de "modal-username" sacamos "username")
        const tipo = idModal.replace('modal-', '');

        // 2. Buscamos todos los <small> y los recorremos uno a uno
        const statusElements = form.querySelectorAll('small');
        statusElements.forEach(status => {
            // Solo ponemos el texto de aviso si es username o correo
            if (tipo === 'username' || tipo === 'correo') {
                status.innerHTML = `Ya dispones de este ${tipo}.`;
                status.style.color = '#f39c12'; // Naranja / Aviso
            } else {
                status.innerHTML = ''; // Limpiamos por defecto para los demás
            }
        });

        // 3. BONUS DE SEGURIDAD: Volver a bloquear el botón de guardar
        const btnGuardar = form.querySelector('.btn-guardar');
        if (btnGuardar && (tipo === 'username' || tipo === 'correo')) {
            btnGuardar.disabled = true;
        }
    }
}

// Cerrar al hacer clic fuera del modal (en el fondo oscuro)
window.onclick = function(event) {
    if (event.target.classList.contains('modal-dato-overlay')) {
        cerrarModalDato(event.target.id);
    }
}

// =========================================
// 5. ENVÍO DE FORMULARIOS POR AJAX
// =========================================
function guardarDato(e, tipo) {
    e.preventDefault();

    const form = e.target;
    const btnGuardar = form.querySelector('button[type="submit"]');
    const originalText = btnGuardar.innerHTML;

    // Buscamos o creamos el elemento para mostrar estados
    let statusElement = form.querySelector('small[id$="-status"]');
    if (!statusElement) {
        statusElement = document.createElement('small');
        statusElement.style.display = 'block';
        statusElement.style.marginBottom = '15px';
        statusElement.style.color = '#ff4444';
        form.insertBefore(statusElement, btnGuardar);
    }

    const formData = new FormData(form);
    formData.append('tipo', tipo);

    btnGuardar.disabled = true;
    btnGuardar.innerHTML = 'Guardando...';

    fetch('guardar_dato_ajax.php', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.exito) {
                btnGuardar.style.background = "#28a745";
                btnGuardar.innerHTML = '¡Guardado!';
                statusElement.innerHTML = "";

                // Recargamos la página para mostrar los nuevos datos
                setTimeout(() => {
                    location.reload();
                }, 1000);
            } else {
                statusElement.innerHTML = data.error || 'Ocurrió un error.';
                btnGuardar.disabled = false;
                btnGuardar.innerHTML = originalText;
            }
        })
        .catch(error => {
            statusElement.innerHTML = 'Error de conexión con el servidor.';
            btnGuardar.disabled = false;
            btnGuardar.innerHTML = originalText;
        });
}

// =========================================
// 6. VALIDACIÓN EN TIEMPO REAL (AJAX)
// =========================================

// Función auxiliar para no saturar el servidor al teclear rápido
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

// Configurar validador para un input específico
function setupValidation(inputId, statusId, btnId, tipo) {
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);
    status.innerHTML = `Ya dispones de este ${tipo}.`;
    status.style.color = '#f39c12'; // Naranja / Aviso
    const btn = document.getElementById(btnId);

    if (!input) return;

    input.addEventListener('input', debounce(function() {
        const value = input.value.trim();
        const current = input.getAttribute('data-current');

        // Reiniciamos estado visual
        status.innerHTML = `Ya dispones de este ${tipo}.`;
        status.style.color = '#f39c12'; // Naranja / Aviso
        btn.disabled = true;

        if (value === '') return;

        // Comprobación local: ¿Ha escrito exactamente lo que ya tiene?
        if (value.toLowerCase() === current.toLowerCase()) {
            status.innerHTML = `Ya dispones de este ${tipo}.`;
            status.style.color = '#f39c12'; // Naranja / Aviso
            return;
        }

        // Validación básica de formato si es correo
        if (tipo === 'correo') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                status.innerHTML = 'El formato del correo no es válido.';
                status.style.color = '#df1818'; // Rojo
                return;
            }
        }

        // Todo parece correcto, consultamos a la base de datos
        status.innerHTML = 'Comprobando disponibilidad...';
        status.style.color = '#888';

        fetch(`check_disponibilidad.php?tipo=${tipo}&valor=${encodeURIComponent(value)}`)
            .then(res => res.json())
            .then(data => {
                if (data.disponible) {
                    status.innerHTML = `Este ${tipo} está disponible.`;
                    status.style.color = '#28a745'; // Verde
                    btn.disabled = false; // Permitimos continuar
                } else {
                    status.innerHTML = `Este ${tipo} ya está en uso.`;
                    status.style.color = '#df1818';
                }
            })
            .catch(() => {
                status.innerHTML = 'Error de conexión al comprobar.';
                status.style.color = '#df1818';
            });
    }, 500)); // Espera 500ms después de la última tecla pulsada
}

// Inicializar los listeners al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    setupValidation('input-new-username', 'username-status', 'btn-save-username', 'username');
    setupValidation('input-new-correo', 'correo-status', 'btn-send-code', 'correo');
});

// =========================================
// 7. FLUJO DE CAMBIO DE CORREO (2 PASOS)
// =========================================

function enviarCodigoCorreo(e) {
    e.preventDefault();

    const btn = document.getElementById('btn-send-code');
    const nuevoCorreo = document.getElementById('input-new-correo').value;
    const status = document.getElementById('correo-status');

    btn.disabled = true;
    btn.innerHTML = 'Enviando...';

    let formData = new FormData();
    formData.append('nuevo_correo', nuevoCorreo);

    fetch('enviar_codigo_correo.php', {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(data => {
            if (data.exito) {
                // Ocultar formulario 1 y mostrar el formulario 2 (el del código)
                document.getElementById('form-correo-step1').style.display = 'none';
                document.getElementById('form-correo-step2').style.display = 'block';
                // Pasamos el correo al formulario oculto para que `guardar_dato_ajax.php` sepa a quién asignarlo
                document.getElementById('hidden-nuevo-correo').value = nuevoCorreo;
            } else {
                status.innerHTML = data.error || 'Ocurrió un error al enviar el código.';
                status.style.color = '#df1818';
            }
        })
        .catch(() => {
            status.innerHTML = 'Error de conexión con el servidor.';
            status.style.color = '#df1818';
        })
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = 'Enviar código de verificación';
        });
}

function volverPaso1Correo() {
    document.getElementById('form-correo-step1').style.display = 'block';
    document.getElementById('form-correo-step2').style.display = 'none';
    document.getElementById('form-correo-step2').reset();
}

// Para limpiar el proceso si cierran el modal de golpe
const funcionCierreOriginal = window.cerrarModalDato;
window.cerrarModalDato = function(idModal) {
    funcionCierreOriginal(idModal);
    if (idModal === 'modal-correo') {
        volverPaso1Correo();
    }
};

// =========================================
// FORZAR RECÁLCULO AL GIRAR EL MÓVIL
// =========================================
window.addEventListener('orientationchange', () => {
    // Le damos al navegador 150 milisegundos para estabilizarse y subimos la cámara
    setTimeout(() => {
        window.scrollTo(0, 0);
    }, 150);
});