import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  BarChart2,
  Bot,
  Brain,
  Building2,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  GitFork,
  Info,
  Mail,
  MapPin,
  MessageSquare,
  Minus,
  Pencil,
  Phone,
  Plus,
  Trash2,
  User,
  Wrench,
  X,
} from "lucide-react"
import type { ContactDetail } from "@/types/api"
import { useAdminAuth } from "@/hooks/useAdminAuth"
import { useContactMemories, useSetMode } from "@/hooks/useContacts"
import { useLeads } from "@/hooks/useLeads"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { getInitials } from "./utils"

interface ContactDetailsSidebarProps {
  contact: ContactDetail
  onClose: () => void
}

export function ContactDetailsSidebar({
  contact,
  onClose,
}: ContactDetailsSidebarProps) {
  const { t, i18n } = useTranslation()
  const { data: admin } = useAdminAuth()
  const { data: memories } = useContactMemories(contact.id)
  const { data: leads } = useLeads({ contact_id: contact.id })
  const setMode = useSetMode(contact.id)

  const lead = leads?.items?.[0]
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("high")
  const [actionsOpen, setActionsOpen] = useState(true)
  const [memoriesOpen, setMemoriesOpen] = useState(true)
  const [macrosOpen, setMacrosOpen] = useState(false)
  const [labels, setLabels] = useState<string[]>(["login-issue", "support"])

  const isHuman = contact.mode === "human"
  const initials = getInitials(contact.display_name ?? contact.external_id)

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const removeLabel = (labelToRemove: string) => {
    setLabels(labels.filter((l) => l !== labelToRemove))
  }

  const addLabel = () => {
    const newTag = prompt(t("conversations.addLabels"))
    if (newTag && !labels.includes(newTag)) {
      setLabels([...labels, newTag.trim()])
    }
  }

  const operatorName = admin?.full_name || "Riley Brooks"
  const operatorInitials = getInitials(operatorName)

  return (
    <div className="flex h-full w-full flex-col border-l border-border bg-card overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">
          {t("conversations.contact")}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          title={t("common.close")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-5">
        {/* Contact Profile Section */}
        <div className="flex flex-col items-center text-center">
          <Avatar className="h-18 w-18 ring-2 ring-border shadow-xs mb-3">
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex items-center justify-center gap-1.5">
            <h4 className="text-base font-semibold text-foreground">
              {lead?.name || contact.display_name || contact.external_id}
            </h4>
            <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
          </div>

          <p className="mt-1.5 text-xs text-muted-foreground max-w-xs leading-relaxed px-2">
            {lead?.notes ||
              (contact.handoff_reason
                ? `Handoff requested: ${contact.handoff_reason}`
                : "Head of Operations at Northwind Traders. Customer since 2023 and an internal product champion.")}
          </p>

          {/* Contact Details List */}
          <div className="mt-4 w-full rounded-xl border border-border bg-background/50 p-3 space-y-2.5 text-xs text-left">
            {/* Email */}
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground truncate">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{lead?.email || contact.external_id}</span>
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(lead?.email || contact.external_id, "email")}
                className="text-muted-foreground hover:text-foreground"
                title={t("conversations.copied")}
              >
                {copiedKey === "email" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {/* Phone */}
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono">{contact.wa_id || lead?.phone || "+14155550100"}</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  copyToClipboard(contact.wa_id || lead?.phone || "+14155550100", "phone")
                }
                className="text-muted-foreground hover:text-foreground"
                title={t("conversations.copied")}
              >
                {copiedKey === "phone" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {/* Company */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span>{lead?.extra?.company || "Northwind Traders"}</span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="flex items-center gap-1.5">
                <span>{lead?.extra?.location || "San Francisco, United States"}</span>
                <span>🇺🇸</span>
              </span>
            </div>
          </div>

          {/* Social Icons matching sample.webp */}
          <div className="mt-3 flex items-center justify-center gap-4 text-muted-foreground">
            <span className="cursor-pointer hover:text-foreground transition-colors" title="Twitter / X">
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </span>
            <span className="cursor-pointer hover:text-foreground transition-colors" title="LinkedIn">
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </span>
            <span className="cursor-pointer hover:text-foreground transition-colors" title="GitHub">
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </span>
            <span className="cursor-pointer hover:text-foreground transition-colors" title="Instagram">
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </span>
          </div>

          {/* Quick Action Icons Row matching sample.webp */}
          <div className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background p-1 shadow-2xs">
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={t("conversations.reply")}
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={t("common.edit")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Branch / Merge"
            >
              <GitFork className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title={t("common.delete")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Accordion: Conversation Actions */}
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setActionsOpen(!actionsOpen)}
            className="flex w-full items-center justify-between py-1 text-xs font-semibold text-foreground tracking-tight"
          >
            <span>{t("conversations.conversationActions")}</span>
            {actionsOpen ? (
              <Minus className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {actionsOpen && (
            <div className="mt-3 space-y-3.5 text-xs">
              {/* Assigned Agent */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  {t("conversations.assignedAgent")}
                </label>
                <div className="flex items-center justify-between rounded-lg border border-border bg-background p-2 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-primary text-primary-foreground text-[9px] font-bold">
                        {operatorInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{operatorName}</span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>

              {/* Assigned Team */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  {t("conversations.assignedTeam")}
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={setMode.isPending}
                      className="flex w-full items-center justify-between rounded-lg border border-border bg-background p-2 text-left transition-colors hover:bg-muted/50 shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                          {isHuman ? "H" : "T"}
                        </span>
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-foreground lowercase">
                          {isHuman ? t("conversations.humanOperator") : "technical support"}
                        </span>
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem
                      onClick={() => setMode.mutate("human")}
                      className="gap-2 text-xs"
                    >
                      <User className="h-4 w-4 text-primary" />
                      <span>{t("conversations.humanOperator")}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setMode.mutate("agent")}
                      className="gap-2 text-xs"
                    >
                      <Bot className="h-4 w-4 text-brand" />
                      <span>{t("conversations.botAgent")}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  {t("conversations.priority")}
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border border-border bg-background p-2 text-left transition-colors hover:bg-muted/50 shadow-2xs"
                    >
                      <div className="flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-warning" />
                        <span className="font-medium text-foreground capitalize">
                          {t(`conversations.priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`)}
                        </span>
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {(["low", "medium", "high", "urgent"] as const).map((p) => (
                      <DropdownMenuItem
                        key={p}
                        onClick={() => setPriority(p)}
                        className="gap-2 text-xs capitalize"
                      >
                        <BarChart2
                          className={cn(
                            "h-3.5 w-3.5",
                            p === "urgent"
                              ? "text-destructive"
                              : p === "high"
                              ? "text-warning"
                              : "text-muted-foreground"
                          )}
                        />
                        <span>{t(`conversations.priority${p.charAt(0).toUpperCase() + p.slice(1)}`)}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Conversation Labels */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    {t("conversations.conversationLabels")}
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={addLabel}
                    className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/10 px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-brand/20"
                  >
                    <span>+ {t("conversations.addLabels")}</span>
                  </button>

                  {labels.map((lbl) => (
                    <span
                      key={lbl}
                      className="inline-flex items-center gap-1.5 rounded-md bg-muted/60 dark:bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground border border-border/60"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-2xs bg-brand" />
                      <span>{lbl}</span>
                      <button
                        type="button"
                        onClick={() => removeLabel(lbl)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Accordion: Macros matching sample.webp */}
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setMacrosOpen(!macrosOpen)}
            className="flex w-full items-center justify-between py-1 text-xs font-semibold text-foreground tracking-tight"
          >
            <span>{t("conversations.macros")}</span>
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {macrosOpen && (
            <div className="mt-2.5 space-y-1.5 text-xs">
              {[
                { title: "Greeting", text: t("conversations.macroGreeting") },
                { title: "One moment", text: t("conversations.macroWait") },
                { title: "Resolved", text: t("conversations.macroResolved") },
              ].map((macro, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => copyToClipboard(macro.text, `macro_${idx}`)}
                  className="w-full rounded-lg border border-border bg-background p-2 text-left hover:bg-muted/50 transition-colors shadow-2xs"
                >
                  <p className="font-medium text-foreground">{macro.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {macro.text}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Accordion: Memories & AI Notes */}
        <div className="border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setMemoriesOpen(!memoriesOpen)}
            className="flex w-full items-center justify-between py-1 text-xs font-semibold text-foreground tracking-tight"
          >
            <span className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-brand" />
              <span>{t("conversations.memories")}</span>
            </span>
            {memoriesOpen ? (
              <Minus className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>

          {memoriesOpen && (
            <div className="mt-2.5 space-y-2 text-xs">
              {!memories?.length ? (
                <p className="text-xs text-muted-foreground italic py-1">
                  {t("conversations.noMemories")}
                </p>
              ) : (
                memories.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-border bg-background p-2.5 text-xs text-foreground leading-relaxed shadow-2xs"
                  >
                    <p>{m.content}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground font-mono">
                      {new Date(m.created_at + "Z").toLocaleDateString(i18n.language)}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
