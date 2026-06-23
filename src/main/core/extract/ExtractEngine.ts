import { UITreeNode, UIString } from '../plugin/PluginHost'

export interface ExtractionResult {
  strings: UIString[]
  elements: UITreeNode[]
  screens: Record<string, UIString[]>
}

export class ExtractEngine {
  async extractStrings(tree: UITreeNode, screenName = 'unknown'): Promise<UIString[]> {
    const strings: UIString[] = []
    this.traverse(tree, (node) => {
      if (node.text) {
        strings.push({ text: node.text, source: 'text', elementId: node.id, screen: screenName })
      }
      if (node.label) {
        strings.push({ text: node.label, source: 'label', elementId: node.id, screen: screenName })
      }
      if (node.hint) {
        strings.push({ text: node.hint, source: 'hint', elementId: node.id, screen: screenName })
      }
    })
    return strings
  }

  async extractElements(tree: UITreeNode): Promise<UITreeNode[]> {
    const elements: UITreeNode[] = []
    this.traverse(tree, (node) => elements.push(node))
    return elements
  }

  async extractAll(tree: UITreeNode, screenName = 'unknown'): Promise<ExtractionResult> {
    const [strings, elements] = await Promise.all([
      this.extractStrings(tree, screenName),
      this.extractElements(tree)
    ])
    const screens: Record<string, UIString[]> = {}
    screens[screenName] = strings
    return { strings, elements, screens }
  }

  exportToJSON(result: ExtractionResult): string {
    return JSON.stringify(result, null, 2)
  }

  exportToCSV(result: ExtractionResult): string {
    const header = 'text,source,elementId,screen\n'
    const rows = result.strings.map(s => `"${s.text.replace(/"/g, '""')}",${s.source},${s.elementId},${s.screen}`).join('\n')
    return header + rows
  }

  private traverse(node: UITreeNode, callback: (node: UITreeNode) => void): void {
    callback(node)
    for (const child of node.children) {
      this.traverse(child, callback)
    }
  }
}
