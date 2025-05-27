"use client"

import { useEffect } from "react"

export default function ForceLocationPermission() {
  useEffect(() => {
    // Detectar si es un dispositivo móvil
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase())

    if (isMobile && navigator.geolocation) {
      console.log("Solicitando permisos de ubicación al cargar la página en dispositivo móvil")

      // Intentar obtener la ubicación inmediatamente al cargar la página
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("Ubicación obtenida al inicio:", position.coords)
        },
        (error) => {
          console.error("Error al obtener ubicación al inicio:", error)
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        },
      )
    }
  }, [])

  // Este componente no renderiza nada visible
  return null
}
