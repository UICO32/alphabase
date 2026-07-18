import { lazy } from 'react'

const loadAgentReachPanel = () =>
  import('./AgentReachPanel').then(module => ({ default: module.AgentReachPanel }))

export const preloadAgentReachPanel = () => {
  void loadAgentReachPanel()
}

export const LazyAgentReachPanel = lazy(loadAgentReachPanel)
