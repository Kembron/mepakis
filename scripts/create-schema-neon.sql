-- Esquema para PostgreSQL/Neon
-- Crear las tablas necesarias para la aplicación de cuidadores

-- Tabla de usuarios (trabajadores y administradores)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    identity_document VARCHAR(50),
    birth_date DATE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'worker',
    phone VARCHAR(50),
    department VARCHAR(100),
    city VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de domicilios/ubicaciones
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255),
    identity_document VARCHAR(50),
    birth_date DATE,
    address TEXT NOT NULL,
    department VARCHAR(100),
    city VARCHAR(100),
    subscription_date DATE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    geofence_radius INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de registros de entrada y salida
CREATE TABLE IF NOT EXISTS check_in_records (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out_time TIMESTAMP WITH TIME ZONE,
    check_in_latitude DECIMAL(10, 8) NOT NULL,
    check_in_longitude DECIMAL(11, 8) NOT NULL,
    check_out_latitude DECIMAL(10, 8),
    check_out_longitude DECIMAL(11, 8),
    status VARCHAR(50) NOT NULL DEFAULT 'incomplete',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

-- Tabla de documentos (si se usa)
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER,
    uploaded_by INTEGER,
    worker_id INTEGER,
    location_id INTEGER,
    status VARCHAR(50) DEFAULT 'pending',
    signature_data TEXT,
    signed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_check_in_records_worker_id ON check_in_records(worker_id);
CREATE INDEX IF NOT EXISTS idx_check_in_records_location_id ON check_in_records(location_id);
CREATE INDEX IF NOT EXISTS idx_check_in_records_check_in_time ON check_in_records(check_in_time);
CREATE INDEX IF NOT EXISTS idx_check_in_records_status ON check_in_records(status);
CREATE INDEX IF NOT EXISTS idx_locations_coordinates ON locations(latitude, longitude);

-- Insertar usuario administrador por defecto
INSERT INTO users (name, email, password, role) 
VALUES ('Administrador', 'admin@ejemplo.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Insertar algunos datos de ejemplo para testing
INSERT INTO users (name, first_name, last_name, email, password, role, phone) 
VALUES 
    ('Juan Pérez', 'Juan', 'Pérez', 'juan@ejemplo.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'worker', '099123456'),
    ('María García', 'María', 'García', 'maria@ejemplo.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'worker', '099654321')
ON CONFLICT (email) DO NOTHING;

-- Insertar algunas ubicaciones de ejemplo
INSERT INTO locations (name, last_name, address, latitude, longitude, geofence_radius) 
VALUES 
    ('Ana', 'Rodríguez', 'Av. 18 de Julio 1234, Montevideo', -34.9011, -56.1645, 100),
    ('Carlos', 'López', 'Bvar. Artigas 567, Montevideo', -34.8941, -56.1591, 150)
ON CONFLICT DO NOTHING;

-- Configurar zona horaria por defecto
SET TIME ZONE 'America/Montevideo';

-- Mostrar información de las tablas creadas
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
