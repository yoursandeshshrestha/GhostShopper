import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/brand/Logo'
import { Moon, PhoneOutgoing, SidebarSimple, SignOut, Sun } from '@phosphor-icons/react'
import { useTheme } from 'next-themes'
import { useAuth } from '@/components/auth/AuthProvider'
import { useOrgContext } from '@/hooks/use-org-context'
import { LogoutConfirmDialog } from '@/components/auth/LogoutConfirmDialog'
import { useNewCall } from '@/components/calls/NewCallProvider'
import { primaryNav, secondaryNav, adminNav } from '@/config/sidebar'
import { useAwaitingReviewCount } from '@/hooks/use-awaiting-review-count'
import { appHome, canAccessNav, isPlatformAdmin, showNewCallCta } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

function SidebarWordmark({ homeHref }: { homeHref: string }) {
  return <Logo to={homeHref} variant="full" className="max-w-full" />
}

export function AppSidebar() {
  const { profile, signOut } = useAuth()
  const { profile: effectiveProfile, organisation, role } = useOrgContext()
  const { openNewCall } = useNewCall()
  const email = effectiveProfile?.email ?? profile?.email ?? null
  const organisationName =
    organisation?.name ||
    (profile?.role === 'superadmin' && !effectiveProfile?.orgId
      ? 'Platform'
      : null)
  const location = useLocation()
  const navigate = useNavigate()
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const { resolvedTheme, setTheme } = useTheme()
  const [themeReady, setThemeReady] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const roleForNav = role
  const homeHref = appHome(roleForNav)
  const isAdmin = isPlatformAdmin(profile?.role) && !organisation
  const visiblePrimaryNav = (isAdmin ? adminNav : primaryNav).filter((item) =>
    canAccessNav(item.href, roleForNav)
  )
  const visibleSecondaryNav = isAdmin
    ? []
    : secondaryNav.filter((item) => canAccessNav(item.href, roleForNav))

  const awaitingReviewCount = useAwaitingReviewCount()

  useEffect(() => {
    setThemeReady(true)
  }, [])

  const isDark = themeReady && resolvedTheme === 'dark'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  function navButtonClass(isActive: boolean) {
    return cn(
      'h-8 rounded-md px-2.5 text-muted-foreground transition-colors',
      'hover:bg-sidebar-accent hover:text-foreground',
      'data-active:bg-sidebar-accent data-active:font-medium data-active:text-foreground',
      'group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!',
      'group-data-[collapsible=icon]:[&_span]:hidden',
      isActive && 'bg-sidebar-accent text-foreground'
    )
  }

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader
        className={cn(
          isCollapsed ? 'items-center gap-2 p-2' : 'gap-0 p-4 pb-3'
        )}
      >
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleSidebar}
                className="group relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                aria-label="Expand sidebar"
              >
                <Logo variant="icon" className="transition-opacity group-hover:opacity-0" />
                <SidebarSimple
                  className="absolute size-4 opacity-0 transition-opacity group-hover:opacity-100"
                  weight="regular"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" align="center" sideOffset={8}>
              Expand sidebar
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 space-y-0.5">
              <SidebarWordmark homeHref={homeHref} />
              {organisationName ? (
                <p className="truncate text-xs text-muted-foreground">
                  {organisationName}
                </p>
              ) : null}
            </div>
            <SidebarTrigger className="size-8 shrink-0 self-start text-muted-foreground hover:bg-sidebar-accent hover:text-foreground" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent
        className={cn(
          'py-2',
          isCollapsed ? 'px-1.5' : 'px-2'
        )}
      >
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
              {visiblePrimaryNav.map((item) => {
                const isActive =
                  location.pathname === item.href ||
                  (item.href !== '/dashboard' &&
                    item.href !== '/admin' &&
                    location.pathname.startsWith(`${item.href}/`))
                const badge =
                  !isAdmin && item.href === '/review' && awaitingReviewCount > 0
                    ? awaitingReviewCount
                    : item.badge

                return (
                  <SidebarMenuItem key={item.href} className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={navButtonClass(isActive)}
                    >
                      <Link to={item.href}>
                        <item.icon
                          weight={isActive ? 'fill' : 'regular'}
                          className="size-4 shrink-0"
                        />
                        <span>{item.title}</span>
                        {badge != null ? (
                          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                            {badge}
                          </span>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                    {badge != null ? (
                      <span
                        className="pointer-events-none absolute top-1 right-2 hidden size-1.5 rounded-full bg-primary group-data-[collapsible=icon]:block"
                        aria-hidden
                      />
                    ) : null}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
              {visibleSecondaryNav.map((item) => {
                const isActive =
                  location.pathname === item.href ||
                  location.pathname.startsWith(`${item.href}/`)

                return (
                  <SidebarMenuItem
                    key={item.href}
                    className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center"
                  >
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className={navButtonClass(isActive)}
                    >
                      <Link to={item.href}>
                        <item.icon
                          weight={isActive ? 'fill' : 'regular'}
                          className="size-4 shrink-0"
                        />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter
        className={cn(
          'gap-3',
          isCollapsed ? 'items-center p-2' : 'p-4 pt-3'
        )}
      >
        {!isCollapsed && email ? (
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        ) : null}
        <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
          {showNewCallCta(roleForNav) && !isAdmin ? (
            <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
              <SidebarMenuButton
                tooltip="New call"
                onClick={openNewCall}
                className={cn(
                  'h-9 rounded-full bg-primary font-bold tracking-tight text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                  'group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:shrink-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!',
                  'group-data-[collapsible=icon]:[&_span]:hidden'
                )}
              >
                <PhoneOutgoing className="size-4 shrink-0" weight="fill" />
                <span>New call</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ) : null}
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              tooltip={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={navButtonClass(false)}
            >
              {isDark ? (
                <Sun className="size-4 shrink-0" weight="regular" />
              ) : (
                <Moon className="size-4 shrink-0" weight="regular" />
              )}
              <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              tooltip="Log out"
              onClick={() => setLogoutOpen(true)}
              className={navButtonClass(false)}
            >
              <SignOut className="size-4 shrink-0" weight="regular" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!isCollapsed ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground/80">
            Every location. Every week. Scored.
          </p>
        ) : null}
      </SidebarFooter>
      <LogoutConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={handleSignOut}
      />
    </Sidebar>
  )
}
