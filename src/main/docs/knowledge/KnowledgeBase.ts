/**
 * KnowledgeBase — 知识库
 * 基于关键词匹配的知识检索系统
 */

export interface Article {
  id: string
  title: string
  content: string
  tags: string[]
  author?: string
  createdAt: number
  updatedAt: number
  version?: string
  category?: string
}

export interface SearchResult {
  article: Article
  relevance: number
  matchedTerms: string[]
}

export class KnowledgeBase {
  private articles = new Map<string, Article>()
  private tagIndex = new Map<string, Set<string>>() // tag -> article ids
  private categoryIndex = new Map<string, Set<string>>() // category -> article ids

  addArticle(article: Article): void {
    this.articles.set(article.id, article)

    // 建立标签索引
    for (const tag of article.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set())
      }
      this.tagIndex.get(tag)!.add(article.id)
    }

    // 建立分类索引
    if (article.category) {
      if (!this.categoryIndex.has(article.category)) {
        this.categoryIndex.set(article.category, new Set())
      }
      this.categoryIndex.get(article.category)!.add(article.id)
    }
  }

  updateArticle(id: string, updates: Partial<Article>): boolean {
    const existing = this.articles.get(id)
    if (!existing) return false

    const updated: Article = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: Date.now()
    }

    this.articles.set(id, updated)
    return true
  }

  removeArticle(id: string): boolean {
    const article = this.articles.get(id)
    if (!article) return false

    // 清理索引
    for (const tag of article.tags) {
      this.tagIndex.get(tag)?.delete(id)
    }
    if (article.category) {
      this.categoryIndex.get(article.category)?.delete(id)
    }

    return this.articles.delete(id)
  }

  getArticle(id: string): Article | undefined {
    return this.articles.get(id)
  }

  search(query: string): SearchResult[] {
    const queryLower = query.toLowerCase()
    const queryTerms = queryLower.split(/\s+/).filter(Boolean)
    const results: SearchResult[] = []

    for (const article of this.articles.values()) {
      const searchText = `${article.title} ${article.content} ${article.tags.join(' ')}`.toLowerCase()
      const matchedTerms = queryTerms.filter(term => searchText.includes(term))

      if (matchedTerms.length > 0) {
        const relevance = this.calculateRelevance(article, queryLower, matchedTerms)
        results.push({ article, relevance, matchedTerms })
      }
    }

    return results.sort((a, b) => b.relevance - a.relevance)
  }

  private calculateRelevance(article: Article, query: string, matchedTerms: string[]): number {
    let score = 0

    // 标题匹配权重最高
    if (article.title.toLowerCase().includes(query)) {
      score += 10
    }

    // 标签匹配
    const tagMatches = article.tags.filter(t =>
      matchedTerms.some(term => t.toLowerCase().includes(term))
    ).length
    score += tagMatches * 5

    // 内容匹配
    const contentMatches = matchedTerms.filter(term =>
      article.content.toLowerCase().includes(term)
    ).length
    score += contentMatches * 2

    // 时间衰减（越新的文章越靠前）
    const ageDays = (Date.now() - article.createdAt) / (1000 * 60 * 60 * 24)
    score += Math.max(0, 5 - ageDays * 0.1)

    return score
  }

  findByTag(tag: string): Article[] {
    const ids = this.tagIndex.get(tag)
    if (!ids) return []
    return Array.from(ids)
      .map(id => this.articles.get(id)!)
      .filter(Boolean)
  }

  findByCategory(category: string): Article[] {
    const ids = this.categoryIndex.get(category)
    if (!ids) return []
    return Array.from(ids)
      .map(id => this.articles.get(id)!)
      .filter(Boolean)
  }

  getAllTags(): string[] {
    return Array.from(this.tagIndex.keys())
  }

  getAllCategories(): string[] {
    return Array.from(this.categoryIndex.keys())
  }

  getCount(): number {
    return this.articles.size
  }

  clear(): void {
    this.articles.clear()
    this.tagIndex.clear()
    this.categoryIndex.clear()
  }
}