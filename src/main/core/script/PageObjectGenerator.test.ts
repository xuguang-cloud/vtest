import { describe, it, expect } from 'vitest'
import { PageObjectGenerator } from './PageObjectGenerator'
import { UITreeNode } from '../plugin/PluginHost'

describe('PageObjectGenerator', () => {
  const buildTree = (id: string): UITreeNode => ({
    id, platform: 'android', nativeType: 'android.widget.FrameLayout', role: 'layout',
    bounds: { x: 0, y: 0, width: 1080, height: 1920 }, text: '', clickable: false,
    enabled: true, visible: true,
    children: [
      {
        id: `${id}-btn`, platform: 'android', nativeType: 'android.widget.Button', role: 'button',
        bounds: { x: 100, y: 100, width: 200, height: 80 }, text: 'Login',
        resourceId: 'com.example:id/login', clickable: true, enabled: true, visible: true, children: []
      },
      {
        id: `${id}-link`, platform: 'android', nativeType: 'android.widget.TextView', role: 'text',
        bounds: { x: 100, y: 200, width: 200, height: 80 }, text: 'Forgot Password',
        resourceId: 'com.example:id/forgot', clickable: true, enabled: true, visible: true, children: []
      }
    ]
  })

  it('generates one page per screen', async () => {
    const generator = new PageObjectGenerator()
    const trees = new Map<string, UITreeNode>([['LoginScreen', buildTree('login')]])
    const pages = await generator.generate(trees, { language: 'typescript', framework: 'appium' })
    expect(pages).toHaveLength(1)
    expect(pages[0].name).toBe('LoginScreenPage')
  })

  it('generates elements only for clickable nodes', async () => {
    const generator = new PageObjectGenerator()
    const trees = new Map<string, UITreeNode>([['LoginScreen', buildTree('login')]])
    const pages = await generator.generate(trees, { language: 'typescript', framework: 'appium' })
    expect(pages[0].elements).toHaveLength(2)
    expect(pages[0].elements[0].action).toBe('tap')
  })

  it('exports TypeScript', async () => {
    const generator = new PageObjectGenerator()
    const trees = new Map<string, UITreeNode>([['LoginScreen', buildTree('login')]])
    const pages = await generator.generate(trees, { language: 'typescript', framework: 'appium' })
    const ts = await generator.export(pages, { language: 'typescript', framework: 'appium' })
    expect(ts).toContain('class LoginScreenPage')
    expect(ts).toContain('loginButton')
  })

  it('exports Python', async () => {
    const generator = new PageObjectGenerator()
    const trees = new Map<string, UITreeNode>([['LoginScreen', buildTree('login')]])
    const pages = await generator.generate(trees, { language: 'python', framework: 'appium' })
    const py = await generator.export(pages, { language: 'python', framework: 'appium' })
    expect(py).toContain('class LoginScreenPage')
    expect(py).toContain('loginButton')
  })
})
