"use client"

import { useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin } from "lucide-react"

// Coordenadas de Salto, Uruguay
const DEFAULT_LOCATION = { lat: -31.383, lng: -57.961 }

interface MapViewProps {
  checkInCoordinates?: { lat: number; lng: number }
  checkOutCoordinates?: { lat: number; lng: number } | null
  locationCoordinates?: { lat: number; lng: number }
  geofenceRadius?: number
  title?: string
  description?: string
}

export default function MapView({
  checkInCoordinates,
  checkOutCoordinates,
  locationCoordinates,
  geofenceRadius = 100,
  title = "Mapa de ubicación",
  description = "Visualización de las coordenadas de entrada y salida",
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    // Cargar el script de Leaflet
    const loadLeaflet = async () => {
      if (typeof window !== "undefined" && !window.L) {
        // Cargar CSS de Leaflet
        const linkElement = document.createElement("link")
        linkElement.rel = "stylesheet"
        linkElement.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        linkElement.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        linkElement.crossOrigin = ""
        document.head.appendChild(linkElement)

        // Cargar JS de Leaflet
        const script = document.createElement("script")
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
        script.crossOrigin = ""
        document.body.appendChild(script)

        return new Promise<void>((resolve) => {
          script.onload = () => resolve()
        })
      }
      return Promise.resolve()
    }

    const initMap = async () => {
      await loadLeaflet()

      // Esperar a que Leaflet esté disponible
      if (typeof window === "undefined" || !window.L) {
        setTimeout(initMap, 100)
        return
      }

      if (!mapRef.current) return

      // Determinar el centro del mapa
      let center = DEFAULT_LOCATION // Salto, Uruguay por defecto
      if (locationCoordinates) {
        center = locationCoordinates
      } else if (checkInCoordinates) {
        center = checkInCoordinates
      }

      // Crear el mapa si no existe
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = window.L.map(mapRef.current).setView([center.lat, center.lng], 15)

        // Usar un estilo de mapa más moderno
        window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }).addTo(mapInstanceRef.current)
      } else {
        // Si ya existe, actualizar la vista
        mapInstanceRef.current.setView([center.lat, center.lng], 15)
        // Limpiar marcadores existentes
        mapInstanceRef.current.eachLayer((layer: any) => {
          if (layer instanceof window.L.Marker || layer instanceof window.L.Circle) {
            mapInstanceRef.current.removeLayer(layer)
          }
        })
      }

      // Añadir marcador de la ubicación del domicilio si existe
      if (locationCoordinates) {
        const homeIcon = window.L.divIcon({
          html: `<div class="flex items-center justify-center w-10 h-10 bg-blue-500 text-white rounded-full shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-home"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                </div>`,
          className: "",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        })

        window.L.marker([locationCoordinates.lat, locationCoordinates.lng], { icon: homeIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup("<b>Ubicación del domicilio</b>", { className: "custom-popup" })

        // Añadir círculo para el radio de geofence con estilo mejorado
        window.L.circle([locationCoordinates.lat, locationCoordinates.lng], {
          radius: geofenceRadius,
          color: "#3b82f6",
          fillColor: "#3b82f6",
          fillOpacity: 0.1,
          weight: 2,
          dashArray: "5, 5",
        }).addTo(mapInstanceRef.current)
      }

      // Añadir marcador de entrada si existe
      if (checkInCoordinates) {
        const checkInIcon = window.L.divIcon({
          html: `<div class="flex items-center justify-center w-10 h-10 bg-green-500 text-white rounded-full shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-log-in"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>
                </div>`,
          className: "",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        })

        window.L.marker([checkInCoordinates.lat, checkInCoordinates.lng], { icon: checkInIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup("<b>Ubicación de entrada</b>", { className: "custom-popup" })
      }

      // Añadir marcador de salida si existe
      if (checkOutCoordinates) {
        const checkOutIcon = window.L.divIcon({
          html: `<div class="flex items-center justify-center w-10 h-10 bg-red-500 text-white rounded-full shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-log-out"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                </div>`,
          className: "",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        })

        window.L.marker([checkOutCoordinates.lat, checkOutCoordinates.lng], { icon: checkOutIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup("<b>Ubicación de salida</b>", { className: "custom-popup" })
      }

      // Añadir línea entre entrada y salida si ambos existen
      if (checkInCoordinates && checkOutCoordinates) {
        window.L.polyline(
          [
            [checkInCoordinates.lat, checkInCoordinates.lng],
            [checkOutCoordinates.lat, checkOutCoordinates.lng],
          ],
          {
            color: "#6366f1",
            weight: 3,
            opacity: 0.7,
            dashArray: "10, 10",
            lineCap: "round",
          },
        ).addTo(mapInstanceRef.current)
      }

      // Ajustar el mapa para mostrar todos los marcadores
      const bounds = []
      if (locationCoordinates) bounds.push([locationCoordinates.lat, locationCoordinates.lng])
      if (checkInCoordinates) bounds.push([checkInCoordinates.lat, checkInCoordinates.lng])
      if (checkOutCoordinates) bounds.push([checkOutCoordinates.lat, checkOutCoordinates.lng])

      if (bounds.length > 1) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30] })
      }
    }

    initMap()

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [checkInCoordinates, checkOutCoordinates, locationCoordinates, geofenceRadius])

  return (
    <Card className="hover-scale h-full">
      <CardHeader className="bg-gray-50 border-b mobile-compact">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <MapPin className="h-5 w-5 text-blue-500" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={mapRef} className="h-[250px] sm:h-[300px] w-full rounded-b-md"></div>
        <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
          {locationCoordinates && (
            <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-md">
              <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0"></div>
              <span className="text-blue-700 font-medium truncate">
                Domicilio: {locationCoordinates.lat.toFixed(6)}, {locationCoordinates.lng.toFixed(6)}
              </span>
            </div>
          )}
          {checkInCoordinates && (
            <div className="flex items-center gap-2 p-2 bg-green-50 rounded-md">
              <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></div>
              <span className="text-green-700 font-medium truncate">
                Entrada: {checkInCoordinates.lat.toFixed(6)}, {checkInCoordinates.lng.toFixed(6)}
              </span>
            </div>
          )}
          {checkOutCoordinates && (
            <div className="flex items-center gap-2 p-2 bg-red-50 rounded-md">
              <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0"></div>
              <span className="text-red-700 font-medium truncate">
                Salida: {checkOutCoordinates.lat.toFixed(6)}, {checkOutCoordinates.lng.toFixed(6)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
