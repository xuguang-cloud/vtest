import { UITreeNode } from './types'

/**
 * Interface for UI tree dump providers.
 * Abstracts the actual UI tree retrieval mechanism.
 */
export interface UITreeProvider {
  dumpUITree(): Promise<UITreeNode>
}

/**
 * Mock UI tree provider for development and testing.
 */
export class MockUITreeProvider implements UITreeProvider {
  private mockTree: UITreeNode

  constructor(mockTree?: UITreeNode) {
    this.mockTree = mockTree ?? {
      className: 'android.widget.FrameLayout',
      bounds: { x: 0, y: 0, width: 1080, height: 1920 },
      text: '',
      clickable: false,
      children: [
        {
          className: 'android.widget.Button',
          bounds: { x: 100, y: 100, width: 200, height: 80 },
          text: 'Button 1',
          clickable: true,
          children: []
        },
        {
          className: 'android.widget.Button',
          bounds: { x: 100, y: 200, width: 200, height: 80 },
          text: 'Button 2',
          clickable: true,
          children: []
        }
      ]
    }
  }

  async dumpUITree(): Promise<UITreeNode> {
    return this.mockTree
  }
}
