import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSession } from "@/lib/auth"

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    // Verificar autenticación
    const session = await getSession()
    if (!session || !session.user) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }

    const userId = session.user.id
    const userRole = session.user.role

    // En Next.js 14, debemos usar await con los parámetros de ruta
    const params = await Promise.resolve(context.params)
    const documentId = params.id

    console.log(`=== VERIFICANDO ESTADO DE DOCUMENTO ===`)
    console.log(`Documento ID: ${documentId}`)
    console.log(`Usuario ID: ${userId}, Rol: ${userRole}`)

    // Obtener información del documento
    let sqlQuery = `
      SELECT 
        d.id, 
        d.status,
        ds.signed_file_path as signedFilePath
      FROM documents d
      LEFT JOIN document_signatures ds ON d.id = ds.document_id
      WHERE d.id = ?
    `

    // Si es trabajador, verificar que el documento le pertenece
    const queryParams = [documentId]
    if (userRole !== "admin") {
      sqlQuery += " AND d.worker_id = ?"
      queryParams.push(userId)
    } else {
      // Si es admin, verificar que el documento fue creado por él
      sqlQuery += " AND d.admin_id = ?"
      queryParams.push(userId)
    }

    const documents = await query(sqlQuery, queryParams)

    if ((documents as any[]).length === 0) {
      return NextResponse.json({ success: false, error: "Documento no encontrado" }, { status: 404 })
    }

    const document = (documents as any[])[0]

    // Verificar si el documento está firmado pero no se refleja en su estado
    if (document.status !== "signed" && document.signedFilePath) {
      console.log("Documento con firma pero estado incorrecto. Actualizando...")
      await query("UPDATE documents SET status = 'signed', updated_at = NOW() WHERE id = ?", [documentId])
      document.status = "signed"
    }

    // Si no hay ruta de firma pero hay una entrada en document_signatures, verificar
    if (document.status === "signed" && !document.signedFilePath) {
      const signatures = await query("SELECT signed_file_path FROM document_signatures WHERE document_id = ? LIMIT 1", [
        documentId,
      ])

      if ((signatures as any[]).length > 0 && (signatures as any[])[0].signed_file_path) {
        document.signedFilePath = (signatures as any[])[0].signed_file_path
      }
    }

    return NextResponse.json({
      success: true,
      status: document.status,
      hasSignedFile: !!document.signedFilePath,
    })
  } catch (error) {
    console.error("Error al verificar estado del documento:", error)
    return NextResponse.json({ success: false, error: "Error al verificar estado del documento" }, { status: 500 })
  }
}
