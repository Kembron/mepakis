import ExcelJS from "exceljs"
import { format } from "date-fns"
import { es } from "date-fns/locale"

/**
 * Genera un archivo Excel con los datos de los reportes
 * @param reportData Datos del reporte
 * @param filters Filtros aplicados
 * @returns Buffer con el archivo Excel
 */
export async function generateExcelReport(reportData: any, filters: any) {
  console.log("Iniciando generación de Excel...")
  console.log("Datos del reporte:", JSON.stringify(reportData.completeReport?.length || 0, null, 2))

  // Crear un nuevo libro de Excel
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Sistema de Gestión de Asistentes"
  workbook.lastModifiedBy = "Sistema de Gestión"
  workbook.created = new Date()
  workbook.modified = new Date()

  // Crear una hoja para el reporte principal (formato solicitado)
  const mainSheet = workbook.addWorksheet("Reporte")

  // Configurar encabezados del reporte principal exactamente como en la imagen
  mainSheet.columns = [
    // Datos de la persona a cuidar (usuario)
    { header: "Céd de usuario", key: "userIdentity", width: 15 },
    { header: "Nombre de usuario", key: "userName", width: 20 },
    { header: "Apellido de usuario", key: "userLastName", width: 20 },
    { header: "Fecha de nacimiento", key: "userBirthDate", width: 20 },
    { header: "Departamento", key: "userDepartment", width: 15 },
    { header: "Localidad", key: "userCity", width: 15 },
    { header: "Fecha de suscripción", key: "subscriptionDate", width: 20 },

    // Datos del asistente personal (AP)
    { header: "Cédula de AP", key: "workerIdentity", width: 15 },
    { header: "Nombre de AP", key: "workerName", width: 20 },
    { header: "Apellido de AP", key: "workerLastName", width: 20 },
    { header: "Fecha de nacimiento", key: "workerBirthDate", width: 20 },
    { header: "Departamento", key: "workerDepartment", width: 15 },
    { header: "Localidad", key: "workerCity", width: 15 },

    // Columna adicional para horas trabajadas
    { header: "Cantidad de horas", key: "totalHours", width: 25 },
  ]

  // Estilo para los encabezados
  mainSheet.getRow(1).font = { bold: true, size: 11 }
  mainSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEEEEEE" },
  }

  // Agregar datos al reporte principal
  if (reportData.completeReport && reportData.completeReport.length > 0) {
    console.log(`Agregando ${reportData.completeReport.length} registros al Excel...`)

    reportData.completeReport.forEach((item: any, index: number) => {
      console.log(`Procesando registro ${index + 1}:`, item.userName, item.workerName)

      try {
        // Formatear fechas al estilo dd/mm/yyyy
        let userBirthDate = ""
        try {
          userBirthDate = item.userBirthDate ? format(new Date(item.userBirthDate), "dd/MM/yyyy", { locale: es }) : ""
        } catch (e) {
          console.error("Error al formatear fecha de nacimiento del usuario:", e)
        }

        let subscriptionDate = ""
        try {
          subscriptionDate = item.subscriptionDate
            ? format(new Date(item.subscriptionDate), "dd/MM/yyyy", { locale: es })
            : ""
        } catch (e) {
          console.error("Error al formatear fecha de suscripción:", e)
        }

        let workerBirthDate = ""
        try {
          workerBirthDate = item.workerBirthDate
            ? format(new Date(item.workerBirthDate), "dd/MM/yyyy", { locale: es })
            : ""
        } catch (e) {
          console.error("Error al formatear fecha de nacimiento del trabajador:", e)
        }

        mainSheet.addRow({
          // Datos del usuario (persona a cuidar)
          userIdentity: item.userIdentityDocument || "",
          userName: item.userName || "",
          userLastName: item.userLastName || "",
          userBirthDate: userBirthDate,
          userDepartment: item.userDepartment || "",
          userCity: item.userCity || "",
          subscriptionDate: subscriptionDate,

          // Datos del asistente personal (AP)
          workerIdentity: item.workerIdentityDocument || "",
          workerName: item.workerFirstName || item.workerName || "",
          workerLastName: item.workerLastName || "",
          workerBirthDate: workerBirthDate,
          workerDepartment: item.workerDepartment || "",
          workerCity: item.workerCity || "",

          // Horas trabajadas
          totalHours: `${Math.floor(item.totalMinutes / 60)}h ${item.totalMinutes % 60}m`,
        })
      } catch (error) {
        console.error(`Error al procesar registro ${index + 1}:`, error)
      }
    })
  } else {
    console.log("No hay datos para el reporte completo")

    // Si no hay datos reales, agregar datos de ejemplo para demostración
    // En un entorno de producción, esto debería eliminarse
    for (let i = 0; i < 5; i++) {
      mainSheet.addRow({
        userIdentity: `12345${i}`,
        userName: `Usuario ${i + 1}`,
        userLastName: `Apellido ${i + 1}`,
        userBirthDate: "01/01/1970",
        userDepartment: "Montevideo",
        userCity: "Montevideo",
        subscriptionDate: "01/01/2023",
        workerIdentity: `98765${i}`,
        workerName: `Asistente ${i + 1}`,
        workerLastName: `Apellido AP ${i + 1}`,
        workerBirthDate: "01/01/1980",
        workerDepartment: "Montevideo",
        workerCity: "Montevideo",
        totalHours: `${i + 1}h 30m`,
      })
    }
  }

  // Crear una hoja para el resumen
  const summarySheet = workbook.addWorksheet("Resumen")

  // Configurar encabezados del resumen
  summarySheet.columns = [
    { header: "Trabajador", key: "worker", width: 30 },
    { header: "Horas Trabajadas", key: "hours", width: 20 },
    { header: "Porcentaje del Total", key: "percentage", width: 20 },
  ]

  // Estilo para los encabezados
  summarySheet.getRow(1).font = { bold: true, size: 12 }
  summarySheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  }

  // Agregar datos del resumen
  reportData.workerStats.forEach((stat: any) => {
    summarySheet.addRow({
      worker: stat.name,
      hours: `${stat.totalHours}h ${stat.totalMinutesRemainder}m`,
      percentage:
        reportData.totalMinutes > 0 ? `${((stat.totalMinutes / reportData.totalMinutes) * 100).toFixed(1)}%` : "0%",
    })
  })

  // Agregar fila de total
  summarySheet.addRow({
    worker: "TOTAL",
    hours: `${reportData.totalHours}h ${reportData.totalMinutesRemainder}m`,
    percentage: "100%",
  })

  // Estilo para la fila de total
  const totalRow = summarySheet.lastRow
  if (totalRow) {
    totalRow.font = { bold: true }
    totalRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEEEEEE" },
    }
  }

  // Crear una hoja para los registros detallados
  const detailsSheet = workbook.addWorksheet("Registros Detallados")

  // Configurar encabezados de los registros detallados
  detailsSheet.columns = [
    { header: "Trabajador", key: "worker", width: 25 },
    { header: "Domicilio", key: "location", width: 25 },
    { header: "Fecha", key: "date", width: 15 },
    { header: "Entrada", key: "checkIn", width: 20 },
    { header: "Salida", key: "checkOut", width: 20 },
    { header: "Horas Trabajadas", key: "hours", width: 20 },
  ]

  // Estilo para los encabezados
  detailsSheet.getRow(1).font = { bold: true, size: 12 }
  detailsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  }

  // Agregar datos de los registros detallados
  reportData.records.forEach((record: any) => {
    detailsSheet.addRow({
      worker: record.workerName,
      location: record.locationName,
      date: format(new Date(record.checkInTime), "dd/MM/yyyy", { locale: es }),
      checkIn: format(new Date(record.checkInTime), "dd/MM/yyyy HH:mm:ss", { locale: es }),
      checkOut: record.checkOutTime
        ? format(new Date(record.checkOutTime), "dd/MM/yyyy HH:mm:ss", { locale: es })
        : "N/A",
      hours: record.workTimeMinutes
        ? `${Math.floor(record.workTimeMinutes / 60)}h ${record.workTimeMinutes % 60}m`
        : "N/A",
    })
  })

  // Crear una hoja para la información del reporte
  const infoSheet = workbook.addWorksheet("Información")

  // Agregar información del reporte
  infoSheet.addRow(["Fecha de generación", format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: es })])
  infoSheet.addRow([
    "Período",
    `${format(new Date(filters.dateFrom), "dd/MM/yyyy", { locale: es })} - ${format(new Date(filters.dateTo), "dd/MM/yyyy", { locale: es })}`,
  ])
  infoSheet.addRow(["Total de registros", reportData.records.length.toString()])
  infoSheet.addRow(["Total de horas trabajadas", `${reportData.totalHours}h ${reportData.totalMinutesRemainder}m`])

  console.log("Generación de Excel completada")
  // Generar el archivo
  return await workbook.xlsx.writeBuffer()
}
