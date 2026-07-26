import { describe, expect, it } from "vitest"
import { displayValue, formatFieldValue, numericValue, recordId } from "./types"

describe("CRM record helpers", () => {
  it("normalizes database identifiers", () => {
    expect(recordId({ id: "new-id" })).toBe("new-id")
    expect(recordId({ _id: "legacy-id" })).toBe("legacy-id")
  })

  it("renders empty and structured values consistently", () => {
    expect(displayValue(null)).toBe("—")
    expect(displayValue(true)).toBe("Yes")
    expect(displayValue(["one", "two"])).toBe("one, two")
    expect(displayValue({ stage: "new" })).toBe('{"stage":"new"}')
  })

  it("formats CRM money, dates, and numeric strings for India", () => {
    expect(numericValue("₹12,50,000")).toBe(1250000)
    expect(formatFieldValue({ key: "amount", label: "Amount", type: "currency" }, "1250000")).toContain("12,50,000")
    expect(formatFieldValue({ key: "active", label: "Active", type: "boolean" }, "true")).toBe("Yes")
  })
})
