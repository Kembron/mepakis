import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getSession } from "@/lib/auth"
import fs from "fs"
import path from "path"

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    // Verificar autenticación
    const session = await getSession()
    if (!session || !session.user) {
      return new NextResponse("No autorizado", { status: 401 })
    }

    const userId = session.user.id
    const userRole = session.user.role

    // En Next.js 14, debemos usar await con los parámetros de ruta
    const params = await Promise.resolve(context.params)
    const documentId = params.id

    console.log(`=== SOLICITUD PARA VER DOCUMENTO ===`)
    console.log(`Documento ID: ${documentId}`)
    console.log(`Usuario ID: ${userId}, Rol: ${userRole}`)

    // CONSULTA CORREGIDA: Obtener información completa del documento
    let sqlQuery = `
      SELECT 
        d.id, 
        d.title, 
        d.file_path,
        d.status,
        d.admin_id,
        d.worker_id,
        ds.signed_file_path,
        ds.signed_at
      FROM documents d
      LEFT JOIN document_signatures ds ON d.id = ds.document_id
      WHERE d.id = $1
    `

    // Si es trabajador, verificar que el documento le pertenece
    const queryParams = [documentId]
    if (userRole !== "admin") {
      sqlQuery += " AND d.worker_id = $2"
      queryParams.push(userId)
    } else {
      // Si es admin, verificar que el documento fue creado por él
      sqlQuery += " AND d.admin_id = $2"
      queryParams.push(userId)
    }

    console.log(`Ejecutando consulta SQL: ${sqlQuery}`)
    console.log(`Parámetros: ${JSON.stringify(queryParams)}`)

    const documents = await query(sqlQuery, queryParams)

    if ((documents as any[]).length === 0) {
      console.error(`Documento no encontrado: ID ${documentId}`)
      return new NextResponse("Documento no encontrado", { status: 404 })
    }

    const document = (documents as any[])[0]
    console.log(`=== DOCUMENTO ENCONTRADO ===`)
    console.log(`Título: ${document.title}`)
    console.log(`Estado: ${document.status}`)
    console.log(`Archivo original: ${document.file_path}`)
    console.log(`Archivo firmado: ${document.signed_file_path || "No disponible"}`)
    console.log(`Fecha firma: ${document.signed_at || "No disponible"}`)

    // LÓGICA CORREGIDA: Determinar qué archivo mostrar
    let filePath = document.file_path // Por defecto, mostrar el original
    let isShowingSigned = false

    // CONDICIÓN CRÍTICA: Si el documento está firmado Y tenemos la ruta del archivo firmado
    if (document.status === "signed" && document.signed_file_path) {
      filePath = document.signed_file_path
      isShowingSigned = true
      console.log(`✅ MOSTRANDO DOCUMENTO FIRMADO: ${filePath}`)
    } else {
      console.log(`📄 MOSTRANDO DOCUMENTO ORIGINAL: ${filePath}`)
      console.log(`   - Estado: ${document.status}`)
      console.log(`   - Tiene archivo firmado: ${!!document.signed_file_path}`)
    }

    // Verificar que tenemos una ruta válida
    if (!filePath) {
      console.error("❌ ERROR: filePath es undefined o null")
      return new NextResponse("Archivo no encontrado - ruta inválida", { status: 404 })
    }

    // Headers para el PDF
    const headers = {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "Cache-Control": "no-store, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      // Header personalizado para debugging
      "X-Document-Type": isShowingSigned ? "signed" : "original",
      "X-Document-Status": document.status,
    }

    // Verificar si el archivo está en la base de datos o en el sistema de archivos
    if (filePath.startsWith("/api/document-files/")) {
      // El archivo está en la base de datos
      const fileId = filePath.split("/").pop()
      console.log(`📁 Obteniendo archivo de la base de datos con ID: ${fileId}`)

      // Obtener el contenido del archivo desde la base de datos
      const files = await query("SELECT content, content_type FROM document_files WHERE id = $1", [fileId])

      if ((files as any[]).length === 0) {
        console.error(`❌ Archivo no encontrado en la base de datos: ID ${fileId}`)
        return new NextResponse("Archivo no encontrado", { status: 404 })
      }

      // Convertir el contenido base64 a Buffer
      const fileBuffer = Buffer.from((files as any[])[0].content, "base64")
      const contentType = (files as any[])[0].content_type || "application/pdf"

      console.log(`✅ Archivo obtenido de la base de datos, tamaño: ${fileBuffer.length} bytes`)
      console.log(`   - Tipo: ${isShowingSigned ? "FIRMADO" : "ORIGINAL"}`)

      // Devolver el archivo como respuesta
      return new NextResponse(fileBuffer, { headers: { ...headers, "Content-Type": contentType } })
    } else {
      // El archivo está en el sistema de archivos
      const fullPath = path.join(process.cwd(), "public", filePath)
      console.log(`📁 Obteniendo archivo del sistema de archivos: ${fullPath}`)

      // Verificar que el archivo existe
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ Archivo no encontrado en la ruta: ${fullPath}`)
        return new NextResponse("Archivo no encontrado", { status: 404 })
      }

      // Leer el archivo
      const fileBuffer = fs.readFileSync(fullPath)
      console.log(`✅ Archivo leído del sistema de archivos, tamaño: ${fileBuffer.length} bytes`)
      console.log(`   - Tipo: ${isShowingSigned ? "FIRMADO" : "ORIGINAL"}`)

      // Devolver el archivo como respuesta
      return new NextResponse(fileBuffer, { headers })
    }
  } catch (error) {
    console.error("❌ Error al obtener documento:", error)
    return new NextResponse("Error al obtener el documento", { status: 500 })
  }
}
