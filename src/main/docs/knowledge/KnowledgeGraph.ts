/**
 * KnowledgeGraph — 知识图谱
 * 基于节点和边的有向图知识表示
 * 支持寻路、关联发现、子图查询
 */

export interface GraphNode {
  id: string
  type: string
  label: string
  properties?: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  type: string
  label?: string
  weight?: number
  properties?: Record<string, unknown>
}

export class KnowledgeGraph {
  private nodes = new Map<string, GraphNode>()
  private outEdges = new Map<string, GraphEdge[]>()  // source -> edges
  private inEdges = new Map<string, GraphEdge[]>()   // target -> edges
  private typeIndex = new Map<string, Set<string>>() // node type -> node ids

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node)
    if (!this.typeIndex.has(node.type)) {
      this.typeIndex.set(node.type, new Set())
    }
    this.typeIndex.get(node.type)!.add(node.id)
  }

  addEdge(edge: GraphEdge): void {
    // 确保节点存在
    if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) {
      throw new Error(`Cannot add edge: source or target node not found`)
    }

    if (!this.outEdges.has(edge.source)) {
      this.outEdges.set(edge.source, [])
    }
    this.outEdges.get(edge.source)!.push(edge)

    if (!this.inEdges.has(edge.target)) {
      this.inEdges.set(edge.target, [])
    }
    this.inEdges.get(edge.target)!.push(edge)
  }

  removeNode(id: string): boolean {
    // 清理相关边
    this.outEdges.delete(id)
    this.inEdges.delete(id)

    // 清理其他节点中指向该节点的边
    for (const [sourceId, edges] of this.outEdges) {
      this.outEdges.set(sourceId, edges.filter(e => e.target !== id))
    }

    // 清理类型索引
    const node = this.nodes.get(id)
    if (node) {
      this.typeIndex.get(node.type)?.delete(id)
    }

    return this.nodes.delete(id)
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id)
  }

  findPath(source: string, target: string, maxDepth: number = 10): string[][] {
    const paths: string[][] = []
    const visited = new Set<string>()

    const dfs = (current: string, path: string[]) => {
      if (path.length > maxDepth) return
      if (current === target) {
        paths.push([...path, current])
        return
      }

      visited.add(current)
      const edges = this.outEdges.get(current) || []
      for (const edge of edges) {
        if (!visited.has(edge.target)) {
          dfs(edge.target, [...path, current])
        }
      }
      visited.delete(current)
    }

    dfs(source, [])
    return paths.sort((a, b) => a.length - b.length)
  }

  findShortestPath(source: string, target: string): string[] | null {
    if (source === target) return [source]

    const queue: Array<{ node: string; path: string[] }> = [{ node: source, path: [source] }]
    const visited = new Set<string>([source])

    while (queue.length > 0) {
      const { node, path } = queue.shift()!
      const edges = this.outEdges.get(node) || []

      for (const edge of edges) {
        if (!visited.has(edge.target)) {
          if (edge.target === target) {
            return [...path, target]
          }
          visited.add(edge.target)
          queue.push({ node: edge.target, path: [...path, edge.target] })
        }
      }
    }

    return null
  }

  getRelatedNodes(nodeId: string, maxDepth: number = 2): Map<string, GraphNode[]> {
    const result = new Map<string, GraphNode[]>()
    const visited = new Set<string>()

    const traverse = (currentId: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentId)) return
      visited.add(currentId)

      const edges = this.outEdges.get(currentId) || []
      for (const edge of edges) {
        const target = this.nodes.get(edge.target)
        if (target) {
          const edgeType = edge.type
          if (!result.has(edgeType)) {
            result.set(edgeType, [])
          }
          result.get(edgeType)!.push(target)
          traverse(edge.target, depth + 1)
        }
      }
    }

    traverse(nodeId, 1)
    return result
  }

  findByType(type: string): GraphNode[] {
    const ids = this.typeIndex.get(type)
    if (!ids) return []
    return Array.from(ids).map(id => this.nodes.get(id)!).filter(Boolean)
  }

  getSubgraph(nodeIds: string[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const nodeSet = new Set(nodeIds)
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []

    for (const id of nodeIds) {
      const node = this.nodes.get(id)
      if (node) nodes.push(node)
    }

    for (const [sourceId, edgeList] of this.outEdges) {
      if (nodeSet.has(sourceId)) {
        for (const edge of edgeList) {
          if (nodeSet.has(edge.target)) {
            edges.push(edge)
          }
        }
      }
    }

    return { nodes, edges }
  }

  getStats(): { nodeCount: number; edgeCount: number; typeCount: number } {
    return {
      nodeCount: this.nodes.size,
      edgeCount: Array.from(this.outEdges.values()).reduce((sum, e) => sum + e.length, 0),
      typeCount: this.typeIndex.size
    }
  }

  clear(): void {
    this.nodes.clear()
    this.outEdges.clear()
    this.inEdges.clear()
    this.typeIndex.clear()
  }
}