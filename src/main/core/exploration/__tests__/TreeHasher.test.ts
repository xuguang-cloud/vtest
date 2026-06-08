import { TreeHasher } from '../TreeHasher'
import { UITreeNode } from '../types'

describe('TreeHasher', () => {
  const createNode = (overrides: Partial<UITreeNode> = {}): UITreeNode => ({
    className: 'android.widget.Button',
    bounds: { x: 0, y: 0, width: 100, height: 50 },
    text: 'Click me',
    clickable: true,
    children: [],
    ...overrides
  })

  it('should hash a simple node', () => {
    const node = createNode()
    const hash = TreeHasher.hash(node)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBe(64) // SHA-256 hex
  })

  it('should ignore bounds changes', () => {
    const node1 = createNode({ bounds: { x: 0, y: 0, width: 100, height: 50 } })
    const node2 = createNode({ bounds: { x: 10, y: 20, width: 200, height: 80 } })
    expect(TreeHasher.hash(node1)).toBe(TreeHasher.hash(node2))
  })

  it('should produce different hash for different className', () => {
    const node1 = createNode()
    const node2 = createNode({ className: 'android.widget.TextView' })
    expect(TreeHasher.hash(node1)).not.toBe(TreeHasher.hash(node2))
  })

  it('should produce different hash for different text', () => {
    const node1 = createNode()
    const node2 = createNode({ text: 'Different' })
    expect(TreeHasher.hash(node1)).not.toBe(TreeHasher.hash(node2))
  })

  it('should include children in hash', () => {
    const node1 = createNode({
      children: [{ className: 'android.widget.Button', bounds: { x: 0, y: 0, width: 50, height: 50 }, text: 'Child', clickable: true, children: [] }]
    })
    const node2 = createNode({ children: [] })
    expect(TreeHasher.hash(node1)).not.toBe(TreeHasher.hash(node2))
  })

  it('should handle deeply nested trees', () => {
    const node: UITreeNode = {
      className: 'root',
      bounds: { x: 0, y: 0, width: 100, height: 100 },
      text: 'Root',
      clickable: false,
      children: [
        {
          className: 'child1',
          bounds: { x: 0, y: 0, width: 50, height: 50 },
          text: 'Child1',
          clickable: true,
          children: []
        },
        {
          className: 'child2',
          bounds: { x: 0, y: 0, width: 50, height: 50 },
          text: 'Child2',
          clickable: true,
          children: [
            {
              className: 'grandchild',
              bounds: { x: 0, y: 0, width: 20, height: 20 },
              text: 'GrandChild',
              clickable: true,
              children: []
            }
          ]
        }
      ]
    }
    const hash = TreeHasher.hash(node)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBe(64)
  })
})
