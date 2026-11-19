import { useTranslation } from "react-i18next"
import { MessageSquare, Sparkles, Zap, ShieldCheck } from "lucide-react"

export function ConversationEmptyState() {
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-background/50">
      <div className="relative mb-6">
        {/* Layered decorative conversation visual */}
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs ring-8 ring-primary/5">
          <MessageSquare className="h-10 w-10 text-primary stroke-[1.5]" />
        </div>
        <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-card border border-border text-brand shadow-xs">
          <Sparkles className="h-4 w-4 text-brand" />
        </div>
      </div>

      <h2 className="text-xl font-semibold text-foreground tracking-tight max-w-md">
        {t("conversations.selectConversation")}
      </h2>

      <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
        {t("conversations.selectConversationDesc")}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 shadow-2xs">
          <Zap className="h-3.5 w-3.5 text-brand" />
          <span>{t("conversations.realtimeSync")}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 shadow-2xs">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>{t("conversations.windowTracking")}</span>
        </span>
      </div>
    </div>
  )
}
