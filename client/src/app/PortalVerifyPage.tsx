import { useEffect, useState } from "react"
import { CheckCircle2, CircleAlert } from "lucide-react"
import { Link, useSearchParams } from "react-router"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { api, errorMessage } from "./api"

export function PortalVerifyPage() {
  const [params] = useSearchParams()
  const [state, setState] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("Verifying your secure buyer link…")

  useEffect(() => {
    const token = params.get("token")
    const workspace = params.get("workspace") || "moon-estates"
    if (!token) {
      setState("error")
      setMessage("The sign-in token is missing.")
      return
    }
    api.post("/v1/public/auth/passwordless/verify", { token, workspace })
      .then(() => {
        setState("success")
        setMessage("Your buyer workspace is ready.")
      })
      .catch((error) => {
        setState("error")
        setMessage(errorMessage(error))
      })
  }, [params])

  return (
    <div className="grid min-h-screen place-items-center bg-[#f7f6f2] p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {state === "success" ? <CheckCircle2 className="mx-auto size-12 text-emerald-600" /> : state === "error" ? <CircleAlert className="mx-auto size-12 text-red-600" /> : <div className="mx-auto size-10 animate-spin rounded-full border-4 border-slate-200 border-t-black" />}
          <h1 className="mt-4 font-display text-2xl font-bold">{state === "loading" ? "Secure sign in" : state === "success" ? "Signed in" : "Link unavailable"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          {state !== "loading" && <Button asChild className="mt-6"><Link to="/discover">Return to properties</Link></Button>}
        </CardContent>
      </Card>
    </div>
  )
}
