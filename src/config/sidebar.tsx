import type { Icon } from '@phosphor-icons/react'
import {
  Buildings,
  CalendarBlank,
  ClipboardText,
  Gear,
  Headphones,
  House,
  MapPin,
  PhoneCall,
  PhoneOutgoing,
  Robot,
  UsersThree,
  WarningCircle,
} from '@phosphor-icons/react'

export interface NavItem {
  title: string
  href: string
  icon: Icon
  badge?: string | number
}

export const primaryNav: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: House },
  { title: 'Locations', href: '/locations', icon: MapPin },
  { title: 'Scorecards', href: '/scorecard', icon: ClipboardText },
  { title: 'Review', href: '/review', icon: WarningCircle },
  { title: 'Agents', href: '/agent', icon: Robot },
  { title: 'Schedule', href: '/schedule', icon: CalendarBlank },
  { title: 'New call', href: '/new-call', icon: PhoneOutgoing },
]

export const adminNav: NavItem[] = [
  { title: 'Overview', href: '/admin', icon: House },
  { title: 'Organisations', href: '/admin/organisations', icon: Buildings },
  { title: 'Users', href: '/admin/users', icon: UsersThree },
  { title: 'Calls', href: '/admin/calls', icon: PhoneCall },
]

export const secondaryNav: NavItem[] = [
  { title: 'Settings', href: '/settings', icon: Gear },
  { title: 'Support', href: '/support', icon: Headphones },
]
