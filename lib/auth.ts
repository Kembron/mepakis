import { cookies } from "next/headers"
import { query } from "@/lib/db"

// Tipo para el usuario
interface User {
  id: string
  name: string
  email: string
  role: string
}

// Tipo para la sesión
interface Session {
  user: User
}

// Función para obtener la sesión actual
export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")

    if (!sessionCookie || !sessionCookie.value) {
      console.log("No se encontró cookie de sesión")
      return null
    }

    let sessionData: Session
    try {
      // Añadir verificación adicional para asegurar que la cookie no está vacía
      if (sessionCookie.value.trim() === "") {
        console.error("Cookie de sesión vacía")
        return null
      }

      // Decodificar y parsear la cookie
      const decodedValue = atob(sessionCookie.value)
      console.log("Valor decodificado de la cookie:", decodedValue)

      sessionData = JSON.parse(decodedValue)
    } catch (error) {
      console.error("Error al decodificar la sesión:", error)
      // Eliminar la cookie corrupta
      cookieStore.delete("session")
      return null
    }

    if (!sessionData || !sessionData.user || !sessionData.user.id) {
      console.error("Datos de sesión inválidos:", sessionData)
      cookieStore.delete("session")
      return null
    }

    // Verificar que el usuario existe en la base de datos
    const users = await query("SELECT id, name, email, role FROM users WHERE id = ?", [sessionData.user.id])

    if ((users as any[]).length === 0) {
      console.error("Usuario de sesión no encontrado en la base de datos:", sessionData.user.id)
      cookieStore.delete("session")
      return null
    }

    // Devolver la sesión
    return sessionData
  } catch (error) {
    console.error("Error al obtener la sesión:", error)
    return null
  }
}

// Función para crear una sesión
export async function createSession(user: User): Promise<boolean> {
  try {
    // Crear objeto de sesión
    const session = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    }

    // Guardar sesión en cookie
    const sessionStr = btoa(JSON.stringify(session))
    console.log("Creando sesión:", sessionStr)

    const cookieStore = await cookies()
    cookieStore.set("session", sessionStr, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 semana
      path: "/",
    })

    return true
  } catch (error) {
    console.error("Error al crear la sesión:", error)
    return false
  }
}
