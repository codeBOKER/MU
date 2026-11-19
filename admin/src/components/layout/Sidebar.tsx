import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  BookOpen,
  LayoutDashboard,
  Library,
  MessageSquare,
  Settings,
  Sparkles,
  UserPlus,
  Wrench,
} from "lucide-react"
import { useContacts } from "@/hooks/useContacts"
import { cn } from "@/lib/utils"

const navigation = [
  { key: "nav.dashboard", href: "/", icon: LayoutDashboard },
  { key: "nav.prompt", href: "/prompt", icon: Sparkles },
  { key: "nav.faq", href: "/faq", icon: BookOpen },
  { key: "nav.knowledge", href: "/knowledge", icon: Library },
  { key: "nav.tools", href: "/tools", icon: Wrench },
  { key: "nav.conversations", href: "/conversations", icon: MessageSquare },
  { key: "nav.leads", href: "/leads", icon: UserPlus },
]

interface SidebarProps {
  expanded: boolean
  mobile: boolean
  open: boolean
  hoverEnabled: boolean
  onExpand: () => void
  onCollapse: () => void
  onNavigate: () => void
}

export function Sidebar({
  expanded,
  mobile,
  open,
  hoverEnabled,
  onExpand,
  onCollapse,
  onNavigate,
}: SidebarProps) {
  const { t } = useTranslation()
  const location = useLocation()
  // Waiting-for-human badge on the conversations entry (polls, ADR-004).
  const { data: humanCount } = useContacts({ mode: "human", limit: 1 }, { poll: true })
  const isExpanded = mobile ? open : expanded

  const linkClass = (active: boolean) =>
    cn(
      "group/link flex h-10 items-center overflow-hidden rounded-md text-sm font-medium transition-colors duration-150",
      isExpanded ? "gap-3 px-3" : "justify-center px-0",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    )

  return (
    <>
      {mobile && open && (
        <button
          type="button"
          aria-label={t("common.close")}
          className="fixed inset-0 z-40 cursor-default bg-black/40 md:hidden"
          onClick={onCollapse}
        />
      )}
      <aside
        aria-label={t("nav.navigation")}
        id="admin-sidebar"
        aria-hidden={mobile && !open}
        inert={mobile && !open}
        onMouseEnter={hoverEnabled ? onExpand : undefined}
        onMouseLeave={hoverEnabled ? onCollapse : undefined}
        onFocusCapture={hoverEnabled ? onExpand : undefined}
        onBlurCapture={(event) => {
          if (
            hoverEnabled &&
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            onCollapse()
          }
        }}
        className={cn(
          "z-50 flex h-dvh shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-200 ease-out motion-reduce:transition-none",
          mobile
            ? cn(
                "fixed inset-y-0 left-0 w-64 md:hidden",
                open ? "translate-x-0" : "-translate-x-full"
              )
            : cn("relative hidden md:flex", expanded ? "w-64" : "w-16")
        )}
      >
        <div
          className={cn(
            "relative flex h-14 shrink-0 items-center border-b border-sidebar-border transition-[padding] duration-200",
            isExpanded ? "px-3" : "justify-center px-2"
          )}
        >
          <div className="relative h-10 w-full min-w-0">
            <img
              src="/chasqui-logo.svg"
              alt={isExpanded ? "Chasqui" : ""}
              aria-hidden={!isExpanded}
              className={cn(
                "absolute left-1/2 top-1/2 h-9 max-w-full -translate-x-1/2 -translate-y-1/2 object-contain transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
                isExpanded ? "scale-100 opacity-100" : "scale-95 opacity-0"
              )}
            />
            <img
              src="/favicon.svg"
              alt=""
              aria-hidden="true"
              className={cn(
                "absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 object-contain transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
                isExpanded ? "scale-95 opacity-0" : "scale-100 opacity-100"
              )}
            />
          </div>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto p-2">
          <div className="flex flex-1 flex-col gap-1">
            {navigation.map((item) => {
              const label = t(item.key)
              const isActive =
                item.href === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.href)

              return (
                <Link
                  key={item.key}
                  to={item.href}
                  onClick={onNavigate}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  title={isExpanded ? undefined : label}
                  className={linkClass(isActive)}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span
                    aria-hidden={!isExpanded}
                    className={cn(
                      "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-150 ease-out motion-reduce:transition-none",
                      isExpanded
                        ? "max-w-[11rem] translate-x-0 opacity-100"
                        : "max-w-0 -translate-x-1 opacity-0"
                    )}
                  >
                    {label}
                  </span>
                  {item.href === "/conversations" && (humanCount?.total ?? 0) > 0 && (
                    <span
                      aria-label={t("conversations.filterHuman")}
                      className={cn(
                        "rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground",
                        isExpanded ? "ml-auto" : "absolute right-1 top-1 size-2 p-0"
                      )}
                    >
                      {isExpanded ? humanCount?.total : null}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>

          <div className="border-t border-sidebar-border pt-2">
            {(() => {
              const label = t("nav.settings")
              const isActive = location.pathname.startsWith("/settings")
              return (
                <Link
                  to="/settings"
                  onClick={onNavigate}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  title={isExpanded ? undefined : label}
                  className={linkClass(isActive)}
                >
                  <Settings className="size-4 shrink-0" aria-hidden="true" />
                  <span
                    aria-hidden={!isExpanded}
                    className={cn(
                      "min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,transform] duration-150 ease-out motion-reduce:transition-none",
                      isExpanded
                        ? "max-w-[11rem] translate-x-0 opacity-100"
                        : "max-w-0 -translate-x-1 opacity-0"
                    )}
                  >
                    {label}
                  </span>
                </Link>
              )
            })()}
          </div>
        </nav>
      </aside>
    </>
  )
}
