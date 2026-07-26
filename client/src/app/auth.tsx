import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { Navigate, useLocation } from "react-router-dom"
import { api, errorMessage } from "./api"
import { t } from "./i18n"
import type { SessionUser } from "./types"

type AuthContextValue = {
  user: SessionUser | null
  token: string | null
  loading: boolean
  login: (username: string, password: string, remember: boolean) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api.get("/v1/session")
      .then((response) => {
        if (!active) return
        const session = response.data?.data
        if (!session?.user || !session?.membership) return
        setUser({
          ...session.user,
          legacyRole: session.user.role,
          role: session.membership.role,
          organizationId: session.organization?.id,
        })
        setToken("cookie-session")
      })
      .catch(() => {
        if (!active) return
        setUser(null)
        setToken(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post("/user/logout")
    } finally {
      setToken(null)
      setUser(null)
    }
  }, [])

  const login = useCallback(async (username: string, password: string, remember: boolean) => {
    try {
      const response = await api.post("/user/login", { username, password, remember })
      const nextUser = response.data?.user as SessionUser
      const workspace = response.data?.workspace as { organizationId?: string; role?: string } | undefined
      if (!nextUser || !workspace?.organizationId) throw new Error("The server returned an invalid session")
      setToken("cookie-session")
      setUser({
        ...nextUser,
        legacyRole: nextUser.role,
        role: workspace.role,
        organizationId: workspace.organizationId,
      })
    } catch (error) {
      throw new Error(errorMessage(error))
    }
  }, [])

  const value = useMemo(
    () => ({ user, token, loading, login, logout }),
    [user, token, loading, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used inside AuthProvider")
  return value
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { token, user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">{t("app.loading")}</div>
  }
  if (!token || !user) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  return children
}
