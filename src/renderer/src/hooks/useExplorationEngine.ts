import { useState, useEffect } from 'react'

export type ExplorationState = 'IDLE' | 'INIT' | 'EXPLORING' | 'COMPARING' | 'GENERATING' | 'DONE' | 'ERROR'

export function useExplorationEngine() {
  const [currentState, setCurrentState] = useState<ExplorationState>('IDLE')

  useEffect(() => {
    // 调用 Preload 暴露的监听方法
    const cleanup = window.vtest.onExplorationStateChanged((data: any) => {
      setCurrentState(data.to || 'ERROR')
    })

    return () => {
      if (cleanup) cleanup() // 组件卸载时移除监听
    }
  }, [])

  const startExploration = () => {
    window.vtest.startExploration()
  }

  return { currentState, startExploration }
}