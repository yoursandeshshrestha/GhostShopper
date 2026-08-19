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
  Brain,
  ChatTeardropText,
  SpeakerHigh,
  UsersThree,
  WarningCircle,
  CurrencyDollar,
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
  { title: 'Team', href: '/team', icon: UsersThree },
  { title: 'Scorecards', href: '/scorecard', icon: ClipboardText },
  { title: 'Review', href: '/review', icon: WarningCircle },
  { title: 'Agents', href: '/agent', icon: ChatTeardropText },
  { title: 'Schedule', href: '/schedule', icon: CalendarBlank },
]

export const adminNav: NavItem[] = [
  { title: 'Overview', href: '/admin', icon: House },
  { title: 'Organisations', href: '/admin/organisations', icon: Buildings },
  { title: 'Users', href: '/admin/users', icon: UsersThree },
  { title: 'Voices', href: '/admin/voices', icon: SpeakerHigh },
  { title: 'AI models', href: '/admin/ai', icon: Brain },
  { title: 'Spend', href: '/admin/usage', icon: CurrencyDollar },
  { title: 'Calls', href: '/admin/calls', icon: PhoneCall },
]

export const secondaryNav: NavItem[] = [
  { title: 'Settings', href: '/settings', icon: Gear },
  { title: 'Support', href: '/support', icon: Headphones },
]
