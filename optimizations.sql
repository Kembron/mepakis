-- Optimizaciones críticas para la base de datos antes de la entrega

-- 1. Índices para mejorar rendimiento
CREATE INDEX idx_documents_worker_status ON documents(worker_id, status);
CREATE INDEX idx_documents_admin_created ON documents(admin_id, created_at DESC);
CREATE INDEX idx_check_in_records_worker_date ON check_in_records(worker_id, check_in_time DESC);
CREATE INDEX idx_check_in_records_location_date ON check_in_records(location_id, check_in_time DESC);
CREATE INDEX idx_document_signatures_document ON document_signatures(document_id);

-- 2. Optimizar consultas de reportes
CREATE INDEX idx_check_in_records_date_status ON check_in_records(check_in_time, status);

-- 3. Limpiar datos de prueba (EJECUTAR SOLO EN PRODUCCIÓN)
-- DELETE FROM check_in_records WHERE notes LIKE '%test%' OR notes LIKE '%prueba%';
-- DELETE FROM documents WHERE title LIKE '%test%' OR title LIKE '%prueba%';

-- 4. Configurar límites de almacenamiento
ALTER TABLE document_files ADD COLUMN file_size INT DEFAULT 0;

-- 5. Añadir campos para auditoría
ALTER TABLE documents ADD COLUMN last_accessed TIMESTAMP NULL;
ALTER TABLE check_in_records ADD COLUMN accuracy DECIMAL(10,2) NULL;
