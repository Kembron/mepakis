import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import LoginForm from "@/components/login-form"

export default async function Home() {
  const session = await getSession()

  if (session) {
    redirect("/dashboard")
  }

  return (
    <main className="min-h-screen flex flex-col md:flex-row">
      {/* Sección izquierda - Imagen/Gradiente */}
      <div className="hidden md:flex md:w-1/2 gradient-bg items-center justify-center p-8">
        <div className="max-w-md text-white space-y-8 animate-fadeIn">
          <h1 className="text-4xl font-bold tracking-tight">Sistema de Gestión de Asistentes</h1>
          <p className="text-lg opacity-90 leading-relaxed">
            Plataforma integral para la gestión eficiente de asistentes, control de asistencia y generación de reportes.
          </p>
          <div className="grid grid-cols-2 gap-6 pt-6">
            <div className="bg-white/20 p-5 rounded-xl backdrop-blur-sm hover-scale">
              <h3 className="font-semibold text-xl">Control de Ubicación</h3>
              <p className="text-sm mt-2 opacity-90">
                Verificación de ubicación en tiempo real mediante geolocalización
              </p>
            </div>
            <div className="bg-white/20 p-5 rounded-xl backdrop-blur-sm hover-scale">
              <h3 className="font-semibold text-xl">Reportes Detallados</h3>
              <p className="text-sm mt-2 opacity-90">Generación de informes de horas trabajadas y asistencia</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sección derecha - Formulario de login */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 md:p-8 bg-gray-50">
        <div className="w-full max-w-md space-y-8 animate-fadeIn">
          <div className="text-center">
            <div className="inline-block p-3 bg-blue-100 rounded-full mb-5 animate-pulse-blue">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Bienvenido</h1>
            <p className="text-gray-600 mt-2">Inicie sesión para continuar</p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-lg hover-scale">
            <LoginForm />
          </div>

          {/* Mostrar características en móvil */}
          <div className="md:hidden mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-center text-gray-800">Características</h2>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="font-medium text-blue-800">Control de Ubicación</h3>
              <p className="text-sm mt-1 text-blue-700">
                Verificación de ubicación en tiempo real mediante geolocalización
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="font-medium text-blue-800">Reportes Detallados</h3>
              <p className="text-sm mt-1 text-blue-700">Generación de informes de horas trabajadas y asistencia</p>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">
            © {new Date().getFullYear()} Sistema de Gestión de Asistentes. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </main>
  )
}
