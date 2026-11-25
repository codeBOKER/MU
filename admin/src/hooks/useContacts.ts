import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import {
  getSampleContact,
  listSampleContacts,
  listSampleMemories,
  listSampleMessages,
  sendSampleMessage,
  setSampleMode,
  stubConversations,
} from "@/lib/dev-sample-conversations"
import type {
  ContactDetail,
  ContactListItem,
  ConversationMode,
  MemoryItem,
  MessageItem,
  ModeResponse,
  Paginated,
  PaginationParams,
} from "@/types/api"

// The open conversation polls (~5s) so operator chat feels live — omakase,
// no websockets (ADR-004).
export const INBOX_POLL_MS = 5000

export function useContacts(
  params: PaginationParams & { mode?: ConversationMode; channel?: string },
  options?: { poll?: boolean }
) {
  return useQuery({
    queryKey: ["contacts", params],
    queryFn: async () => {
      if (stubConversations) return listSampleContacts(params)
      const { data } = await apiClient.get<Paginated<ContactListItem>>(
        "/admin/contacts",
        { params }
      )
      return data
    },
    placeholderData: keepPreviousData,
    refetchInterval: options?.poll ? INBOX_POLL_MS : undefined,
  })
}

export function useContact(contactId: string, options?: { poll?: boolean }) {
  return useQuery({
    queryKey: ["contacts", contactId],
    queryFn: async () => {
      if (stubConversations) {
        const sample = getSampleContact(contactId)
        if (!sample) throw new Error(`Sample contact not found: ${contactId}`)
        return sample
      }
      const { data } = await apiClient.get<ContactDetail>(
        `/admin/contacts/${contactId}`
      )
      return data
    },
    refetchInterval: options?.poll ? INBOX_POLL_MS : undefined,
  })
}

export function useContactMessages(
  contactId: string,
  params: PaginationParams,
  options?: { poll?: boolean }
) {
  return useQuery({
    queryKey: ["contacts", contactId, "messages", params],
    queryFn: async () => {
      if (stubConversations) return listSampleMessages(contactId, params)
      const { data } = await apiClient.get<Paginated<MessageItem>>(
        `/admin/contacts/${contactId}/messages`,
        { params }
      )
      return data
    },
    placeholderData: keepPreviousData,
    refetchInterval: options?.poll ? INBOX_POLL_MS : undefined,
  })
}

export function useContactMemories(contactId: string) {
  return useQuery({
    queryKey: ["contacts", contactId, "memories"],
    queryFn: async () => {
      if (stubConversations) return listSampleMemories(contactId)
      const { data } = await apiClient.get<{ items: MemoryItem[] }>(
        `/admin/contacts/${contactId}/memories`
      )
      return data.items
    },
  })
}

// --- Inbox writes (Sprint 7, ADR-004) ---

export function useSetMode(contactId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (mode: ConversationMode) => {
      if (stubConversations) return setSampleMode(contactId, mode)
      const { data } = await apiClient.put<ModeResponse>(
        `/admin/contacts/${contactId}/mode`,
        { mode }
      )
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contacts"] }),
  })
}

export interface OperatorMessagePayload {
  type?: "text" | "image" | "document" | "audio"
  text?: string | null
  // base64 data: URI — the mirror of the inbound contract (ADR-004)
  media_data_uri?: string | null
  filename?: string | null
}

export function useSendOperatorMessage(contactId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: OperatorMessagePayload) => {
      if (stubConversations) {
        const sample = sendSampleMessage(contactId, payload)
        if (!sample) throw new Error(`Sample contact not found: ${contactId}`)
        return sample
      }
      const { data } = await apiClient.post<MessageItem>(
        `/admin/contacts/${contactId}/messages`,
        payload
      )
      return data
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["contacts", contactId] }),
  })
}
