-- Script para verificar el estado de los documentos y firmas
-- Ejecutar este script para diagnosticar problemas

-- Verificar documentos y sus firmas
SELECT 
    d.id as document_id,
    d.title,
    d.status,
    d.worker_id,
    d.file_path as original_file,
    ds.signed_file_path as signed_file,
    ds.signed_at,
    u.name as worker_name
FROM documents d
LEFT JOIN document_signatures ds ON d.id = ds.document_id
LEFT JOIN users u ON d.worker_id = u.id
ORDER BY d.created_at DESC;

-- Verificar firmas de trabajadores
SELECT 
    ws.id,
    ws.worker_id,
    u.name as worker_name,
    ws.created_at,
    ws.updated_at,
    CASE 
        WHEN ws.signature_data IS NOT NULL THEN 'Tiene firma'
        ELSE 'Sin firma'
    END as signature_status
FROM worker_signatures ws
LEFT JOIN users u ON ws.worker_id = u.id
ORDER BY ws.updated_at DESC;

-- Verificar archivos en document_files (para entorno Vercel)
SELECT 
    id,
    file_name,
    content_type,
    created_at,
    CASE 
        WHEN content IS NOT NULL THEN CONCAT('Archivo presente (', LENGTH(content), ' caracteres)')
        ELSE 'Sin contenido'
    END as content_status
FROM document_files
ORDER BY created_at DESC;
