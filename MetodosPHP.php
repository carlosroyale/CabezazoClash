<?php
// MetodosPHP.php

class MetodosPHP {

    /**
     * Envía un correo con el código OTP usando la API nativa de Brevo.
     * * @param string $correoDestino El email del usuario.
     * @param string $codigo El código de 6 dígitos autogenerado.
     * @return bool Devuelve true si se envió correctamente, false si hubo un error.
     */
    public function enviarCorreoOTP($correoDestino, $codigo): bool {
        $url = 'https://api.brevo.com/v3/smtp/email';

        // Es altamente recomendable poner la API Key en las variables de tu servidor (DigitalOcean/Railway)
        // Si no la encuentra, usará el valor por defecto que pongas después del ?:
        $apiKey = getenv('BREVO_API_KEY') ?: 'TU_API_KEY_AQUI';

        // Correo del remitente (¡DEBE estar verificado en tu panel de Brevo!)
        $emailRemitente = getenv('MAIL_FROM') ?: 'noreply@tudominio.com';

        // Preparamos los datos tal como los pide Brevo
        $data = [
            'sender' => [
                'name' => 'Cabezazo Clash',
                'email' => $emailRemitente
            ],
            'to' => [
                ['email' => $correoDestino]
            ],
            'subject' => 'Tu código de acceso: ' . $codigo,
            'htmlContent' => '
                <div style="font-family: sans-serif; text-align: center; padding: 30px; background-color: #f4f4f4; border-radius: 10px;">
                    <img src="https://tuservidor.com/assets/img/logo129.png" alt="Logo" style="width: 100px; border-radius: 10px; margin-bottom: 20px;">
                    <h2 style="color: #5c2d91;">¡Listo para jugar a Cabezazo Clash!</h2>
                    <p style="color: #333; font-size: 16px;">Tu código de acceso de un solo uso es:</p>
                    <div style="background-color: #fff; padding: 15px; margin: 20px auto; width: fit-content; border-radius: 8px; border: 2px dashed #5c2d91;">
                        <h1 style="color: #2b5797; font-size: 45px; letter-spacing: 8px; margin: 0;">' . $codigo . '</h1>
                    </div>
                    <p style="color: #888; font-size: 13px;">Este código caduca en 5 minutos. Si no has solicitado este acceso, puedes ignorar este correo.</p>
                </div>'
        ];

        // Iniciamos cURL
        $ch = curl_init($url);

        // Configuramos las opciones de la petición HTTP POST
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'accept: application/json',
            'api-key: ' . $apiKey,
            'content-type: application/json'
        ]);

        // Ejecutamos y capturamos la respuesta
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);

        curl_close($ch);

        // Evaluamos si hubo errores de conexión del servidor
        if ($err) {
            error_log("Error cURL conectando a Brevo: " . $err);
            return false;
        }

        // Evaluamos si Brevo aceptó la petición (Códigos 200 a 299 son éxito)
        if ($httpCode >= 200 && $httpCode < 300) {
            return true;
        } else {
            // Si el código no es 200, registramos el error para poder depurarlo en los logs
            error_log("Error en API Brevo (HTTP $httpCode): " . $response);
            return false;
        }
    }

    /**
     * Genera un código numérico aleatorio de la longitud deseada (por defecto 6)
     */
    public function generarCodigoOTP($longitud = 6): string {
        $min = pow(10, $longitud - 1);
        $max = pow(10, $longitud) - 1;
        // random_int es más seguro criptográficamente que rand()
        return (string) random_int($min, $max);
    }
}