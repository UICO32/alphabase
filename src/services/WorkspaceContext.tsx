import { createContext, useContext, type ReactNode } from 'react'
import { WorkspaceService } from './WorkspaceService'

const WorkspaceContextInternal = createContext<WorkspaceService | null>(null)

export function WorkspaceProvider({ service, children }: { service: WorkspaceService; children: ReactNode }) {
  return (
    <WorkspaceContextInternal.Provider value={service}>
      {children}
    </WorkspaceContextInternal.Provider>
  )
}

export function useWorkspaceService(): WorkspaceService {
  const service = useContext(WorkspaceContextInternal)
  if (!service) throw new Error('useWorkspaceService must be used within a WorkspaceProvider')
  return service
}
