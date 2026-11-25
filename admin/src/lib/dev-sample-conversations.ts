import { devAutoLogin, devStubAdmin } from "@/lib/dev-auth"
import type { OperatorMessagePayload } from "@/hooks/useContacts"
import type {
  ContactDetail,
  ContactListItem,
  ConversationMode,
  Lead,
  MemoryItem,
  MessageItem,
  ModeResponse,
  Paginated,
  PaginationParams,
} from "@/types/api"

export const stubConversations = devAutoLogin && devStubAdmin

type SampleSeed = {
  id: string
  channel: string
  external_id: string
  wa_id: string | null
  display_name: string | null
  mode: ConversationMode
  handoff_reason: string | null
  meta: Record<string, unknown>
  messages: Array<{
    direction: "in" | "out"
    minutesAgo: number
    text: string | null
    meta?: Record<string, unknown>
    type?: string
  }>
}

const MINUTE = 60_000

function ago(minutes: number): string {
  return new Date(Date.now() - minutes * MINUTE).toISOString()
}

const SEEDS: SampleSeed[] = [
  {
    id: "sample-ada",
    channel: "whatsapp",
    external_id: "whatsapp:15551234567",
    wa_id: "15551234567",
    display_name: "Ada Lovelace",
    mode: "human",
    handoff_reason: "billing",
    meta: { tags: ["vip"], city: "London" },
    messages: [
      { direction: "in", minutesAgo: 48, text: "Hi! I have a question about my last invoice." },
      {
        direction: "out",
        minutesAgo: 46,
        text: "Sure — I can help with that. What would you like to know?",
        meta: { sent_by_email: "dev@chasqui.local" },
      },
      { direction: "in", minutesAgo: 18, text: "It shows a charge I don't recognize. Can you check?" },
      {
        direction: "out",
        minutesAgo: 16,
        text: "Of course. I'm looking at it now and will come right back to you.",
        meta: { is_private: true },
      },
    ],
  },
  {
    id: "sample-mateo",
    channel: "telegram",
    external_id: "telegram:884219076",
    wa_id: null,
    display_name: "Mateo Ruiz",
    mode: "agent",
    handoff_reason: null,
    meta: { tags: ["support"], city: "Madrid" },
    messages: [
      { direction: "in", minutesAgo: 75, text: "Hola, ¿podéis ayudarme con mi pedido?" },
      { direction: "out", minutesAgo: 73, text: "¡Hola! Claro, dime tu número de pedido." },
      { direction: "in", minutesAgo: 42, text: "Es el número 48291. Gracias." },
    ],
  },
  {
    id: "sample-lena",
    channel: "whatsapp-waha",
    external_id: "whatsapp:493012345678",
    wa_id: "493012345678",
    display_name: "Lena Fischer",
    mode: "human",
    handoff_reason: "login-issue",
    meta: { tags: ["login"], city: "Berlin" },
    messages: [
      { direction: "in", minutesAgo: 60 * 30, text: "I can't log into my account anymore." },
      { direction: "out", minutesAgo: 60 * 30 - 4, text: "I'm sorry to hear that. Let's get it sorted." },
    ],
  },
  {
    id: "sample-noor",
    channel: "telegram",
    external_id: "telegram:551204983",
    wa_id: null,
    display_name: null,
    mode: "agent",
    handoff_reason: null,
    meta: { tags: ["shipping"], city: "Toronto" },
    messages: [
      { direction: "in", minutesAgo: 190, text: "Any update on my delivery?" },
      { direction: "out", minutesAgo: 188, text: "It's out for delivery and should arrive today." },
    ],
  },
]

function buildMessages(seed: SampleSeed): MessageItem[] {
  return seed.messages.map((message, index) => ({
    id: `${seed.id}-m${index + 1}`,
    direction: message.direction,
    type: message.type ?? "text",
    text: message.text,
    meta: message.meta ?? {},
    created_at: ago(message.minutesAgo),
    has_media: false,
  }))
}

function buildContact(seed: SampleSeed, messages: MessageItem[]): ContactListItem {
  const last = messages[messages.length - 1]
  const lastInbound = [...messages].reverse().find((message) => message.direction === "in")
  return {
    id: seed.id,
    channel: seed.channel,
    external_id: seed.external_id,
    wa_id: seed.wa_id,
    display_name: seed.display_name,
    created_at: ago(60 * 24 * 7),
    updated_at: last?.created_at ?? ago(0),
    message_count: messages.length,
    last_message: last
      ? {
          direction: last.direction,
          type: last.type,
          text: last.text,
          created_at: last.created_at,
        }
      : null,
    mode: seed.mode,
    handoff_reason: seed.handoff_reason,
    handoff_at: seed.handoff_reason ? ago(20) : null,
    last_inbound_at: lastInbound?.created_at ?? null,
  }
}

function buildDetail(seed: SampleSeed, contact: ContactListItem): ContactDetail {
  return {
    id: contact.id,
    channel: contact.channel,
    external_id: contact.external_id,
    wa_id: contact.wa_id,
    display_name: contact.display_name,
    meta: seed.meta,
    created_at: contact.created_at,
    updated_at: contact.updated_at,
    mode: contact.mode,
    handoff_reason: contact.handoff_reason,
    handoff_at: contact.handoff_at,
    last_inbound_at: contact.last_inbound_at,
  }
}

const contacts: ContactListItem[] = []
const details: Record<string, ContactDetail> = {}
const threads: Record<string, MessageItem[]> = {}
const memories: Record<string, MemoryItem[]> = {}

for (const seed of SEEDS) {
  const messages = buildMessages(seed)
  const contact = buildContact(seed, messages)
  contacts.push(contact)
  details[seed.id] = buildDetail(seed, contact)
  threads[seed.id] = messages
  memories[seed.id] = [
    {
      id: `${seed.id}-memory-1`,
      content: "Prefers short, direct answers.",
      has_embedding: true,
      created_at: ago(60 * 24 * 3),
    },
  ]
}

const leads: Lead[] = [
  {
    id: "sample-lead-ada",
    contact_id: "sample-ada",
    contact_display_name: "Ada Lovelace",
    name: "Ada Lovelace",
    interest: "Billing inquiry",
    email: "ada@example.test",
    phone: "+15551234567",
    notes: "Asked about an unrecognized charge.",
    extra: {},
    created_at: ago(30),
  },
  {
    id: "sample-lead-mateo",
    contact_id: "sample-mateo",
    contact_display_name: "Mateo Ruiz",
    name: "Mateo Ruiz",
    interest: "Order status",
    email: "mateo@example.test",
    phone: null,
    notes: "Order 48291.",
    extra: {},
    created_at: ago(70),
  },
]

function paginate<T>(items: T[], params: PaginationParams): Paginated<T> {
  const offset = params.offset ?? 0
  const limit = params.limit ?? items.length
  return { items: items.slice(offset, offset + limit), total: items.length }
}

function findContact(contactId: string): ContactListItem | undefined {
  return contacts.find((contact) => contact.id === contactId)
}

export function listSampleContacts(
  params: PaginationParams & { mode?: ConversationMode; channel?: string }
): Paginated<ContactListItem> {
  const search = params.search?.trim().toLowerCase()
  const filtered = contacts
    .filter((contact) => !params.mode || contact.mode === params.mode)
    .filter((contact) => !params.channel || contact.channel === params.channel)
    .filter((contact) => {
      if (!search) return true
      const values = [contact.display_name, contact.external_id, contact.wa_id, contact.id]
      return values
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLowerCase().includes(search))
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return paginate(filtered, params)
}

export function getSampleContact(contactId: string): ContactDetail | undefined {
  return details[contactId]
}

export function listSampleMessages(
  contactId: string,
  params: PaginationParams
): Paginated<MessageItem> {
  const messages = [...(threads[contactId] ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  )
  return paginate(messages, params)
}

export function listSampleMemories(contactId: string): MemoryItem[] {
  return memories[contactId] ?? []
}

export function listSampleLeads(params: PaginationParams & { contact_id?: string }): Paginated<Lead> {
  const filtered = params.contact_id
    ? leads.filter((lead) => lead.contact_id === params.contact_id)
    : leads
  return paginate(filtered, params)
}

export function setSampleMode(contactId: string, mode: ConversationMode): ModeResponse {
  const contact = findContact(contactId)
  const detail = details[contactId]
  if (contact) {
    contact.mode = mode
    contact.handoff_at = mode === "human" ? ago(0) : null
    contact.handoff_reason = mode === "human" ? "needs human" : null
  }
  if (detail) {
    detail.mode = mode
    detail.handoff_at = contact?.handoff_at ?? null
    detail.handoff_reason = contact?.handoff_reason ?? null
  }
  return { mode }
}

export function sendSampleMessage(
  contactId: string,
  payload: OperatorMessagePayload
): MessageItem | undefined {
  const contact = findContact(contactId)
  const thread = threads[contactId]
  if (!contact || !thread) return undefined

  const message: MessageItem = {
    id: `${contactId}-m${thread.length + 1}-${Date.now()}`,
    direction: "out",
    type: payload.type ?? "text",
    text: payload.text ?? null,
    meta: payload.filename ? { filename: payload.filename } : {},
    created_at: ago(0),
    has_media: false,
  }
  thread.push(message)
  contact.last_message = {
    direction: message.direction,
    type: message.type,
    text: message.text,
    created_at: message.created_at,
  }
  contact.message_count = thread.length
  contact.updated_at = message.created_at
  const detail = details[contactId]
  if (detail) detail.updated_at = message.created_at
  return message
}
