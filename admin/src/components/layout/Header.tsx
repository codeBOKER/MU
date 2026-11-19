import { Menu, PanelLeftClose } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  showMenuToggle: boolean
  sidebarExpanded: boolean
  onToggleSidebar: () => void
}

const pageTitles: Array<[string, string]> = [
  ["/settings", "settings.title"],
  ["/prompt", "prompt.title"],
  ["/faq", "faq.title"],
  ["/knowledge", "knowledge.title"],
  ["/tools", "tools.title"],
  ["/conversations", "conversations.title"],
  ["/leads", "leads.title"],
]

export function Header({
  showMenuToggle,
  sidebarExpanded,
  onToggleSidebar,
}: HeaderProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const titleKey =
    location.pathname === "/"
      ? "dashboard.title"
      : pageTitles.find(([path]) => location.pathname.startsWith(path))?.[1] ??
        "dashboard.title"

  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 md:px-6">
      {showMenuToggle && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("nav.toggleNavigation")}
          aria-expanded={sidebarExpanded}
          aria-controls="admin-sidebar"
          onClick={onToggleSidebar}
          className="shrink-0"
        >
          {sidebarExpanded ? (
            <PanelLeftClose className="size-4" />
          ) : (
            <Menu className="size-4" />
          )}
        </Button>
      )}
      <h1 className="min-w-0 truncate text-sm font-semibold text-foreground md:text-base">
        {t(titleKey)}
      </h1>
    </header>
  )
}
