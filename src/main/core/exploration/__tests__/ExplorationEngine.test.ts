import { ExplorationEngine } from '../ExplorationEngine'
import { UITreeNode } from '../types'

function makeButton(text: string): UITreeNode {
  return {
    className: 'android.widget.Button',
    bounds: { x: 0, y: 0, width: 100, height: 50 },
    text,
    clickable: true,
    children: []
  }
}

function makeLayout(children: UITreeNode[] = []): UITreeNode {
  return {
    className: 'android.widget.LinearLayout',
    bounds: { x: 0, y: 0, width: 1080, height: 1920 },
    text: '',
    clickable: false,
    children
  }
}

describe('ExplorationEngine', () => {
  let engine: ExplorationEngine

  beforeEach(() => {
    engine = new ExplorationEngine()
  })

  it('should initialize in IDLE state', () => {
    expect(engine.getCurrentState()).toBe('IDLE')
  })

  it('should transition states', () => {
    engine.transition('INIT')
    expect(engine.getCurrentState()).toBe('INIT')
    engine.transition('EXPLORING')
    expect(engine.getCurrentState()).toBe('EXPLORING')
  })

  it('should track history', () => {
    engine.transition('INIT')
    engine.transition('EXPLORING')
    const history = engine.getHistory()
    expect(history.length).toBe(2)
    expect(history[0].state).toBe('INIT')
    expect(history[1].state).toBe('EXPLORING')
  })

  it('should initialize with UI tree', () => {
    const tree = makeLayout([makeButton('btn1')])
    engine.initialize(tree, 'MainActivity')
    expect(engine.getCurrentState()).toBe('EXPLORING')
    expect(engine.getVisitedNodes()).toBe(1)
  })

  it('should perform step and return action', () => {
    const tree = makeLayout([makeButton('btn1')])
    engine.initialize(tree, 'MainActivity')

    const action = engine.step(tree, 'MainActivity')
    expect(action.type).toBe('CLICK')
  })

  it('should add paths', () => {
    const path = {
      pathId: 'p1',
      startActivity: 'MainActivity',
      endActivity: 'DetailActivity',
      steps: [],
      coverage: ['MainActivity', 'DetailActivity'],
      reproducible: true
    }
    engine.addPath(path)
    expect(engine.getPaths()).toHaveLength(1)
  })

  it('should reset state', () => {
    const tree = makeLayout([makeButton('btn1')])
    engine.initialize(tree, 'MainActivity')
    engine.addPath({
      pathId: 'p1',
      startActivity: 'MainActivity',
      endActivity: 'DetailActivity',
      steps: [],
      coverage: [],
      reproducible: true
    })
    engine.reset()
    expect(engine.getCurrentState()).toBe('IDLE')
    expect(engine.getVisitedNodes()).toBe(0)
    expect(engine.getPaths()).toHaveLength(0)
    expect(engine.getHistory()).toHaveLength(0)
  })

  it('should return exploration result', () => {
    const result = engine.explore({ maxDepth: 10, maxSteps: 100, maxTime: 30000, maxNodes: 500 })
    expect(result.appPackage).toBe('com.example.app')
    expect(result.coverageSummary.totalActivities).toBe(0)
    expect(result.totalPaths).toBe(0)
  })

  it('should track visited nodes', () => {
    const tree = makeLayout([makeButton('btn1')])
    engine.initialize(tree, 'MainActivity')
    expect(engine.hasVisited(engine['hashTree'](tree))).toBe(true)
  })
})
