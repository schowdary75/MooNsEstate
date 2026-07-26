import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { AuthProvider } from "./auth"
import { api } from "./api"
import { LoginPage } from "./LoginPage"

describe("sign-in screen", () => {
  it("exposes one private sign-in flow and no public registration", async () => {
    const sessionRequest = vi.spyOn(api, "get").mockResolvedValue({ data: { data: null } })
    localStorage.clear()
    sessionStorage.clear()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByRole("heading", { name: "Welcome back." })).toBeInTheDocument()
    expect(screen.getByLabelText("Email address")).toBeRequired()
    expect(screen.getByLabelText("Password")).toBeRequired()
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument()
    await waitFor(() => expect(sessionRequest).toHaveBeenCalledWith("/v1/session"))
    sessionRequest.mockRestore()
  })
})
