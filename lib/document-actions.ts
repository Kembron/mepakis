"use server"

import { revalidatePath } from "next/cache"
import { query, initializeDatabase } from "@/lib/db"
import { z } from "zod"
import { handleServerError } from "@/lib/error-handler"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import { getSession } from "@/lib/auth"
import { headers } from "next/headers"
import path from "path"
import { mkdir, writeFile, readFile } from "fs/promises"
import fs from "fs"

// Esquemas de validación
const documentSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  description: z.string().optional(),
  workerId: z.string(),
})

// Función mejorada para detectar si estamos en Vercel (producción) o desarrollo local
function isVercelProduction() {
  return !!(
    (
      process.env.VERCEL === "1" ||
      process.env.VERCEL_ENV === "production" ||
      process.env.NODE_ENV === "production" ||
      process.env.POSTGRES_URL
    ) // Si tenemos Postgres URL, probablemente estamos en Vercel
  )
}

// Función para obtener la URL base
function getBaseUrl() {
  const headersList = headers()
  const host = headersList.get("host") || "localhost:3000"
  const protocol = host.includes("localhost") ? "http" : "https"
  return `${protocol}://${host}`
}

// Función para obtener el usuario actual
async function getCurrentUser() {
  try {
    const session = await getSession()
    if (!session) {
      console.log("No se encontró sesión")
      return null
    }
    return session.user
  } catch (error) {
    console.error("Error al obtener usuario actual:", error)
    return null
  }
}

// Función para verificar si el usuario es administrador
async function isAdmin() {
  const user = await getCurrentUser()
  if (!user) return false

  return user.role === "admin"
}

// Función para validar PDF
async function validatePdfContent(buffer: Buffer): Promise<{ isValid: boolean; canProcess: boolean; error?: string }> {
  try {
    // Verificar que es un PDF válido
    if (buffer.length < 5) {
      return { isValid: false, canProcess: false, error: "Archivo demasiado pequeño para ser un PDF" }
    }

    // Verificar header PDF
    const header = buffer.slice(0, 4).toString()
    if (header !== "%PDF") {
      return { isValid: false, canProcess: false, error: "El archivo no es un PDF válido" }
    }

    // Intentar cargar el PDF para verificar si se puede procesar
    try {
      await PDFDocument.load(buffer)
      return { isValid: true, canProcess: true }
    } catch (loadError) {
      console.log("PDF válido pero no se puede procesar normalmente:", loadError)

      // Intentar con opciones permisivas
      try {
        await PDFDocument.load(buffer, { ignoreEncryption: true })
        return { isValid: true, canProcess: true }
      } catch (encryptedError) {
        console.log("PDF encriptado o corrupto:", encryptedError)
        return { isValid: true, canProcess: false, error: "PDF encriptado o corrupto" }
      }
    }
  } catch (error) {
    console.error("Error al validar PDF:", error)
    return { isValid: false, canProcess: false, error: "Error al validar el archivo PDF" }
  }
}

// Función para crear un PDF de respaldo con la firma
async function createFallbackPdf(documentTitle: string, signatureData: string, workerName: string): Promise<Buffer> {
  try {
    console.log("Creando PDF de respaldo...")

    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // Tamaño A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const { width, height } = page.getSize()

    // Título del documento
    page.drawText("DOCUMENTO FIRMADO DIGITALMENTE", {
      x: 50,
      y: height - 100,
      size: 18,
      font: boldFont,
      color: rgb(0, 0, 0),
    })

    // Información del documento
    page.drawText(`Título: ${documentTitle}`, {
      x: 50,
      y: height - 150,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    })

    page.drawText(`Firmado por: ${workerName}`, {
      x: 50,
      y: height - 180,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    })

    page.drawText(`Fecha de firma: ${new Date().toLocaleString("es-ES")}`, {
      x: 50,
      y: height - 210,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    })

    // Nota sobre el documento original
    page.drawText("NOTA:", {
      x: 50,
      y: height - 260,
      size: 12,
      font: boldFont,
      color: rgb(0.8, 0, 0),
    })

    page.drawText("El documento original no pudo ser procesado debido a restricciones", {
      x: 50,
      y: height - 290,
      size: 10,
      font: font,
      color: rgb(0.5, 0, 0),
    })

    page.drawText("de seguridad o corrupción. Esta es una versión de respaldo que", {
      x: 50,
      y: height - 310,
      size: 10,
      font: font,
      color: rgb(0.5, 0, 0),
    })

    page.drawText("confirma la firma digital del trabajador.", {
      x: 50,
      y: height - 330,
      size: 10,
      font: font,
      color: rgb(0.5, 0, 0),
    })

    // Área de firma
    page.drawText("Firma Digital:", {
      x: 50,
      y: height - 400,
      size: 12,
      font: boldFont,
      color: rgb(0, 0, 0),
    })

    // Si es una firma de imagen, intentar incrustarla
    if (signatureData.startsWith("data:image")) {
      try {
        const signatureImage = signatureData.split(",")[1]
        const signatureImageBytes = Buffer.from(signatureImage, "base64")
        const signatureImageEmbed = await pdfDoc.embedPng(signatureImageBytes)

        page.drawImage(signatureImageEmbed, {
          x: 50,
          y: height - 500,
          width: 200,
          height: 80,
        })
      } catch (imageError) {
        console.error("Error al incrustar imagen de firma:", imageError)
        // Si falla, usar texto
        page.drawText(signatureData.length > 100 ? "Firma digital aplicada" : signatureData, {
          x: 50,
          y: height - 450,
          size: 16,
          font: font,
          color: rgb(0, 0, 0.8),
        })
      }
    } else {
      // Firma de texto
      page.drawText(signatureData, {
        x: 50,
        y: height - 450,
        size: 16,
        font: font,
        color: rgb(0, 0, 0.8),
      })
    }

    // Línea de firma
    page.drawLine({
      start: { x: 50, y: height - 520 },
      end: { x: 300, y: height - 520 },
      thickness: 1,
      color: rgb(0, 0, 0),
    })

    // Información de validación
    page.drawText("Documento generado automáticamente por el sistema", {
      x: 50,
      y: height - 600,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    })

    page.drawText(`ID de verificación: ${Date.now()}`, {
      x: 50,
      y: height - 620,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    })

    const pdfBytes = await pdfDoc.save()
    console.log("PDF de respaldo creado exitosamente")

    return Buffer.from(pdfBytes)
  } catch (error) {
    console.error("Error al crear PDF de respaldo:", error)
    throw new Error("No se pudo crear el documento de respaldo")
  }
}

// Función para procesar PDF con múltiples intentos
async function processPdfWithSignature(
  pdfBytes: Buffer,
  signatureData: string,
): Promise<{ success: boolean; pdfBuffer?: Buffer; usedFallback?: boolean; error?: string }> {
  console.log("=== INICIANDO PROCESAMIENTO DE PDF ===")
  console.log(`Tamaño del PDF: ${pdfBytes.length} bytes`)

  // Validar el PDF primero
  const validation = await validatePdfContent(pdfBytes)
  console.log("Resultado de validación:", validation)

  if (!validation.isValid) {
    return { success: false, error: validation.error || "PDF no válido" }
  }

  if (!validation.canProcess) {
    console.log("PDF válido pero no procesable, usando método de respaldo")
    return { success: false, error: "PDF no procesable", usedFallback: true }
  }

  // Intentar procesar el PDF con diferentes métodos
  const methods = [
    { name: "Normal", options: {} },
    { name: "IgnoreEncryption", options: { ignoreEncryption: true } },
    { name: "UpdateMetadata", options: { ignoreEncryption: true, updateMetadata: false } },
  ]

  for (const method of methods) {
    try {
      console.log(`Intentando método: ${method.name}`)

      const pdfDoc = await PDFDocument.load(pdfBytes, method.options)
      console.log(`PDF cargado exitosamente con método: ${method.name}`)
      console.log(`Páginas: ${pdfDoc.getPageCount()}`)

      // Obtener la última página
      const pages = pdfDoc.getPages()
      const lastPage = pages[pages.length - 1]
      const { width, height } = lastPage.getSize()

      console.log(`Dimensiones de la página: ${width}x${height}`)

      // Procesar la firma
      if (signatureData.startsWith("data:image")) {
        // Firma de imagen
        try {
          const signatureImage = signatureData.split(",")[1]
          if (!signatureImage) {
            throw new Error("Datos de imagen de firma inválidos")
          }

          const signatureImageBytes = Buffer.from(signatureImage, "base64")
          const signatureImageEmbed = await pdfDoc.embedPng(signatureImageBytes)

          // Posicionar la firma
          const signatureWidth = 150
          const signatureHeight = 60
          const signatureX = width * 0.7
          const signatureY = height * 0.52

          lastPage.drawImage(signatureImageEmbed, {
            x: signatureX,
            y: signatureY,
            width: signatureWidth,
            height: signatureHeight,
          })

          console.log("Firma de imagen añadida exitosamente")
        } catch (imageError) {
          console.error("Error con firma de imagen, usando texto:", imageError)
          // Fallback a texto
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
          lastPage.drawText("Firma Digital Aplicada", {
            x: width * 0.7,
            y: height * 0.52,
            size: 12,
            font: font,
            color: rgb(0, 0, 0.8),
          })
        }
      } else {
        // Firma de texto
        try {
          const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
          lastPage.drawText(signatureData, {
            x: width * 0.7,
            y: height * 0.52,
            size: 14,
            font: font,
            color: rgb(0, 0, 0.8),
          })

          console.log("Firma de texto añadida exitosamente")
        } catch (textError) {
          console.error("Error con firma de texto:", textError)
          throw textError
        }
      }

      // Guardar el PDF
      const signedPdfBytes = await pdfDoc.save()
      console.log(`PDF firmado generado exitosamente con método: ${method.name}`)
      console.log(`Tamaño final: ${signedPdfBytes.byteLength} bytes`)

      return { success: true, pdfBuffer: Buffer.from(signedPdfBytes), usedFallback: false }
    } catch (error) {
      console.error(`Error con método ${method.name}:`, error)
      continue
    }
  }

  console.log("Todos los métodos fallaron, el PDF necesita respaldo")
  return { success: false, error: "No se pudo procesar el PDF con ningún método", usedFallback: true }
}

// Función para subir un documento
export async function uploadDocument(formData: FormData) {
  try {
    // Asegurar que la base de datos tenga la zona horaria correcta
    await initializeDatabase()

    // Obtener usuario actual (admin)
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return { success: false, error: "No se pudo verificar la sesión. Por favor, inicie sesión nuevamente." }
    }

    // Verificar si el usuario es administrador
    if (currentUser.role !== "admin") {
      return { success: false, error: "No tiene permisos para realizar esta acción" }
    }

    // Obtener datos del formulario
    const title = formData.get("title") as string
    const description = formData.get("description") as string
    const workerId = formData.get("workerId") as string
    const file = formData.get("file") as File

    // Validar datos
    documentSchema.parse({ title, description, workerId })

    if (!file) {
      return { success: false, error: "No se ha proporcionado ningún archivo" }
    }

    // Verificar que el archivo es un PDF
    if (file.type !== "application/pdf") {
      return { success: false, error: "El archivo debe ser un PDF" }
    }

    // Verificar que el trabajador existe
    const workers = await query("SELECT id FROM users WHERE id = ? AND role = 'worker'", [workerId])

    if ((workers as any[]).length === 0) {
      return { success: false, error: "El trabajador seleccionado no existe" }
    }

    // Generar nombre de archivo único
    const timestamp = Date.now()
    const fileName = `document_${timestamp}_${file.name.replace(/\s+/g, "_")}`

    // Convertir el archivo a ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Validar el PDF
    const validation = await validatePdfContent(buffer)
    if (!validation.isValid) {
      return { success: false, error: validation.error || "El archivo PDF no es válido" }
    }

    let filePath = ""

    if (isVercelProduction()) {
      // En Vercel, guardar el contenido del archivo en la base de datos
      const base64Content = buffer.toString("base64")

      // Insertar el contenido del archivo en la tabla document_files
      await query("INSERT INTO document_files (file_name, content_type, content) VALUES (?, ?, ?)", [
        fileName,
        "application/pdf",
        base64Content,
      ])

      // Obtener el ID del archivo recién insertado
      const fileResult = await query(
        "SELECT id FROM document_files WHERE file_name = ? ORDER BY created_at DESC LIMIT 1",
        [fileName],
      )

      if ((fileResult as any[]).length === 0) {
        return { success: false, error: "Error al guardar el archivo" }
      }

      const fileId = (fileResult as any[])[0].id
      filePath = `/api/document-files/${fileId}`
    } else {
      // En desarrollo local, guardar el archivo en el sistema de archivos
      const uploadsDir = path.join(process.cwd(), "public", "uploads", "documents")
      await mkdir(uploadsDir, { recursive: true })

      const localFilePath = path.join(uploadsDir, fileName)
      await writeFile(localFilePath, buffer)
      filePath = `/uploads/documents/${fileName}`
    }

    // Guardar documento en la base de datos usando NOW() con la zona horaria ya configurada
    await query(
      `INSERT INTO documents 
       (title, description, file_path, status, admin_id, worker_id, created_at, updated_at) 
       VALUES (?, ?, ?, 'pending', ?, ?, NOW(), NOW())`,
      [title, description || null, filePath, currentUser.id, workerId],
    )

    // Verificar que se guardó correctamente
    const [timeCheck] = (await query("SELECT NOW() as server_time")) as any[]
    console.log(`Documento creado a las: ${timeCheck.server_time}`)

    revalidatePath("/dashboard?tab=documents")
    return { success: true }
  } catch (error) {
    console.error("Error al subir documento:", error)
    return handleServerError(error)
  }
}

// Función para obtener documentos (para administradores)
export async function getDocuments() {
  try {
    // Asegurar que la base de datos tenga la zona horaria correcta
    await initializeDatabase()

    // Obtener usuario actual
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return []
    }

    // Verificar si el usuario es administrador
    if (currentUser.role !== "admin") {
      return []
    }

    // Obtener documentos
    const documents = await query(
      `SELECT 
    d.id, 
    d.title, 
    d.description, 
    d.file_path, 
    d.status, 
    d.admin_id, 
    d.worker_id, 
    d.created_at, 
    d.updated_at,
    u.name as worker_name,
    ds.signed_file_path,
    ds.signed_at
  FROM documents d
  JOIN users u ON d.worker_id = u.id
  LEFT JOIN document_signatures ds ON d.id = ds.document_id
  WHERE d.admin_id = ?
  ORDER BY d.created_at DESC`,
      [currentUser.id],
    )

    console.log("Documentos obtenidos:", documents)

    // Transformar resultados con mejor manejo de valores undefined
    return (documents as any[]).map((doc) => {
      console.log(`Procesando documento:`, doc)
      console.log(`Tipo de admin_id: ${typeof doc.admin_id}`)
      console.log(`Tipo de worker_id: ${typeof doc.worker_id}`)

      return {
        id: doc.id?.toString() || "",
        title: doc.title || "",
        description: doc.description || null,
        fileUrl: doc.file_path || "",
        signedFileUrl: doc.signed_file_path || null,
        status: doc.status || "pending",
        adminId: doc.admin_id?.toString() || "",
        workerId: doc.worker_id?.toString() || "",
        workerName: doc.worker_name || "",
        createdAt: doc.created_at || null,
        updatedAt: doc.updated_at || null,
        signedAt: doc.signed_at || null,
      }
    })
  } catch (error) {
    console.error("Error al obtener documentos:", error)
    return []
  }
}

// Función para obtener documentos pendientes de firma (para trabajadores)
export async function getPendingDocuments() {
  try {
    // Asegurar que la base de datos tenga la zona horaria correcta
    await initializeDatabase()

    // Obtener usuario actual
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return []
    }

    console.log(`Obteniendo documentos pendientes para trabajador ID: ${currentUser.id}`)

    // Obtener documentos pendientes
    const documents = await query(
      `SELECT 
    d.id, 
    d.title, 
    d.description, 
    d.file_path, 
    d.status, 
    d.created_at, 
    d.updated_at
  FROM documents d
  WHERE d.worker_id = ? AND d.status = 'pending'
  ORDER BY d.created_at DESC`,
      [currentUser.id],
    )

    console.log(`Documentos pendientes encontrados: ${(documents as any[]).length}`)

    // Transformar resultados con mejor manejo de fechas
    return (documents as any[]).map((doc) => ({
      id: doc.id.toString(),
      title: doc.title,
      description: doc.description,
      fileUrl: `/api/documents/${doc.id}/view`, // Usar la API para servir el documento
      status: doc.status,
      createdAt: doc.created_at ? new Date(doc.created_at).toISOString() : null,
      updatedAt: doc.updated_at ? new Date(doc.updated_at).toISOString() : null,
    }))
  } catch (error) {
    console.error("Error al obtener documentos pendientes:", error)
    return []
  }
}

// Función para obtener documentos firmados (para trabajadores) - SIEMPRE DESDE BD
export async function getSignedDocuments() {
  try {
    console.log("🗄️ === CONECTANDO A BASE DE DATOS PARA DOCUMENTOS FIRMADOS ===")

    // Asegurar que la base de datos tenga la zona horaria correcta
    await initializeDatabase()

    // Obtener usuario actual
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      console.log("❌ Usuario no autenticado")
      return []
    }

    console.log(`👤 Obteniendo documentos firmados para trabajador ID: ${currentUser.id}`)

    // CONSULTA DIRECTA A LA BASE DE DATOS - SIN CACHÉ
    const documents = await query(
      `SELECT 
        d.id, 
        d.title, 
        d.description, 
        d.file_path,
        d.status, 
        d.created_at, 
        d.updated_at,
        ds.signed_file_path,
        ds.signed_at
      FROM documents d
      INNER JOIN document_signatures ds ON d.id = ds.document_id
      WHERE d.worker_id = ? AND d.status = 'signed'
      ORDER BY ds.signed_at DESC`,
      [currentUser.id],
    )

    console.log(`📊 Documentos firmados encontrados en BD: ${(documents as any[]).length}`)

    // Transformar resultados con información completa
    const result = (documents as any[]).map((doc) => {
      console.log(`📄 Procesando documento firmado desde BD:`)
      console.log(`   ID: ${doc.id}`)
      console.log(`   Título: ${doc.title}`)
      console.log(`   Estado: ${doc.status}`)
      console.log(`   Archivo original: ${doc.file_path}`)
      console.log(`   Archivo firmado: ${doc.signed_file_path}`)
      console.log(`   Fecha firma: ${doc.signed_at}`)

      return {
        id: doc.id.toString(),
        title: doc.title,
        description: doc.description,
        fileUrl: `/api/documents/${doc.id}/view`, // Esta API ya maneja mostrar el firmado
        status: doc.status,
        createdAt: doc.created_at ? new Date(doc.created_at).toISOString() : null,
        updatedAt: doc.updated_at ? new Date(doc.updated_at).toISOString() : null,
        signedAt: doc.signed_at ? new Date(doc.signed_at).toISOString() : null,
        signedFilePath: doc.signed_file_path,
        originalFilePath: doc.file_path,
      }
    })

    console.log("✅ Documentos firmados cargados exitosamente desde BD")
    return result
  } catch (error) {
    console.error("❌ Error al obtener documentos firmados desde BD:", error)
    return []
  }
}

// Función para obtener la firma de un trabajador
export async function getWorkerSignature() {
  try {
    // Obtener usuario actual
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: "Usuario no autenticado" }
    }

    // Obtener firma
    const signatures = await query(
      "SELECT signature_data FROM worker_signatures WHERE worker_id = ? ORDER BY updated_at DESC LIMIT 1",
      [currentUser.id],
    )

    if ((signatures as any[]).length === 0) {
      return { success: true, signature: null }
    }

    return { success: true, signature: (signatures as any[])[0].signature_data }
  } catch (error) {
    console.error("Error al obtener firma:", error)
    return { success: false, error: "Error al obtener la firma" }
  }
}

// Función para guardar la firma de un trabajador
export async function saveWorkerSignature(signatureData: string) {
  try {
    // Asegurar que la base de datos tenga la zona horaria correcta
    await initializeDatabase()

    // Obtener usuario actual
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: "Usuario no autenticado" }
    }

    // Verificar si ya existe una firma
    const existingSignatures = await query("SELECT id FROM worker_signatures WHERE worker_id = ?", [currentUser.id])

    if ((existingSignatures as any[]).length > 0) {
      // Actualizar firma existente
      await query("UPDATE worker_signatures SET signature_data = ?, updated_at = NOW() WHERE worker_id = ?", [
        signatureData,
        currentUser.id,
      ])
    } else {
      // Crear nueva firma
      await query("INSERT INTO worker_signatures (worker_id, signature_data) VALUES (?, ?)", [
        currentUser.id,
        signatureData,
      ])
    }

    return { success: true }
  } catch (error) {
    console.error("Error al guardar firma:", error)
    return { success: false, error: "Error al guardar la firma" }
  }
}

// Función para obtener el contenido de un archivo PDF
async function getPdfContent(filePath: string) {
  console.log(`Obteniendo contenido del PDF desde: ${filePath}`)

  if (!filePath) {
    throw new Error("Ruta de archivo no proporcionada")
  }

  // Si la ruta comienza con /api/document-files/, es un archivo almacenado en la base de datos
  if (filePath.startsWith("/api/document-files/")) {
    const fileId = filePath.split("/").pop()
    console.log(`Obteniendo archivo de la base de datos con ID: ${fileId}`)

    if (!fileId) {
      throw new Error("ID de archivo no válido")
    }

    // Obtener el contenido del archivo desde la base de datos
    const files = await query("SELECT content FROM document_files WHERE id = ?", [fileId])

    if ((files as any[]).length === 0) {
      throw new Error("Archivo no encontrado en la base de datos")
    }

    // Convertir el contenido base64 a Buffer
    return Buffer.from((files as any[])[0].content, "base64")
  } else {
    // Es un archivo en el sistema de archivos
    const fullPath = path.join(process.cwd(), "public", filePath)
    console.log(`Obteniendo archivo del sistema de archivos: ${fullPath}`)

    // Verificar que el archivo existe
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Archivo no encontrado en la ruta: ${fullPath}`)
    }

    return await readFile(fullPath)
  }
}

// Función mejorada para guardar un PDF firmado
async function savePdfContent(fileName: string, content: Buffer) {
  console.log(`💾 Guardando PDF firmado: ${fileName}`)
  console.log(`🌍 Entorno detectado: ${isVercelProduction() ? "Vercel/Producción" : "Local/Desarrollo"}`)

  if (isVercelProduction()) {
    // En Vercel, guardar en la base de datos
    console.log("📊 Guardando en la base de datos (entorno Vercel)")
    const base64Content = content.toString("base64")

    try {
      // Insertar en la tabla document_files
      await query("INSERT INTO document_files (file_name, content_type, content) VALUES (?, ?, ?)", [
        fileName,
        "application/pdf",
        base64Content,
      ])

      // Obtener el ID del archivo recién insertado
      const fileResult = await query(
        "SELECT id FROM document_files WHERE file_name = ? ORDER BY created_at DESC LIMIT 1",
        [fileName],
      )

      if ((fileResult as any[]).length === 0) {
        throw new Error("Error al guardar el archivo firmado en la base de datos")
      }

      const fileId = (fileResult as any[])[0].id
      const filePath = `/api/document-files/${fileId}`

      // VERIFICACIÓN CRÍTICA: Confirmar que el archivo se guardó
      const verification = await query("SELECT id, file_name FROM document_files WHERE id = ?", [fileId])
      if ((verification as any[]).length === 0) {
        throw new Error("Error en la verificación del archivo guardado")
      }

      console.log(`✅ Archivo guardado en la base de datos`)
      console.log(`   - ID: ${fileId}`)
      console.log(`   - Ruta: ${filePath}`)
      console.log(`   - Tamaño: ${content.length} bytes`)

      return filePath
    } catch (dbError) {
      console.error("❌ Error al guardar en la base de datos:", dbError)
      throw new Error(`Error al guardar el archivo firmado: ${dbError.message}`)
    }
  } else {
    // En desarrollo local, guardar en el sistema de archivos
    console.log("💿 Guardando en el sistema de archivos (entorno local)")

    try {
      const signedDir = path.join(process.cwd(), "public", "uploads", "signed")
      await mkdir(signedDir, { recursive: true })

      const filePath = path.join(signedDir, fileName)
      await writeFile(filePath, content)
      const relativePath = `/uploads/signed/${fileName}`

      // VERIFICACIÓN CRÍTICA: Confirmar que el archivo se guardó
      if (!fs.existsSync(filePath)) {
        throw new Error("El archivo no se guardó correctamente en el sistema de archivos")
      }

      console.log(`✅ Archivo guardado en el sistema de archivos`)
      console.log(`   - Ruta completa: ${filePath}`)
      console.log(`   - Ruta relativa: ${relativePath}`)
      console.log(`   - Tamaño: ${content.length} bytes`)

      return relativePath
    } catch (fsError) {
      console.error("❌ Error al guardar en el sistema de archivos:", fsError)
      throw new Error(`Error al guardar el archivo firmado: ${fsError.message}`)
    }
  }
}

// Función para firmar un documento - CORREGIDA Y MEJORADA
export async function signDocument(documentId: string, signatureData: string) {
  try {
    // Asegurar que la base de datos tenga la zona horaria correcta
    await initializeDatabase()

    console.log(`=== INICIANDO PROCESO DE FIRMA ROBUSTO ===`)
    console.log(`Documento ID: ${documentId}`)

    // Obtener usuario actual
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: "Usuario no autenticado" }
    }

    console.log(`Usuario: ${currentUser.name} (ID: ${currentUser.id})`)

    // Verificar que el documento existe y pertenece al trabajador
    const documents = await query("SELECT id, file_path, title, status FROM documents WHERE id = ? AND worker_id = ?", [
      documentId,
      currentUser.id,
    ])

    if ((documents as any[]).length === 0) {
      return { success: false, error: "Documento no encontrado" }
    }

    const document = (documents as any[])[0]
    console.log(`Documento encontrado: ${document.title}`)
    console.log(`Estado actual: ${document.status}`)
    console.log(`Ruta archivo original: ${document.file_path}`)

    // Obtener la firma del trabajador o usar la proporcionada
    let signatureToUse = signatureData

    // Si no se proporciona una firma específica, intentar obtener la guardada
    if (!signatureData || (!signatureData.startsWith("data:image") && signatureData.length < 3)) {
      const signatures = await query(
        "SELECT id, signature_data FROM worker_signatures WHERE worker_id = ? ORDER BY updated_at DESC LIMIT 1",
        [currentUser.id],
      )

      if ((signatures as any[]).length === 0) {
        return { success: false, error: "No tiene una firma registrada" }
      }

      signatureToUse = (signatures as any[])[0].signature_data
    }

    // Validar que tenemos una firma válida
    if (!signatureToUse || signatureToUse.length < 2) {
      return { success: false, error: "Firma inválida o vacía" }
    }

    let pdfBytes: Buffer
    let processResult: { success: boolean; pdfBuffer?: Buffer; usedFallback?: boolean; error?: string }
    let usedFallback = false

    try {
      // Obtener el contenido del PDF original
      pdfBytes = await getPdfContent(document.file_path)
      console.log(`PDF original obtenido correctamente, tamaño: ${pdfBytes.length} bytes`)

      // Intentar procesar el PDF
      processResult = await processPdfWithSignature(pdfBytes, signatureToUse)

      if (!processResult.success && processResult.usedFallback) {
        console.log("Usando método de respaldo para crear PDF firmado")
        usedFallback = true

        // Crear PDF de respaldo
        const fallbackPdf = await createFallbackPdf(document.title, signatureToUse, currentUser.name)
        processResult = { success: true, pdfBuffer: fallbackPdf, usedFallback: true }
      }
    } catch (error) {
      console.error("Error al obtener o procesar el PDF original:", error)
      console.log("Creando PDF de respaldo debido a error en el archivo original")
      usedFallback = true

      try {
        const fallbackPdf = await createFallbackPdf(document.title, signatureToUse, currentUser.name)
        processResult = { success: true, pdfBuffer: fallbackPdf, usedFallback: true }
      } catch (fallbackError) {
        console.error("Error al crear PDF de respaldo:", fallbackError)
        return { success: false, error: "No se pudo procesar el documento ni crear una versión de respaldo" }
      }
    }

    if (!processResult.success || !processResult.pdfBuffer) {
      return { success: false, error: processResult.error || "Error al procesar el documento" }
    }

    console.log(`PDF procesado exitosamente. Método de respaldo usado: ${usedFallback}`)

    // Generar nombre de archivo para el documento firmado
    const timestamp = Date.now()
    const prefix = usedFallback ? "fallback_signed" : "signed"
    const fileName = `${prefix}_${timestamp}_${document.title.replace(/\s+/g, "_")}.pdf`

    // Guardar el PDF firmado usando la función mejorada
    let signedFilePath: string
    try {
      signedFilePath = await savePdfContent(fileName, processResult.pdfBuffer)
      console.log(`✅ Documento firmado guardado en: ${signedFilePath}`)
    } catch (saveError) {
      console.error("❌ Error al guardar el PDF firmado:", saveError)
      return { success: false, error: `Error al guardar el documento firmado: ${saveError.message}` }
    }

    // TRANSACCIÓN MEJORADA PARA ACTUALIZAR BASE DE DATOS
    try {
      console.log(`=== INICIANDO TRANSACCIÓN DE BASE DE DATOS ===`)
      console.log(`📁 Ruta del archivo firmado a guardar: ${signedFilePath}`)

      // Obtener o crear la firma del trabajador
      let signatureId: number
      const workerSignatures = await query(
        "SELECT id FROM worker_signatures WHERE worker_id = ? ORDER BY updated_at DESC LIMIT 1",
        [currentUser.id],
      )

      if ((workerSignatures as any[]).length === 0) {
        // Crear nueva firma
        console.log("🆕 Creando nueva firma de trabajador...")
        await query("INSERT INTO worker_signatures (worker_id, signature_data) VALUES (?, ?)", [
          currentUser.id,
          signatureToUse,
        ])

        const newSignatures = await query(
          "SELECT id FROM worker_signatures WHERE worker_id = ? ORDER BY updated_at DESC LIMIT 1",
          [currentUser.id],
        )

        if ((newSignatures as any[]).length === 0) {
          return { success: false, error: "Error al guardar la firma" }
        }

        signatureId = (newSignatures as any[])[0].id
        console.log(`✅ Nueva firma creada con ID: ${signatureId}`)
      } else {
        signatureId = (workerSignatures as any[])[0].id
        console.log(`✅ Usando firma existente con ID: ${signatureId}`)
      }

      // Verificar si ya existe una firma para este documento
      const existingSignatures = await query("SELECT id FROM document_signatures WHERE document_id = ?", [document.id])

      if ((existingSignatures as any[]).length > 0) {
        // Actualizar la firma existente
        console.log("🔄 Actualizando firma existente...")
        await query(
          "UPDATE document_signatures SET worker_id = ?, signature_id = ?, signed_file_path = ?, signed_at = NOW() WHERE document_id = ?",
          [currentUser.id, signatureId, signedFilePath, document.id],
        )
        console.log(`✅ Firma actualizada con ruta: ${signedFilePath}`)
      } else {
        // Insertar nueva firma
        console.log("🆕 Insertando nueva firma...")
        await query(
          "INSERT INTO document_signatures (document_id, worker_id, signature_id, signed_file_path, signed_at) VALUES (?, ?, ?, ?, NOW())",
          [document.id, currentUser.id, signatureId, signedFilePath],
        )
        console.log(`✅ Nueva firma insertada con ruta: ${signedFilePath}`)
      }

      // CRÍTICO: Actualizar el estado del documento a 'signed'
      console.log("=== ACTUALIZANDO ESTADO DEL DOCUMENTO ===")
      const updateResult = await query("UPDATE documents SET status = 'signed', updated_at = NOW() WHERE id = ?", [
        document.id,
      ])
      console.log(`✅ Estado del documento actualizado:`, updateResult)

      // VERIFICACIÓN CRÍTICA: Confirmar que todo se guardó correctamente
      const finalVerification = await query(
        `SELECT 
          d.id, 
          d.status, 
          ds.signed_file_path,
          ds.signed_at
        FROM documents d 
        INNER JOIN document_signatures ds ON d.id = ds.document_id 
        WHERE d.id = ?`,
        [document.id],
      )

      if ((finalVerification as any[]).length === 0) {
        console.error("❌ ERROR: No se encontró el documento firmado en la verificación final")
        return { success: false, error: "Error en la verificación final del documento" }
      }

      const verifiedDoc = (finalVerification as any[])[0]
      console.log(`=== VERIFICACIÓN FINAL COMPLETA ===`)
      console.log(`📄 Documento ID: ${verifiedDoc.id}`)
      console.log(`📊 Estado final: ${verifiedDoc.status}`)
      console.log(`📁 Archivo firmado: ${verifiedDoc.signed_file_path}`)
      console.log(`📅 Fecha de firma: ${verifiedDoc.signed_at}`)
      console.log(`🔧 Método de respaldo usado: ${usedFallback}`)

      if (verifiedDoc.status !== "signed" || !verifiedDoc.signed_file_path) {
        console.error("❌ ERROR: La verificación final falló")
        console.error(`   - Estado: ${verifiedDoc.status} (esperado: signed)`)
        console.error(`   - Archivo firmado: ${verifiedDoc.signed_file_path} (esperado: ruta válida)`)
        return { success: false, error: "Error en la verificación final del documento" }
      }

      // Verificar que la ruta del archivo firmado es accesible
      try {
        if (verifiedDoc.signed_file_path.startsWith("/api/document-files/")) {
          const fileId = verifiedDoc.signed_file_path.split("/").pop()
          const fileCheck = await query("SELECT id FROM document_files WHERE id = ?", [fileId])
          if ((fileCheck as any[]).length === 0) {
            console.error("❌ ERROR: El archivo firmado no existe en la base de datos")
            return { success: false, error: "El archivo firmado no se guardó correctamente en la base de datos" }
          }
          console.log(`✅ Archivo firmado verificado en BD: ID ${fileId}`)
        } else {
          const fullPath = path.join(process.cwd(), "public", verifiedDoc.signed_file_path)
          if (!fs.existsSync(fullPath)) {
            console.error("❌ ERROR: El archivo firmado no existe en el sistema de archivos")
            return { success: false, error: "El archivo firmado no se guardó correctamente en el sistema de archivos" }
          }
          console.log(`✅ Archivo firmado verificado en filesystem: ${fullPath}`)
        }
      } catch (verifyError) {
        console.error("❌ Error al verificar el archivo firmado:", verifyError)
        return { success: false, error: "Error al verificar que el archivo firmado se guardó correctamente" }
      }

      // Revalidar rutas para forzar actualización
      revalidatePath("/dashboard")
      revalidatePath("/dashboard?tab=documents")
      revalidatePath(`/api/documents/${documentId}/view`)
      revalidatePath(`/api/documents/${documentId}/download`)

      console.log("🎉 === PROCESO DE FIRMA COMPLETADO EXITOSAMENTE ===")
      return {
        success: true,
        documentId: document.id,
        usedFallback: usedFallback,
        signedFilePath: verifiedDoc.signed_file_path,
        message: usedFallback
          ? "Documento firmado usando método de respaldo debido a restricciones del archivo original"
          : "Documento firmado correctamente",
      }
    } catch (dbError) {
      console.error("❌ Error en operaciones de base de datos:", dbError)
      return { success: false, error: `Error al registrar la firma en la base de datos: ${dbError.message}` }
    }
  } catch (error) {
    console.error("Error general al firmar documento:", error)
    return { success: false, error: "Error inesperado al firmar el documento" }
  }
}

// Función para descargar un documento
export async function downloadDocument(documentId: string) {
  try {
    // Obtener usuario actual
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: "Usuario no autenticado" }
    }

    // Verificar si es admin o trabajador
    const isUserAdmin = currentUser.role === "admin"

    let sqlQuery = `
      SELECT 
        d.id, 
        d.title, 
        d.file_path as filePath,
        d.status,
        ds.signed_file_path as signedFilePath
      FROM documents d
      LEFT JOIN document_signatures ds ON d.id = ds.document_id
      WHERE d.id = ?
    `

    // Si es trabajador, verificar que el documento le pertenece
    if (!isUserAdmin) {
      sqlQuery += " AND d.worker_id = ?"
    }

    const documents = await query(sqlQuery, isUserAdmin ? [documentId] : [documentId, currentUser.id])

    if ((documents as any[]).length === 0) {
      return { success: false, error: "Documento no encontrado" }
    }

    const document = (documents as any[])[0]

    // Usar la API para servir el documento
    const fileUrl = `/api/documents/${documentId}/download?t=${Date.now()}`

    return { success: true, fileUrl }
  } catch (error) {
    console.error("Error al descargar documento:", error)
    return { success: false, error: "Error al descargar el documento" }
  }
}

// Función para eliminar un documento (solo administradores)
export async function deleteDocument(documentId: string) {
  try {
    // Asegurar que la base de datos tenga la zona horaria correcta
    await initializeDatabase()

    // Obtener usuario actual
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return { success: false, error: "Usuario no autenticado" }
    }

    // Verificar si el usuario es administrador
    if (currentUser.role !== "admin") {
      return { success: false, error: "No tiene permisos para realizar esta acción" }
    }

    console.log(`=== ELIMINANDO DOCUMENTO ===`)
    console.log(`Documento ID: ${documentId}`)
    console.log(`Admin ID: ${currentUser.id}`)

    // Verificar que el documento existe y pertenece al administrador
    const documents = await query("SELECT id, file_path, title FROM documents WHERE id = ? AND admin_id = ?", [
      documentId,
      currentUser.id,
    ])

    if ((documents as any[]).length === 0) {
      return { success: false, error: "Documento no encontrado o no tiene permisos para eliminarlo" }
    }

    const document = (documents as any[])[0]
    console.log(`Documento encontrado: ${document.title}`)

    // Eliminar las firmas asociadas al documento
    await query("DELETE FROM document_signatures WHERE document_id = ?", [documentId])
    console.log("Firmas del documento eliminadas")

    // Eliminar el documento
    await query("DELETE FROM documents WHERE id = ?", [documentId])
    console.log("Documento eliminado de la base de datos")

    // Si el archivo está almacenado en el sistema de archivos local, intentar eliminarlo
    if (!isVercelProduction() && document.file_path && !document.file_path.startsWith("/api/")) {
      try {
        const fullPath = path.join(process.cwd(), "public", document.file_path)
        if (fs.existsSync(fullPath)) {
          await fs.promises.unlink(fullPath)
          console.log("Archivo físico eliminado")
        }
      } catch (fileError) {
        console.error("Error al eliminar archivo físico:", fileError)
        // No fallar la operación si no se puede eliminar el archivo físico
      }
    }

    // Si el archivo está en la base de datos (Vercel), eliminarlo también
    if (document.file_path && document.file_path.startsWith("/api/document-files/")) {
      try {
        const fileId = document.file_path.split("/").pop()
        if (fileId) {
          await query("DELETE FROM document_files WHERE id = ?", [fileId])
          console.log("Archivo eliminado de la base de datos")
        }
      } catch (dbFileError) {
        console.error("Error al eliminar archivo de la base de datos:", dbFileError)
        // No fallar la operación si no se puede eliminar el archivo de la DB
      }
    }

    revalidatePath("/dashboard?tab=documents")
    console.log("=== DOCUMENTO ELIMINADO EXITOSAMENTE ===")

    return { success: true }
  } catch (error) {
    console.error("Error al eliminar documento:", error)
    return handleServerError(error)
  }
}

// Nueva función para verificar el estado de un documento - CORREGIDA
export async function checkDocumentStatus(documentId: string) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { success: false, error: "Usuario no autenticado" }
    }

    console.log(`=== VERIFICANDO ESTADO DEL DOCUMENTO ===`)
    console.log(`Documento ID: ${documentId}`)
    console.log(`Usuario ID: ${currentUser.id}`)

    const documents = await query(
      `SELECT 
        d.id, 
        d.status,
        ds.signed_file_path,
        ds.signed_at
      FROM documents d
      LEFT JOIN document_signatures ds ON d.id = ds.document_id
      WHERE d.id = ? AND d.worker_id = ?`,
      [documentId, currentUser.id],
    )

    if ((documents as any[]).length === 0) {
      console.log("Documento no encontrado")
      return { success: false, error: "Documento no encontrado" }
    }

    const document = (documents as any[])[0]
    console.log(`Estado actual: ${document.status}`)
    console.log(`Archivo firmado: ${document.signed_file_path || "No disponible"}`)
    console.log(`Fecha firma: ${document.signed_at || "No disponible"}`)

    return {
      success: true,
      status: document.status,
      hasSignedFile: !!document.signed_file_path,
      signedAt: document.signed_at,
    }
  } catch (error) {
    console.error("Error al verificar estado del documento:", error)
    return { success: false, error: "Error al verificar estado del documento" }
  }
}
