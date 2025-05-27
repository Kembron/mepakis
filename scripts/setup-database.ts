import { Pool } from "pg"
import fs from "fs"
import path from "path"

async function setupDatabase() {
  console.log("🚀 Configurando base de datos Neon...")

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  })

  try {
    const client = await pool.connect()
    console.log("✅ Conectado a Neon")

    // Leer y ejecutar el script SQL
    const sqlPath = path.join(__dirname, "create-schema-neon.sql")
    const sqlContent = fs.readFileSync(sqlPath, "utf8")

    console.log("📝 Ejecutando script de creación de esquema...")
    await client.query(sqlContent)

    console.log("✅ Esquema creado exitosamente")

    // Verificar que todo se creó correctamente
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)

    console.log("📋 Tablas creadas:")
    tables.rows.forEach((table) => {
      console.log(`  ✅ ${table.table_name}`)
    })

    client.release()
    await pool.end()

    console.log("🎉 Base de datos configurada correctamente")
  } catch (error) {
    console.error("❌ Error al configurar la base de datos:", error)
    await pool.end()
    process.exit(1)
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  setupDatabase()
}

export { setupDatabase }
