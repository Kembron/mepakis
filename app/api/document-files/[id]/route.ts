import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSession } from "@/lib/auth"

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    // Verificar autenticación
    const session = await getSession()
    if (!session || !session.user) {
      return new NextResponse("No autorizado", { status: 401 })
    }

    // En Next.js 14, debemos usar await con los parámetros de ruta
    const params = await Promise.resolve(context.params)
    const fileId = params.id

    // Obtener el contenido del archivo desde la base de datos
    const files = await query("SELECT content, content_type, file_name FROM document_files WHERE id = ?", [fileId])

    if ((files as any[]).length === 0) {
      return new NextResponse("Archivo no encontrado", { status: 404 })
    }

    // Convertir el contenido base64 a Buffer
    const fileBuffer = Buffer.from((files as any[])[0].content, "base64")
    const contentType = (files as any[])[0].content_type || "application/pdf"

    // Determinar si es una descarga o visualización basado en el query param
    const searchParams = new URL(request.url).searchParams
    const disposition = searchParams.get("download") === "true" ? "attachment" : "inline"
    const fileName = (files as any[])[0].file_name || `file_${fileId}.pdf`

    // Devolver el archivo como respuesta
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${fileName}"`,
        "Cache-Control": "no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
  } catch (error) {
    console.error("Error al obtener archivo:", error)
    return new NextResponse("Error al obtener el archivo", { status: 500 })
  }
}
