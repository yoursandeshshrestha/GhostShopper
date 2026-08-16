import { create } from 'zustand'
import type { OrgRole } from '@/components/auth/AuthProvider'
import { invokeFunction } from '@/lib/invoke-function'
import { deliverInviteEmail } from '@/lib/deliver-invite-email'
import { supabase } from '@/lib/supabase/client'
import {
  createLocalId,
  DEFAULT_SCORECARD_CRITERIA,
  scorecardWeightTotal,
  type ScorecardCriterion,
  type SetupInvite,
  type SetupLocation,
  type SetupScenario,
  type SetupStep,
} from '@/types/setup'

interface SetupState {
  orgId: string | null
  hydrated: boolean
  saving: boolean
  generating: boolean
  finishing: boolean
  error: string | null
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  step: SetupStep
  locations: SetupLocation[]
  scorecardMode: 'default' | 'custom' | null
  scorecardId: string | null
  criteria: ScorecardCriterion[]
  scenario: SetupScenario
  invites: SetupInvite[]
  orgName: string

  reset: () => void
  hydrate: (orgId: string, orgName: string, setupStep: SetupStep) => Promise<void>
  setStep: (step: SetupStep) => Promise<void>
  setError: (error: string | null) => void

  addLocation: (location: Omit<SetupLocation, 'id'> & { id?: string }) => Promise<void>
  removeLocation: (id: string) => Promise<void>
  importLocations: (
    rows: Omit<SetupLocation, 'id'>[]
  ) => Promise<{ error: string | null }>

  setScorecardMode: (mode: 'default' | 'custom') => void
  setCriteria: (criteria: ScorecardCriterion[]) => void
  updateCriterion: (
    id: string,
    patch: Partial<Pick<ScorecardCriterion, 'name' | 'weight'>>
  ) => void
  saveScorecard: () => Promise<{ error: string | null }>

  setScenarioPrompt: (prompt: string) => void
  generateScenario: () => Promise<{ error: string | null }>
  approveScenario: () => Promise<{ error: string | null }>

  addInviteDraft: () => void
  updateInvite: (
    id: string,
    patch: Partial<Pick<SetupInvite, 'email' | 'role' | 'assignedLocationId'>>
  ) => void
  removeInvite: (id: string) => void
  saveInvite: (id: string) => Promise<{ error: string | null }>
  sendInviteEmail: (id: string) => Promise<{ error: string | null }>

  finishSetup: () => Promise<{ error: string | null }>
}

const emptyScenario = (): SetupScenario => ({
  id: null,
  prompt: '',
  persona: '',
  goals: '',
  conversationRules: '',
  approved: false,
})

const initialState = {
  orgId: null as string | null,
  hydrated: false,
  saving: false,
  generating: false,
  finishing: false,
  error: null as string | null,
  saveStatus: 'idle' as const,
  step: 'welcome' as SetupStep,
  locations: [] as SetupLocation[],
  scorecardMode: null as 'default' | 'custom' | null,
  scorecardId: null as string | null,
  criteria: [] as ScorecardCriterion[],
  scenario: emptyScenario(),
  invites: [] as SetupInvite[],
  orgName: '',
}

function mapLocation(row: {
  id: string
  name: string
  phone: string | null
  timezone: string | null
  country: string | null
  call_frequency: string | null
}): SetupLocation {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? '',
    timezone: row.timezone ?? '',
    country: row.country ?? '',
    callFrequency: row.call_frequency ?? '',
  }
}

async function persistStep(step: SetupStep) {
  const { error } = await supabase.rpc('save_setup_step', { next_step: step })
  if (error) throw new Error(error.message)
}

export const useSetupStore = create<SetupState>((set, get) => ({
  ...initialState,

  reset: () => {
    set({ ...initialState, scenario: emptyScenario() })
  },

  setError: (error) => set({ error }),

  hydrate: async (orgId, orgName, setupStep) => {
    set({
      orgId,
      orgName,
      step: setupStep,
      hydrated: false,
      error: null,
    })

    const [orgRes, locationsRes, scorecardRes, scenarioRes, invitesRes] =
      await Promise.all([
        supabase
          .from('orgs')
          .select('setup_step, name')
          .eq('id', orgId)
          .maybeSingle(),
        supabase
          .from('locations')
          .select('id, name, phone, timezone, country, call_frequency')
          .eq('org_id', orgId)
          .order('created_at', { ascending: true }),
        supabase
          .from('scorecards')
          .select('id, criteria')
          .eq('org_id', orgId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('scenarios')
          .select(
            'id, prompt, persona, goals, conversation_rules, approved_at'
          )
          .eq('org_id', orgId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('invitations')
          .select('id, email, role, assigned_location_id, token, accepted_at')
          .eq('org_id', orgId)
          .is('accepted_at', null)
          .order('created_at', { ascending: true }),
      ])

    if (
      orgRes.error ||
      locationsRes.error ||
      scorecardRes.error ||
      scenarioRes.error
    ) {
      set({
        hydrated: true,
        error:
          orgRes.error?.message ||
          locationsRes.error?.message ||
          scorecardRes.error?.message ||
          scenarioRes.error?.message ||
          'Failed to load setup progress',
      })
      return
    }

    const criteriaRaw = (scorecardRes.data?.criteria ?? []) as Array<{
      id?: string
      name: string
      weight: number
    }>

    const resolvedStep =
      orgRes.data?.setup_step &&
      [
        'welcome',
        'locations',
        'scorecard',
        'scenario',
        'team',
        'review',
      ].includes(orgRes.data.setup_step)
        ? (orgRes.data.setup_step as SetupStep)
        : setupStep

    set({
      orgName: orgRes.data?.name ?? orgName,
      step: resolvedStep,
      locations: (locationsRes.data ?? []).map(mapLocation),
      scorecardId: scorecardRes.data?.id ?? null,
      scorecardMode: scorecardRes.data ? 'custom' : null,
      criteria: criteriaRaw.map((item) => ({
        id: item.id ?? createLocalId(),
        name: item.name,
        weight: item.weight,
      })),
      scenario: scenarioRes.data
        ? {
            id: scenarioRes.data.id,
            prompt: scenarioRes.data.prompt ?? '',
            persona: scenarioRes.data.persona ?? '',
            goals: scenarioRes.data.goals ?? '',
            conversationRules: scenarioRes.data.conversation_rules ?? '',
            approved: Boolean(scenarioRes.data.approved_at),
          }
        : emptyScenario(),
      invites: (invitesRes.data ?? []).map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role as Exclude<OrgRole, 'owner'>,
        assignedLocationId: invite.assigned_location_id,
        token: invite.token,
        saved: true,
        emailSent: false,
      })),
      hydrated: true,
      saveStatus: 'idle',
    })
  },

  setStep: async (step) => {
    const current = get().step
    if (current === step) return
    set({ step, saveStatus: 'saving', saving: true, error: null })
    try {
      await persistStep(step)
      set({ saveStatus: 'saved', saving: false })
    } catch (err) {
      set({
        step: current,
        saving: false,
        saveStatus: 'error',
        error: err instanceof Error ? err.message : 'Could not save progress',
      })
    }
  },

  addLocation: async (location) => {
    const orgId = get().orgId
    if (!orgId) return

    set({ saving: true, saveStatus: 'saving', error: null })

    const { data, error } = await supabase
      .from('locations')
      .insert({
        org_id: orgId,
        name: location.name.trim(),
        phone: location.phone.trim() || null,
        timezone: location.timezone || null,
        country: location.country || null,
        call_frequency: location.callFrequency || null,
      })
      .select('id, name, phone, timezone, country, call_frequency')
      .single()

    if (error || !data) {
      set({
        saving: false,
        saveStatus: 'error',
        error: error?.message ?? 'Could not save location',
      })
      return
    }

    set((state) => ({
      locations: [...state.locations, mapLocation(data)],
      saving: false,
      saveStatus: 'saved',
    }))
  },

  removeLocation: async (id) => {
    set({ saving: true, saveStatus: 'saving', error: null })
    const { error } = await supabase.from('locations').delete().eq('id', id)
    if (error) {
      set({
        saving: false,
        saveStatus: 'error',
        error: error.message,
      })
      return
    }
    set((state) => ({
      locations: state.locations.filter((item) => item.id !== id),
      saving: false,
      saveStatus: 'saved',
    }))
  },

  importLocations: async (rows) => {
    const orgId = get().orgId
    if (!orgId) return { error: 'Missing organisation' }
    if (rows.length === 0) return { error: 'No rows to import' }

    set({ saving: true, saveStatus: 'saving', error: null })

    const { data, error } = await supabase
      .from('locations')
      .insert(
        rows.map((row) => ({
          org_id: orgId,
          name: row.name.trim(),
          phone: row.phone.trim() || null,
          timezone: row.timezone || null,
          country: row.country || null,
          call_frequency: row.callFrequency || null,
        }))
      )
      .select('id, name, phone, timezone, country, call_frequency')

    if (error || !data) {
      set({
        saving: false,
        saveStatus: 'error',
        error: error?.message ?? 'Could not import locations',
      })
      return { error: error?.message ?? 'Could not import locations' }
    }

    set((state) => ({
      locations: [...state.locations, ...data.map(mapLocation)],
      saving: false,
      saveStatus: 'saved',
    }))
    return { error: null }
  },

  setScorecardMode: (mode) => {
    if (mode === 'default') {
      set({
        scorecardMode: mode,
        criteria: DEFAULT_SCORECARD_CRITERIA.map((item) => ({
          ...item,
          id: createLocalId(),
        })),
      })
      return
    }
    set({
      scorecardMode: mode,
      criteria:
        get().criteria.length > 0
          ? get().criteria
          : [{ id: createLocalId(), name: '', weight: 0 }],
    })
  },

  setCriteria: (criteria) => set({ criteria }),

  updateCriterion: (id, patch) => {
    set((state) => ({
      criteria: state.criteria.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }))
  },

  saveScorecard: async () => {
    const { orgId, criteria, scorecardId } = get()
    if (!orgId) return { error: 'Missing organisation' }

    const total = scorecardWeightTotal(criteria)
    if (criteria.length === 0) {
      return { error: 'Add at least one criterion' }
    }
    if (criteria.some((item) => !item.name.trim())) {
      return { error: 'Every criterion needs a name' }
    }
    if (total !== 100) {
      return { error: `Weights must equal 100 (currently ${total})` }
    }

    set({ saving: true, saveStatus: 'saving', error: null })

    const payload = {
      org_id: orgId,
      name: 'Default Scorecard',
      criteria: criteria.map((item) => ({
        id: item.id,
        name: item.name.trim(),
        weight: Number(item.weight) || 0,
      })),
    }

    const query = scorecardId
      ? supabase
          .from('scorecards')
          .update(payload)
          .eq('id', scorecardId)
          .select('id')
          .single()
      : supabase.from('scorecards').insert(payload).select('id').single()

    const { data, error } = await query
    if (error || !data) {
      set({
        saving: false,
        saveStatus: 'error',
        error: error?.message ?? 'Could not save scorecard',
      })
      return { error: error?.message ?? 'Could not save scorecard' }
    }

    set({
      scorecardId: data.id,
      saving: false,
      saveStatus: 'saved',
    })
    return { error: null }
  },

  setScenarioPrompt: (prompt) => {
    set((state) => ({
      scenario: {
        ...state.scenario,
        prompt,
        approved: false,
      },
    }))
  },

  generateScenario: async () => {
    const prompt = get().scenario.prompt.trim()
    if (!prompt) return { error: 'Describe the customer first.' }

    set({ generating: true, error: null })

    const { data, error } = await invokeFunction<{
      persona?: string
      goals?: string
      conversationRules?: string
      error?: string
    }>('generate-scenario', { prompt })

    if (error || !data?.persona) {
      const message = error ?? 'Could not generate scenario.'
      set({ generating: false, error: message })
      return { error: message }
    }

    set((state) => ({
      generating: false,
      scenario: {
        ...state.scenario,
        persona: data.persona ?? '',
        goals: data.goals ?? '',
        conversationRules: data.conversationRules ?? '',
        approved: false,
      },
    }))
    return { error: null }
  },

  approveScenario: async () => {
    const { orgId, scenario } = get()
    if (!orgId) return { error: 'Missing organisation' }
    if (!scenario.persona || !scenario.goals || !scenario.conversationRules) {
      return { error: 'Generate a scenario before approving' }
    }

    set({ saving: true, saveStatus: 'saving', error: null })

    const payload = {
      org_id: orgId,
      prompt: scenario.prompt.trim(),
      persona: scenario.persona,
      goals: scenario.goals,
      conversation_rules: scenario.conversationRules,
      approved_at: new Date().toISOString(),
    }

    const query = scenario.id
      ? supabase
          .from('scenarios')
          .update(payload)
          .eq('id', scenario.id)
          .select('id')
          .single()
      : supabase.from('scenarios').insert(payload).select('id').single()

    const { data, error } = await query
    if (error || !data) {
      set({
        saving: false,
        saveStatus: 'error',
        error: error?.message ?? 'Could not save scenario',
      })
      return { error: error?.message ?? 'Could not save scenario' }
    }

    set((state) => ({
      scenario: {
        ...state.scenario,
        id: data.id,
        approved: true,
      },
      saving: false,
      saveStatus: 'saved',
    }))
    return { error: null }
  },

  addInviteDraft: () => {
    set((state) => ({
      invites: [
        ...state.invites,
        {
          id: createLocalId(),
          email: '',
          role: 'admin',
          assignedLocationId: null,
          token: null,
          saved: false,
          emailSent: false,
        },
      ],
    }))
  },

  updateInvite: (id, patch) => {
    set((state) => ({
      invites: state.invites.map((invite) =>
        invite.id === id
          ? {
              ...invite,
              ...patch,
              saved: invite.saved ? false : invite.saved,
            }
          : invite
      ),
    }))
  },

  removeInvite: (id) => {
    const invite = get().invites.find((item) => item.id === id)
    if (!invite) return

    if (!invite.saved) {
      set((state) => ({
        invites: state.invites.filter((item) => item.id !== id),
      }))
      return
    }

    void (async () => {
      set({ saving: true, saveStatus: 'saving', error: null })
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', id)
      if (error) {
        set({
          saving: false,
          saveStatus: 'error',
          error: error.message,
        })
        return
      }
      set((state) => ({
        invites: state.invites.filter((item) => item.id !== id),
        saving: false,
        saveStatus: 'saved',
      }))
    })()
  },

  saveInvite: async (id) => {
    const invite = get().invites.find((item) => item.id === id)
    if (!invite) return { error: 'Invite not found' }
    if (!invite.email.trim()) return { error: 'Email is required' }
    if (invite.role === 'location_viewer' && !invite.assignedLocationId) {
      return { error: 'Assign a location for Location Viewer' }
    }

    set({ saving: true, saveStatus: 'saving', error: null })

    const { data, error } = await supabase.rpc('create_invitation', {
      invite_email: invite.email.trim(),
      invite_role: invite.role,
      invite_location_id: invite.assignedLocationId,
    })

    if (error || !data) {
      set({
        saving: false,
        saveStatus: 'error',
        error: error?.message ?? 'Could not send invite',
      })
      return { error: error?.message ?? 'Could not send invite' }
    }

    const saved = data as {
      id: string
      email: string
      role: Exclude<OrgRole, 'owner'>
      assigned_location_id: string | null
      token: string
    }

    set((state) => ({
      invites: state.invites.map((item) =>
        item.id === id
          ? {
              id: saved.id,
              email: saved.email,
              role: saved.role,
              assignedLocationId: saved.assigned_location_id,
              token: saved.token,
              saved: true,
              emailSent: false,
            }
          : item
      ),
      saving: false,
      saveStatus: 'saved',
    }))

    const emailResult = await get().sendInviteEmail(saved.id)
    return { error: emailResult.error }
  },

  sendInviteEmail: async (id) => {
    const invite = get().invites.find((item) => item.id === id)
    const orgName = get().orgName
    if (!invite?.token || !invite.email) {
      return { error: 'Invite is not ready to email' }
    }

    set({ saving: true, saveStatus: 'saving', error: null })

    const inviteUrl = `${window.location.origin}/invite/${invite.token}`
    const { error } = await deliverInviteEmail({
      email: invite.email,
      orgName: orgName || 'your organization',
      role: invite.role,
      token: invite.token,
      inviteUrl,
    })

    if (error) {
      set({
        saving: false,
        saveStatus: 'error',
        error,
      })
      return { error }
    }

    set((state) => ({
      invites: state.invites.map((item) =>
        item.id === id ? { ...item, emailSent: true } : item
      ),
      saving: false,
      saveStatus: 'saved',
    }))
    return { error: null }
  },

  finishSetup: async () => {
    const { locations, scorecardId, scenario } = get()
    if (locations.length === 0) {
      return { error: 'Add at least one location before finishing' }
    }
    if (!scorecardId) {
      return { error: 'Save a scorecard before finishing' }
    }
    if (!scenario.approved) {
      return { error: 'Approve an AI scenario before finishing' }
    }

    set({ finishing: true, error: null })
    const { error } = await supabase.rpc('complete_org_setup')
    if (error) {
      set({ finishing: false, error: error.message })
      return { error: error.message }
    }
    set({ finishing: false, saveStatus: 'saved' })
    return { error: null }
  },
}))
