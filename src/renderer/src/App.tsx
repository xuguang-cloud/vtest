import React from 'react'
import { ExplorationMonitor } from './components/ExplorationMonitor'

function App(): React.ReactElement {
  return (
    <div className="flex h-screen bg-slate-100">
      <main className="flex-1 overflow-y-auto">
        <ExplorationMonitor />
      </main>
    </div>
  )
}

export default App