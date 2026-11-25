import { useEffect, useState } from "react"

export const CONVERSATION_TIPS = [
  "conversations.tips.search",
  "conversations.tips.humanHandoff",
  "conversations.tips.whatsappWindow",
  "conversations.tips.quickReplies",
  "conversations.tips.keyboard",
] as const

export type ConversationTipKey = (typeof CONVERSATION_TIPS)[number]

const TIP_ROTATION_MS = 30_000

function pickTipIndex(previous?: number): number {
  if (CONVERSATION_TIPS.length < 2) return 0
  let next = previous
  while (next === previous) {
    next = Math.floor(Math.random() * CONVERSATION_TIPS.length)
  }
  return next ?? 0
}

export function useConversationTip(): ConversationTipKey {
  const [index, setIndex] = useState(() => pickTipIndex())

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((current) => pickTipIndex(current))
    }, TIP_ROTATION_MS)
    return () => window.clearInterval(interval)
  }, [])

  return CONVERSATION_TIPS[index]
}
