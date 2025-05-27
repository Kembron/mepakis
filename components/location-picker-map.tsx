"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin, Search } from "lucide-react"

const DEFAULT_LOCATION = { lat: -31.383, lng: -57.961 }

interface LocationPickerMapProps {
  initialPosition?: { lat: number; lng: number }
  geofenceRadius?: number
  onPositionChange: (position: { lat: number; lng: number }) => void
  onRadiusChange: (radius: number) => void
}

export default function LocationPickerMap({
  initialPosition = DEFAULT_LOCATION,
  geofenceRadius = 100,
  onPositionChange,
  onRadiusChange,
}: LocationPickerMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [position, setPosition] = useState(initialPosition)
  const [radius, setRadius] = useState(geofenceRadius)

  useEffect(() => {
    const loadLeaflet = async () => {
      if (typeof window !== "undefined" && !window.L) {
        const linkElement = document.createElement("link")
        linkElement.rel = "stylesheet"
        linkElement.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        linkElement.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        linkElement.crossOrigin = ""
        document.head.appendChild(linkElement)

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
      if (typeof window === "undefined" || !window.L || !mapRef.current) {
        setTimeout(initMap, 100)
        return
      }

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = window.L.map(mapRef.current).setView([position.lat, position.lng], 15)
        window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        }).addTo(mapInstanceRef.current)

        const homeIcon = window.L.divIcon({
          html: `<div class="flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full shadow-md"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" class="lucide lucide-home"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`,
          className: "",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })
        markerRef.current = window.L.marker([position.lat, position.lng], { icon: homeIcon, draggable: true })
          .addTo(mapInstanceRef.current)
          .bindPopup("Ubicación del domicilio")
        circleRef.current = window.L.circle([position.lat, position.lng], {
          radius: radius,
          color: "blue",
          fillColor: "#3b82f6",
          fillOpacity: 0.1,
        }).addTo(mapInstanceRef.current)
        mapInstanceRef.current.on("click", (e: any) => updatePosition(e.latlng))
        markerRef.current.on("dragend", () => updatePosition(markerRef.current.getLatLng()))
      }
    }
    initMap()
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (initialPosition.lat !== position.lat || initialPosition.lng !== position.lng || geofenceRadius !== radius) {
      setPosition(initialPosition)
      setRadius(geofenceRadius)
      updateMapElements(initialPosition, geofenceRadius)
    }
  }, [initialPosition, geofenceRadius])

  const updatePosition = (newPosition: { lat: number; lng: number }) => {
    // Asegurarse de que newPosition es un objeto con lat y lng como números
    if (!newPosition || typeof newPosition !== "object") {
      console.error("Posición inválida:", newPosition)
      return
    }

    // Convertir explícitamente a números y usar valores por defecto si son inválidos
    const position = {
      lat:
        typeof newPosition.lat === "function"
          ? DEFAULT_LOCATION.lat
          : !isNaN(Number(newPosition.lat))
            ? Number(newPosition.lat)
            : DEFAULT_LOCATION.lat,
      lng:
        typeof newPosition.lng === "function"
          ? DEFAULT_LOCATION.lng
          : !isNaN(Number(newPosition.lng))
            ? Number(newPosition.lng)
            : DEFAULT_LOCATION.lng,
    }

    // Actualizar estado local
    setPosition(position)

    // Actualizar elementos del mapa
    updateMapElements(position, radius)

    // Notificar al componente padre
    onPositionChange(position)
  }

  const updateMapElements = (pos: { lat: number; lng: number }, rad: number) => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) {
      console.log("Referencias del mapa no disponibles aún")
      return
    }

    try {
      // Asegurarse de que pos.lat y pos.lng son números válidos
      const lat =
        typeof pos.lat === "function"
          ? DEFAULT_LOCATION.lat
          : !isNaN(Number(pos.lat))
            ? Number(pos.lat)
            : DEFAULT_LOCATION.lat
      const lng =
        typeof pos.lng === "function"
          ? DEFAULT_LOCATION.lng
          : !isNaN(Number(pos.lng))
            ? Number(pos.lng)
            : DEFAULT_LOCATION.lng

      // Asegurarse de que rad es un número válido
      const validRadius = !isNaN(Number(rad)) ? Number(rad) : 100

      // Actualizar elementos del mapa
      markerRef.current.setLatLng([lat, lng])
      circleRef.current.setLatLng([lat, lng])
      circleRef.current.setRadius(validRadius)
    } catch (error) {
      console.error("Error al actualizar elementos del mapa:", error)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=uy`,
      )
      const data = await response.json()
      if (data && data.length > 0) {
        const newPosition = { lat: Number.parseFloat(data[0].lat), lng: Number.parseFloat(data[0].lon) }
        updatePosition(newPosition)
        if (mapInstanceRef.current) mapInstanceRef.current.setView([newPosition.lat, newPosition.lng], 15)
      }
    } catch (error) {
      console.error("Error searching location:", error)
    }
  }

  const updateRadius = (newRadius: number) => {
    setRadius(newRadius)
    onRadiusChange(newRadius)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Buscar dirección..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button type="button" onClick={handleSearch} variant="outline" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </div>
      <div ref={mapRef} className="h-[250px] sm:h-[300px] w-full rounded-md border bg-gray-100 dark:bg-gray-800"></div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="latitude">Latitud</Label>
          <Input
            id="latitude"
            type="number"
            step="0.000001"
            value={position.lat}
            onChange={(e) => {
              const val = Number.parseFloat(e.target.value)
              if (!isNaN(val)) updatePosition({ ...position, lat: val })
            }}
          />
        </div>
        <div>
          <Label htmlFor="longitude">Longitud</Label>
          <Input
            id="longitude"
            type="number"
            step="0.000001"
            value={position.lng}
            onChange={(e) => {
              const val = Number.parseFloat(e.target.value)
              if (!isNaN(val)) updatePosition({ ...position, lng: val })
            }}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="radius">Radio de geocerca (metros)</Label>
        <Input
          id="radius"
          type="number"
          min="10"
          max="1000"
          value={radius}
          onChange={(e) => {
            const val = Number.parseInt(e.target.value)
            if (!isNaN(val)) updateRadius(val)
          }}
        />
        <p className="text-xs text-muted-foreground mt-1">Define el área permitida alrededor de la ubicación</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4" />
        <span>Haz clic en el mapa o arrastra el marcador</span>
      </div>
    </div>
  )
}
