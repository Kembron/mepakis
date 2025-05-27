import { query } from "../lib/db"

async function debugDocuments() {
  try {
    console.log("=== DEPURACIÓN DE DOCUMENTOS ===")

    // Verificar estructura de la tabla documents
    console.log("\n1. Verificando estructura de la tabla documents:")
    const documentsStructure = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      ORDER BY ordinal_position
    `)
    console.table(documentsStructure)

    // Verificar datos en la tabla documents
    console.log("\n2. Verificando datos en la tabla documents:")
    const documents = await query("SELECT * FROM documents LIMIT 5")
    console.table(documents)

    // Verificar estructura de la tabla document_signatures
    console.log("\n3. Verificando estructura de la tabla document_signatures:")
    const signaturesStructure = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'document_signatures' 
      ORDER BY ordinal_position
    `)
    console.table(signaturesStructure)

    // Verificar datos en la tabla document_signatures
    console.log("\n4. Verificando datos en la tabla document_signatures:")
    const signatures = await query("SELECT * FROM document_signatures LIMIT 5")
    console.table(signatures)

    // Verificar JOIN entre documents y users
    console.log("\n5. Verificando JOIN entre documents y users:")
    const joinResult = await query(`
      SELECT 
        d.id, 
        d.title, 
        d.file_path, 
        d.admin_id, 
        d.worker_id,
        u.name as worker_name
      FROM documents d
      LEFT JOIN users u ON d.worker_id = u.id
      LIMIT 3
    `)
    console.table(joinResult)
  } catch (error) {
    console.error("Error en depuración:", error)
  }
}

debugDocuments()
