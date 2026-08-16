import type { CallFrequency } from '@/lib/schedule-time'

export type CallScheduleKind = 'recurring' | 'one_off'
export type CallScheduleStatus =
  | 'active'
  | 'paused'
  | 'cancelled'
  | 'completed'

export interface OrgCallSchedule {
  id: string
  locationId: string
  locationName: string
  timezone: string
  scenarioId: string | null
  scorecardId: string | null
  kind: CallScheduleKind
  status: CallScheduleStatus
  frequency: CallFrequency | null
  localTime: string
  nextRunAt: string
  lastRunAt: string | null
  lastCallId: string | null
  lastError: string | null
  createdAt: string
}

export interface CallScheduleInput {
  locationId: string
  scenarioId: string
  scorecardId: string
  kind: CallScheduleKind
  frequency: CallFrequency | null
  date: string
  localTime: string
  timezone?: string | null
}

export const SCHEDULE_STATUS_LABELS: Record<CallScheduleStatus, string> = {
  active: 'Scheduled',
  paused: 'Paused',
  cancelled: 'Cancelled',
  completed: 'Completed',
}
