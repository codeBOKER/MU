import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { EmojiPicker } from "frimousse"
import {
  Clock,
  FileText,
  Image as ImageIcon,
  Maximize2,
  Mic,
  Minimize2,
  Paperclip,
  Smile,
  Sparkles,
  Square,
  Trash2,
  X,
  Zap,
} from "lucide-react"
import type { ContactDetail } from "@/types/api"
import { useSendOperatorMessage } from "@/hooks/useContacts"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { formatRemaining, whatsappWindow } from "./utils"

const MAX_MB: Record<string, number> = { image: 5, document: 25, audio: 16 }
const WHATSAPP_IMAGE_MIMES = ["image/jpeg", "image/png"]
const IMAGE_ACCEPT = "image/*"
const DOC_ACCEPT = "application/pdf,.doc,.docx,.xls,.xlsx"

function reencodeToJpeg(dataUri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) return reject(new Error("no canvas 2d context"))
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL("image/jpeg", 0.9))
    }
    img.onerror = () => reject(new Error("could not decode image"))
    img.src = dataUri
  })
}

function EmojiPanel({ onPick }: { onPick: (emoji: string) => void }) {
  const { t, i18n } = useTranslation()
  return (
    <EmojiPicker.Root
      onEmojiSelect={({ emoji }) => onPick(emoji)}
      locale={i18n.language.startsWith("es") ? "es" : "en"}
      className="flex h-80 w-full flex-col bg-background"
    >
      <EmojiPicker.Search
        className="mx-2 mt-2 rounded-md border border-input bg-transparent px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground"
        placeholder={t("conversations.emojiSearch")}
      />
      <EmojiPicker.Viewport className="relative flex-1 outline-none">
        <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          {t("common.loading")}
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          {t("conversations.emojiEmpty")}
        </EmojiPicker.Empty>
        <EmojiPicker.List
          className="select-none pb-2"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div
                className="bg-background px-3 pb-1.5 pt-3 text-[11px] font-medium text-muted-foreground"
                {...props}
              >
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div className="scroll-my-1 px-1.5" {...props}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                className="flex size-7 items-center justify-center rounded text-base hover:bg-accent focus:bg-accent transition-colors"
                {...props}
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  )
}

function formatElapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

interface Attachment {
  kind: "image" | "document" | "audio"
  dataUri: string
  mime: string
  name?: string
}

interface ConversationComposerProps {
  contact: ContactDetail
}

export function ConversationComposer({ contact }: ConversationComposerProps) {
  const { t } = useTranslation()
  const [composerMode, setComposerMode] = useState<"reply" | "note">("reply")
  const [isExpanded, setIsExpanded] = useState(false)
  const [text, setText] = useState("")
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [localError, setLocalError] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const sendOnStop = useRef(false)
  const discardOnStop = useRef(false)
  const emojiRef = useRef<HTMLDivElement>(null)

  const send = useSendOperatorMessage(contact.id)
  const window = whatsappWindow(contact)
  const blocked = window !== null && !window.open

  useEffect(() => {
    if (!showEmoji) return
    const onDown = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowEmoji(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [showEmoji])

  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [recording])

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current
    const start = el?.selectionStart ?? text.length
    const end = el?.selectionEnd ?? text.length
    setText(text.slice(0, start) + emoji + text.slice(end))
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.selectionStart = el.selectionEnd = start + emoji.length
    })
  }

  const onPickFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "image" | "document"
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (file.size > MAX_MB[kind] * 1024 * 1024) {
      setLocalError(t("conversations.attachTooLarge", { mb: MAX_MB[kind] }))
      return
    }
    setLocalError(null)
    const reader = new FileReader()
    reader.onload = async () => {
      let dataUri = reader.result as string
      let mime = file.type
      let name = file.name
      if (kind === "image" && !WHATSAPP_IMAGE_MIMES.includes(mime)) {
        try {
          dataUri = await reencodeToJpeg(dataUri)
          mime = "image/jpeg"
          name = name.replace(/\.[^.]+$/, "") + ".jpg"
        } catch {
          setLocalError(t("conversations.attachUnsupportedImage"))
          return
        }
      }
      setAttachment({ kind, dataUri, mime, name })
    }
    reader.readAsDataURL(file)
  }

  const reset = () => {
    setText("")
    setShowEmoji(false)
  }

  const sendAudio = (dataUri: string) => {
    const trimmed = text.trim()
    send.mutate(
      { type: "audio", text: null, media_data_uri: dataUri, filename: null },
      {
        onSuccess: () => {
          setAttachment(null)
          if (trimmed) {
            send.mutate({ type: "text", text: trimmed }, { onSuccess: reset })
          } else {
            reset()
          }
        },
      }
    )
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime =
        ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm"].find((m) =>
          MediaRecorder.isTypeSupported(m)
        ) ?? "audio/webm"
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      const chunks: Blob[] = []
      recorder.ondataavailable = (ev) => {
        if (ev.data.size) chunks.push(ev.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        setRecording(false)
        if (discardOnStop.current) {
          discardOnStop.current = false
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          const dataUri = reader.result as string
          if (sendOnStop.current) {
            sendOnStop.current = false
            sendAudio(dataUri)
          } else {
            setAttachment({ kind: "audio", dataUri, mime })
          }
        }
        reader.readAsDataURL(new Blob(chunks, { type: mime }))
      }
      recorderRef.current = recorder
      recorder.start()
      setElapsed(0)
      setRecording(true)
      setLocalError(null)
    } catch {
      setLocalError(t("conversations.micDenied"))
    }
  }

  const cancelRecording = () => {
    discardOnStop.current = true
    recorderRef.current?.stop()
  }
  const stopToPreview = () => recorderRef.current?.stop()
  const stopAndSend = () => {
    sendOnStop.current = true
    recorderRef.current?.stop()
  }

  const canSend = !blocked && !send.isPending
  const handleSend = () => {
    if (!canSend) return
    if (recording) {
      stopAndSend()
      return
    }
    const trimmed = text.trim()
    if (attachment) {
      if (attachment.kind === "audio") {
        sendAudio(attachment.dataUri)
        return
      }
      send.mutate(
        {
          type: attachment.kind,
          text: trimmed || null,
          media_data_uri: attachment.dataUri,
          filename: attachment.name ?? null,
        },
        {
          onSuccess: () => {
            setAttachment(null)
            reset()
          },
        }
      )
    } else if (trimmed) {
      send.mutate({ type: "text", text: trimmed }, { onSuccess: reset })
    }
  }

  const error = send.error as
    | { response?: { data?: { detail?: { code?: string } } } }
    | null
  const errorCode = error?.response?.data?.detail?.code
  const errorText = send.isError
    ? errorCode === "WINDOW_EXPIRED"
      ? t("conversations.windowExpired")
      : t("conversations.sendError", { code: errorCode ?? "" })
    : localError

  return (
    <div className="p-3 bg-card border-t border-border">
      {/* WhatsApp Window Banner if closing soon or expired */}
      {window && (
        <div
          className={cn(
            "mb-2 flex items-center justify-between rounded-lg px-3 py-1.5 text-xs border",
            window.open
              ? "border-warning/30 bg-warning/10 text-foreground"
              : "bg-destructive/10 text-destructive border-destructive/20"
          )}
        >
          <span className="flex items-center gap-1.5">
            <Clock className={cn("h-3.5 w-3.5", window.open && "text-warning")} />
            <span>
              {window.open
                ? t("conversations.windowClosesIn", {
                    time: formatRemaining(window.remainingMs),
                  })
                : t("conversations.windowExpired")}
            </span>
          </span>
        </div>
      )}

      {/* Attachment Preview Box */}
      {attachment && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-background p-2">
          {attachment.kind === "image" ? (
            <img
              src={attachment.dataUri}
              alt={attachment.name ?? t("conversations.mediaImageAlt")}
              className="h-12 w-12 rounded object-cover border border-border"
            />
          ) : attachment.kind === "audio" ? (
            <audio controls src={attachment.dataUri} className="h-9 w-56" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-muted-foreground">
              <FileText className="h-5 w-5" />
            </div>
          )}
          {attachment.name && (
            <span className="min-w-0 flex-1 truncate text-xs text-foreground font-medium">
              {attachment.name}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setAttachment(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Composer Card Container */}
      <div className="rounded-2xl border border-border bg-background shadow-2xs transition-all focus-within:ring-1 focus-within:ring-ring focus-within:border-ring">
        {/* Top bar inside composer: Reply / Private Note tabs & tools */}
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setComposerMode("reply")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                composerMode === "reply"
                  ? "bg-muted text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("conversations.reply")}
            </button>
            <button
              type="button"
              onClick={() => setComposerMode("note")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                composerMode === "note"
                  ? "bg-brand/10 text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("conversations.privateNote")}
            </button>
          </div>

          <div className="flex items-center gap-1 text-muted-foreground">
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted hover:text-foreground transition-colors"
              title={t("conversations.aiAssist")}
            >
              <Sparkles className="h-3.5 w-3.5 text-brand" />
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted hover:text-foreground transition-colors"
              title={t("conversations.expand")}
            >
              {isExpanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Text Area or Recording Bar */}
        <div className="relative p-3">
          {/* Canned Responses Autocomplete Popover */}
          {text.startsWith("/") && (
            <div className="absolute bottom-full left-3 z-30 mb-2 w-80 rounded-xl border border-border bg-card shadow-lg p-1.5 space-y-1">
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Canned Responses
              </div>
              {[
                { title: "Greeting", text: t("conversations.macroGreeting") },
                { title: "One moment", text: t("conversations.macroWait") },
                { title: "Resolved", text: t("conversations.macroResolved") },
              ].map((macro, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setText(macro.text)
                    textareaRef.current?.focus()
                  }}
                  className="flex w-full flex-col items-start rounded-lg px-2.5 py-1.5 text-left hover:bg-muted/70 transition-colors"
                >
                  <span className="text-xs font-medium text-foreground">{macro.title}</span>
                  <span className="text-[11px] text-muted-foreground truncate w-full">
                    {macro.text}
                  </span>
                </button>
              ))}
            </div>
          )}

          {recording ? (
            <div className="flex min-h-[46px] items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={cancelRecording}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <span className="flex items-center gap-2 text-xs font-medium tabular-nums text-destructive">
                <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                {formatElapsed(elapsed)}
              </span>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive"
                onClick={stopToPreview}
              >
                <Square className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) || (e.key === "Enter" && !e.shiftKey)) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={
                blocked
                  ? t("conversations.composerBlocked")
                  : composerMode === "note"
                  ? t("conversations.privateNote")
                  : t("conversations.cannedHint")
              }
              disabled={blocked || send.isPending}
              rows={isExpanded ? 6 : 2}
              className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="flex items-center justify-between border-t border-border/60 px-3 py-2">
          <div className="flex items-center gap-1">
            {/* Emoji popover */}
            <div className="relative" ref={emojiRef}>
              <button
                type="button"
                disabled={blocked || recording}
                onClick={() => setShowEmoji(!showEmoji)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  showEmoji && "bg-muted text-foreground"
                )}
                title={t("conversations.emoji")}
              >
                <Smile className="h-4 w-4" />
              </button>
              {showEmoji && (
                <div className="absolute bottom-full left-0 z-50 mb-2 w-[340px] overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                  <EmojiPanel onPick={insertEmoji} />
                </div>
              )}
            </div>

            {/* Attachment dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={blocked || recording}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title={t("conversations.attach")}
                >
                  <Paperclip className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-44">
                <DropdownMenuItem
                  onClick={() => imageInputRef.current?.click()}
                  className="gap-2 text-xs"
                >
                  <ImageIcon className="h-4 w-4 text-primary" />
                  {t("conversations.attachPhotos")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => docInputRef.current?.click()}
                  className="gap-2 text-xs"
                >
                  <FileText className="h-4 w-4 text-primary" />
                  {t("conversations.attachDocument")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Hidden file inputs */}
            <input
              ref={imageInputRef}
              type="file"
              hidden
              accept={IMAGE_ACCEPT}
              onChange={(e) => onPickFile(e, "image")}
            />
            <input
              ref={docInputRef}
              type="file"
              hidden
              accept={DOC_ACCEPT}
              onChange={(e) => onPickFile(e, "document")}
            />

            {/* Voice record button */}
            <button
              type="button"
              disabled={blocked || send.isPending}
              onClick={recording ? stopAndSend : startRecording}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                recording
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={t("conversations.record")}
            >
              <Mic className="h-4 w-4" />
            </button>

            {/* Quick canned responses trigger */}
            <button
              type="button"
              disabled={blocked}
              onClick={() => {
                const el = textareaRef.current
                if (el) {
                  setText((prev) => (prev ? prev + " /" : "/"))
                  el.focus()
                }
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Canned responses (/)"
            >
              <Zap className="h-4 w-4" />
            </button>
          </div>

          {/* Send Button matching sample.webp */}
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!canSend || (!text.trim() && !attachment && !recording)}
            className="h-8 rounded-lg bg-brand px-4 text-xs font-semibold text-brand-foreground shadow-2xs transition-colors hover:bg-brand/90"
          >
            <span>{t("conversations.sendButton")}</span>
          </Button>
        </div>
      </div>

      {errorText && (
        <p className="mt-2 text-xs text-destructive font-medium">{errorText}</p>
      )}
    </div>
  )
}
