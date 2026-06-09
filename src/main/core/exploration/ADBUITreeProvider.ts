import { UITreeNode } from './types'
import { ADBAdapter } from '../adb/ADBAdapter'

/**
 * ADB-based UI tree provider.
 * Parses uiautomator XML dump into UITreeNode.
 */
export class ADBUITreeProvider {
  private adb: ADBAdapter

  constructor(adb: ADBAdapter) {
    this.adb = adb
  }

  async dumpUITree(): Promise<UITreeNode> {
    const xml = await this.adb.dumpUI()
    return this.parseUIXML(xml)
  }

  /**
   * Parse uiautomator XML into UITreeNode.
   * Handles: <node> elements with class/text/resource-id/content-desc/clickable/bounds attributes.
   */
  private parseUIXML(xml: string): UITreeNode {
    // Strip XML declaration
    const clean = xml.replace(/<\?xml[^>]*\?>/, '').trim()

    // Parse nodes recursively
    const rootMatch = clean.match(/<node[^>]*>[\s\S]*<\/node>/)
    if (!rootMatch) {
      return { className: 'android.widget.FrameLayout', bounds: { x: 0, y: 0, width: 0, height: 0 }, text: '', clickable: false, children: [] }
    }

    return this.parseNode(rootMatch[0])
  }

  private parseNode(xml: string): UITreeNode {
    const tagMatch = xml.match(/^<node([^>]*)>/)
    if (!tagMatch) {
      return { className: 'unknown', bounds: { x: 0, y: 0, width: 0, height: 0 }, text: '', clickable: false, children: [] }
    }

    const attrs = tagMatch[1]
    const className = this.attr(attrs, 'class') || 'android.view.View'
    const text = this.attr(attrs, 'text') || ''
    const resourceId = this.attr(attrs, 'resource-id') || ''
    const contentDesc = this.attr(attrs, 'content-desc') || ''
    const clickable = this.attr(attrs, 'clickable') === 'true'
    const boundsStr = this.attr(attrs, 'bounds') || '[0,0][0,0]'
    const bounds = this.parseBounds(boundsStr)

    // Find content between <node...> and </node>
    const innerStart = xml.indexOf('>') + 1
    const closingTag = '</node>'
    const innerEnd = xml.lastIndexOf(closingTag)
    const inner = innerEnd > innerStart ? xml.substring(innerStart, innerEnd) : ''

    // Find children <node...>...</node> recursively
    const children: UITreeNode[] = []
    let pos = 0
    while (pos < inner.length) {
      const childStart = inner.indexOf('<node', pos)
      if (childStart === -1) break

      // Find matching </node>
      let depth = 0
      let childEnd = childStart
      let searchPos = childStart
      while (searchPos < inner.length) {
        const openTag = inner.indexOf('<node', searchPos)
        const closeTag = inner.indexOf('</node>', searchPos)

        if (closeTag === -1) break

        if (openTag !== -1 && openTag < closeTag) {
          depth++
          searchPos = openTag + 5
        } else {
          depth--
          if (depth === 0) {
            childEnd = closeTag + 7 // after </node>
            break
          }
          searchPos = closeTag + 7
        }
      }

      if (depth === 0) {
        const childXml = inner.substring(childStart, childEnd)
        children.push(this.parseNode(childXml))
        pos = childEnd
      } else {
        break
      }
    }

    return {
      className,
      bounds,
      text: text || contentDesc,
      resourceId: resourceId || undefined,
      clickable,
      children
    }
  }

  private attr(attrs: string, name: string): string | undefined {
    const regex = new RegExp(`${name}="([^"]*)"`, 'i')
    const match = attrs.match(regex)
    return match ? match[1] : undefined
  }

  private parseBounds(str: string): { x: number; y: number; width: number; height: number } {
    const match = str.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/)
    if (!match) return { x: 0, y: 0, width: 0, height: 0 }
    const [, x1, y1, x2, y2] = match
    return {
      x: parseInt(x1), y: parseInt(y1),
      width: parseInt(x2) - parseInt(x1),
      height: parseInt(y2) - parseInt(y1)
    }
  }
}