import React from 'react'
import { useExplorationEngine } from '../hooks/useExplorationEngine'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ExplorationState } from '../hooks/useExplorationEngine'

export const ExplorationMonitor: React.FC = () => {
  const { currentState, startExploration } = useExplorationEngine()

  const getStatusConfig = () => {
    switch (currentState) {
      case 'EXPLORING':
        return { color: 'bg-green-500', pulse: 'animate-pulse', text: '正在探索应用...' }
      case 'COMPARING':
        return { color: 'bg-blue-500', pulse: 'animate-pulse', text: '正在比对 UI 状态...' }
      case 'DONE':
        return { color: 'bg-gray-500', pulse: '', text: '探索完成' }
      case 'ERROR':
        return { color: 'bg-red-500', pulse: '', text: '发生错误' }
      default:
        return { color: 'bg-gray-400', pulse: '', text: '等待启动' }
    }
  }

  const config = getStatusConfig()
  const isRunning = currentState === 'EXPLORING' || currentState === 'COMPARING' || currentState === 'INIT' || currentState === 'GENERATING'

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">AI 探索引擎监控</h2>
        
        <div className="flex items-center justify-center space-x-4 mb-8">
          <span className={`${config.color} ${config.pulse} h-4 w-4 rounded-full inline-block`}></span>
          <span className="text-lg font-medium text-slate-700">{config.text}</span>
        </div>

        <div className="bg-slate-100 rounded-lg p-4 mb-6 font-mono text-sm text-slate-600">
          Current State: <span className="text-primary-600 font-bold">{currentState}</span>
        </div>

        <button
          onClick={startExploration}
          disabled={isRunning}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 ease-in-out"
        >
          启动自动探索
        </button>
      </div>
    </div>
  )
}