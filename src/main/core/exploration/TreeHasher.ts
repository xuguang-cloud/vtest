import { createHash } from 'crypto'
import { UITreeNode } from './types'

/**
 * UI Tree Hasher - Generates deterministic SHA256 hash for UI tree deduplication.
 * Ignores coordinate offsets (bounds) to handle minor UI shifts.
 */
export class TreeHasher {
  /**
   * Hash a UI tree node for deduplication.
   * Ignores bounds coordinates to handle layout shifts.
   */
  static hash(uiTree: UITreeNode): string {
    const normalized = this.normalizeNode(uiTree)
    const json = JSON.stringify(normalized)
    return createHash('sha256').update(json).digest('hex')
  }

  private static normalizeNode(node: UITreeNode): object {
    const children = node.children?.map(child => this.normalizeNode(child)) ?? []
    return {
      className: node.className,
      text: node.text,
      clickable: node.clickable,
      resourceId: node.resourceId ?? null,
      contentDescription: node.contentDescription ?? null,
      children
      // bounds intentionally omitted to ignore coordinate shifts
    }
  }
}
