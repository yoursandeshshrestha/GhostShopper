import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  CaretUpDown,
  Check,
  Gear,
  MagnifyingGlass,
  SignOut,
} from '@phosphor-icons/react'
import { useAuth } from '@/components/auth/AuthProvider'
import { primaryNav, secondaryNav } from '@/config/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Kbd } from '@/components/ui/kbd'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'

export function AppSidebar() {
  const { user, profile, organisation, signOut } = useAuth()
  const displayName =
    profile?.fullName ||
    (user?.user_metadata?.full_name as string | undefined) ||
    profile?.email ||
    user?.email ||
    'Account'
  const email = profile?.email || user?.email || null
  const roleLabel = profile?.role
    ? profile.role
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ')
    : null
  const organisationName =
    organisation?.name ||
    (profile?.role === 'superadmin' ? 'Platform' : 'Organisation')
  const organisationSubtitle =
    profile?.role === 'superadmin'
      ? 'Superadmin'
      : roleLabel || (organisation ? 'Organisation' : 'No organisation')
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'GS'
  const orgInitials =
    organisationName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || (profile?.role === 'superadmin' ? 'SA' : 'OR')
  const location = useLocation()
  const navigate = useNavigate()
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <Sidebar variant="floating" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu className="group-data-[collapsible=icon]:items-center">
          <SidebarMenuItem className="flex items-center gap-1 group-data-[collapsible=icon]:justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={organisationName}
                  className="flex-1 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">
                      {orgInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {organisationName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {organisationSubtitle}
                    </span>
                  </div>
                  <CaretUpDown className="ml-auto" weight="regular" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-56 w-56 rounded-lg"
                align="start"
                side={isCollapsed ? 'right' : 'bottom'}
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">
                        {orgInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">
                        {organisationName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {organisationSubtitle}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="gap-2">
                  <Check className="size-4" weight="bold" />
                  <span className="truncate">{organisationName}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <SidebarTrigger className="shrink-0 group-data-[collapsible=icon]:hidden" />
          </SidebarMenuItem>
          {isCollapsed && (
            <SidebarMenuItem className="flex justify-center">
              <SidebarTrigger />
            </SidebarMenuItem>
          )}
        </SidebarMenu>

        {!isCollapsed && (
          <div className="relative px-0">
            <MagnifyingGlass
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              weight="regular"
            />
            <SidebarInput
              className="h-9 rounded-md pl-8 pr-12"
              placeholder="Search locations"
            />
            <Kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
              ⌘L
            </Kbd>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="group-data-[collapsible=icon]:p-0">
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
              {primaryNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.href}
                    tooltip={item.title}
                    className="data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground"
                  >
                    <Link to={item.href}>
                      <item.icon weight="regular" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.badge != null && (
                    <SidebarMenuBadge className="top-1/2! -translate-y-1/2 bg-secondary text-muted-foreground peer-data-active/menu-button:bg-success peer-data-active/menu-button:text-success-foreground">
                      {item.badge}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto group-data-[collapsible=icon]:p-0">
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
              {secondaryNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.href}
                    tooltip={item.title}
                    className="data-active:bg-sidebar-accent data-active:font-medium data-active:text-sidebar-accent-foreground"
                  >
                    <Link to={item.href}>
                      <item.icon weight="regular" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu className="group-data-[collapsible=icon]:items-center">
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={displayName}
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    {email ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {email}
                      </span>
                    ) : null}
                  </div>
                  <CaretUpDown className="ml-auto" weight="regular" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-56 w-56 rounded-lg"
                align="start"
                side={isCollapsed ? 'right' : 'top'}
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{displayName}</span>
                      {email ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {email}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer">
                      <Gear className="size-4" weight="regular" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  data-test="logout-button"
                  className="cursor-pointer"
                  onClick={handleSignOut}
                >
                  <SignOut className="size-4" weight="regular" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
