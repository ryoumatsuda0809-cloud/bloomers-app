'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

const MIN_WIDTH = 220
const MAX_WIDTH = 400
const DEFAULT_WIDTH = 288

type SidebarContextType = {
  isOpen: boolean
  width: number
  toggle: () => void
  open: () => void
  close: () => void
  setWidth: (w: number) => void
}

const SidebarContext = createContext<SidebarContextType | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true)
  const [width, setWidthState] = useState(DEFAULT_WIDTH)

  const setWidth = (w: number) => {
    setWidthState(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w)))
  }

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        width,
        toggle: () => setIsOpen((v) => !v),
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        setWidth,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar(): SidebarContextType {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    return {
      isOpen: true,
      width: DEFAULT_WIDTH,
      toggle: () => {},
      open: () => {},
      close: () => {},
      setWidth: () => {},
    }
  }
  return ctx
}
