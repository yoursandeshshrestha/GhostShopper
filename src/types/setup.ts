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
  name: string
  prompt: string
  persona: string
  goals: string
  conversationRules: string
  approved: boolean
}

export interface ScenarioTemplate {
  id: string
  name: string
  description: string
  prompt: string
}

export const SCENARIO_TEMPLATES: ScenarioTemplate[] = [
  {
    id: 'appointment',
    name: 'Book an appointment',
    description: 'Ask about availability, pricing, and what to bring.',
    prompt:
      'I want the AI to call pretending to book an appointment. They should ask about availability this week, pricing, and what they need to bring or prepare.',
  },
  {
    id: 'product-enquiry',
    name: 'Product enquiry',
    description: 'Ask about a product or service, stock, and recommendations.',
    prompt:
      'I want the AI to call asking about a specific product or service — whether it is available, how much it costs, and what the staff would recommend for a new customer.',
  },
  {
    id: 'new-customer',
    name: 'New customer',
    description: 'First-time caller exploring whether this business fits.',
    prompt:
      'I want the AI to call as a first-time customer who found the business online. They should ask what services are offered, opening hours, and what makes this location a good choice.',
  },
  {
    id: 'pricing',
    name: 'Pricing & packages',
    description: 'Compare options and ask what is included.',
    prompt:
      'I want the AI to call comparing pricing options and asking what is included in each package or tier, plus whether there are any current promotions.',
  },
  {
    id: 'website',
    name: 'Website enquiry',
    description: 'Questions they could not answer from the website.',
    prompt:
      'I want the AI to call after visiting the website with questions they could not find online — opening hours, parking, location details, and how to get started as a new customer.',
  },
  {
    id: 'complaint',
    name: 'Complaint follow-up',
    description: 'Previous bad experience — will they come back?',
    prompt:
      'I want the AI to call as a customer who had a disappointing visit last month. They should explain what went wrong and ask whether things have improved and if it is worth giving the business another chance.',
  },
]

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
