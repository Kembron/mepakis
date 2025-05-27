import { NextResponse } from "next/server"
import { generateReport } from "@/lib/actions"
import { generateExcelReport } from "@/lib/excel-generator"
import { getSession } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    // Verificar autenticación
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // Obtener los filtros del cuerpo de la solicitud
    const filters = await request.json()

    // Generar el reporte con datos completos
    const reportData = await generateReport(filters, true)

    // Generar el archivo Excel
    const excelBuffer = await generateExcelReport(reportData, filters)

    // Crear la respuesta con el archivo Excel
    const response = new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="reporte-${new Date().toISOString().split("T")[0]}.xlsx"`,
      },
    })

    return response
  } catch (error) {
    console.error("Error al generar el reporte Excel:", error)
    return NextResponse.json(
      { error: `Error al generar el reporte Excel: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
