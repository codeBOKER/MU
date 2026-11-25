import { createContext, useContext, useState, type ReactNode } from "react"

interface HeaderContentContextValue {
  headerContent: ReactNode | null
  setHeaderContent: (content: ReactNode | null) => void
}

const HeaderContentContext = createContext<HeaderContentContextValue | null>(null)
const emptyHeaderContent: HeaderContentContextValue = {
  headerContent: null,
  setHeaderContent: () => {},
}

export function HeaderContentProvider({ children }: { children: ReactNode }) {
  const [headerContent, setHeaderContent] = useState<ReactNode | null>(null)

  return (
    <HeaderContentContext.Provider value={{ headerContent, setHeaderContent }}>
      {children}
    </HeaderContentContext.Provider>
  )
}

export function useHeaderContent() {
  return useContext(HeaderContentContext) ?? emptyHeaderContent
}
