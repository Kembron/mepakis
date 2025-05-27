import { NextResponse } from "next/server"
import { initializeDatabase } from "@/lib/db"

export async function GET() {
  try {
    const result = await initializeDatabase()

    if (result) {
      return NextResponse.json({
        success: true,
        message: "Base de datos inicializada correctamente con zona horaria de Uruguay (America/Montevideo)",
      })
    } else {
      return NextResponse.json({ success: false, error: "Error al inicializar la base de datos" }, { status: 500 })
    }
  } catch (error) {
    console.error("Error en la inicialización de la base de datos:", error)
    return NextResponse.json(
      { success: false, error: "Error en la inicialización de la base de datos" },
      { status: 500 },
    )
  }
}
