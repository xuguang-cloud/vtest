import { MockUITreeProvider, UITreeProvider } from '../UITreeProvider'
import { UITreeNode } from '../types'

describe('MockUITreeProvider', () => {
  it('should dump a mock UI tree', async () => {
    const provider = new MockUITreeProvider()
    const tree = await provider.dumpUITree()
    expect(tree.className).toBe('android.widget.FrameLayout')
    expect(tree.children).toHaveLength(2)
    expect(tree.children[0].clickable).toBe(true)
    expect(tree.children[0].text).toBe('Button 1')
  })

  it('should accept custom mock tree', async () => {
    const customTree: UITreeNode = {
      className: 'android.widget.LinearLayout',
      bounds: { x: 0, y: 0, width: 1080, height: 1920 },
      text: 'Custom',
      clickable: false,
      children: [
        {
          className: 'android.widget.TextView',
          bounds: { x: 0, y: 0, width: 100, height: 50 },
          text: 'Custom Button',
          clickable: true,
          children: []
        }
      ]
    }
    const provider = new MockUITreeProvider(customTree)
    const tree = await provider.dumpUITree()
    expect(tree.text).toBe('Custom')
    expect(tree.children[0].text).toBe('Custom Button')
  })
})
