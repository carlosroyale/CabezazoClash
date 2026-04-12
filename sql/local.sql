DROP DATABASE IF EXISTS cabezazo_clash;
CREATE DATABASE cabezazo_clash;
USE cabezazo_clash;

SET GLOBAL event_scheduler = ON;

CREATE TABLE tipo_usuario (
    id_tipo_usuario INT NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(16) NOT NULL,
    CONSTRAINT tipo_usuario_pk PRIMARY KEY (id_tipo_usuario)
);

INSERT INTO tipo_usuario (nombre)
VALUES ('jugador'), ('admin');

CREATE TABLE usuario (
    id_usuario INT NOT NULL AUTO_INCREMENT,
    username VARCHAR(32) NOT NULL,
    nombre VARCHAR(32) NOT NULL,
    primer_apellido VARCHAR(32) NOT NULL,
    segundo_apellido VARCHAR(32),
    correo_electronico VARCHAR(128) NOT NULL,
    puntos_globales INT NOT NULL DEFAULT 0,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    ultima_conexion DATETIME NULL,
    id_tipo_usuario INT NOT NULL,
    CONSTRAINT usuario_pk PRIMARY KEY (id_usuario),
    CONSTRAINT usuario_tipo_usuario_fk
       FOREIGN KEY (id_tipo_usuario) REFERENCES tipo_usuario (id_tipo_usuario),
    CONSTRAINT usuario_username_uk UNIQUE (username),
    CONSTRAINT usuario_correo_electronico_uk UNIQUE (correo_electronico)
);

CREATE TABLE otp_login (
    id_otp INT NOT NULL AUTO_INCREMENT,
    codigo VARCHAR(6) NOT NULL,
    expiracion DATETIME NOT NULL,
    id_usuario INT NULL,
    CONSTRAINT pk_otp PRIMARY KEY (id_otp),
    CONSTRAINT fk_otp_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE

);

CREATE TABLE recuerdo (
    id_recuerdo INT NOT NULL AUTO_INCREMENT,
    token VARCHAR(64) NOT NULL, -- El código secreto que tendrá la cookie
    expiracion DATETIME NOT NULL, -- Hasta cuándo vale (ej. 30 días)
    id_usuario INT NOT NULL,
    CONSTRAINT pk_recuerdo PRIMARY KEY (id_recuerdo),
    CONSTRAINT fk_recuerdo_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

CREATE TABLE sesion (
    id_sesion VARCHAR(128) NOT NULL,
    access INT(10) UNSIGNED,
    data TEXT,
    fecha_acceso DATETIME,
    id_usuario INT NULL,
    CONSTRAINT sesion_pk PRIMARY KEY (id_sesion),
    CONSTRAINT sesion_usuario_fk FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario) ON DELETE SET NULL
);

CREATE TABLE global_foto_ranking (
    id_usuario INT NOT NULL,
    posicion INT NOT NULL,
    CONSTRAINT global_foto_ranking_pk PRIMARY KEY (id_usuario),
    CONSTRAINT global_foto_ranking_usuario_fk FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario)
);

CREATE TABLE partida (
    id_partida INT AUTO_INCREMENT PRIMARY KEY,
    golesLocal INT NOT NULL,
    golesVisitante INT NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    id_usuario_local INT NOT NULL,
    id_usuario_visitante INT NOT NULL,
    CONSTRAINT partida_usuario_local_fk FOREIGN KEY (id_usuario_local) REFERENCES usuario (id_usuario),
    CONSTRAINT partida_usuario_visitante_fk FOREIGN KEY (id_usuario_visitante) REFERENCES usuario (id_usuario)
);

-- Creamos índice para que las consultas sean rápidas
CREATE INDEX idx_ranking ON partida(fecha);