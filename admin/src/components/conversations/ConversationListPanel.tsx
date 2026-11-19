import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  ArrowUpDown,
  BarChart2,
  Bot,
  ChevronDown,
  CornerDownLeft,
  Flame,
  Search,
  SlidersHorizontal,
  SquarePen,
  User,
  X,
} from "lucide-react"
import type { ContactListItem } from "@/types/api"
import { useContacts } from "@/hooks/useContacts"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { channelIcon } from "@/components/shared/ChannelBadge"
import { Pagination } from "@/components/shared/Pagination"
import { cn } from "@/lib/utils"
import {
  formatRemaining,
  formatSampleTime,
  getContactTags,
  getInitials,
  whatsappWindow,
} from "./utils"

const PAGE_SIZE = 25
const CHANNEL_FILTERS = ["whatsapp", "whatsapp-waha", "telegram"] as const

interface ConversationListPanelProps {
  selectedContactId?: string
}

export function ConversationListPanel({
  selectedContactId,
}: ConversationListPanelProps) {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved">("open")
  const [activeTab, setActiveTab] = useState<"mine" | "unassigned" | "all">("all")

  const humanOnly = searchParams.get("mode") === "human" || activeTab === "mine"
  const channel = searchParams.get("channel") ?? undefined

  const { data, isLoading } = useContacts(
    {
      search: search || undefined,
      mode: humanOnly ? "human" : undefined,
      channel,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    },
    { poll: true }
  )

  const { data: humanCount } = useContacts({ mode: "human", limit: 1 }, { poll: true })
  const { data: allCount } = useContacts({ limit: 1 }, { poll: true })

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))

  const updateChannel = (ch: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (ch) next.set("channel", ch)
    else next.delete("channel")
    setSearchParams(next)
    setPage(1)
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-card">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            {t("conversations.title")}
          </h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <span>
                  {statusFilter === "open"
                    ? t("conversations.statusOpen")
                    : t("conversations.statusResolved")}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              <DropdownMenuItem onClick={() => setStatusFilter("open")}>
                {t("conversations.statusOpen")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("resolved")}>
                {t("conversations.statusResolved")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-1 text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title={t("conversations.filterAll")}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title={t("common.actions")}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-foreground"
            title={t("conversations.newConversation")}
          >
            <SquarePen className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs Row: Mine · Unassigned · All */}
      <div className="flex border-b border-border px-3 text-xs">
        <button
          type="button"
          onClick={() => {
            setActiveTab("mine")
            setPage(1)
          }}
          className={cn(
            "relative flex items-center gap-1.5 py-2.5 px-3 transition-colors",
            activeTab === "mine"
              ? "text-foreground font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-brand"
              : "text-muted-foreground hover:text-foreground font-medium"
          )}
        >
          <span>{t("conversations.tabMine")}</span>
          <span className="font-normal opacity-90">{humanCount?.total ?? 0}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("unassigned")
            setPage(1)
          }}
          className={cn(
            "relative flex items-center gap-1.5 py-2.5 px-3 transition-colors",
            activeTab === "unassigned"
              ? "text-foreground font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-brand"
              : "text-muted-foreground hover:text-foreground font-medium"
          )}
        >
          <span>{t("conversations.tabUnassigned")}</span>
          <span className="font-normal opacity-90">0</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("all")
            setPage(1)
          }}
          className={cn(
            "relative flex items-center gap-1.5 py-2.5 px-3 transition-colors",
            activeTab === "all"
              ? "text-foreground font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-brand"
              : "text-muted-foreground hover:text-foreground font-medium"
          )}
        >
          <span>{t("conversations.tabAll")}</span>
          <span className="font-normal opacity-90">{allCount?.total ?? 0}</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder={t("conversations.searchPlaceholder")}
            className="w-full rounded-md border border-input bg-background pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Channel Filter Chips */}
        <div className="mt-2 flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
          <button
            type="button"
            onClick={() => updateChannel(null)}
            className={cn(
              "shrink-0 rounded-md px-2 py-0.5 transition-colors",
              !channel
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            )}
          >
            {t("conversations.filterChannelAll")}
          </button>
          {CHANNEL_FILTERS.map((ch) => {
            const Icon = channelIcon(ch)
            return (
              <button
                key={ch}
                type="button"
                onClick={() => updateChannel(channel === ch ? null : ch)}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 transition-colors",
                  channel === ch
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground"
                )}
              >
                {Icon && <Icon className="h-3 w-3" />}
                <span>{t(`conversations.channel.${ch}`)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Conversations List Items */}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          selectedContactId
            ? "space-y-1 px-2 py-1"
            : "grid content-start grid-cols-1 gap-2 px-4 py-3 md:grid-cols-2 2xl:grid-cols-3"
        )}
      >
        {isLoading ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {t("common.loading")}
          </div>
        ) : !data?.items.length ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            {search
              ? t("conversations.noMatchingConversations")
              : humanOnly
              ? t("conversations.emptyHuman")
              : t("conversations.empty")}
          </div>
        ) : (
          data.items.map((contact: ContactListItem) => {
            const isSelected = contact.id === selectedContactId
            const ChannelIcon = channelIcon(contact.channel)
            const window = whatsappWindow(contact)
            const initials = getInitials(contact.display_name ?? contact.external_id)
            const timeAgo = contact.last_message?.created_at
              ? formatSampleTime(contact.last_message.created_at)
              : ""
            const tags = getContactTags(contact)

            return (
              <Link
                key={contact.id}
                to={`/conversations/${contact.id}`}
                className={cn(
                  "group relative flex items-start gap-3 rounded-xl p-3 transition-all border",
                  isSelected
                    ? "border-brand/40 bg-brand/10 shadow-2xs"
                    : "border-transparent hover:bg-muted/40 hover:border-border/40"
                )}
              >
                {/* Avatar */}
                <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border/40">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  {/* Top Line: Channel on left, Assignee & Time on right */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1 truncate font-medium">
                      {ChannelIcon && <ChannelIcon className="h-3 w-3 shrink-0" />}
                      <span className="truncate">
                        {t(`conversations.channel.${contact.channel}`, {
                          defaultValue: contact.channel,
                        })}
                      </span>
                    </span>

                    <span className="flex items-center gap-1 shrink-0 ml-1">
                      <span className="flex items-center gap-1 text-[10px]">
                        {contact.mode === "human" ? (
                          <User className="h-3 w-3" />
                        ) : (
                          <Bot className="h-3 w-3" />
                        )}
                        <span className="truncate max-w-[90px]">
                          {contact.mode === "human"
                            ? t("conversations.humanOperator")
                            : t("conversations.botAgent")}
                        </span>
                        {contact.mode === "human" && (
                          <BarChart2 className="h-2.5 w-2.5 shrink-0 text-warning" />
                        )}
                      </span>
                      {timeAgo && <span>• {timeAgo}</span>}
                    </span>
                  </div>

                  {/* Second Line: Contact Name */}
                  <div className="mt-0.5 flex items-center justify-between gap-1">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {contact.display_name ?? contact.external_id}
                    </h3>
                  </div>

                  {/* Third Line: Last message preview */}
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0 text-xs text-muted-foreground">
                      <CornerDownLeft className="h-3 w-3 shrink-0 opacity-70" />
                      <span className="truncate">
                        {contact.last_message?.text ??
                          (contact.last_message
                            ? t(`conversations.type.${contact.last_message.type}`, {
                                defaultValue: contact.last_message.type,
                              })
                            : t("conversations.noMessages"))}
                      </span>
                    </div>

                    {contact.mode === "human" && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white shrink-0">
                        1
                      </span>
                    )}
                  </div>

                  {/* Fourth Line: Tags and SLA Badges */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                    {window && window.open && (
                      <span className="inline-flex items-center gap-1 rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 font-medium text-foreground">
                        <Flame className="h-3 w-3 text-warning" />
                        <span>{formatRemaining(window.remainingMs)}</span>
                      </span>
                    )}

                    {tags.map((tag) => (
                      <span
                        key={tag.label}
                        className="inline-flex items-center gap-1 rounded bg-muted/60 dark:bg-muted/30 px-1.5 py-0.5 font-medium text-muted-foreground border border-border/50 text-[10px]"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-2xs bg-brand"
                        />
                        <span className="truncate max-w-[100px]">{tag.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="border-t border-border p-2">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}
