const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadLocalEnv() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;

        const separatorIndex = trimmed.indexOf('=');
        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim();

        if (key && process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

loadLocalEnv();

const pool = mysql.createPool({
    host: process.env.RAILWAY_TCP_PROXY_DOMAIN || '127.0.0.1',
    user: process.env.MYSQLUSER || 'root',
    password: process.env.MYSQL_ROOT_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'cabezazo_clash',
    port: Number.parseInt(process.env.RAILWAY_TCP_PROXY_PORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

async function registrarPartidaOnline({
    golesIzquierda,
    golesDerecha,
    puntosIzquierda,
    puntosDerecha,
    puntosDeltaIzquierda,
    puntosDeltaDerecha,
    idUsuarioIzquierda,
    idUsuarioDerecha
}) {
    const connection = await pool.getConnection();
    const sql = `
        INSERT INTO partida (
            golesIzquierda,
            golesDerecha,
            puntosIzquierda,
            puntosDerecha,
            puntosDeltaIzquierda,
            puntosDeltaDerecha,
            id_usuario_izquierda,
            id_usuario_derecha
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
        await connection.beginTransaction();

        await connection.execute(sql, [
            golesIzquierda,
            golesDerecha,
            puntosIzquierda,
            puntosDerecha,
            puntosDeltaIzquierda,
            puntosDeltaDerecha,
            idUsuarioIzquierda,
            idUsuarioDerecha
        ]);

        await connection.execute(
            'UPDATE usuario SET puntos_globales = puntos_globales + ? WHERE id_usuario = ?',
            [puntosDeltaIzquierda, idUsuarioIzquierda]
        );

        await connection.execute(
            'UPDATE usuario SET puntos_globales = puntos_globales + ? WHERE id_usuario = ?',
            [puntosDeltaDerecha, idUsuarioDerecha]
        );

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    registrarPartidaOnline
};
