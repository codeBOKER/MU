import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { useContact } from "@/hooks/useContacts"
import type { ContactDetail } from "@/types/api"
import { ConversationsPage } from "./ConversationsPage"

vi.mock("@/hooks/useContacts", () => ({ useContact: vi.fn() }))
vi.mock("@/components/conversations/ConversationListPanel", () => ({
  ConversationListPanel: ({ selectedContactId }: { selectedContactId?: string }) => (
    <div data-testid="conversation-list" data-selected-id={selectedContactId ?? ""} />
  ),
}))
vi.mock("@/components/conversations/ConversationThread", () => ({
  ConversationThread: () => <div data-testid="conversation-thread" />,
}))
vi.mock("@/components/conversations/ContactDetailsSidebar", () => ({
  ContactDetailsSidebar: () => <div data-testid="contact-details" />,
}))

const contact = {
  id: "contact-1",
  display_name: "Ada Lovelace",
  external_id: "ada@example.test",
  channel: "whatsapp",
  mode: "agent",
} as ContactDetail

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/conversations" element={<ConversationsPage />} />
        <Route path="/conversations/:contactId" element={<ConversationsPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe("ConversationsPage selection layout", () => {
  beforeEach(() => {
    vi.mocked(useContact).mockReturnValue({
      data: contact,
      isLoading: false,
    } as never)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it("shows only the expanded conversation list when no conversation is selected", () => {
    renderAt("/conversations")

    expect(screen.getByTestId("conversation-list").getAttribute("data-selected-id"))
      .toBe("")
    expect(screen.queryByTestId("conversation-thread")).toBeNull()
    expect(screen.queryByTestId("contact-details")).toBeNull()
    expect(vi.mocked(useContact)).toHaveBeenCalledWith("", { poll: false })
  })

  it("restores the conversation thread and contact details for a selected route", () => {
    renderAt("/conversations/contact-1")

    expect(screen.getByTestId("conversation-list").getAttribute("data-selected-id"))
      .toBe("contact-1")
    expect(screen.getByTestId("conversation-thread")).toBeTruthy()
    expect(screen.getByTestId("contact-details")).toBeTruthy()
    expect(vi.mocked(useContact)).toHaveBeenCalledWith("contact-1", { poll: true })
  })
})
