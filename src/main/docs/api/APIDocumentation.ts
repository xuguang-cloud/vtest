/**
 * APIDocumentation — API 文档生成器
 * 基于注册的路由信息自动生成 Markdown/HTML 格式的 API 文档
 */

export interface ParameterInfo {
  name: string
  type: string
  required: boolean
  description: string
  defaultValue?: unknown
}

export interface RouteInfo {
  description: string
  parameters: ParameterInfo[]
  example: unknown
  responses?: Record<string, { description: string; example?: unknown }>
  tags?: string[]
  deprecated?: boolean
}

export class APIDocumentation {
  private routes = new Map<string, RouteInfo>()

  registerRoute(method: string, path: string, info: RouteInfo): void {
    this.routes.set(`${method.toUpperCase()} ${path}`, info)
  }

  getRoute(method: string, path: string): RouteInfo | undefined {
    return this.routes.get(`${method.toUpperCase()} ${path}`)
  }

  getAllRoutes(): Array<{ method: string; path: string; info: RouteInfo }> {
    return Array.from(this.routes.entries()).map(([key, info]) => {
      const [method, ...pathParts] = key.split(' ')
      return { method, path: pathParts.join(' '), info }
    })
  }

  generateMarkdown(): string {
    let markdown = '# API Documentation\n\n'
    markdown += `> Generated at: ${new Date().toISOString()}\n\n`
    markdown += `Total endpoints: ${this.routes.size}\n\n`

    // 按标签分组
    const routes = this.getAllRoutes()
    const taggedRoutes = new Map<string, Array<{ method: string; path: string; info: RouteInfo }>>()
    const untagged: Array<{ method: string; path: string; info: RouteInfo }> = []

    for (const route of routes) {
      if (route.info.tags && route.info.tags.length > 0) {
        for (const tag of route.info.tags) {
          if (!taggedRoutes.has(tag)) taggedRoutes.set(tag, [])
          taggedRoutes.get(tag)!.push(route)
        }
      } else {
        untagged.push(route)
      }
    }

    // 有标签的分组
    for (const [tag, tagRoutes] of taggedRoutes) {
      markdown += `## ${tag}\n\n`
      for (const route of tagRoutes) {
        markdown += this.renderRouteMarkdown(route.method, route.path, route.info)
      }
    }

    // 无标签的
    if (untagged.length > 0) {
      markdown += `## Other Endpoints\n\n`
      for (const route of untagged) {
        markdown += this.renderRouteMarkdown(route.method, route.path, route.info)
      }
    }

    return markdown
  }

  private renderRouteMarkdown(method: string, path: string, info: RouteInfo): string {
    const deprecationBadge = info.deprecated ? ' ⚠️ **DEPRECATED**' : ''
    let md = `### \`${method}\` ${path}${deprecationBadge}\n\n`
    md += `${info.description}\n\n`

    if (info.parameters.length > 0) {
      md += `#### Parameters\n\n`
      md += `| Name | Type | Required | Description |\n`
      md += `|------|------|----------|-------------|\n`
      for (const param of info.parameters) {
        const required = param.required ? '✅' : '❌'
        const desc = param.defaultValue !== undefined
          ? `${param.description} (default: \`${param.defaultValue}\`)`
          : param.description
        md += `| \`${param.name}\` | \`${param.type}\` | ${required} | ${desc} |\n`
      }
      md += '\n'
    }

    if (info.example !== undefined) {
      md += `#### Example\n\n`
      md += '```json\n'
      md += `${JSON.stringify(info.example, null, 2)}\n`
      md += '```\n\n'
    }

    return md
  }

  generateHTML(): string {
    const routes = this.getAllRoutes()
    const routeCards = routes.map(route => this.renderRouteHTML(route.method, route.path, route.info)).join('\n')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fa; color: #333; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { margin-bottom: 10px; }
    .meta { color: #666; margin-bottom: 30px; }
    .route-card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .route-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .method { display: inline-block; padding: 4px 8px; border-radius: 4px; color: white; font-weight: 600; font-size: 12px; text-transform: uppercase; }
    .method-GET { background: #28a745; }
    .method-POST { background: #007bff; }
    .method-PUT { background: #ffc107; color: #333; }
    .method-DELETE { background: #dc3545; }
    .method-PATCH { background: #6f42c1; }
    .path { font-family: monospace; font-size: 14px; font-weight: 500; }
    .desc { color: #555; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }
    th { background: #f8f9fa; font-weight: 600; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
    .deprecated { opacity: 0.6; text-decoration: line-through; }
    .deprecated-badge { background: #dc3545; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📖 API Documentation</h1>
    <p class="meta">Endpoints: ${routes.length} | Generated: ${new Date().toISOString()}</p>
    ${routeCards}
  </div>
</body>
</html>`
  }

  private renderRouteHTML(method: string, path: string, info: RouteInfo): string {
    const depClass = info.deprecated ? 'deprecated' : ''
    const depBadge = info.deprecated ? '<span class="deprecated-badge">DEPRECATED</span>' : ''
    const paramsTable = info.parameters.length > 0 ? `
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>
          ${info.parameters.map(p => `<tr>
            <td><code>${p.name}</code></td>
            <td><code>${p.type}</code></td>
            <td>${p.required ? '✅' : '❌'}</td>
            <td>${p.description}${p.defaultValue !== undefined ? ` <em>(default: ${p.defaultValue})</em>` : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : ''

    const example = info.example !== undefined
      ? `<pre>${JSON.stringify(info.example, null, 2)}</pre>`
      : ''

    return `<div class="route-card ${depClass}">
      <div class="route-header">
        <span class="method method-${method}">${method}</span>
        <span class="path">${path}</span>
        ${depBadge}
      </div>
      <div class="desc">${info.description}</div>
      ${paramsTable}
      ${example}
    </div>`
  }

  clear(): void {
    this.routes.clear()
  }
}