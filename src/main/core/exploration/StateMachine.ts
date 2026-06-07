import { EventEmitter } from 'events'

export type ExplorationState = 'IDLE' | 'INIT' | 'EXPLORING' | 'COMPARING' | 'GENERATING' | 'DONE' | 'ERROR'

export interface StateTransition {
  from: ExplorationState
  to: ExplorationState
  guard?: () => boolean
}

export interface StateMachineConfig {
  autoTransition: boolean
}

export class StateMachine extends EventEmitter {
  private currentState: ExplorationState = 'IDLE'
  private history: { state: ExplorationState; timestamp: number }[] = []

  private transitions: StateTransition[] = [
    { from: 'IDLE', to: 'INIT' },
    { from: 'INIT', to: 'EXPLORING' },
    { from: 'INIT', to: 'ERROR' },
    { from: 'EXPLORING', to: 'COMPARING' },
    { from: 'EXPLORING', to: 'IDLE' },
    { from: 'EXPLORING', to: 'ERROR' },
    { from: 'COMPARING', to: 'GENERATING' },
    { from: 'COMPARING', to: 'EXPLORING' },
    { from: 'COMPARING', to: 'ERROR' },
    { from: 'GENERATING', to: 'DONE' },
    { from: 'GENERATING', to: 'EXPLORING' },
    { from: 'GENERATING', to: 'ERROR' },
    { from: 'DONE', to: 'IDLE' },
    { from: 'ERROR', to: 'IDLE' },
    { from: 'ERROR', to: 'INIT' }
  ]

  constructor(private config: StateMachineConfig = { autoTransition: true }) {
    super()
  }

  getCurrentState(): ExplorationState {
    return this.currentState
  }

  getState(): ExplorationState {
    return this.currentState
  }

  getHistory(): { state: ExplorationState; timestamp: number }[] {
    return [...this.history]
  }

  canTransition(to: ExplorationState): boolean {
    return this.transitions.some(t => t.from === this.currentState && t.to === to)
  }

  getPossibleTransitions(): ExplorationState[] {
    return this.transitions
      .filter(t => t.from === this.currentState)
      .map(t => t.to)
  }

  transition(to: ExplorationState): void {
    if (!this.canTransition(to)) {
      throw new Error('Invalid state transition')
    }

    const from = this.currentState
    this.currentState = to

    this.history.push({
      state: to,
      timestamp: Date.now()
    })

    if (this.history.length > 100) {
      this.history.shift()
    }

    this.emit('transition', {
      from,
      to,
      timestamp: Date.now()
    })

    this.emit('stateChange', { from, to })

    if (to === 'ERROR') {
      this.emit('error', {
        previousState: from,
        timestamp: Date.now()
      })
    }

    if (to === 'DONE') {
      this.emit('done', {
        timestamp: Date.now()
      })
    }
  }

  reset(): void {
    this.currentState = 'IDLE'
    this.history = []
    this.emit('stateChange', { from: this.currentState, to: 'IDLE' })
    this.emit('reset')
  }
}

export const ExplorationStateMachine = StateMachine
