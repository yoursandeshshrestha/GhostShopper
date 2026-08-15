import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowCounterClockwise,
  Plus,
  Star,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react'
import { AppPage, SurfaceCard, SurfacePanel } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useScorecardDetail } from '@/hooks/use-scorecard'
import { cn } from '@/lib/utils'

const fieldControlClassName = cn(
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs',
  'placeholder:text-muted-foreground',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
)

export function ScorecardDetailPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const {
    loading,
    saving,
    error,
    canManage,
    found,
    isDefault,
    name,
    setName,
    criteria,
    updateCriterion,
    addCriterion,
    removeCriterion,
    applyDefaultCriteria,
    discardChanges,
    saveScorecard,
    deleteScorecard,
    setDefaultScorecard,
    dirty,
    weightTotal,
  } = useScorecardDetail(id)

  const [actionError, setActionError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function onSave() {
    setActionError(null)
    const result = await saveScorecard()
    if (result.error) setActionError(result.error)
  }

  async function onSetDefault() {
    setActionError(null)
    const result = await setDefaultScorecard()
    if (result.error) setActionError(result.error)
  }

  async function onDelete() {
    setActionError(null)
    const result = await deleteScorecard()
    if (result.error) {
      setActionError(result.error)
      return
    }
    navigate('/scorecard')
  }

  const canSave =
    canManage &&
    dirty &&
    criteria.length > 0 &&
    weightTotal === 100 &&
    criteria.every((item) => item.name.trim())

  if (!loading && !found) {
    return (
      <AppPage title="Scorecard" backHref="/scorecard" backLabel="Scorecards">
        <PageEmptyState
          title="Scorecard not found"
          description="This scorecard may have been removed or you do not have access."
          action={
            <Button type="button" size="sm" asChild>
              <Link to="/scorecard">Back to scorecards</Link>
            </Button>
          }
        />
      </AppPage>
    )
  }

  return (
    <AppPage
      title={name || 'Scorecard'}
      count={criteria.length > 0 ? criteria.length : undefined}
      backHref="/scorecard"
      backLabel="Scorecards"
      loading={loading}
      actions={
        canManage ? (
          <>
            {isDefault ? <Badge variant="outline">Default</Badge> : null}
            {!isDefault ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={saving}
                onClick={() => void onSetDefault()}
              >
                <Star />
                Set as default
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash />
              Delete
            </Button>
            {dirty ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={discardChanges}
              >
                Discard
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              loading={saving}
              disabled={!canSave}
              onClick={() => void onSave()}
            >
              Save changes
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

      <div className="space-y-4">
        <SurfacePanel className="flex flex-wrap items-end justify-between gap-4">
          {canManage ? (
            <Field className="min-w-[240px] flex-1 gap-2">
              <FieldLabel htmlFor="scorecard-name">Scorecard name</FieldLabel>
              <Input
                id="scorecard-name"
                className={fieldControlClassName}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Default Scorecard"
              />
            </Field>
          ) : (
            <div>
              <p className="text-sm font-medium text-foreground">{name}</p>
              <p className="text-xs text-muted-foreground">
                {criteria.length} criteria
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Badge variant={weightTotal === 100 ? 'success' : 'destructive'}>
              {weightTotal} / 100
            </Badge>
            {canManage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={applyDefaultCriteria}
              >
                <ArrowCounterClockwise />
                Reset to default
              </Button>
            ) : null}
          </div>
        </SurfacePanel>

        <SurfaceCard>
          <div className="grid grid-cols-[1fr_96px_40px] gap-2 border-b border-border-table px-4 py-2.5 text-xs font-medium text-muted-foreground">
            <span>Criterion</span>
            <span className="text-center">Weight</span>
            <span />
          </div>

          <div className="divide-y divide-border-table">
            {criteria.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_96px_40px] items-center gap-2 px-4 py-2.5"
              >
                {canManage ? (
                  <>
                    <Input
                      value={item.name}
                      onChange={(e) =>
                        updateCriterion(item.id, { name: e.target.value })
                      }
                      placeholder="Greeting"
                      className={cn(
                        fieldControlClassName,
                        'border-transparent bg-transparent shadow-none focus-visible:border-ring focus-visible:bg-background'
                      )}
                    />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={item.weight}
                      onChange={(e) =>
                        updateCriterion(item.id, {
                          weight: Number(e.target.value),
                        })
                      }
                      className={cn(
                        fieldControlClassName,
                        'border-transparent bg-transparent text-center shadow-none focus-visible:border-ring focus-visible:bg-background'
                      )}
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={criteria.length <= 1}
                      onClick={() => removeCriterion(item.id)}
                      aria-label={`Remove ${item.name || 'criterion'}`}
                    >
                      <Trash />
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      {item.name || '—'}
                    </p>
                    <p className="text-center text-sm tabular-nums text-muted-foreground">
                      {item.weight}
                    </p>
                    <span />
                  </>
                )}
              </div>
            ))}
          </div>

          {canManage ? (
            <div className="flex items-center justify-between gap-3 border-t border-border-table px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-0"
                onClick={addCriterion}
              >
                <Plus />
                Add criterion
              </Button>
              <p
                className={cn(
                  'text-sm font-medium tabular-nums',
                  weightTotal === 100
                    ? 'text-foreground'
                    : 'text-destructive'
                )}
              >
                Total {weightTotal} / 100
              </p>
            </div>
          ) : null}
        </SurfaceCard>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scorecard?</AlertDialogTitle>
            <AlertDialogDescription>
              “{name}” will be removed. Existing calls keep their scores.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={saving}
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
