-- Eliminar triggers y funciones si existen (para re-ejecución)
-- (Necesitarás hacer esto manualmente o ajustar si hay dependencias)
-- DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Eliminar tablas en orden inverso de dependencias o usar CASCADE
DROP TABLE IF EXISTS "document_signatures" CASCADE;
DROP TABLE IF EXISTS "check_in_records" CASCADE;
DROP TABLE IF EXISTS "documents" CASCADE;
DROP TABLE IF EXISTS "security_events" CASCADE;
DROP TABLE IF EXISTS "worker_signatures" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "locations" CASCADE;
DROP TABLE IF EXISTS "document_files" CASCADE;

-- Eliminar tipos ENUM si existen
DROP TYPE IF EXISTS check_in_status_enum;
DROP TYPE IF EXISTS document_status_enum;
DROP TYPE IF EXISTS user_role_enum;

-- Crear tipos ENUM
CREATE TYPE check_in_status_enum AS ENUM ('completed', 'incomplete', 'invalid');
CREATE TYPE document_status_enum AS ENUM ('pending', 'signed', 'expired');
CREATE TYPE user_role_enum AS ENUM ('admin', 'worker');

-- Crear función para actualizar 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

--
-- Table structure for table "users"
--
CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "last_name" VARCHAR(255) DEFAULT NULL,
  "birth_date" DATE DEFAULT NULL,
  "identity_document" VARCHAR(20) DEFAULT NULL,
  "first_name" VARCHAR(255) DEFAULT NULL,
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "password" VARCHAR(255) NOT NULL,
  "role" user_role_enum NOT NULL DEFAULT 'worker',
  "phone" VARCHAR(20) DEFAULT NULL,
  "department" VARCHAR(100) DEFAULT NULL,
  "city" VARCHAR(100) DEFAULT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para 'users'
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON "users"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

--
-- Table structure for table "locations"
--
CREATE TABLE "locations" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(255) NOT NULL,
  "last_name" VARCHAR(255) DEFAULT NULL,
  "birth_date" DATE DEFAULT NULL,
  "identity_document" VARCHAR(20) DEFAULT NULL,
  "address" TEXT NOT NULL,
  "department" VARCHAR(100) DEFAULT NULL,
  "city" VARCHAR(100) DEFAULT NULL,
  "subscription_date" DATE DEFAULT NULL,
  "latitude" DECIMAL(10,8) NOT NULL,
  "longitude" DECIMAL(11,8) NOT NULL,
  "geofence_radius" INT NOT NULL DEFAULT 100,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para 'locations'
CREATE TRIGGER update_locations_updated_at
BEFORE UPDATE ON "locations"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

--
-- Table structure for table "check_in_records"
--
CREATE TABLE "check_in_records" (
  "id" SERIAL PRIMARY KEY,
  "worker_id" INT NOT NULL,
  "location_id" INT NOT NULL,
  "check_in_time" TIMESTAMP NOT NULL,
  "check_out_time" TIMESTAMP DEFAULT NULL,
  "check_in_latitude" DECIMAL(10,8) NOT NULL,
  "check_in_longitude" DECIMAL(11,8) NOT NULL,
  "check_out_latitude" DECIMAL(10,8) DEFAULT NULL,
  "check_out_longitude" DECIMAL(11,8) DEFAULT NULL,
  "status" check_in_status_enum NOT NULL DEFAULT 'incomplete',
  "notes" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "check_in_records_fk_1" FOREIGN KEY ("worker_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "check_in_records_fk_2" FOREIGN KEY ("location_id") REFERENCES "locations" ("id") ON DELETE CASCADE
);

CREATE INDEX "idx_check_in_worker_id" ON "check_in_records" ("worker_id");
CREATE INDEX "idx_check_in_location_id" ON "check_in_records" ("location_id");

-- Trigger para 'check_in_records'
CREATE TRIGGER update_check_in_records_updated_at
BEFORE UPDATE ON "check_in_records"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

--
-- Table structure for table "document_files"
--
CREATE TABLE "document_files" (
  "id" SERIAL PRIMARY KEY,
  "file_name" VARCHAR(255) NOT NULL,
  "content_type" VARCHAR(100) NOT NULL,
  "content" TEXT NOT NULL, -- longtext -> TEXT
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Trigger para 'document_files'
CREATE TRIGGER update_document_files_updated_at
BEFORE UPDATE ON "document_files"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

--
-- Table structure for table "documents"
--
CREATE TABLE "documents" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "file_path" VARCHAR(255) NOT NULL,
  "status" document_status_enum NOT NULL DEFAULT 'pending',
  "admin_id" INT NOT NULL,
  "worker_id" INT NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "expiration_date" DATE DEFAULT NULL,
  CONSTRAINT "documents_fk_1" FOREIGN KEY ("admin_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "documents_fk_2" FOREIGN KEY ("worker_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX "idx_documents_admin_id" ON "documents" ("admin_id");
CREATE INDEX "idx_documents_worker_id" ON "documents" ("worker_id");

-- Trigger para 'documents'
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON "documents"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

--
-- Table structure for table "worker_signatures"
--
CREATE TABLE "worker_signatures" (
  "id" SERIAL PRIMARY KEY,
  "worker_id" INT NOT NULL,
  "signature_data" TEXT NOT NULL, -- longtext -> TEXT
  "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_signatures_fk_1" FOREIGN KEY ("worker_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX "idx_worker_signatures_worker_id" ON "worker_signatures" ("worker_id");

-- Trigger para 'worker_signatures'
CREATE TRIGGER update_worker_signatures_updated_at
BEFORE UPDATE ON "worker_signatures"
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

--
-- Table structure for table "document_signatures"
--
CREATE TABLE "document_signatures" (
  "id" SERIAL PRIMARY KEY,
  "document_id" INT NOT NULL,
  "worker_id" INT NOT NULL,
  "signature_id" INT NOT NULL,
  "signed_file_path" VARCHAR(255) NOT NULL,
  "signed_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_signatures_fk_1" FOREIGN KEY ("document_id") REFERENCES "documents" ("id") ON DELETE CASCADE,
  CONSTRAINT "document_signatures_fk_2" FOREIGN KEY ("worker_id") REFERENCES "users" ("id") ON DELETE CASCADE,
  CONSTRAINT "document_signatures_fk_3" FOREIGN KEY ("signature_id") REFERENCES "worker_signatures" ("id") ON DELETE CASCADE
);

CREATE INDEX "idx_doc_signatures_document_id" ON "document_signatures" ("document_id");
CREATE INDEX "idx_doc_signatures_worker_id" ON "document_signatures" ("worker_id");
CREATE INDEX "idx_doc_signatures_signature_id" ON "document_signatures" ("signature_id");

--
-- Table structure for table "security_events"
--
CREATE TABLE "security_events" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INT NOT NULL,
  "event_type" VARCHAR(50) NOT NULL,
  "details" TEXT,
  "severity" VARCHAR(20) NOT NULL,
  "timestamp" TIMESTAMP NOT NULL,
  CONSTRAINT "security_events_fk_1" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX "idx_security_events_user_id" ON "security_events" ("user_id");
CREATE INDEX "idx_security_events_event_type" ON "security_events" ("event_type");
CREATE INDEX "idx_security_events_timestamp" ON "security_events" ("timestamp");

-- Insertar usuario administrador por defecto
INSERT INTO "users" ("name", "email", "password", "role") VALUES 
('Administrador', 'admin@ejemplo.com', '$2b$10$XdUzHHgkBhPYhZ0VPJ1N8.TXm0TZ.8QMbZqBQyTXN4KK9D5QNNmVa', 'admin');
-- La contraseña es 'admin123' hasheada con bcrypt

-- Insertar algunos trabajadores de ejemplo
INSERT INTO "users" ("name", "email", "password", "role", "phone") VALUES 
('Juan Pérez', 'juan@ejemplo.com', '$2b$10$XdUzHHgkBhPYhZ0VPJ1N8.TXm0TZ.8QMbZqBQyTXN4KK9D5QNNmVa', 'worker', '123456789'),
('María López', 'maria@ejemplo.com', '$2b$10$XdUzHHgkBhPYhZ0VPJ1N8.TXm0TZ.8QMbZqBQyTXN4KK9D5QNNmVa', 'worker', '987654321');

-- Insertar algunos domicilios de ejemplo
INSERT INTO "locations" ("name", "address", "latitude", "longitude", "geofence_radius") VALUES 
('Carlos Rodríguez', 'Calle Principal 123', 40.416775, -3.70379, 100),
('Ana Martínez', 'Avenida Central 456', 40.42, -3.71, 150);
