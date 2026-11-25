import { useState } from "react"
import { useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useContact } from "@/hooks/useContacts"
import { ConversationListPanel } from "@/components/conversations/ConversationListPanel"
import { ConversationThread } from "@/components/conversations/ConversationThread"
import { ContactDetailsSidebar } from "@/components/conversations/ContactDetailsSidebar"
import { ConversationTip } from "@/components/conversations/ConversationTip"
import { cn } from "@/lib/utils"

export function ConversationsPage() {
  const { t } = useTranslation()
  const { contactId } = useParams<{ contactId?: string }>()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const hasSelection = Boolean(contactId)

  const { data: contact, isLoading } = useContact(contactId ?? "", {
    poll: hasSelection,
  })

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-background">
      <div
        className={cn(
          "h-full min-h-0 shrink-0 overflow-hidden transition-[width,flex] duration-300 ease-in-out motion-reduce:transition-none",
          hasSelection
            ? "hidden lg:flex lg:w-[350px] lg:flex-none lg:border-r lg:border-border xl:w-[380px]"
            : "flex w-full min-w-0 flex-none lg:w-[350px] lg:border-r lg:border-border xl:w-[380px]"
        )}
      >
        <ConversationListPanel selectedContactId={contactId} />
      </div>

      {hasSelection ? (
        <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : contact ? (
            <div className="flex h-full min-h-0 w-full min-w-0 overflow-hidden">
              <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
                <ConversationThread
                  contact={contact}
                  isSidebarOpen={isSidebarOpen}
                  onToggleSidebar={() => setIsSidebarOpen((open) => !open)}
                />
              </div>

              {isSidebarOpen && (
                <div className="hidden h-full w-80 shrink-0 border-l border-border xl:flex">
                  <ContactDetailsSidebar
                    contact={contact}
                    onClose={() => setIsSidebarOpen(false)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              {t("conversations.noMessages")}
            </div>
          )}
        </div>
      ) : (
        <div className="hidden h-full min-h-0 min-w-0 flex-1 overflow-hidden lg:flex">
          <ConversationTip />
        </div>
      )}
    </div>
  )
}
