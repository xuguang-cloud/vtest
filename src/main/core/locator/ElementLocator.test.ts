import { describe, it, expect } from 'vitest'
import { ElementLocator } from './ElementLocator'
import { UITreeNode } from '../plugin/PluginHost'

describe('ElementLocator', () => {
  const buildTree = (): UITreeNode => ({
    id: 'root', platform: 'android', nativeType: 'android.widget.FrameLayout', role: 'layout',
    bounds: { x: 0, y: 0, width: 1080, height: 1920 }, text: '', clickable: false,
    enabled: true, visible: true,
    children: [
      {
        id: 'btn-login', platform: 'android', nativeType: 'android.widget.Button', role: 'button',
        bounds: { x: 100, y: 100, width: 200, height: 80 }, text: 'Login',
        resourceId: 'com.example:id/login', clickable: true, enabled: true, visible: true, children: []
      },
      {
        id: 'btn-register', platform: 'android', nativeType: 'android.widget.Button', role: 'button',
        bounds: { x: 100, y: 200, width: 200, height: 80 }, text: 'Register',
        resourceId: 'com.example:id/register', clickable: true, enabled: true, visible: true, children: []
      }
    ]
  })

  it('finds by resource id', async () => {
    const el = await new ElementLocator(buildTree()).find({ by: 'id', value: 'com.example:id/login' })
    expect(el?.text).toBe('Login')
  })

  it('finds by text', async () => {
    const el = await new ElementLocator(buildTree()).find({ by: 'text', value: 'Register' })
    expect(el?.resourceId).toBe('com.example:id/register')
  })

  it('finds by content desc', async () => {
    const tree = buildTree()
    tree.children[0].label = 'Login Button'
    const el = await new ElementLocator(tree).find({ by: 'contentDesc', value: 'Login Button' })
    expect(el?.id).toBe('btn-login')
  })

  it('finds by class', async () => {
    const els = await new ElementLocator(buildTree()).findAll({ by: 'class', value: 'android.widget.Button' })
    expect(els).toHaveLength(2)
  })

  it('finds by coordinate', async () => {
    const el = await new ElementLocator(buildTree()).find({ by: 'coordinate', bounds: { x: 90, y: 90, width: 220, height: 100 } })
    expect(el?.text).toBe('Login')
  })

  it('supports fuzzy text match', async () => {
    const el = await new ElementLocator(buildTree()).find({ by: 'text', value: 'log', fuzzy: true })
    expect(el?.text).toBe('Login')
  })

  it('returns null when not found', async () => {
    const el = await new ElementLocator(buildTree()).find({ by: 'text', value: 'Missing' })
    expect(el).toBeNull()
  })

  it('findAll returns all matches', async () => {
    const els = await new ElementLocator(buildTree()).findAll({ by: 'class', value: 'android.widget.Button' })
    expect(els).toHaveLength(2)
  })
})
