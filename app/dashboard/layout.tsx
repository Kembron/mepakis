import type { ReactNode } from "react"
import { initializeDatabase } from "@/lib/db"

// Inicializar la base de datos al cargar el dashboard
initializeDatabase()
  .then(() => {
    console.log("Base de datos inicializada con zona horaria de Uruguay (UTC-3)")
  })
  .catch((error) => {
    console.error("Error al inicializar la base de datos:", error)
  })

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className="dashboard-layout">{children}</div>
}
