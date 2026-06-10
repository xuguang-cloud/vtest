import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'

export type ExplorationState = 'IDLE' | 'INIT' | 'EXPLORING' | 'COMPARING' | 'GENERATING' | 'DONE' | 'ERROR'

interface ExplorationContextValue {
  currentState: ExplorationState
  startExploration: () => void
  stopExploration: () => void
  pauseExploration: () => void
  resumeExploration: () => void
  resetExploration: () => void
  error: string | null
  sessionId: string | null
  progress: { currentDepth: number; totalPaths: number } | null
}

type ExplorationAction =
  | { type: 'SET_STATE'; state: ExplorationState }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_SESSION_ID'; id: string }
  | { type: 'SET_PROGRESS'; progress: { currentDepth: number; totalPaths: number } }
  | { type: 'RESET' }

interface ExplorationStateData {
  currentState: ExplorationState
  error: string | null
  sessionId: string | null
  progress: { currentDepth: number; totalPaths: number } | null
}

function explorationReducer(state: ExplorationStateData, action: ExplorationAction): ExplorationStateData {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, currentState: action.state }
    case 'SET_ERROR':
      return { ...state, error: action.error, currentState: 'ERROR' }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.id }
    case 'SET_PROGRESS':
      return { ...state, progress: action.progress }
    case 'RESET':
      return { currentState: 'IDLE', error: null, sessionId: null, progress: null }
    default:
      return state
  }
}

const ExplorationContext = createContext<ExplorationContextValue | null>(null)

export function ExplorationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(explorationReducer, {
    currentState: 'IDLE' as ExplorationState,
    error: null,
    sessionId: null,
    progress: null
  })

  useEffect(() => {
    const cleanup = window.vtest?.onExplorationStateChanged?.((data: any) => {
      dispatch({ type: 'SET_STATE', state: data.to || 'ERROR' })
      if (data.sessionId) {
        dispatch({ type: 'SET_SESSION_ID', id: data.sessionId })
      }
    })

    return () => {
      if (cleanup) cleanup()
    }
  }, [])

  const startExploration = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' })
    dispatch({ type: 'SET_STATE', state: 'INIT' })
    ;window.vtest?.startExploration?.()
  }, [])

  const stopExploration = useCallback(() => {
    ;window.vtest?.stopExploration?.()
  }, [])

  const pauseExploration = useCallback(() => {
    ;window.vtest?.pauseExploration?.()
  }, [])

  const resumeExploration = useCallback(() => {
    ;window.vtest?.resumeExploration?.()
  }, [])

  const resetExploration = useCallback(() => {
    dispatch({ type: 'RESET' })
    ;window.vtest?.resetExploration?.()
  }, [])

  return (
    <ExplorationContext.Provider
      value={{
        currentState: state.currentState,
        startExploration,
        stopExploration,
        pauseExploration,
        resumeExploration,
        resetExploration,
        error: state.error,
        sessionId: state.sessionId,
        progress: state.progress
      }}
    >
      {children}
    </ExplorationContext.Provider>
  )
}

export function useExplorationEngine(): ExplorationContextValue {
  const context = useContext(ExplorationContext)
  if (!context) {
    throw new Error('useExplorationEngine must be used within an ExplorationProvider')
  }
  return context
}