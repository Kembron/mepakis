-- Crear la base de datos
CREATE DATABASE IF NOT EXISTS cuidadores_app;
USE cuidadores_app;

-- Tabla de usuarios (administradores y trabajadores)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'worker') NOT NULL DEFAULT 'worker',
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de domicilios de ancianos
CREATE TABLE IF NOT EXISTS locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  geofence_radius INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de registros de entrada/salida
CREATE TABLE IF NOT EXISTS check_in_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  worker_id INT NOT NULL,
  location_id INT NOT NULL,
  check_in_time DATETIME NOT NULL,
  check_out_time DATETIME,
  check_in_latitude DECIMAL(10, 8) NOT NULL,
  check_in_longitude DECIMAL(11, 8) NOT NULL,
  check_out_latitude DECIMAL(10, 8),
  check_out_longitude DECIMAL(11, 8),
  status ENUM('completed', 'incomplete', 'invalid') NOT NULL DEFAULT 'incomplete',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

-- Insertar usuario administrador por defecto
INSERT INTO users (name, email, password, role) VALUES 
('Administrador', 'admin@ejemplo.com', '$2b$10$XdUzHHgkBhPYhZ0VPJ1N8.TXm0TZ.8QMbZqBQyTXN4KK9D5QNNmVa', 'admin');
-- La contraseña es 'admin123' hasheada con bcrypt

-- Insertar algunos trabajadores de ejemplo
INSERT INTO users (name, email, password, role, phone) VALUES 
('Juan Pérez', 'juan@ejemplo.com', '$2b$10$XdUzHHgkBhPYhZ0VPJ1N8.TXm0TZ.8QMbZqBQyTXN4KK9D5QNNmVa', 'worker', '123456789'),
('María López', 'maria@ejemplo.com', '$2b$10$XdUzHHgkBhPYhZ0VPJ1N8.TXm0TZ.8QMbZqBQyTXN4KK9D5QNNmVa', 'worker', '987654321');

-- Insertar algunos domicilios de ejemplo
INSERT INTO locations (name, address, latitude, longitude, geofence_radius) VALUES 
('Carlos Rodríguez', 'Calle Principal 123', 40.416775, -3.70379, 100),
('Ana Martínez', 'Avenida Central 456', 40.42, -3.71, 150);
