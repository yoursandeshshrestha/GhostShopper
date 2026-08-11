import type { Icon } from '@phosphor-icons/react'
import {
  ClipboardText,
  Gear,
  Headphones,
  House,
  MapPin,
  PhoneOutgoing,
  Robot,
  WarningCircle,
} from '@phosphor-icons/react'

export interface NavItem {
  title: string
  href: string
  icon: Icon
  badge?: string | number
}

export const primaryNav: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: House },
  { title: 'Locations', href: '/locations', icon: MapPin },
  { title: 'Scorecard', href: '/scorecard', icon: ClipboardText },
  { title: 'Review', href: '/review', icon: WarningCircle, badge: 3 },
  { title: 'Agent', href: '/agent', icon: Robot },
  { title: 'New call', href: '/new-call', icon: PhoneOutgoing },
]

export const secondaryNav: NavItem[] = [
  { title: 'Support', href: '/support', icon: Headphones },
  { title: 'Settings', href: '/settings', icon: Gear },
]
