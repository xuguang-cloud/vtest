import { UITreeNode, Bounds } from '../plugin/PluginHost'

export interface ElementSelector {
  by?: 'id' | 'text' | 'contentDesc' | 'class' | 'coordinate'
  value?: string
  bounds?: Bounds
  fuzzy?: boolean
}

export interface IElementLocator {
  find(selector: ElementSelector): Promise<UITreeNode | null>
  findAll(selector: ElementSelector): Promise<UITreeNode[]>
}

export class ElementLocator implements IElementLocator {
  constructor(private tree: UITreeNode) {}

  async find(selector: ElementSelector): Promise<UITreeNode | null> {
    const matches = this.findAllInternal(selector)
    return matches[0] ?? null
  }

  async findAll(selector: ElementSelector): Promise<UITreeNode[]> {
    return this.findAllInternal(selector)
  }

  private findAllInternal(selector: ElementSelector): UITreeNode[] {
    const results: UITreeNode[] = []
    this.traverse(this.tree, (node) => {
      if (this.matches(node, selector)) {
        results.push(node)
      }
    })
    return results
  }

  private matches(node: UITreeNode, selector: ElementSelector): boolean {
    if (selector.by === 'id' && selector.value) {
      return this.fuzzyMatch(node.resourceId, selector.value, selector.fuzzy)
    }
    if (selector.by === 'text' && selector.value) {
      return this.fuzzyMatch(node.text, selector.value, selector.fuzzy)
    }
    if (selector.by === 'contentDesc' && selector.value) {
      return this.fuzzyMatch(node.label, selector.value, selector.fuzzy)
    }
    if (selector.by === 'class' && selector.value) {
      return this.fuzzyMatch(node.nativeType, selector.value, selector.fuzzy)
    }
    if (selector.by === 'coordinate' && selector.bounds) {
      return this.boundsContain(selector.bounds, node.bounds)
    }
    return false
  }

  private fuzzyMatch(haystack?: string, needle?: string, fuzzy = false): boolean {
    if (!haystack || !needle) return false
    if (fuzzy) {
      return haystack.toLowerCase().includes(needle.toLowerCase())
    }
    return haystack === needle
  }

  private boundsContain(outer: Bounds, inner: Bounds): boolean {
    return (
      outer.x <= inner.x &&
      outer.y <= inner.y &&
      outer.x + outer.width >= inner.x + inner.width &&
      outer.y + outer.height >= inner.y + inner.height
    )
  }

  private traverse(node: UITreeNode, callback: (node: UITreeNode) => void): void {
    callback(node)
    for (const child of node.children) {
      this.traverse(child, callback)
    }
  }
}
