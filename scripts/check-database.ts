import { Pool } from "pg"

async function checkDatabase() {
  console.log("🔍 Verificando conexión a la base de datos Neon...")

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  })

  try {
    const client = await pool.connect()
    console.log("✅ Conexión exitosa a Neon")

    // Verificar zona horaria
    const timeZone = await client.query("SHOW TIME ZONE")
    console.log("🕐 Zona horaria actual:", timeZone.rows[0])

    // Listar todas las tablas
    const tables = await client.query(`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)

    console.log("📋 Tablas en la base de datos:")
    if (tables.rows.length === 0) {
      console.log("❌ No se encontraron tablas. Necesitas ejecutar el script de creación de esquema.")
    } else {
      tables.rows.forEach((table) => {
        console.log(`  - ${table.table_name} (${table.table_type})`)
      })
    }

    // Verificar tablas específicas que necesita la aplicación
    const requiredTables = ["users", "locations", "check_in_records"]
    console.log("\n🔍 Verificando tablas requeridas:")

    for (const tableName of requiredTables) {
      const tableExists = await client.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `,
        [tableName],
      )

      const exists = tableExists.rows[0].exists
      console.log(`  ${exists ? "✅" : "❌"} ${tableName}`)

      if (exists) {
        // Contar registros
        const count = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`)
        console.log(`     └─ ${count.rows[0].count} registros`)
      }
    }

    client.release()
    await pool.end()
  } catch (error) {
    console.error("❌ Error al conectar con la base de datos:", error)
    await pool.end()
    process.exit(1)
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  checkDatabase()
}

export { checkDatabase }
