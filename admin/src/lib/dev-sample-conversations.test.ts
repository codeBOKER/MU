import { describe, expect, it } from "vitest"
import i18n from "@/i18n"
import {
  getSampleContact,
  listSampleContacts,
  listSampleLeads,
  listSampleMemories,
  listSampleMessages,
  sendSampleMessage,
  setSampleMode,
} from "./dev-sample-conversations"

describe("dev sample conversations", () => {
  it("filters, searches and paginates the sample inbox", () => {
    expect(listSampleContacts({}).total).toBe(4)
    expect(listSampleContacts({ mode: "human" }).items).toHaveLength(2)
    expect(listSampleContacts({ channel: "telegram" }).items).toHaveLength(2)
    expect(listSampleContacts({ search: "ada" }).items.map((contact) => contact.id)).toEqual([
      "sample-ada",
    ])
    const page = listSampleContacts({ limit: 1, offset: 1 })
    expect(page.items).toHaveLength(1)
    expect(page.total).toBe(4)
  })

  it("returns threads newest-first with matching previews and memories", () => {
    const contact = getSampleContact("sample-ada")
    const listContact = listSampleContacts({}).items.find((item) => item.id === "sample-ada")
    expect(contact).toBeDefined()
    expect(contact?.last_inbound_at).toBeTruthy()

    const messages = listSampleMessages("sample-ada", {})
    expect(messages.total).toBe(listContact?.message_count)
    expect(messages.items[0].created_at >= messages.items[1].created_at).toBe(true)
    expect(listSampleContacts({}).items.find((item) => item.id === "sample-ada")?.last_message?.text)
      .toBe(messages.items[0].text)
    expect(listSampleMemories("sample-ada")).toHaveLength(1)
  })

  it("keeps handoff and outbound replies in memory", () => {
    expect(setSampleMode("sample-mateo", "human")).toEqual({ mode: "human" })
    expect(getSampleContact("sample-mateo")?.mode).toBe("human")
    expect(listSampleContacts({ mode: "human" }).items.map((contact) => contact.id))
      .toContain("sample-mateo")

    const before = listSampleMessages("sample-mateo", {}).total
    const sent = sendSampleMessage("sample-mateo", { text: "听到的，谢谢！" })
    expect(sent?.direction).toBe("out")
    expect(listSampleMessages("sample-mateo", {}).total).toBe(before + 1)
    expect(listSampleMessages("sample-mateo", {}).items[0].id).toBe(sent?.id)

    setSampleMode("sample-mateo", "agent")
    expect(getSampleContact("sample-mateo")?.mode).toBe("agent")
  })

  it("filters sample leads by contact", () => {
    expect(listSampleLeads({}).total).toBe(2)
    expect(listSampleLeads({ contact_id: "sample-ada" }).items.map((lead) => lead.contact_id))
      .toEqual(["sample-ada"])
  })

  it("uses channels and message types that have locale keys", () => {
    for (const contact of listSampleContacts({}).items) {
      expect(i18n.exists(`conversations.channel.${contact.channel}`)).toBe(true)
    }
    for (const message of listSampleMessages("sample-ada", {}).items) {
      expect(i18n.exists(`conversations.type.${message.type}`)).toBe(true)
    }
  })
})
