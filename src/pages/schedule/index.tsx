import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarBlank,
  Pause,
  PhoneOutgoing,
  Play,
  Plus,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import { AppPage, SurfaceCard } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSchedules } from '@/hooks/use-schedules'
import { formatDateTimeShort } from '@/lib/datetime'
import { SCHEDULE_STATUS_LABELS, type OrgCallSchedule } from '@/types/schedule'
import { ScheduleFormDialog } from './ScheduleFormDialog'

function statusVariant(schedule: OrgCallSchedule) {
  if (schedule.status === 'cancelled') return 'destructive' as const
  if (schedule.status === 'paused') return 'warning' as const
  if (schedule.status === 'completed') return 'secondary' as const
  if (schedule.lastError) return 'destructive' as const
  return 'success' as const
}

export function SchedulePage() {
  const navigate = useNavigate()
  const {
    loading,
    saving,
    dispatching,
    error,
    canManage,
    schedules,
    locations,
    agents,
    scorecards,
    defaultAgent,
    defaultScorecard,
    createSchedule,
    updateStatus,
    deleteSchedule,
    dispatchDue,
    runNow,
  } = useSchedules()

  const [formOpen, setFormOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<OrgCallSchedule | null>(
    null
  )

  async function onCreate(input: Parameters<typeof createSchedule>[0]) {
    const result = await createSchedule(input)
    return result.error
  }

  async function onAction(
    schedule: OrgCallSchedule,
    action: 'pause' | 'resume' | 'cancel' | 'run'
  ) {
    setActionError(null)
    if (action === 'run') {
      const result = await runNow(schedule.id)
      if (result.error) setActionError(result.error)
      else navigate('/review')
      return
    }
    const status =
      action === 'pause'
        ? 'paused'
        : action === 'resume'
          ? 'active'
          : 'cancelled'
    const result = await updateStatus(schedule.id, status)
    if (result.error) setActionError(result.error)
  }

  async function onDelete() {
    if (!pendingDelete) return
    setActionError(null)
    const result = await deleteSchedule(pendingDelete.id)
    if (result.error) setActionError(result.error)
    else setPendingDelete(null)
  }

  return (
    <AppPage
      title="Schedule"
      count={schedules.length > 0 ? schedules.length : undefined}
      loading={loading}
      actions={
        canManage ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={dispatching}
              onClick={() => {
                setActionError(null)
                void dispatchDue().then((result) => {
                  if (result.error) setActionError(result.error)
                })
              }}
            >
              Run due now
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setActionError(null)
                setFormOpen(true)
              }}
            >
              <Plus />
              New schedule
            </Button>
          </>
        ) : undefined
      }
    >
      {error || actionError ? (
        <Alert variant="destructive">
          <WarningCircle weight="fill" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{actionError || error}</AlertDescription>
        </Alert>
      ) : null}

      {!canManage ? (
        <PageEmptyState
          title="No permission"
          description="Only owners, admins, and coaches can manage call schedules."
        />
      ) : locations.length === 0 ? (
        <PageEmptyState
          title="Add a location first"
          description="Schedules need a location phone number and timezone."
          action={
            <Button type="button" size="sm" onClick={() => navigate('/locations')}>
              Go to locations
            </Button>
          }
        />
      ) : schedules.length === 0 ? (
        <PageEmptyState
          title="No scheduled calls"
          description="Set a recurring cadence so every location is mystery-shopped automatically — or schedule a one-off call for a specific time."
          action={
            <Button type="button" size="sm" onClick={() => setFormOpen(true)}>
              <CalendarBlank />
              Schedule a call
            </Button>
          }
        />
      ) : (
            <SurfaceCard>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Location</TableHead>
                    <TableHead>Cadence</TableHead>
                    <TableHead>Next call</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">
                        {schedule.locationName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {schedule.kind === 'recurring'
                          ? `${schedule.frequency} at ${schedule.localTime}`
                          : `Once at ${schedule.localTime}`}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatDateTimeShort(schedule.nextRunAt, schedule.timezone)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={statusVariant(schedule)}>
                            {SCHEDULE_STATUS_LABELS[schedule.status]}
                          </Badge>
                          {schedule.lastError ? (
                            <span className="max-w-48 truncate text-xs text-destructive">
                              {schedule.lastError}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {schedule.status === 'active' ||
                          schedule.status === 'paused' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={dispatching}
                              onClick={() => void onAction(schedule, 'run')}
                            >
                              <PhoneOutgoing />
                              Run now
                            </Button>
                          ) : null}
                          {schedule.status === 'active' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void onAction(schedule, 'pause')}
                            >
                              <Pause />
                              Pause
                            </Button>
                          ) : null}
                          {schedule.status === 'paused' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void onAction(schedule, 'resume')}
                            >
                              <Play />
                              Resume
                            </Button>
                          ) : null}
                          {schedule.status !== 'cancelled' &&
                          schedule.status !== 'completed' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => void onAction(schedule, 'cancel')}
                            >
                              <X />
                              Cancel
                            </Button>
                          ) : null}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setPendingDelete(schedule)}
                            >
                              <Trash />
                              Delete
                            </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SurfaceCard>
      )}

      <ScheduleFormDialog
        open={formOpen}
        saving={saving}
        locations={locations}
        agents={agents}
        scorecards={scorecards}
        defaultScenarioId={defaultAgent?.id}
        defaultScorecardId={defaultScorecard?.id}
        onOpenChange={setFormOpen}
        onSubmit={onCreate}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `The schedule for “${pendingDelete.locationName}” will be removed. This cannot be undone.`
                : 'This schedule will be removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep schedule</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(event) => {
                event.preventDefault()
                void onDelete()
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppPage>
  )
}
