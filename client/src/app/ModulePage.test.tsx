import { fireEvent, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router"
import { ModulePage } from "./ModulePage"
import type { ModuleConfig } from "./types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { UserRound } from "lucide-react"

vi.mock("./api", () => ({
  createRecord: vi.fn(),
  deleteRecord: vi.fn(),
  errorMessage: (error: unknown) => String(error),
  importRecords: vi.fn(),
  listRecords: vi.fn().mockResolvedValue([]),
  updateRecord: vi.fn(),
}))

const leads: ModuleConfig = {
  key: "leads",
  path: "/leads",
  label: "Leads",
  singular: "Lead",
  endpoint: "/lead",
  group: "Workspace",
  addMany: true,
  icon: UserRound,
  fields: [
    { key: "leadName", label: "Name", required: true },
    { key: "leadEmail", label: "Email", type: "email" },
  ],
}

describe("ModulePage", () => {
  it("renders the shared dialog primitive", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test dialog</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogHeader>
          <DialogFooter>Footer</DialogFooter>
          <Label htmlFor="test-name">Name</Label>
          <Input id="test-name" />
          <Button>Save</Button>
        </DialogContent>
      </Dialog>,
    )

    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("opens the create form from the primary action", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ModulePage module={leads} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole("button", { name: "Add Lead" }))

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "New Lead" })).toBeInTheDocument()
  })
})
