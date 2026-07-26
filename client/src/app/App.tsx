import { Navigate, Route, Routes } from "react-router-dom"
import { AppShell, NotFoundPage } from "./AppShell"
import { AuthProvider, ProtectedRoute, useAuth } from "./auth"
import { DashboardPage } from "./DashboardPage"
import { LoginPage } from "./LoginPage"
import { ModulePage } from "./ModulePage"
import { legacyRedirects, modules } from "./modules"
import { PipelinePage } from "./PipelinePage"
import { ReportsPage } from "./ReportsPage"
import { CalendarPage } from "./CalendarPage"
import { FollowupsPage } from "./FollowupsPage"
import { LeadsPage } from "./LeadsPage"
import { EmailTemplatesPage } from "./EmailTemplatesPage"
import { InvoicesPage } from "./InvoicesPage"
import { PropertiesPage } from "./PropertiesPage"
import { BillingPage } from "./BillingPage"
import { ConversationsPage } from "./ConversationsPage"
import { IntegrationsPage } from "./IntegrationsPage"
import { MetaAcquisitionPage } from "./MetaAcquisitionPage"
import { BuyerPortalPage } from "./BuyerPortalPage"
import { PortalVerifyPage } from "./PortalVerifyPage"

function ProtectedModule({ index }: { index: number }) {
  const { user } = useAuth()
  const module = modules[index]
  if (module.adminOnly && !["platform_owner", "organization_owner", "organization_admin"].includes(user?.role || "")) {
    return <Navigate to="/" replace />
  }
  if (module.key === "reports") return <ReportsPage />
  if (module.key === "calendar") return <CalendarPage />
  if (module.key === "followups") return <FollowupsPage />
  if (module.key === "leads") return <LeadsPage />
  if (module.key === "email-templates") return <EmailTemplatesPage />
  if (module.key === "invoices") return <InvoicesPage />
  if (module.key === "properties") return <PropertiesPage />
  if (module.key === "conversations") return <ConversationsPage />
  if (module.key === "meta-acquisition") return <MetaAcquisitionPage />
  if (module.key === "integrations") return <IntegrationsPage />
  if (module.key === "billing") return <BillingPage />
  return <ModulePage module={module} />
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/sign-in" element={<LoginPage />} />
        <Route path="/discover" element={<BuyerPortalPage />} />
        <Route path="/portal/verify" element={<PortalVerifyPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          {modules.map((module, index) => (
            <Route key={module.path} path={module.path.slice(1)} element={<ProtectedModule index={index} />} />
          ))}
          {Object.entries(legacyRedirects).map(([legacy, canonical]) => (
            <Route key={legacy} path={legacy.slice(1)} element={<Navigate to={canonical} replace />} />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
