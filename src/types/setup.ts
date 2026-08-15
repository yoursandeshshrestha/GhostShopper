import type { OrgRole } from '@/components/auth/AuthProvider'

export type SetupStep =
  | 'welcome'
  | 'locations'
  | 'scorecard'
  | 'scenario'
  | 'team'
  | 'review'

export const SETUP_STEPS: SetupStep[] = [
  'welcome',
  'locations',
  'scorecard',
  'scenario',
  'team',
  'review',
]

export const SETUP_STEP_LABELS: Record<SetupStep, string> = {
  welcome: 'Welcome',
  locations: 'Locations',
  scorecard: 'Scorecard',
  scenario: 'AI Scenario',
  team: 'Team',
  review: 'Review',
}

export interface SetupLocation {
  id: string
  name: string
  phone: string
  timezone: string
  country: string
  callFrequency: string
}

export interface ScorecardCriterion {
  id: string
  name: string
  weight: number
}

export interface SetupScenario {
  id: string | null
  prompt: string
  persona: string
  goals: string
  conversationRules: string
  approved: boolean
}

export interface SetupInvite {
  id: string
  email: string
  role: Exclude<OrgRole, 'owner'>
  assignedLocationId: string | null
  token: string | null
  saved: boolean
  emailSent: boolean
}

export const DEFAULT_SCORECARD_CRITERIA: Omit<ScorecardCriterion, 'id'>[] = [
  { name: 'Greeting', weight: 15 },
  { name: 'Professionalism', weight: 15 },
  { name: 'Product Knowledge', weight: 15 },
  { name: 'Helpfulness', weight: 15 },
  { name: 'Appointment Booking', weight: 15 },
  { name: 'Closing', weight: 15 },
  { name: 'Overall Experience', weight: 10 },
]

export const CALL_FREQUENCIES = [
  'Daily',
  'Weekly',
  'Bi-weekly',
  'Monthly',
] as const

export const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const

export const COUNTRIES = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'New Zealand',
  'Ireland',
  'India',
  'United Arab Emirates',
  'Singapore',
  'Other',
] as const

export function setupProgressPercent(step: SetupStep): number {
  const index = SETUP_STEPS.indexOf(step)
  if (index <= 0) return 0
  return Math.round((index / (SETUP_STEPS.length - 1)) * 100)
}

export function scorecardWeightTotal(criteria: ScorecardCriterion[]): number {
  return criteria.reduce((sum, item) => sum + (Number(item.weight) || 0), 0)
}

export function createLocalId(): string {
  return crypto.randomUUID()
}
