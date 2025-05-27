-- Optimizaciones para PostgreSQL

-- Crear índices para mejorar el rendimiento de las consultas más comunes
CREATE INDEX IF NOT EXISTS idx_users_email ON "users" ("email");
CREATE INDEX IF NOT EXISTS idx_users_role ON "users" ("role");
CREATE INDEX IF NOT EXISTS idx_check_in_records_dates ON "check_in_records" ("check_in_time", "check_out_time");
CREATE INDEX IF NOT EXISTS idx_check_in_records_status ON "check_in_records" ("status");

-- Configurar autovacuum para mantener las tablas optimizadas
ALTER TABLE "users" SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE "check_in_records" SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE "locations" SET (autovacuum_vacuum_scale_factor = 0.05);

-- Crear vistas materializadas para reportes comunes
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_work_summary AS
SELECT 
  u.id AS worker_id,
  u.name AS worker_name,
  DATE_TRUNC('month', r.check_in_time) AS month,
  COUNT(*) AS total_records,
  SUM(EXTRACT(EPOCH FROM (r.check_out_time - r.check_in_time)) / 60) AS total_minutes
FROM "users" u
JOIN "check_in_records" r ON u.id = r.worker_id
WHERE r.status = 'completed'
GROUP BY u.id, u.name, DATE_TRUNC('month', r.check_in_time);

-- Crear función para refrescar la vista materializada
CREATE OR REPLACE FUNCTION refresh_work_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW mv_monthly_work_summary;
END;
$$ LANGUAGE plpgsql;

-- Crear un índice en la vista materializada
CREATE INDEX IF NOT EXISTS idx_mv_monthly_work_summary ON mv_monthly_work_summary (worker_id, month);

-- Configurar estadísticas para el optimizador de consultas
ALTER TABLE "users" ALTER COLUMN role SET STATISTICS 1000;
ALTER TABLE "check_in_records" ALTER COLUMN status SET STATISTICS 1000;
ALTER TABLE "check_in_records" ALTER COLUMN worker_id SET STATISTICS 1000;
