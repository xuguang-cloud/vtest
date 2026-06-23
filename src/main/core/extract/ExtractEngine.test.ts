import { describe, it, expect } from 'vitest'
import { ExtractEngine } from './ExtractEngine'
import { UITreeNode } from '../plugin/PluginHost'

describe('ExtractEngine', () => {
  const buildTree = (): UITreeNode => ({
    id: 'root', platform: 'android', nativeType: 'FrameLayout', role: 'layout',
    bounds: { x: 0, y: 0, width: 1080, height: 1920 }, text: 'Hello', label: 'Welcome', hint: 'Root hint',
    clickable: false, enabled: true, visible: true,
    children: [
      {
        id: 'btn', platform: 'android', nativeType: 'Button', role: 'button',
        bounds: { x: 0, y: 0, width: 100, height: 50 }, text: 'Submit', hint: 'Tap to submit',
        clickable: true, enabled: true, visible: true, children: []
      },
      {
        id: 'input', platform: 'android', nativeType: 'EditText', role: 'textfield',
        bounds: { x: 0, y: 100, width: 200, height: 50 }, text: '', label: 'Username',
        clickable: true, enabled: true, visible: true, children: []
      }
    ]
  })

  it('extracts all strings including text, label and hint', async () => {
    const result = await new ExtractEngine().extractAll(buildTree(), 'HomeScreen')
    const texts = result.strings.map(s => s.text)
    expect(texts).toContain('Hello')
    expect(texts).toContain('Welcome')
    expect(texts).toContain('Submit')
    expect(texts).toContain('Tap to submit')
    expect(texts).toContain('Username')
  })

  it('extracts all elements', async () => {
    const result = await new ExtractEngine().extractAll(buildTree(), 'HomeScreen')
    expect(result.elements).toHaveLength(3)
  })

  it('exports JSON correctly', async () => {
    const engine = new ExtractEngine()
    const result = await engine.extractAll(buildTree(), 'HomeScreen')
    const json = engine.exportToJSON(result)
    const parsed = JSON.parse(json)
    expect(parsed.strings).toBeDefined()
    expect(parsed.elements).toBeDefined()
  })

  it('exports CSV correctly', async () => {
    const engine = new ExtractEngine()
    const result = await engine.extractAll(buildTree(), 'HomeScreen')
    const csv = engine.exportToCSV(result)
    expect(csv).toContain('text,source,elementId,screen')
    expect(csv).toContain('Hello')
    expect(csv).toContain('HomeScreen')
  })
})
