import { useState, type FormEvent } from "react"
import { Navigate, useLocation, useNavigate } from "react-router"
import { ArrowRight, Check, Eye, EyeOff, KeyRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "./auth"

export function LoginPage() {
  const { token, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  if (token) return <Navigate to="/" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    try {
      await login(username, password, remember)
      toast.success("Welcome back")
      const from = (location.state as { from?: string } | null)?.from || "/"
      navigate(from, { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign in")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-white lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden border-r border-black/10 bg-black p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="mono-pattern absolute inset-0 opacity-20" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-full border border-white/30">
            <span className="font-display text-xl">M</span>
          </div>
          <div>
            <p className="text-sm font-semibold tracking-[0.28em]">MOON</p>
            <p className="text-xs text-white/50">ESTATE INTELLIGENCE</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <p className="mb-6 text-xs font-semibold tracking-[0.28em] text-white/50">THE MODERN REAL ESTATE DESK</p>
          <h1 className="font-display text-6xl leading-[1.02] tracking-tight xl:text-7xl">
            Every property.
            <br />
            Every relationship.
            <br />
            One clear view.
          </h1>
          <div className="mt-10 grid grid-cols-3 gap-6 border-t border-white/20 pt-6 text-sm text-white/60">
            {["Pipeline clarity", "Focused follow-up", "Confident reporting"].map((item) => (
              <div className="flex items-center gap-2" key={item}>
                <Check className="size-4 text-white" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs tracking-wider text-white/40">PRIVATE CRM • AUTHORIZED ACCESS ONLY</p>
      </section>

      <section className="relative flex min-h-screen items-center justify-center bg-[#f7f7f5] px-5 py-12">
        <div className="absolute inset-0 mono-pattern opacity-25" />
        <Card className="editorial-shadow relative w-full max-w-md border-black/15 bg-white">
          <CardContent className="p-7 sm:p-10">
            <div className="mb-9 lg:hidden">
              <p className="font-display text-3xl">MooNsEstate</p>
            </div>

            <div className="mb-8">
              <div className="mb-5 grid size-11 place-items-center rounded-full bg-black text-white">
                <KeyRound className="size-5" />
              </div>
              <h2 className="font-display text-4xl tracking-tight">Welcome back.</h2>
              <p className="mt-2 text-sm text-muted-foreground">Sign in to continue to your private workspace.</p>
            </div>

            <form className="space-y-5" onSubmit={submit}>
              <div className="space-y-2">
                <Label htmlFor="username">Email address</Label>
                <Input
                  id="username"
                  type="email"
                  autoComplete="username"
                  placeholder="you@company.com"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  className="h-11 border-black/20 bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="h-11 border-black/20 bg-white pr-11"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-black"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-3 text-sm text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(value) => setRemember(value === true)} />
                Keep me signed in on this device
              </label>

              <Button className="h-11 w-full" disabled={loading} type="submit">
                {loading ? "Signing in…" : "Enter workspace"}
                {!loading && <ArrowRight className="size-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
