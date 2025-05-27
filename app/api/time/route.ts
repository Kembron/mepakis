import { NextResponse } from "next/server"
import { query, initializeDatabase } from "@/lib/db"

export async function GET() {
  try {
    // Inicializar la base de datos y configurar la zona horaria
    await initializeDatabase()

    // Obtener la hora actual del servidor MySQL con la zona horaria configurada
    const [timeResult] = (await query(
      "SELECT NOW() as server_time, @@session.time_zone as time_zone, @@global.time_zone as global_time_zone",
    )) as any[]

    // Obtener la hora actual de JavaScript
    const jsTime = new Date()

    // Obtener la hora actual en Uruguay usando la API de JavaScript
    const uruguayTime = new Date().toLocaleString("es-UY", { timeZone: "America/Montevideo" })

    return NextResponse.json({
      success: true,
      mysql_time: timeResult.server_time,
      mysql_time_zone: timeResult.time_zone,
      mysql_global_time_zone: timeResult.global_time_zone,
      js_time: jsTime.toISOString(),
      js_local_time: jsTime.toString(),
      uruguay_time: uruguayTime,
    })
  } catch (error) {
    console.error("Error al obtener la hora:", error)
    return NextResponse.json({ success: false, error: "Error al obtener la hora del servidor" }, { status: 500 })
  }
}
