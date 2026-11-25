import { useTranslation } from "react-i18next"
import { Lightbulb, Sparkles } from "lucide-react"
import { useConversationTip } from "./tips"

export function ConversationTip() {
  const { t } = useTranslation()
  const tipKey = useConversationTip()

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs ring-8 ring-primary/5">
          <Lightbulb className="h-10 w-10 stroke-[1.5]" />
        </div>
        <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl border border-brand/30 bg-brand text-brand-foreground shadow-xs">
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      <h2 className="max-w-md text-xl font-semibold tracking-tight text-foreground">
        {t("conversations.tips.title")}
      </h2>

      <p
        key={tipKey}
        className="mt-3 max-w-md animate-in fade-in text-sm leading-relaxed text-muted-foreground duration-500"
      >
        {t(tipKey)}
      </p>
    </div>
  )
}
