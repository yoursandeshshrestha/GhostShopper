import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, WarningCircle } from '@phosphor-icons/react'
import { AppPage } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { ResourceCard } from '@/components/layout/ResourceCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAgentList } from '@/hooks/use-agent'

export function AgentPage() {
  const navigate = useNavigate()
  const { loading, saving, error, canManage, agents, createAgent } =
    useAgentList()
  const [actionError, setActionError] = useState<string | null>(null)

  async function onCreate() {
    setActionError(null)
    const result = await createAgent()
    if (result.error) {
      setActionError(result.error)
      return
    }
    if (result.id) {
      navigate(`/agent/${result.id}`)
    }
  }

  return (
    <AppPage
      title="Agents"
      count={agents.length > 0 ? agents.length : undefined}
      loading={loading}
      actions={
        canManage ? (
          <Button
            type="button"
            size="sm"
            loading={saving}
            onClick={() => void onCreate()}
          >
            <Plus />
            New agent
          </Button>
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

      {agents.length === 0 ? (
        <PageEmptyState
          title="No agents yet"
          description="Create an AI customer persona that will call your locations during mystery shops."
          action={
            canManage ? (
              <Button
                type="button"
                size="sm"
                loading={saving}
                onClick={() => void onCreate()}
              >
                <Plus />
                New agent
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <ResourceCard
              key={agent.id}
              to={`/agent/${agent.id}`}
              title={agent.name}
              description={agent.promptPreview}
              badges={
                <>
                  <Badge variant={agent.approved ? 'success' : 'secondary'}>
                    {agent.approved ? 'Approved' : 'Draft'}
                  </Badge>
                  {agent.isDefault ? (
                    <Badge variant="outline">Default</Badge>
                  ) : null}
                </>
              }
            />
          ))}
        </div>
      )}
    </AppPage>
  )
}
