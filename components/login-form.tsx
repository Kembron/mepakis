"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login } from "@/lib/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Mail, Lock, Loader2 } from "lucide-react"

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const result = await login(email, password)

      if (result.success) {
        router.push("/dashboard")
        router.refresh()
      } else {
        setError(result.error || "Error al iniciar sesión")
      }
    } catch (err) {
      console.error("Error en login:", err)
      setError("Ocurrió un error al iniciar sesión")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-gray-700 font-medium flex items-center gap-1.5">
            <Mail className="h-4 w-4 text-primary/70" />
            Correo electrónico
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="pl-10 py-6 bg-gray-50 border-gray-200 focus:ring-blue-500 focus:border-blue-500 transition-all"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-gray-700 font-medium flex items-center gap-1.5">
            <Lock className="h-4 w-4 text-primary/70" />
            Contraseña
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 py-6 bg-gray-50 border-gray-200 focus:ring-blue-500 focus:border-blue-500 transition-all"
              required
            />
          </div>
        </div>
        {error && (
          <Alert variant="destructive" className="border-red-200 bg-red-50 animate-fadeIn">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button
          type="submit"
          className="w-full py-6 text-base font-medium gradient-bg hover:opacity-90 transition-all"
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span>Iniciando sesión...</span>
            </div>
          ) : (
            <span className="relative group">
              Iniciar sesión
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-white/40 transform scale-x-0 transition-transform group-hover:scale-x-100"></span>
            </span>
          )}
        </Button>
      </form>
    </div>
  )
}
