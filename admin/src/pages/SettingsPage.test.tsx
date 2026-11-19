import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useAdminAuth, useAdminLogout } from "@/hooks/useAdminAuth"
import i18n from "@/i18n"
import { SettingsPage } from "./SettingsPage"

vi.mock("@/hooks/useAdminAuth", () => ({
  useAdminAuth: vi.fn(),
  useAdminLogout: vi.fn(),
}))

describe("SettingsPage", () => {
  const logout = vi.fn()

  beforeEach(async () => {
    await i18n.changeLanguage("en")
    vi.mocked(useAdminAuth).mockReturnValue({
      data: {
        id: "admin-1",
        email: "admin@chasqui.example",
        full_name: "Ada Lovelace",
        role: "owner",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        last_login_at: null,
      },
      isLoading: false,
      isError: false,
    } as never)
    vi.mocked(useAdminLogout).mockReturnValue(logout)
  })

  afterEach(async () => {
    cleanup()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    await i18n.changeLanguage("en")
  })

  it("moves language selection and account actions into Settings", () => {
    const changeLanguage = vi.spyOn(i18n, "changeLanguage")
    render(<SettingsPage />)

    expect(screen.getByText("Ada Lovelace")).toBeTruthy()
    expect(screen.getByText("admin@chasqui.example")).toBeTruthy()
    expect(screen.getByText("Role: owner")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Log out" }))
    expect(logout).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole("button", { name: "Spanish" }))
    expect(changeLanguage).toHaveBeenCalledWith("es")
  })
})
