import { createContext, useContext, type RefObject } from 'react'

export const MainScrollContext =
  createContext<RefObject<HTMLDivElement | null> | null>(null)

export function useMainScrollContainer() {
  return useContext(MainScrollContext)
}
