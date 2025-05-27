"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUp, Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { uploadDocument } from "@/lib/document-actions"

interface DocumentUploadProps {
  workers: Array<{ id: string; name: string }>
  onSuccess: () => void
}

export default function DocumentUpload({ workers, onSuccess }: DocumentUploadProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [workerId, setWorkerId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        setError("Solo se permiten archivos PDF")
        setFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
        return
      }

      if (selectedFile.size > 10 * 1024 * 1024) {
        // 10MB
        setError("El archivo no debe superar los 10MB")
        setFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
        return
      }

      setFile(selectedFile)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      setError("El título es obligatorio")
      return
    }

    if (!workerId) {
      setError("Debe seleccionar un trabajador")
      return
    }

    if (!file) {
      setError("Debe seleccionar un archivo PDF")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("title", title)
      formData.append("description", description)
      formData.append("workerId", workerId)
      formData.append("file", file)

      const result = await uploadDocument(formData)

      if (result.success) {
        setSuccess(true)
        setTitle("")
        setDescription("")
        setWorkerId("")
        setFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
        onSuccess()
      } else {
        setError(result.error || "Error al subir el documento")
      }
    } catch (err) {
      console.error("Error al subir documento:", err)
      setError("Error al subir el documento. Inténtelo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Subir Nuevo Documento</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Éxito</AlertTitle>
              <AlertDescription className="text-green-700">Documento subido correctamente</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Título del documento</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Contrato de trabajo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del documento..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker">Trabajador</Label>
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar trabajador" />
              </SelectTrigger>
              <SelectContent>
                {workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Archivo PDF</Label>
            <Input
              ref={fileInputRef}
              id="file"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              required
            />
            <p className="text-xs text-gray-500">Solo archivos PDF. Tamaño máximo: 10MB</p>
          </div>
        </CardContent>

        <CardFooter>
          <Button type="submit" disabled={loading} className="ml-auto">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <FileUp className="h-4 w-4 mr-2" />
                Subir Documento
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
