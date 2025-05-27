/**
 * Sistema centralizado de manejo de errores para la aplicación
 */

import { z } from "zod"

// Tipos de errores personalizados
export class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError?: any,
  ) {
    super(message)
    this.name = "DatabaseError"
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors?: any,
  ) {
    super(message)
    this.name = "ValidationError"
  }
}

export class AuthenticationError extends Error {
  constructor(message = "Error de autenticación") {
    super(message)
    this.name = "AuthenticationError"
  }
}

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`El recurso ${resource} no fue encontrado`)
    this.name = "NotFoundError"
  }
}

// Función para manejar errores de manera centralizada
export function handleServerError(error: unknown): { success: false; error: string; code?: string } {
  console.error("Error en el servidor:", error)

  // Registrar el error en un sistema de logs (simulado)
  logError(error)

  // Manejar diferentes tipos de errores
  if (error instanceof z.ZodError) {
    return {
      success: false,
      error: formatZodError(error),
      code: "VALIDATION_ERROR",
    }
  }

  if (error instanceof DatabaseError) {
    return {
      success: false,
      error: "Error en la base de datos. Por favor, inténtelo de nuevo más tarde.",
      code: "DATABASE_ERROR",
    }
  }

  if (error instanceof ValidationError) {
    return {
      success: false,
      error: error.message,
      code: "VALIDATION_ERROR",
    }
  }

  if (error instanceof AuthenticationError) {
    return {
      success: false,
      error: error.message,
      code: "AUTHENTICATION_ERROR",
    }
  }

  if (error instanceof NotFoundError) {
    return {
      success: false,
      error: error.message,
      code: "NOT_FOUND_ERROR",
    }
  }

  // Error genérico
  return {
    success: false,
    error: "Ha ocurrido un error inesperado. Por favor, inténtelo de nuevo más tarde.",
    code: "UNKNOWN_ERROR",
  }
}

// Función para formatear errores de Zod
function formatZodError(error: z.ZodError): string {
  return error.errors
    .map((err) => {
      const field = err.path.join(".")
      return `${field ? field + ": " : ""}${err.message}`
    })
    .join(", ")
}

// Función para registrar errores (simulada)
function logError(error: unknown): void {
  const timestamp = new Date().toISOString()
  const errorDetails = {
    timestamp,
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }

  // En un entorno real, aquí enviaríamos el error a un servicio de logs
  console.error(`[ERROR LOG] ${timestamp}:`, errorDetails)
}

// Función para envolver funciones del servidor con manejo de errores
export function withErrorHandling<T>(fn: (...args: any[]) => Promise<T>) {
  return async (...args: any[]): Promise<T | { success: false; error: string; code?: string }> => {
    try {
      return await fn(...args)
    } catch (error) {
      return handleServerError(error)
    }
  }
}
