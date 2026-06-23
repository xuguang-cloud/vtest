import { UITreeNode } from '../plugin/PluginHost'

export interface PageObject {
  name: string
  screenName: string
  elements: POElement[]
}

export interface POElement {
  name: string
  selector: string
  action: string
}

export interface POGenerationOptions {
  language: 'typescript' | 'python'
  framework: 'appium' | 'playwright' | 'maestro'
}

export class PageObjectGenerator {
  async generate(trees: Map<string, UITreeNode>, options: POGenerationOptions): Promise<PageObject[]> {
    const pages: PageObject[] = []
    for (const [screenName, tree] of trees.entries()) {
      const page = await this.generatePage(screenName, tree, options)
      pages.push(page)
    }
    return pages
  }

  private async generatePage(screenName: string, tree: UITreeNode, options: POGenerationOptions): Promise<PageObject> {
    const elements: POElement[] = []
    this.traverse(tree, (node) => {
      if (!node.clickable) return
      const name = this.generateElementName(node)
      const selector = this.generateSelector(node)
      elements.push({ name, selector, action: 'tap' })
    })
    return { name: this.toPascalCase(screenName) + 'Page', screenName, elements }
  }

  async export(pages: PageObject[], options: POGenerationOptions): Promise<string> {
    if (options.language === 'typescript') return this.exportTypeScript(pages)
    return this.exportPython(pages)
  }

  private exportTypeScript(pages: PageObject[]): string {
    return pages.map(page => {
      const elements = page.elements.map(e => `  get ${e.name}() { return driver.elementByXPath('${e.selector}'); }`).join('\n')
      return `class ${page.name} {\n${elements}\n}\n`
    }).join('\n')
  }

  private exportPython(pages: PageObject[]): string {
    return pages.map(page => {
      const elements = page.elements.map(e => `    ${e.name} = "${e.selector}"`).join('\n')
      return `class ${page.name}:\n${elements}\n`
    }).join('\n')
  }

  private generateElementName(node: UITreeNode): string {
    const base = node.text || node.label || node.resourceId || node.nativeType
    return this.toCamelCase(base) + 'Button'
  }

  private generateSelector(node: UITreeNode): string {
    if (node.resourceId) return `//${node.nativeType}[@resource-id='${node.resourceId}']`
    if (node.text) return `//${node.nativeType}[@text='${node.text}']`
    return `//${node.nativeType}`
  }

  private toPascalCase(str: string): string {
    return str.replace(/(^|_+|-+|\s+)([a-zA-Z])/g, (_, __, letter) => letter.toUpperCase())
  }

  private toCamelCase(str: string): string {
    const pascal = this.toPascalCase(str)
    return pascal.charAt(0).toLowerCase() + pascal.slice(1)
  }

  private traverse(node: UITreeNode, callback: (node: UITreeNode) => void): void {
    callback(node)
    for (const child of node.children) {
      this.traverse(child, callback)
    }
  }
}
