"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MapPin, AlertTriangle } from "lucide-react"

// Coordenadas de Salto, Uruguay
const DEFAULT_LOCATION = { lat: -31.383, lng: -57.961 }

interface Location {
  id: string
  name: string
  address: string
  coordinates: { lat: number; lng: number }
  geofenceRadius: number
}

interface LocationsMapProps {
  locations: Location[]
  title?: string
  description?: string
}

export default function LocationsMap({
  locations,
  title = "Mapa de Domicilios",
  description = "Visualización de todos los domicilios registrados",
}: LocationsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)

  useEffect(() => {
    console.log("LocationsMap - Locations recibidas:", locations.length)
    if (locations.length > 0) {
      console.log("Primera ubicación:", locations[0])
    }
  }, [locations])

  useEffect(() => {
    // Cargar el script de Leaflet
    const loadLeaflet = async () => {
      if (typeof window !== "undefined" && !window.L) {
        try {
          console.log("Cargando Leaflet...")
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
            script.onload = () => {
              console.log("Leaflet cargado correctamente")
              setIsMapReady(true)
              resolve()
            }
            script.onerror = () => {
              console.error("Error al cargar Leaflet")
              setMapError("No se pudo cargar el mapa. Intente recargar la página.")
              resolve()
            }
          })
        } catch (error) {
          console.error("Error al cargar Leaflet:", error)
          setMapError("Error al cargar el mapa")
        }
      } else if (window.L) {
        console.log("Leaflet ya está cargado")
        setIsMapReady(true)
      }
      return Promise.resolve()
    }

    const initMap = async () => {
      await loadLeaflet()

      // Esperar a que Leaflet esté disponible
      if (typeof window === "undefined" || !window.L) {
        console.log("Leaflet no está disponible, reintentando...")
        setTimeout(initMap, 500)
        return
      }

      if (!mapRef.current) {
        console.log("Referencia del mapa no disponible")
        return
      }

      try {
        // Determinar el centro del mapa
        let center = DEFAULT_LOCATION // Salto, Uruguay por defecto
        if (locations.length > 0 && locations[0].coordinates) {
          center = locations[0].coordinates
          console.log("Centro del mapa establecido en:", center)
        }

        // Crear el mapa si no existe
        if (!mapInstanceRef.current) {
          console.log("Creando instancia del mapa...")
          mapInstanceRef.current = window.L.map(mapRef.current).setView([center.lat, center.lng], 12)

          window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 20,
          }).addTo(mapInstanceRef.current)

          console.log("Mapa creado correctamente")
        } else {
          // Si ya existe, limpiar marcadores existentes
          console.log("Limpiando marcadores existentes...")
          mapInstanceRef.current.eachLayer((layer: any) => {
            if (layer instanceof window.L.Marker || layer instanceof window.L.Circle) {
              mapInstanceRef.current.removeLayer(layer)
            }
          })
        }

        // Añadir marcadores para cada ubicación
        const bounds: [number, number][] = []
        console.log(`Añadiendo ${locations.length} marcadores al mapa...`)

        locations.forEach((location) => {
          if (
            !location.coordinates ||
            typeof location.coordinates.lat !== "number" ||
            typeof location.coordinates.lng !== "number"
          ) {
            console.warn(`Ubicación ${location.id} tiene coordenadas inválidas:`, location.coordinates)
            return
          }

          try {
            const homeIcon = window.L.divIcon({
              html: `<div class="flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-home"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>`,
              className: "",
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            })

            window.L.marker([location.coordinates.lat, location.coordinates.lng], { icon: homeIcon })
              .addTo(mapInstanceRef.current)
              .bindPopup(`<b>${location.name}</b><br>${location.address}`)

            // Añadir círculo para el radio de geofence
            window.L.circle([location.coordinates.lat, location.coordinates.lng], {
              radius: location.geofenceRadius,
              color: "blue",
              fillColor: "#3b82f6",
              fillOpacity: 0.1,
            }).addTo(mapInstanceRef.current)

            bounds.push([location.coordinates.lat, location.coordinates.lng])
          } catch (error) {
            console.error(`Error al añadir marcador para ubicación ${location.id}:`, error)
          }
        })

        // Ajustar el mapa para mostrar todos los marcadores
        if (bounds.length > 0) {
          console.log("Ajustando vista del mapa para mostrar todos los marcadores")
          mapInstanceRef.current.fitBounds(bounds)
        } else {
          console.log("No hay marcadores válidos para ajustar la vista")
        }
      } catch (error) {
        console.error("Error al inicializar el mapa:", error)
        setMapError("Error al inicializar el mapa")
      }
    }

    initMap()

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        console.log("Eliminando instancia del mapa")
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [locations, isMapReady])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {mapError ? (
          <div className="h-[400px] w-full rounded-md border flex items-center justify-center bg-gray-50">
            <div className="text-center text-red-500 flex flex-col items-center">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p>{mapError}</p>
            </div>
          </div>
        ) : (
          <div ref={mapRef} className="h-[400px] w-full rounded-md border"></div>
        )}
        <div className="mt-4 text-sm text-gray-500">
          {locations.length === 0 ? (
            <p>No hay domicilios registrados para mostrar en el mapa.</p>
          ) : (
            <p>Mostrando {locations.length} domicilios en el mapa. Haz clic en los marcadores para ver más detalles.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
