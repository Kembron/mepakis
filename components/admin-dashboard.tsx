"use client"

import { useState, useEffect, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LogOut, Users, Home, BarChart, Clock, Calendar, MapPin, Menu, FileText } from "lucide-react"
import WorkerManagement from "@/components/worker-management"
import ElderlyLocations from "@/components/elderly-locations"
import CheckInRecords from "@/components/check-in-records"
import Reports from "@/components/reports"
import DocumentsManagement from "@/components/documents-management"
import { logout } from "@/lib/actions"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { formatHoursAndMinutes } from "@/lib/utils"
import { DataProvider, useData } from "@/contexts/data-context"
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet"

export default function AdminDashboard({ user }: { user: any }) {
  return (
    <DataProvider>
      <AdminDashboardContent user={user} />
    </DataProvider>
  )
}

function AdminDashboardContent({ user }: { user: any }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("dashboard")
  const { stats, latestRecords, loading, refreshStats, refreshLatestRecords, lastUpdated } = useData()
  const initialLoadDone = useRef(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search)
      const tabFromUrl = searchParams.get("tab") || "dashboard"
      setActiveTab(tabFromUrl)
    }
  }, [])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setIsMobileMenuOpen(false)
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search)
      searchParams.set("tab", tab)
      const newUrl = `${window.location.pathname}?${searchParams.toString()}`
      window.history.pushState({ path: newUrl }, "", newUrl)
    }
    if (tab === "dashboard") {
      const now = new Date()
      const statsAge = lastUpdated.stats ? now.getTime() - lastUpdated.stats.getTime() : Number.POSITIVE_INFINITY
      const recordsAge = lastUpdated.latestRecords
        ? now.getTime() - lastUpdated.latestRecords.getTime()
        : Number.POSITIVE_INFINITY
      if (statsAge > 60000) refreshStats()
      if (recordsAge > 60000) refreshLatestRecords()
    }
  }

  useEffect(() => {
    if (!initialLoadDone.current && activeTab === "dashboard") {
      initialLoadDone.current = true
      if (!stats.workersCount || !latestRecords.length) {
        refreshStats()
        refreshLatestRecords()
      }
    }
  }, [activeTab, stats.workersCount, latestRecords.length, refreshStats, refreshLatestRecords])

  const handleLogout = async () => {
    await logout()
    router.push("/")
    router.refresh()
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A"
    return format(new Date(dateString), "dd/MM/yy HH:mm", {
      locale: es,
      timeZone: "UTC",
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">Completado</span>
        )
      case "incomplete":
        return (
          <span className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-100 rounded-full">En progreso</span>
        )
      case "invalid":
        return <span className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 rounded-full">Inválido</span>
      default:
        return <span className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">{status}</span>
    }
  }

  const renderLoadingStats = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="stat-card animate-pulse bg-gray-200 dark:bg-gray-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded"></div>
            <div className="h-6 w-6 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="h-8 w-16 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
            <div className="h-3 w-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const tabItems = [
    { value: "dashboard", label: "Dashboard", icon: <BarChart className="h-4 w-4 md:mr-2" /> },
    { value: "workers", label: "Trabajadores", icon: <Users className="h-4 w-4 md:mr-2" /> },
    { value: "locations", label: "Domicilios", icon: <Home className="h-4 w-4 md:mr-2" /> },
    { value: "records", label: "Registros", icon: <Clock className="h-4 w-4 md:mr-2" /> },
    { value: "reports", label: "Reportes", icon: <Calendar className="h-4 w-4 md:mr-2" /> },
    { value: "documents", label: "Documentos", icon: <FileText className="h-4 w-4 md:mr-2" /> },
  ]

  const statCardsData = [
    {
      title: "Trabajadores",
      value: stats.workersCount,
      description: "Activos en el sistema",
      icon: <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
      borderColor: "border-blue-500",
      tab: "workers",
    },
    {
      title: "Domicilios",
      value: stats.locationsCount,
      description: "Registrados actualmente",
      icon: <Home className="h-5 w-5 text-green-600 dark:text-green-400" />,
      borderColor: "border-green-500",
      tab: "locations",
    },
    {
      title: "Registros Hoy",
      value: stats.todayRecordsCount,
      description: "Entradas/Salidas del día",
      icon: <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
      borderColor: "border-amber-500",
      tab: "records",
    },
    {
      title: "Horas Mensuales",
      value: `${stats.monthlyHours}h ${stats.monthlyMinutes}m`,
      description: "Total último mes",
      icon: <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      borderColor: "border-purple-500",
      tab: "reports",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-gradient-to-br from-blue-50 to-indigo-100 border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <BarChart className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">¡Hola, {user.name}!</h1>
              <p className="text-xs text-gray-600 hidden sm:block">Administración</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:block bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm text-gray-700 border border-white/40">
              Administrador
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="bg-white/60 text-gray-700 border-white/40 hover:bg-white/80 text-xs sm:text-sm btn-with-icon backdrop-blur-sm"
            >
              <LogOut className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Cerrar sesión</span>
            </Button>
            <div className="md:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-gray-700 hover:bg-white/20">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-64 bg-gray-800 text-white">
                  <div className="p-4 border-b border-gray-700 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <BarChart className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Menú</h2>
                      <p className="text-xs text-gray-300 truncate">{user.name}</p>
                    </div>
                  </div>
                  <nav className="flex flex-col p-2 space-y-1">
                    {tabItems.map((item) => (
                      <SheetClose asChild key={item.value}>
                        <Button
                          variant={activeTab === item.value ? "secondary" : "ghost"}
                          className={`w-full justify-start text-sm ${activeTab === item.value ? "bg-blue-600 text-white" : "hover:bg-gray-700"}`}
                          onClick={() => handleTabChange(item.value)}
                        >
                          {item.icon}
                          {item.label}
                        </Button>
                      </SheetClose>
                    ))}
                    <SheetClose asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 mt-4"
                        onClick={handleLogout}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Cerrar sesión
                      </Button>
                    </SheetClose>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-2 sm:px-4 lg:px-6 py-4 md:py-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 md:space-y-6">
          <div className="hidden md:block">
            <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 w-full bg-white dark:bg-gray-800 shadow-md rounded-lg p-1">
              {tabItems.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white dark:data-[state=active]:bg-blue-500 rounded-md text-sm font-medium py-2 px-3 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {item.icon}
                  <span className="ml-0 md:ml-2">{item.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="space-y-4 md:space-y-6 animate-fadeIn">
            {loading.stats ? (
              renderLoadingStats()
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {statCardsData.map((card) => (
                  <div
                    key={card.title}
                    onClick={() => handleTabChange(card.tab)}
                    tabIndex={0}
                    role="button"
                    className={`stat-card bg-card hover:bg-muted/30 dark:hover:bg-muted/10 border-l-4 ${card.borderColor} shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary card-interactive`}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 mobile-compact">
                      <CardTitle className="text-sm font-medium text-card-foreground flex items-center gap-2">
                        {card.icon}
                        {card.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="mobile-compact">
                      <div className="text-3xl font-bold text-foreground">{card.value}</div>
                      <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                    </CardContent>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
              <Card className="lg:col-span-2 hover-scale shadow-lg bg-card">
                <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
                  <CardTitle className="text-base sm:text-lg font-semibold text-card-foreground">
                    Últimos Registros
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                    Visualización rápida de las últimas actividades.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 sm:pt-6">
                  {loading.latestRecords && latestRecords.length === 0 ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-4 animate-pulse">
                          <div className="h-10 w-10 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                          <div className="space-y-2 flex-1">
                            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
                          </div>
                          <div className="h-5 w-20 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                        </div>
                      ))}
                    </div>
                  ) : latestRecords.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                      No hay registros recientes.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {latestRecords.map((record) => (
                        <div
                          key={record.id}
                          className="p-3 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-2">
                            <div>
                              <h4 className="font-medium text-sm sm:text-base text-foreground">{record.workerName}</h4>
                              <p className="text-xs sm:text-sm text-muted-foreground flex items-center">
                                <MapPin className="h-3 w-3 mr-1 text-gray-400 dark:text-gray-500" />
                                {record.locationName}
                              </p>
                            </div>
                            <div className="mt-1 sm:mt-0 self-start sm:self-center">
                              {getStatusBadge(record.status)}
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs sm:text-sm">
                            <div className="text-muted-foreground">
                              <span className="font-medium text-foreground">Entrada:</span>{" "}
                              {formatDateTime(record.checkInTime)}
                            </div>
                            <div className="text-muted-foreground">
                              <span className="font-medium text-foreground">Salida:</span>{" "}
                              {record.checkOutTime ? formatDateTime(record.checkOutTime) : "Pendiente"}
                            </div>
                          </div>
                          {record.workTimeMinutes > 0 && (
                            <div className="mt-1 text-xs sm:text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">Tiempo:</span>{" "}
                              {formatHoursAndMinutes(record.workTimeMinutes)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-1 hover-scale shadow-lg bg-card">
                <CardHeader className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-700">
                  <CardTitle className="text-base sm:text-lg font-semibold text-card-foreground">
                    Información del Sistema
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-muted-foreground">
                    Funcionalidades clave de la plataforma.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4 sm:pt-6 space-y-3 sm:space-y-4">
                  {[
                    {
                      title: "Verificación de Ubicación",
                      description: "Geofencing para asegurar la presencia.",
                      icon: <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
                      bgColor: "bg-blue-50 dark:bg-blue-900/30",
                      borderColor: "border-blue-200 dark:border-blue-700",
                      titleColor: "text-blue-700 dark:text-blue-300",
                    },
                    {
                      title: "Control de Horas",
                      description: "Cálculo automático y reportes detallados.",
                      icon: <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
                      bgColor: "bg-emerald-50 dark:bg-emerald-900/30",
                      borderColor: "border-emerald-200 dark:border-emerald-700",
                      titleColor: "text-emerald-700 dark:text-emerald-300",
                    },
                    {
                      title: "Firma Digital",
                      description: "Gestión de documentos y firmas electrónicas.",
                      icon: <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
                      bgColor: "bg-purple-50 dark:bg-purple-900/30",
                      borderColor: "border-purple-200 dark:border-purple-700",
                      titleColor: "text-purple-700 dark:text-purple-300",
                    },
                  ].map((item) => (
                    <div key={item.title} className={`p-3 rounded-lg border ${item.borderColor} ${item.bgColor}`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-full bg-white dark:bg-gray-700 shadow`}>{item.icon}</div>
                        <div>
                          <h4 className={`font-semibold text-sm ${item.titleColor}`}>{item.title}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2">
                    <Button
                      onClick={() => handleTabChange("documents")}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all text-sm"
                      size="lg"
                    >
                      Gestionar Documentos
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="workers" className="bg-card p-3 sm:p-4 md:p-6 rounded-lg shadow-xl animate-fadeIn">
            <WorkerManagement />
          </TabsContent>
          <TabsContent value="locations" className="bg-card p-3 sm:p-4 md:p-6 rounded-lg shadow-xl animate-fadeIn">
            <ElderlyLocations />
          </TabsContent>
          <TabsContent value="records" className="bg-card p-3 sm:p-4 md:p-6 rounded-lg shadow-xl animate-fadeIn">
            <CheckInRecords />
          </TabsContent>
          <TabsContent value="reports" className="bg-card p-3 sm:p-4 md:p-6 rounded-lg shadow-xl animate-fadeIn">
            <Reports />
          </TabsContent>
          <TabsContent value="documents" className="bg-card p-3 sm:p-4 md:p-6 rounded-lg shadow-xl animate-fadeIn">
            <DocumentsManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
