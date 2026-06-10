/**
 * FeedbackCollector — 用户反馈收集器
 * 收集、分析和汇总用户反馈
 */

export interface UserFeedback {
  userId: string
  rating: number
  category: string
  message: string
  issues: string[]
  suggestions: string[]
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface FeedbackAnalysis {
  total: number
  averageRating: number
  categoryBreakdown: Record<string, { count: number; avgRating: number }>
  ratingDistribution: Record<number, number>
  topIssues: Array<{ issue: string; count: number; percentage: number }>
  topSuggestions: string[]
  recentTrend: { period: string; count: number; avgRating: number }[]
}

export class FeedbackCollector {
  private feedbackList: UserFeedback[] = []
  private maxEntries: number

  constructor(maxEntries: number = 10000) {
    this.maxEntries = maxEntries
  }

  submit(feedback: UserFeedback): void {
    this.feedbackList.push({
      ...feedback,
      timestamp: feedback.timestamp || Date.now()
    })

    if (this.feedbackList.length > this.maxEntries) {
      this.feedbackList.shift()
    }
  }

  getFeedback(userId?: string, options?: {
    startTime?: number
    endTime?: number
    category?: string
    minRating?: number
    limit?: number
  }): UserFeedback[] {
    let filtered = [...this.feedbackList]

    if (userId) {
      filtered = filtered.filter(f => f.userId === userId)
    }
    if (options?.startTime) {
      filtered = filtered.filter(f => f.timestamp >= options.startTime!)
    }
    if (options?.endTime) {
      filtered = filtered.filter(f => f.timestamp <= options.endTime!)
    }
    if (options?.category) {
      filtered = filtered.filter(f => f.category === options.category)
    }
    if (options?.minRating !== undefined) {
      filtered = filtered.filter(f => f.rating >= options.minRating!)
    }

    filtered.sort((a, b) => b.timestamp - a.timestamp)

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit)
    }

    return filtered
  }

  analyzeFeedback(timeRangeMs?: number): FeedbackAnalysis {
    const now = Date.now()
    const range = timeRangeMs || 7 * 24 * 60 * 60 * 1000 // 默认7天
    const recentFeedback = this.feedbackList.filter(f => now - f.timestamp < range)

    if (recentFeedback.length === 0) {
      return {
        total: 0,
        averageRating: 0,
        categoryBreakdown: {},
        ratingDistribution: {},
        topIssues: [],
        topSuggestions: [],
        recentTrend: []
      }
    }

    // 平均评分
    const averageRating = recentFeedback.reduce((sum, f) => sum + f.rating, 0) / recentFeedback.length

    // 分类统计
    const categoryBreakdown: Record<string, { count: number; avgRating: number }> = {}
    for (const fb of recentFeedback) {
      if (!categoryBreakdown[fb.category]) {
        categoryBreakdown[fb.category] = { count: 0, avgRating: 0 }
      }
      categoryBreakdown[fb.category].count++
      categoryBreakdown[fb.category].avgRating += fb.rating
    }
    for (const cat of Object.keys(categoryBreakdown)) {
      categoryBreakdown[cat].avgRating /= categoryBreakdown[cat].count
    }

    // 评分分布
    const ratingDistribution: Record<number, number> = {}
    for (const fb of recentFeedback) {
      ratingDistribution[fb.rating] = (ratingDistribution[fb.rating] || 0) + 1
    }

    // 常见问题
    const issueCount = new Map<string, number>()
    recentFeedback.forEach(fb => {
      fb.issues.forEach(issue => {
        issueCount.set(issue, (issueCount.get(issue) || 0) + 1)
      })
    })
    const totalFeedbacks = recentFeedback.length
    const topIssues = Array.from(issueCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([issue, count]) => ({
        issue,
        count,
        percentage: (count / totalFeedbacks) * 100
      }))

    // 建议去重排序
    const suggestions = recentFeedback
      .map(f => f.suggestions)
      .flat()
      .filter(Boolean)
    const uniqueSuggestions = [...new Set(suggestions)]
    const suggestionCount = new Map<string, number>()
    suggestions.forEach(s => suggestionCount.set(s, (suggestionCount.get(s) || 0) + 1))
    const topSuggestions = uniqueSuggestions
      .sort((a, b) => (suggestionCount.get(b) || 0) - (suggestionCount.get(a) || 0))
      .slice(0, 10)

    return {
      total: recentFeedback.length,
      averageRating,
      categoryBreakdown,
      ratingDistribution,
      topIssues,
      topSuggestions,
      recentTrend: []
    }
  }

  clear(): void {
    this.feedbackList = []
  }
}