"use client"

import * as React from "react"
import { SidebarProvider, useSidebar } from "@/components/app-shell/sidebar-context"
import { Sidebar } from "@/components/app-shell/sidebar"
import { Topbar, SearchItem, TopbarMember } from "@/components/app-shell/topbar"
import type { NotificationVue } from "@/components/app-shell/notifications-cloche"
import { cn } from "@/lib/utils"

interface AppShellContainerProps {
  searchDb: SearchItem[]
  member: TopbarMember
  notifications?: NotificationVue[]
  nonLues?: number
  children: React.ReactNode
}

function AppShellBody({ searchDb, member, notifications = [], nonLues = 0, children }: AppShellContainerProps) {
  const { isCollapsed } = useSidebar()

  return (
    <div className="h-full bg-background text-foreground">
      <Sidebar />
      <div
        className={cn(
          "flex flex-col h-full transition-all duration-300 ease-in-out",
          isCollapsed ? "lg:pl-20" : "lg:pl-72"
        )}
      >
        <Topbar searchDb={searchDb} member={member} notifications={notifications} nonLues={nonLues} />
        <main className="flex-1 py-10">
          <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export function AppShellContainer(props: AppShellContainerProps) {
  return (
    <SidebarProvider>
      <AppShellBody {...props} />
    </SidebarProvider>
  )
}
