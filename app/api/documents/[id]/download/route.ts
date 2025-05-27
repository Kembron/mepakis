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

    console.log(`=== SOLICITUD PARA DESCARGAR DOCUMENTO ===`)
    console.log(`📄 Documento ID: ${documentId}`)
    console.log(`👤 Usuario ID: ${userId}, Rol: ${userRole}`)

    // CONSULTA MEJORADA: Obtener información completa del documento
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
      WHERE d.id = ?
    `

    // Verificar permisos según el rol
    const queryParams = [documentId]
    if (userRole !== "admin") {
      // Si es trabajador, verificar que el documento le pertenece
      sqlQuery += " AND d.worker_id = ?"
      queryParams.push(userId)
    } else {
      // Si es admin, verificar que el documento fue creado por él
      sqlQuery += " AND d.admin_id = ?"
      queryParams.push(userId)
    }

    console.log(`🔍 Ejecutando consulta SQL: ${sqlQuery}`)
    console.log(`📋 Parámetros: ${JSON.stringify(queryParams)}`)

    const documents = await query(sqlQuery, queryParams)

    if ((documents as any[]).length === 0) {
      console.error(`❌ Documento no encontrado: ID ${documentId}`)
      return new NextResponse("Documento no encontrado", { status: 404 })
    }

    const document = (documents as any[])[0]
    console.log(`=== DOCUMENTO ENCONTRADO PARA DESCARGA ===`)
    console.log(`📄 Título: ${document.title}`)
    console.log(`📊 Estado: ${document.status}`)
    console.log(`📁 Archivo original: ${document.file_path}`)
    console.log(`✍️ Archivo firmado: ${document.signed_file_path || "No disponible"}`)
    console.log(`📅 Fecha firma: ${document.signed_at || "No disponible"}`)

    // LÓGICA MEJORADA: Determinar qué archivo descargar
    let filePath = document.file_path // Por defecto, descargar el original
    let fileName = document.title
    let isDownloadingSigned = false

    // CONDICIÓN CRÍTICA: Si el documento está firmado Y tenemos la ruta del archivo firmado
    if (document.status === "signed" && document.signed_file_path) {
      filePath = document.signed_file_path
      fileName = `${document.title}_FIRMADO`
      isDownloadingSigned = true
      console.log(`✅ DESCARGANDO DOCUMENTO FIRMADO: ${filePath}`)
    } else {
      console.log(`📄 DESCARGANDO DOCUMENTO ORIGINAL: ${filePath}`)
      console.log(`   - Estado: ${document.status}`)
      console.log(`   - Tiene archivo firmado: ${!!document.signed_file_path}`)
    }

    // Verificar que tenemos una ruta válida
    if (!filePath) {
      console.error("❌ ERROR: filePath es undefined o null")
      return new NextResponse("Archivo no encontrado - ruta inválida", { status: 404 })
    }

    // Headers para descarga
    const headers = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}.pdf"`,
      "Cache-Control": "no-store, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      // Headers personalizados para debugging
      "X-Document-Type": isDownloadingSigned ? "signed" : "original",
      "X-Document-Status": document.status,
      "X-File-Source": filePath.startsWith("/api/document-files/") ? "database" : "filesystem",
    }

    try {
      // Verificar si el archivo está en la base de datos o en el sistema de archivos
      if (filePath.startsWith("/api/document-files/")) {
        // El archivo está en la base de datos
        const fileId = filePath.split("/").pop()
        console.log(`📊 Obteniendo archivo de la base de datos con ID: ${fileId}`)

        if (!fileId) {
          console.error("❌ ID de archivo no válido")
          return new NextResponse("ID de archivo no válido", { status: 400 })
        }

        // Obtener el contenido del archivo desde la base de datos
        const files = await query("SELECT content, content_type FROM document_files WHERE id = ?", [fileId])

        if ((files as any[]).length === 0) {
          console.error(`❌ Archivo no encontrado en la base de datos: ID ${fileId}`)
          return new NextResponse("Archivo no encontrado en la base de datos", { status: 404 })
        }

        const fileData = (files as any[])[0]

        // Convertir el contenido base64 a Buffer
        const fileBuffer = Buffer.from(fileData.content, "base64")
        const contentType = fileData.content_type || "application/pdf"

        console.log(`✅ Archivo obtenido de la base de datos`)
        console.log(`   - Tamaño: ${fileBuffer.length} bytes`)
        console.log(`   - Tipo: ${isDownloadingSigned ? "FIRMADO" : "ORIGINAL"}`)
        console.log(`   - Content-Type: ${contentType}`)

        // Devolver el archivo como respuesta
        return new NextResponse(fileBuffer, {
          headers: {
            ...headers,
            "Content-Type": contentType,
            "Content-Length": fileBuffer.length.toString(),
          },
        })
      } else {
        // El archivo está en el sistema de archivos
        const fullPath = path.join(process.cwd(), "public", filePath)
        console.log(`💿 Obteniendo archivo del sistema de archivos: ${fullPath}`)

        // Verificar que el archivo existe
        if (!fs.existsSync(fullPath)) {
          console.error(`❌ Archivo no encontrado en la ruta: ${fullPath}`)
          return new NextResponse("Archivo no encontrado en el sistema de archivos", { status: 404 })
        }

        // Leer el archivo
        const fileBuffer = fs.readFileSync(fullPath)
        console.log(`✅ Archivo leído del sistema de archivos`)
        console.log(`   - Tamaño: ${fileBuffer.length} bytes`)
        console.log(`   - Tipo: ${isDownloadingSigned ? "FIRMADO" : "ORIGINAL"}`)

        // Devolver el archivo como respuesta
        return new NextResponse(fileBuffer, {
          headers: {
            ...headers,
            "Content-Length": fileBuffer.length.toString(),
          },
        })
      }
    } catch (fileError) {
      console.error("❌ Error al obtener el archivo:", fileError)
      return new NextResponse(`Error al obtener el archivo: ${fileError.message}`, { status: 500 })
    }
  } catch (error) {
    console.error("❌ Error general al descargar documento:", error)
    return new NextResponse("Error interno del servidor", { status: 500 })
  }
}
