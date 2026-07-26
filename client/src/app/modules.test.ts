import { describe, expect, it } from "vitest"
import { legacyRedirects, modules } from "./modules"

describe("active CRM route configuration", () => {
  it("uses unique canonical paths and endpoint keys", () => {
    expect(new Set(modules.map((module) => module.path)).size).toBe(modules.length)
    expect(modules.every((module) => module.path.startsWith("/"))).toBe(true)
    expect(modules.every((module) => module.fields.length > 0)).toBe(true)
  })

  it("keeps typoed legacy bookmarks away from canonical routes", () => {
    expect(legacyRedirects["/metting"]).toBe("/meetings")
    expect(legacyRedirects["/calender"]).toBe("/calendar")
    expect(legacyRedirects["/custom-Fields"]).toBe("/custom-fields")
  })

  it("protects administration modules", () => {
    const adminModules = modules.filter((module) => module.group === "Administration")
    expect(adminModules.length).toBeGreaterThan(0)
    expect(adminModules.every((module) => module.adminOnly)).toBe(true)
  })
})
