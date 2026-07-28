import { lazy, Suspense, type ReactNode } from "react"
import { Navigate, Route, Routes } from "react-router"
import { AppShell, NotFoundPage } from "./AppShell"
import { AuthProvider, ProtectedRoute, useAuth } from "./auth"
import { LoginPage } from "./LoginPage"
import { legacyRedirects, modules } from "./modules"

const OperationsDashboardPage = lazy(() =>
  import("./OperationsDashboardPage").then((module) => ({ default: module.OperationsDashboardPage })))
const DashboardPage = lazy(() =>
  import("./DashboardPage").then((module) => ({ default: module.DashboardPage })))
const ProjectsPage = lazy(() =>
  import("./ProjectsPage").then((module) => ({ default: module.ProjectsPage })))
const DevelopersPage = lazy(() =>
  import("./DevelopersPage").then((module) => ({ default: module.DevelopersPage })))
const PropertiesPage = lazy(() =>
  import("./PropertiesPage").then((module) => ({ default: module.PropertiesPage })))
const SalesDeskPage = lazy(() =>
  import("./SalesDeskPage").then((module) => ({ default: module.SalesDeskPage })))
const ReportsPage = lazy(() =>
  import("./ReportsPage").then((module) => ({ default: module.ReportsPage })))
const ModulePage = lazy(() =>
  import("./ModulePage").then((module) => ({ default: module.ModulePage })))
const PipelinePage = lazy(() =>
  import("./PipelinePage").then((module) => ({ default: module.PipelinePage })))
const CalendarPage = lazy(() =>
  import("./CalendarPage").then((module) => ({ default: module.CalendarPage })))
const FollowupsPage = lazy(() =>
  import("./FollowupsPage").then((module) => ({ default: module.FollowupsPage })))
const LeadsPage = lazy(() =>
  import("./LeadsPage").then((module) => ({ default: module.LeadsPage })))
const EmailTemplatesPage = lazy(() =>
  import("./EmailTemplatesPage").then((module) => ({ default: module.EmailTemplatesPage })))
const InvoicesPage = lazy(() =>
  import("./InvoicesPage").then((module) => ({ default: module.InvoicesPage })))
const BillingPage = lazy(() =>
  import("./BillingPage").then((module) => ({ default: module.BillingPage })))
const ConversationsPage = lazy(() =>
  import("./ConversationsPage").then((module) => ({ default: module.ConversationsPage })))
const IntegrationsPage = lazy(() =>
  import("./IntegrationsPage").then((module) => ({ default: module.IntegrationsPage })))
const MetaAcquisitionPage = lazy(() =>
  import("./MetaAcquisitionPage").then((module) => ({ default: module.MetaAcquisitionPage })))
const BuyerPortalPage = lazy(() =>
  import("./BuyerPortalPage").then((module) => ({ default: module.BuyerPortalPage })))
const PortalVerifyPage = lazy(() =>
  import("./PortalVerifyPage").then((module) => ({ default: module.PortalVerifyPage })))

const page = (children: ReactNode) => (
  <Suspense fallback={<div className="grid min-h-64 place-items-center text-sm text-muted-foreground">Loading workspace…</div>}>
    {children}
  </Suspense>
)

function ProtectedModule({ index }: { index: number }) {
  const { user } = useAuth()
  const module = modules[index]
  if (module.adminOnly && !["platform_owner", "organization_owner", "organization_admin"].includes(user?.role || "")) {
    return <Navigate to="/" replace />
  }
  if (module.key === "reports") return page(<ReportsPage />)
  if (module.key === "calendar") return page(<CalendarPage />)
  if (module.key === "followups") return page(<FollowupsPage />)
  if (module.key === "leads") return page(<LeadsPage />)
  if (module.key === "email-templates") return page(<EmailTemplatesPage />)
  if (module.key === "invoices") return page(<InvoicesPage />)
  if (module.key === "properties") return page(<PropertiesPage />)
  if (module.key === "conversations") return page(<ConversationsPage />)
  if (module.key === "meta-acquisition") return page(<MetaAcquisitionPage />)
  if (module.key === "integrations") return page(<IntegrationsPage />)
  if (module.key === "billing") return page(<BillingPage />)
  return page(<ModulePage module={module} />)
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/sign-in" element={<LoginPage />} />
        <Route path="/discover" element={page(<BuyerPortalPage />)} />
        <Route path="/portal/verify" element={page(<PortalVerifyPage />)} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={page(<DashboardPage />)} />
          <Route path="management" element={page(<OperationsDashboardPage />)} />
          <Route path="inventory" element={page(<ProjectsPage />)} />
          <Route path="developers" element={page(<DevelopersPage />)} />
          <Route path="sales" element={page(<SalesDeskPage />)} />
          <Route path="pipeline" element={page(<PipelinePage />)} />
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
