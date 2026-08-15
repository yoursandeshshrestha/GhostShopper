import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Sparkle, Star, Trash, WarningCircle } from '@phosphor-icons/react'
import { AppPage, SurfacePanel } from '@/components/layout/AppPage'
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
import { Textarea } from '@/components/ui/textarea'
import { useAgentDetail } from '@/hooks/use-agent'
import { cn } from '@/lib/utils'

const fieldControlClassName = cn(
  'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs',
  'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
)

export function AgentDetailPage() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const {
    loading,
    saving,
    generating,
    error,
    canManage,
    found,
    scenario,
    dirty,
    setName,
    setPrompt,
    generateScenario,
    updateField,
    discardChanges,
    saveAndApprove,
    deleteAgent,
    setDefaultAgent,
  } = useAgentDetail(id)

  const [actionError, setActionError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const hasPreview = Boolean(
    scenario.persona && scenario.goals && scenario.conversationRules
  )

  async function onSave() {
    setActionError(null)
    const result = await saveAndApprove()
    if (result.error) setActionError(result.error)
  }

  async function onSetDefault() {
    setActionError(null)
    const result = await setDefaultAgent()
    if (result.error) setActionError(result.error)
  }

  async function onDelete() {
    setActionError(null)
    const result = await deleteAgent()
    if (result.error) {
      setActionError(result.error)
      return
    }
    navigate('/agent')
  }

  if (!loading && !found) {
    return (
      <AppPage title="Agent" backHref="/agent" backLabel="Agents">
        <PageEmptyState
          title="Agent not found"
          description="This agent may have been removed or you do not have access."
          action={
            <Button type="button" size="sm" asChild>
              <Link to="/agent">Back to agents</Link>
            </Button>
          }
        />
      </AppPage>
    )
  }

  return (
    <AppPage
      title={scenario.name || 'Agent'}
      backHref="/agent"
      backLabel="Agents"
      loading={loading}
      actions={
        <>
          {scenario.isDefault ? (
            <Badge variant="outline">Default</Badge>
          ) : null}
          {scenario.approved && !dirty ? (
            <Badge variant="success">Approved</Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
          {canManage && !scenario.isDefault ? (
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
          {canManage ? (
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
          ) : null}
          {canManage && dirty ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={discardChanges}
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                loading={saving}
                disabled={!hasPreview}
                onClick={() => void onSave()}
              >
                Save & approve
              </Button>
            </>
          ) : null}
        </>
      }
    >
      {error || actionError ? (
        <Alert variant="destructive">
          <WarningCircle weight="fill" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{actionError || error}</AlertDescription>
        </Alert>
      ) : null}

      {!canManage && !scenario.id ? (
        <PageEmptyState
          title="No agent scenario yet"
          description="An owner or admin needs to configure the AI customer scenario."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <SurfacePanel className="space-y-5 lg:col-span-2">
            <Field className="gap-2">
              <FieldLabel htmlFor="agent-name">Agent name</FieldLabel>
              <Input
                id="agent-name"
                className={fieldControlClassName}
                value={scenario.name}
                disabled={!canManage}
                placeholder="Bookstore customer"
                onChange={(e) => setName(e.target.value)}
              />
            </Field>

            <Field className="gap-2">
              <FieldLabel htmlFor="agent-prompt">Customer brief</FieldLabel>
              <Textarea
                id="agent-prompt"
                className={cn(fieldControlClassName, 'min-h-28')}
                value={scenario.prompt}
                disabled={!canManage}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="I want the AI to call pretending to book a dental appointment."
              />
            </Field>

            {canManage ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!scenario.prompt.trim()}
                loading={generating}
                onClick={() => void generateScenario()}
              >
                <Sparkle />
                Generate scenario
              </Button>
            ) : null}
          </SurfacePanel>

          {hasPreview ? (
            <>
              <SurfacePanel>
                <Field className="gap-2">
                  <FieldLabel htmlFor="agent-persona">Persona</FieldLabel>
                  <Textarea
                    id="agent-persona"
                    className={cn(fieldControlClassName, 'min-h-40')}
                    value={scenario.persona}
                    disabled={!canManage}
                    onChange={(e) => updateField('persona', e.target.value)}
                  />
                </Field>
              </SurfacePanel>
              <SurfacePanel>
                <Field className="gap-2">
                  <FieldLabel htmlFor="agent-goals">Goals</FieldLabel>
                  <Textarea
                    id="agent-goals"
                    className={cn(fieldControlClassName, 'min-h-40')}
                    value={scenario.goals}
                    disabled={!canManage}
                    onChange={(e) => updateField('goals', e.target.value)}
                  />
                </Field>
              </SurfacePanel>
              <SurfacePanel className="lg:col-span-2">
                <Field className="gap-2">
                  <FieldLabel htmlFor="agent-rules">
                    Conversation rules
                  </FieldLabel>
                  <Textarea
                    id="agent-rules"
                    className={cn(fieldControlClassName, 'min-h-32')}
                    value={scenario.conversationRules}
                    disabled={!canManage}
                    onChange={(e) =>
                      updateField('conversationRules', e.target.value)
                    }
                  />
                </Field>
              </SurfacePanel>
            </>
          ) : null}
        </div>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete agent?</AlertDialogTitle>
            <AlertDialogDescription>
              “{scenario.name}” will be removed. Calls that used this agent
              will keep their history.
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
