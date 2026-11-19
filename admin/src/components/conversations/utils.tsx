import type { ContactDetail, ContactListItem } from "@/types/api"

export const WINDOW_MS = 24 * 60 * 60 * 1000

export function whatsappWindow(contact: ContactDetail | ContactListItem | undefined | null) {
  if (!contact || contact.channel !== "whatsapp") return null
  if (!contact.last_inbound_at) return { open: false, remainingMs: 0 }
  const deadline = new Date(contact.last_inbound_at + "Z").getTime() + WINDOW_MS
  const remainingMs = deadline - Date.now()
  return { open: remainingMs > 0, remainingMs: Math.max(0, remainingMs) }
}

export function formatRemaining(ms: number): string {
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

export function getInitials(nameOrId: string | null | undefined): string {
  if (!nameOrId) return "?"
  return (
    nameOrId
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  )
}

/**
 * Formats time matching sample.webp: "3h • 6m", "2h • 35m", "11h • 1h"
 */
export function formatSampleTime(dateString: string): string {
  try {
    const date = new Date(dateString.endsWith("Z") ? dateString : dateString + "Z")
    const now = new Date()
    const diffMs = Math.max(0, now.getTime() - date.getTime())
    const diffMin = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMin < 1) return "now"
    if (diffMin < 60) return `${diffMin}m`
    if (diffHours < 24) {
      const remainingMin = diffMin % 60
      return remainingMin > 0 ? `${diffHours}h • ${remainingMin}m` : `${diffHours}h`
    }
    const remainingHours = diffHours % 24
    return remainingHours > 0 ? `${diffDays}d • ${remainingHours}h` : `${diffDays}d`
  } catch {
    return ""
  }
}

export function formatMessageTime(dateString: string, locale: string): string {
  try {
    const date = new Date(dateString.endsWith("Z") ? dateString : dateString + "Z")
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMin < 1) return "now"
    if (diffMin < 60) return `${diffMin}m`
    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
    }
    if (diffDays < 7) {
      return `${diffDays}d`
    }
    return date.toLocaleDateString(locale, { month: "short", day: "numeric" })
  } catch {
    return ""
  }
}

export function formatDetailTimestamp(dateString: string, locale: string): string {
  try {
    const date = new Date(dateString.endsWith("Z") ? dateString : dateString + "Z")
    return `${date.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
    })}, ${date.toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
    })}`
  } catch {
    return dateString
  }
}

export interface TagInfo {
  label: string
}

export function getContactTags(contact: ContactListItem | ContactDetail): TagInfo[] {
  const result: TagInfo[] = []
  const seen = new Set<string>()

  const add = (label: string) => {
    const clean = label.trim().toLowerCase()
    if (!clean || seen.has(clean)) return
    seen.add(clean)
    result.push({ label: clean })
  }

  // If handoff reason exists (e.g. "needs human", "login-issue", "billing")
  if (contact.handoff_reason) {
    const parts = contact.handoff_reason.split(/[,;/]+/)
    parts.forEach((p) => add(p))
  }

  // If meta has tags or labels
  const meta = "meta" in contact ? (contact.meta as Record<string, unknown> | undefined) : undefined
  if (meta && Array.isArray(meta.tags)) {
    meta.tags.forEach((t) => typeof t === "string" && add(t))
  }
  if (meta && Array.isArray(meta.labels)) {
    meta.labels.forEach((l) => typeof l === "string" && add(l))
  }

  // Fallback default tag if none
  if (result.length === 0) {
    if (contact.mode === "human") {
      add("login-issue")
    } else {
      add("support")
    }
  }

  return result
}

