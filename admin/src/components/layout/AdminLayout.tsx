import { useEffect, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { cn } from "@/lib/utils"

interface ViewportMode {
  mobile: boolean
  touch: boolean
}

function readViewportMode(): ViewportMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return { mobile: false, touch: false }
  }

  return {
    mobile: window.matchMedia("(max-width: 767px)").matches,
    touch: window.matchMedia("(hover: none), (pointer: coarse)").matches,
  }
}

export function AdminLayout() {
  const location = useLocation()
  const [viewport, setViewport] = useState(readViewportMode)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const isConversations = location.pathname.startsWith("/conversations")

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return

    const mobileQuery = window.matchMedia("(max-width: 767px)")
    const touchQuery = window.matchMedia("(hover: none), (pointer: coarse)")
    const updateViewport = () => {
      const next = { mobile: mobileQuery.matches, touch: touchQuery.matches }
      setViewport(next)
      if (next.mobile) setSidebarExpanded(false)
    }

    updateViewport()
    mobileQuery.addEventListener("change", updateViewport)
    touchQuery.addEventListener("change", updateViewport)
    return () => {
      mobileQuery.removeEventListener("change", updateViewport)
      touchQuery.removeEventListener("change", updateViewport)
    }
  }, [])

  const handleSidebarToggle = () => setSidebarExpanded((expanded) => !expanded)
  const closeMobileSidebar = () => {
    if (viewport.mobile) setSidebarExpanded(false)
  }

  return (
    <div className="flex h-dvh min-w-0 overflow-hidden">
      <Sidebar
        expanded={sidebarExpanded}
        mobile={viewport.mobile}
        open={sidebarExpanded}
        hoverEnabled={!viewport.touch && !viewport.mobile}
        onExpand={() => setSidebarExpanded(true)}
        onCollapse={() => setSidebarExpanded(false)}
        onNavigate={closeMobileSidebar}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          showMenuToggle={viewport.mobile || viewport.touch}
          sidebarExpanded={sidebarExpanded}
          onToggleSidebar={handleSidebarToggle}
        />
        <main
          className={cn(
            "min-h-0 min-w-0 flex-1 bg-background",
            isConversations ? "overflow-hidden p-0" : "overflow-auto p-4 md:p-6"
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
