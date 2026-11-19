import { Languages, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useAdminAuth, useAdminLogout } from "@/hooks/useAdminAuth"
import { SUPPORTED_LOCALES } from "@/i18n"
import i18n from "@/i18n"
import { cn } from "@/lib/utils"

function LanguageSettings() {
  const { t } = useTranslation()
  const selectedLocale = (i18n.resolvedLanguage ?? i18n.language).split("-")[0]

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-foreground">
          <Languages className="size-4" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <CardTitle className="text-base">{t("settings.language")}</CardTitle>
          <CardDescription>{t("settings.languageDescription")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div
          role="group"
          aria-label={t("settings.language")}
          className="flex flex-wrap gap-2"
        >
          {SUPPORTED_LOCALES.map((locale) => {
            const isSelected = selectedLocale === locale
            const label = t(`header.${locale === "en" ? "english" : "spanish"}`)

            return (
              <Button
                key={locale}
                type="button"
                variant={isSelected ? "default" : "outline"}
                aria-pressed={isSelected}
                onClick={() => i18n.changeLanguage(locale)}
                className={cn(
                  isSelected && "bg-brand text-brand-foreground hover:bg-brand/90"
                )}
              >
                {label}
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function AccountSettings() {
  const { t } = useTranslation()
  const { data: admin, isLoading, isError } = useAdminAuth()
  const logout = useAdminLogout()
  const initials = admin?.full_name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3 space-y-0">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
          <UserRound className="size-4" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <CardTitle className="text-base">{t("settings.account")}</CardTitle>
          <CardDescription>{t("settings.accountDescription")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : isError || !admin ? (
            <p className="text-sm text-muted-foreground">
              {t("settings.accountUnavailable")}
            </p>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-11">
                <AvatarFallback className="bg-brand text-brand-foreground text-sm font-semibold">
                  {initials || <UserRound className="size-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium text-foreground">
                  {admin.full_name}
                </p>
                <p className="flex min-w-0 items-center gap-1.5 truncate text-sm text-muted-foreground">
                  <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{admin.email}</span>
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                  <span>
                    {t("settings.role")}: {admin.role}
                  </span>
                </p>
              </div>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={logout}
            className="shrink-0 self-start text-destructive hover:bg-destructive/10 hover:text-destructive sm:self-center"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {t("header.logout")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <p className="text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      <div className="grid gap-4">
        <LanguageSettings />
        <AccountSettings />
      </div>
    </div>
  )
}
