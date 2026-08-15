import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, WarningCircle } from '@phosphor-icons/react'
import { AppPage } from '@/components/layout/AppPage'
import { PageEmptyState } from '@/components/layout/PageEmptyState'
import { ResourceCard } from '@/components/layout/ResourceCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useScorecardList } from '@/hooks/use-scorecard'

export function ScorecardPage() {
  const navigate = useNavigate()
  const { loading, saving, error, canManage, scorecards, createScorecard } =
    useScorecardList()
  const [actionError, setActionError] = useState<string | null>(null)

  async function onCreate() {
    setActionError(null)
    const result = await createScorecard()
    if (result.error) {
      setActionError(result.error)
      return
    }
    if (result.id) {
      navigate(`/scorecard/${result.id}`)
    }
  }

  return (
    <AppPage
      title="Scorecards"
      count={scorecards.length > 0 ? scorecards.length : undefined}
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
            New scorecard
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

      {scorecards.length === 0 ? (
        <PageEmptyState
          title="No scorecards yet"
          description="Define how calls are scored — greeting, product knowledge, upselling, and more."
          action={
            canManage ? (
              <Button
                type="button"
                size="sm"
                loading={saving}
                onClick={() => void onCreate()}
              >
                <Plus />
                New scorecard
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {scorecards.map((scorecard) => (
            <ResourceCard
              key={scorecard.id}
              to={`/scorecard/${scorecard.id}`}
              title={scorecard.name}
              description={`${scorecard.criteriaCount} criteria · ${scorecard.weightTotal} / 100 weight`}
              badges={
                <>
                  <Badge
                    variant={
                      scorecard.weightTotal === 100 ? 'success' : 'destructive'
                    }
                  >
                    {scorecard.weightTotal === 100 ? 'Balanced' : 'Incomplete'}
                  </Badge>
                  {scorecard.isDefault ? (
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
