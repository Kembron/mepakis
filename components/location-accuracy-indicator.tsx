import { AlertTriangle, CheckCircle, Info } from "lucide-react"

interface LocationAccuracyIndicatorProps {
  accuracy: number
}

export default function LocationAccuracyIndicator({ accuracy }: LocationAccuracyIndicatorProps) {
  // Determinar el nivel de precisión
  let level: "high" | "medium" | "low" = "high"
  if (accuracy > 100) level = "low"
  else if (accuracy > 30) level = "medium"

  // Colores y textos según el nivel
  const config = {
    high: {
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      icon: CheckCircle,
      text: "Alta precisión",
      description: "Tu ubicación es muy precisa.",
    },
    medium: {
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      icon: Info,
      text: "Precisión media",
      description: "Tu ubicación tiene precisión moderada.",
    },
    low: {
      color: "text-red-600",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      icon: AlertTriangle,
      text: "Baja precisión",
      description: "Tu ubicación tiene baja precisión. Intenta en un área más abierta.",
    },
  }

  const { color, bgColor, borderColor, icon: Icon, text, description } = config[level]

  return (
    <div className={`flex items-start gap-2 p-2 rounded-md ${bgColor} ${borderColor} border text-sm`}>
      <Icon className={`h-4 w-4 ${color} mt-0.5`} />
      <div>
        <p className={`font-medium ${color}`}>{text}</p>
        <p className="text-gray-600 text-xs">
          {description} Precisión: ±{Math.round(accuracy)} metros
        </p>
      </div>
    </div>
  )
}
