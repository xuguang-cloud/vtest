import { DFSExplorer, DEFAULT_DFS_CONFIG } from '../DFSExplorer'
import { UITreeNode, ExplorationAction } from '../types'

function makeButton(text: string, children: UITreeNode[] = []): UITreeNode {
  return {
    className: 'android.widget.Button',
    bounds: { x: 0, y: 0, width: 100, height: 50 },
    text,
    clickable: true,
    children
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

describe('DFSExplorer', () => {
  let explorer: DFSExplorer

  beforeEach(() => {
    explorer = new DFSExplorer()
  })

  describe('initialization', () => {
    it('should start with empty state', () => {
      expect(explorer.getStepCount()).toBe(0)
      expect(explorer.getStack()).toHaveLength(0)
      expect(explorer.getVisitedHashes().size).toBe(0)
      expect(explorer.getVisitedActivities().size).toBe(0)
    })

    it('should initialize with root tree', () => {
      const tree = makeLayout([makeButton('btn1')])
      explorer.initialize(tree, 'MainActivity')
      expect(explorer.getVisitedActivities().get('MainActivity')).toBe(1)
    })
  })

  describe('step - DFS traversal', () => {
    it('should click first unvisited element', () => {
      const btn1 = makeButton('btn1')
      const tree = makeLayout([btn1, makeButton('btn2')])
      explorer.initialize(tree, 'MainActivity')

      const action = explorer.step(tree, 'MainActivity')
      expect(action.type).toBe('CLICK')
      if (action.type === 'CLICK') {
        expect(action.target.text).toBe('btn1')
        expect(action.index).toBe(0)
      }
    })

    it('should click second element after first is visited', () => {
      const btn1 = makeButton('btn1')
      const btn2 = makeButton('btn2')
      const tree = makeLayout([btn1, btn2])
      explorer.initialize(tree, 'MainActivity')

      explorer.step(tree, 'MainActivity') // clicks btn1
      const action = explorer.step(tree, 'MainActivity') // should click btn2
      expect(action.type).toBe('CLICK')
      if (action.type === 'CLICK') {
        expect(action.target.text).toBe('btn2')
      }
    })

    it('should backtrack when all elements visited', () => {
      const tree = makeLayout([makeButton('btn1')])
      explorer.initialize(tree, 'MainActivity')

      explorer.step(tree, 'MainActivity') // clicks btn1
      const action = explorer.step(tree, 'MainActivity')
      expect(action.type).toBe('BACK')
    })

    it('should stop when stack is empty after backtracking', () => {
      const tree = makeLayout([makeButton('btn1')])
      explorer.initialize(tree, 'MainActivity')

      explorer.step(tree, 'MainActivity') // clicks btn1
      explorer.step(tree, 'MainActivity') // BACK

      const action = explorer.step(tree, 'MainActivity')
      expect(action.type).toBe('STOP')
    })
  })

  describe('deduplication', () => {
    it('should track visited tree hashes', () => {
      const tree = makeLayout([makeButton('btn1')])
      explorer.initialize(tree, 'MainActivity')
      explorer.step(tree, 'MainActivity')

      expect(explorer.getVisitedHashes().size).toBeGreaterThan(0)
    })

    it('should handle same tree on different pages', () => {
      const tree = makeLayout([makeButton('btn1')])
      explorer.initialize(tree, 'MainActivity')
      explorer.step(tree, 'MainActivity')

      // Same tree, different activity
      const action = explorer.step(tree, 'SecondActivity')
      expect(action.type).toBe('BACK')
    })
  })

  describe('activity visit tracking', () => {
    it('should count visits per activity', () => {
      const tree = makeLayout([makeButton('btn1')])
      explorer.initialize(tree, 'MainActivity')
      explorer.step(tree, 'MainActivity')
      explorer.step(tree, 'MainActivity')

      expect(explorer.getVisitedActivities().get('MainActivity')).toBeGreaterThanOrEqual(1)
    })
  })

  describe('boundary controls', () => {
    it('should stop at max steps', () => {
      explorer = new DFSExplorer({ maxDepth: 50, maxSteps: 2, maxTime: 60000 })
      const tree = makeLayout([makeButton('btn1'), makeButton('btn2')])
      explorer.initialize(tree, 'MainActivity')

      explorer.step(tree, 'MainActivity') // step 1
      const action = explorer.step(tree, 'MainActivity') // step 2
      expect(action.type).toBe('STOP')
      if (action.type === 'STOP') {
        expect(action.reason).toContain('Max steps')
      }
    })

    it('should stop at max depth', () => {
      explorer = new DFSExplorer({ maxDepth: 0, maxSteps: 1000, maxTime: 60000 })
      const tree = makeLayout([makeButton('btn1')])
      explorer.initialize(tree, 'MainActivity')

      const action = explorer.step(tree, 'MainActivity')
      expect(action.type).toBe('STOP')
      if (action.type === 'STOP') {
        expect(action.reason).toContain('Max depth')
      }
    })

    it('should stop at max time', (done) => {
      explorer = new DFSExplorer({ maxDepth: 50, maxSteps: 1000, maxTime: 10 })
      const tree = makeLayout([makeButton('btn1')])
      explorer.initialize(tree, 'MainActivity')

      setTimeout(() => {
        const action = explorer.step(tree, 'MainActivity')
        expect(action.type).toBe('STOP')
        if (action.type === 'STOP') {
          expect(action.reason).toContain('Max time')
        }
        done()
      }, 20)
    })
  })

  describe('reset', () => {
    it('should clear all state on reset', () => {
      const tree = makeLayout([makeButton('btn1')])
      explorer.initialize(tree, 'MainActivity')
      explorer.step(tree, 'MainActivity')

      explorer.reset()
      expect(explorer.getStepCount()).toBe(0)
      expect(explorer.getStack()).toHaveLength(0)
      expect(explorer.getVisitedHashes().size).toBe(0)
    })
  })
})
