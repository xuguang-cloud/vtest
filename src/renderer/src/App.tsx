import React from 'react'
import { ExplorationProvider } from './hooks/ExplorationContext'
import { ExplorationMonitor } from './components/ExplorationMonitor'

function App(): React.ReactElement {
  return (
    <ExplorationProvider>
      <div className="flex h-screen bg-slate-100">
        <main className="flex-1 overflow-y-auto">
          <ExplorationMonitor />
        </main>
      </div>
    </ExplorationProvider>
  )
}

export default App