"use client"

import * as React from "react"

interface SidebarContextType {
  isCollapsed: boolean
  toggleSidebar: () => void
  setCollapsed: (collapsed: boolean) => void
}

const SidebarContext = React.createContext<SidebarContextType>({
  isCollapsed: false,
  toggleSidebar: () => {},
  setCollapsed: () => {},
})

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false
  try {
    return localStorage.getItem("sidebar_collapsed") === "true"
  } catch {
    return false
  }
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = React.useState(getInitialCollapsed)

  const toggleSidebar = React.useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem("sidebar_collapsed", String(next))
      } catch {
        // LocalStorage non disponible
      }
      return next
    })
  }, [])

  const setCollapsed = React.useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed)
    try {
      localStorage.setItem("sidebar_collapsed", String(collapsed))
    } catch {
      // LocalStorage non disponible
    }
  }, [])

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return React.useContext(SidebarContext)
}
