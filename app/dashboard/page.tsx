import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import AdminDashboard from "@/components/admin-dashboard"
import WorkerDashboard from "@/components/worker-dashboard"

export default async function Dashboard() {
  const session = await getSession()

  if (!session) {
    redirect("/")
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {session.user.role === "admin" ? <AdminDashboard user={session.user} /> : <WorkerDashboard user={session.user} />}
    </main>
  )
}
