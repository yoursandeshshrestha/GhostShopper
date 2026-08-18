import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { NewCallDialog } from '@/components/calls/NewCallDialog'

interface NewCallContextValue {
  openNewCall: () => void
}

const NewCallContext = createContext<NewCallContextValue | null>(null)

export function NewCallProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const openNewCall = useCallback(() => setOpen(true), [])
  const value = useMemo(() => ({ openNewCall }), [openNewCall])

  return (
    <NewCallContext.Provider value={value}>
      {children}
      {open ? <NewCallDialog open onOpenChange={setOpen} /> : null}
    </NewCallContext.Provider>
  )
}

export function useNewCall() {
  const context = useContext(NewCallContext)
  if (!context) {
    throw new Error('useNewCall must be used within NewCallProvider')
  }
  return context
}
