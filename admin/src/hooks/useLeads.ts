import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { listSampleLeads, stubConversations } from "@/lib/dev-sample-conversations"
import type { Lead, Paginated, PaginationParams } from "@/types/api"

// Module-owned endpoint (like /admin/modules/faq) — see core handoff module
const BASE = "/admin/modules/handoff"

export function useLeads(params: PaginationParams & { contact_id?: string }) {
  return useQuery({
    queryKey: ["leads", params],
    queryFn: async () => {
      if (stubConversations) return listSampleLeads(params)
      const { data } = await apiClient.get<Paginated<Lead>>(`${BASE}/leads`, {
        params,
      })
      return data
    },
    placeholderData: keepPreviousData,
  })
}
