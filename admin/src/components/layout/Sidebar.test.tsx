import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import i18n from "@/i18n"
import { Sidebar } from "./Sidebar"

vi.mock("@/hooks/useContacts", () => ({
  useContacts: () => ({ data: undefined }),
}))

describe("Sidebar", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en")
  })

  afterEach(cleanup)

  it("uses the Chasqui lockup when expanded and the existing favicon when collapsed", () => {
    const onExpand = vi.fn()
    const onCollapse = vi.fn()
    const props = {
      mobile: false,
      open: false,
      hoverEnabled: true,
      onExpand,
      onCollapse,
      onNavigate: vi.fn(),
    }
    const { rerender } = render(
      <MemoryRouter>
        <Sidebar {...props} expanded={false} />
      </MemoryRouter>
    )

    const sidebar = screen.getByRole("complementary", { name: "Main navigation" })
    const favicon = sidebar.querySelector('img[src="/favicon.svg"]')
    const wordmark = sidebar.querySelector('img[src="/chasqui-logo.svg"]')
    expect(favicon).not.toBeNull()
    expect(wordmark?.getAttribute("alt")).toBe("")
    expect(
      screen
        .getByRole("link", { name: "Dashboard" })
        .querySelector("span")
        ?.getAttribute("aria-hidden")
    ).toBe("true")

    fireEvent.mouseEnter(sidebar)
    fireEvent.mouseLeave(sidebar)
    expect(onExpand).toHaveBeenCalledOnce()
    expect(onCollapse).toHaveBeenCalledOnce()

    rerender(
      <MemoryRouter>
        <Sidebar {...props} expanded />
      </MemoryRouter>
    )
    expect(
      sidebar.querySelector('img[src="/chasqui-logo.svg"]')?.getAttribute("alt")
    ).toBe("Chasqui")
    expect(
      screen
        .getByRole("link", { name: "Dashboard" })
        .querySelector("span")
        ?.getAttribute("aria-hidden")
    ).toBe("false")
  })

  it("does not use hover expansion when the pointer mode is touch based", () => {
    const onExpand = vi.fn()
    const onCollapse = vi.fn()
    render(
      <MemoryRouter>
        <Sidebar
          expanded={false}
          mobile={false}
          open={false}
          hoverEnabled={false}
          onExpand={onExpand}
          onCollapse={onCollapse}
          onNavigate={vi.fn()}
        />
      </MemoryRouter>
    )

    const sidebar = screen.getByRole("complementary", { name: "Main navigation" })
    fireEvent.mouseEnter(sidebar)
    fireEvent.mouseLeave(sidebar)
    expect(onExpand).not.toHaveBeenCalled()
    expect(onCollapse).not.toHaveBeenCalled()
  })
})
