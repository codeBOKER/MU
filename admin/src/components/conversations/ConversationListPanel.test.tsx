import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { useContacts } from "@/hooks/useContacts"
import { Header } from "@/components/layout/Header"
import { HeaderContentProvider } from "@/components/layout/HeaderContentContext"
import { ConversationListPanel } from "./ConversationListPanel"
import i18n from "@/i18n"

vi.mock("@/hooks/useContacts", () => ({ useContacts: vi.fn() }))
vi.mock("@/lib/dev-sample-conversations", () => ({ stubConversations: true }))

describe("ConversationListPanel sample-data badge", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en")
    vi.mocked(useContacts).mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
    } as never)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("shows the sample-data badge when dev conversations are stubbed", () => {
    render(
      <MemoryRouter>
        <HeaderContentProvider>
          <Header
            showMenuToggle={false}
            sidebarExpanded={false}
            onToggleSidebar={() => {}}
          />
          <ConversationListPanel />
        </HeaderContentProvider>
      </MemoryRouter>
    )

    expect(screen.getByText("Sample data")).toBeTruthy()
  })
})
