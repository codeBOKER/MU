import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCheck,
  ChevronDown,
  Flame,
  Hand,
  Lock,
  MoreVertical,
  PanelRight,
  PanelRightClose,
  RotateCcw,
  User,
} from "lucide-react"
import type { ContactDetail, MessageItem } from "@/types/api"
import { useAdminAuth } from "@/hooks/useAdminAuth"
import { useContactMessages, useSetMode } from "@/hooks/useContacts"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MessageMedia } from "@/components/shared/MessageMedia"
import { ChannelBadge } from "@/components/shared/ChannelBadge"
import { cn } from "@/lib/utils"
import { ConversationComposer } from "./ConversationComposer"
import {
  formatDetailTimestamp,
  formatRemaining,
  getInitials,
  whatsappWindow,
} from "./utils"

const PAGE_SIZE = 50

interface ConversationThreadProps {
  contact: ContactDetail
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

function MessageBubbleItem({
  message,
  operatorName,
}: {
  message: MessageItem
  operatorName: string
}) {
  const { t, i18n } = useTranslation()
  const isInbound = message.direction === "in"
  const isPrivateNote =
    Boolean(message.meta?.is_private) ||
    message.type === "note" ||
    message.meta?.visibility === "private"
  const operatorInitials = getInitials(operatorName)

  if (isPrivateNote) {
    return (
      <div className="flex w-full items-end justify-center my-3">
        <div className="group relative flex flex-col max-w-[85%] sm:max-w-[75%] w-full items-center">
          <div className="w-full rounded-2xl border border-brand/30 bg-accent p-3.5 text-xs text-accent-foreground shadow-2xs">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
              <Lock className="h-3 w-3" />
              <span>{t("conversations.privateNote")}</span>
              <span className="font-normal text-muted-foreground">· {operatorName}</span>
            </div>
            {message.text && (
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {message.text}
              </p>
            )}
            <div className="mt-1.5 flex justify-end text-[10px] text-muted-foreground">
              <span>{formatDetailTimestamp(message.created_at, i18n.language)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex w-full items-end gap-2 my-2.5",
        isInbound ? "justify-start" : "justify-end"
      )}
    >
      <div
        className={cn(
          "group relative flex flex-col max-w-[78%] sm:max-w-[70%]",
          isInbound ? "items-start" : "items-end"
        )}
      >
        {/* Bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-2xs border",
            isInbound
              ? "bg-muted/70 text-foreground border-border/60"
              : "bg-accent text-accent-foreground border-border/60"
          )}
        >
          {/* Operator email / tag if available */}
          {!isInbound && typeof message.meta.sent_by_email === "string" && (
            <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">
              {message.meta.sent_by_email}
            </span>
          )}

          {/* Media Player / Image / Document */}
          <MessageMedia message={message} />

          {/* Text Message */}
          {message.text && (
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          )}

          {/* Delivery Error Indicator */}
          {message.meta.delivery_status === "failed" && (
            <p className="mt-1 flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-[11px] text-destructive">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>
                {t("conversations.deliveryFailed", {
                  reason:
                    (message.meta.delivery_detail as string) ||
                    (message.meta.delivery_code as string) ||
                    "?",
                })}
              </span>
            </p>
          )}
        </div>

        {/* Timestamp and Delivery Checkmarks */}
        <div
          className={cn(
            "mt-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground select-none",
            isInbound ? "justify-start" : "justify-end"
          )}
        >
          <span>{formatDetailTimestamp(message.created_at, i18n.language)}</span>
          {!isInbound && (
            <CheckCheck className="h-3.5 w-3.5 text-success stroke-[2.5]" />
          )}
        </div>
      </div>

      {/* Operator avatar on outbound message */}
      {!isInbound && (
        <Avatar className="h-6 w-6 shrink-0 mb-5 ring-1 ring-border">
          <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">
            {operatorInitials}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

export function ConversationThread({
  contact,
  isSidebarOpen,
  onToggleSidebar,
}: ConversationThreadProps) {
  const { t } = useTranslation()
  const { data: admin } = useAdminAuth()
  const setMode = useSetMode(contact.id)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [activeTab, setActiveTab] = useState<"messages" | "dashboard">("messages")

  const { data: messages, isLoading } = useContactMessages(
    contact.id,
    { limit },
    { poll: true }
  )

  const isHuman = contact.mode === "human"
  const window = whatsappWindow(contact)
  const initials = getInitials(contact.display_name ?? contact.external_id)
  const operatorName = admin?.full_name || "Riley Brooks"

  const timeline = [...(messages?.items ?? [])].reverse()
  const hasOlder = (messages?.total ?? 0) > (messages?.items.length ?? 0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const newestId = messages?.items[0]?.id
  const pinnedFor = useRef<string | null>(null)
  const atBottom = useRef(true)

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el || newestId === undefined) return
    if (pinnedFor.current !== contact.id) {
      pinnedFor.current = contact.id
      atBottom.current = true
      el.scrollTop = el.scrollHeight
      return
    }
    if (atBottom.current) el.scrollTop = el.scrollHeight
  }, [newestId, contact.id])

  useEffect(() => {
    const el = scrollRef.current
    const content = contentRef.current
    if (!el || !content) return
    const observer = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight
    })
    observer.observe(content)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex h-full w-full flex-col bg-background overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        {/* Left Customer Info */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-8 w-8 p-0 lg:hidden text-muted-foreground"
          >
            <Link to="/conversations">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/50">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {contact.display_name ?? contact.external_id}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-mono text-[11px]">#{contact.id.slice(0, 6)}</span>
              <span>·</span>
              <ChannelBadge channel={contact.channel} className="text-[10px]" />
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* SLA Flame Badge */}
          {window && window.open && (
            <span className="hidden items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-foreground sm:inline-flex">
              <Flame className="h-3.5 w-3.5 text-warning" />
              <span>{formatRemaining(window.remainingMs)}</span>
            </span>
          )}

          {/* Resolve / Mode Toggle Action */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-lg text-xs font-medium"
              >
                <span>{isHuman ? t("conversations.resolve") : t("conversations.takeOver")}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => setMode.mutate(isHuman ? "agent" : "human")}
                className="gap-2 text-xs"
              >
                {isHuman ? (
                  <>
                    <Bot className="h-4 w-4 text-brand" />
                    <span>{t("conversations.resumeBot")}</span>
                  </>
                ) : (
                  <>
                    <Hand className="h-4 w-4 text-primary" />
                    <span>{t("conversations.takeOver")}</span>
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setMode.mutate("agent")}
                className="gap-2 text-xs"
              >
                <RotateCcw className="h-4 w-4 text-muted-foreground" />
                <span>{t("conversations.resolve")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Toggle Right Contact Details Sidebar */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            title={t("conversations.toggleContact")}
          >
            {isSidebarOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRight className="h-4 w-4" />
            )}
          </Button>

          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setMode.mutate(isHuman ? "agent" : "human")}
                className="text-xs"
              >
                {isHuman ? t("conversations.resumeBot") : t("conversations.takeOver")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Subheader Tabs: Messages · Customer Dashboard */}
      <div className="flex border-b border-border bg-card px-4 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("messages")}
          className={cn(
            "relative py-2.5 px-3 transition-colors",
            activeTab === "messages"
              ? "text-foreground font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-brand"
              : "text-muted-foreground hover:text-foreground font-medium"
          )}
        >
          {t("conversations.tabMessages")}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("dashboard")}
          className={cn(
            "relative py-2.5 px-3 transition-colors",
            activeTab === "dashboard"
              ? "text-foreground font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-brand"
              : "text-muted-foreground hover:text-foreground font-medium"
          )}
        >
          {t("conversations.tabDashboard")}
        </button>
      </div>

      {/* Main Conversation Body */}
      {activeTab === "messages" ? (
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* Floating Action Buttons matching sample.webp (Top-Right inside chat area) */}
          <div className="absolute right-4 top-4 z-10 hidden sm:flex flex-col gap-2">
            <button
              type="button"
              onClick={onToggleSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/95 text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground backdrop-blur-xs"
              title={t("conversations.toggleContact")}
            >
              <User className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggleSidebar}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/95 text-muted-foreground shadow-xs transition-colors hover:bg-muted hover:text-foreground backdrop-blur-xs",
                isSidebarOpen && "border-brand/50 bg-brand/10 text-foreground"
              )}
              title={t("conversations.toggleContact")}
            >
              <PanelRight className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable Message Timeline */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-4"
          >
            <div ref={contentRef} className="mx-auto max-w-3xl space-y-2">
              {isLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  {t("common.loading")}
                </div>
              ) : timeline.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  {t("conversations.noMessages")}
                </div>
              ) : (
                <>
                  {hasOlder && (
                    <div className="py-2 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLimit((l) => l + PAGE_SIZE)}
                        className="h-7 text-xs"
                      >
                        {t("conversations.loadOlder")}
                      </Button>
                    </div>
                  )}

                  {timeline.map((msg) => (
                    <MessageBubbleItem
                      key={msg.id}
                      message={msg}
                      operatorName={operatorName}
                    />
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="mx-auto w-full max-w-3xl">
            <ConversationComposer contact={contact} />
          </div>
        </div>
      ) : (
        /* Customer Dashboard Tab View */
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xs">
            <h3 className="text-base font-semibold text-foreground mb-4">
              {t("conversations.customerProfile")}
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <dt className="text-muted-foreground font-medium">{t("conversations.externalId")}</dt>
                <dd className="mt-1 font-mono text-foreground">{contact.external_id}</dd>
              </div>
              {contact.wa_id && (
                <div>
                  <dt className="text-muted-foreground font-medium">WhatsApp ID</dt>
                  <dd className="mt-1 font-mono text-foreground">{contact.wa_id}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground font-medium">{t("conversations.channelTitle")}</dt>
                <dd className="mt-1 text-foreground capitalize">{contact.channel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground font-medium">Mode</dt>
                <dd className="mt-1 text-foreground">
                  {isHuman
                    ? t("conversations.humanOperator")
                    : t("conversations.botAgent")}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}
