import { ADBUITreeProvider } from '../ADBUITreeProvider'
import { ADBAdapter } from '../../adb/ADBAdapter'

jest.mock('../../adb/ADBAdapter')

describe('ADBUITreeProvider', () => {
  const realXML = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<hierarchy rotation="0">
  <node index="0" text="" class="android.widget.FrameLayout" bounds="[0,0][1080,1920]" clickable="false">
    <node index="1" text="Login" class="android.widget.Button" bounds="[100,100][300,180]" clickable="true"></node>
    <node index="2" text="" class="android.widget.EditText" bounds="[100,250][500,330]" clickable="true"></node>
  </node>
</hierarchy>`

  it('should parse uiautomator XML into UITreeNode', async () => {
    const mockDumpUI = jest.fn().mockResolvedValue(realXML)
    const adb = { dumpUI: mockDumpUI } as any
    const provider = new ADBUITreeProvider(adb)
    const tree = await provider.dumpUITree()
    expect(tree.className).toContain('FrameLayout')
    expect(tree.children.length).toBe(2)
    expect(tree.children[0].text).toBe('Login')
    expect(tree.children[0].clickable).toBe(true)
    expect(tree.children[1].className).toContain('EditText')
  })

  it('should parse bounds correctly', async () => {
    const xml = '<node text="Btn" class="android.widget.Button" bounds="[50,60][250,140]" clickable="true"></node>'
    const mockDumpUI = jest.fn().mockResolvedValue(xml)
    const provider = new ADBUITreeProvider({ dumpUI: mockDumpUI } as any)
    const tree = await provider.dumpUITree()
    expect(tree.bounds).toEqual({ x: 50, y: 60, width: 200, height: 80 })
  })

  it('should handle empty UI', async () => {
    const mockDumpUI = jest.fn().mockResolvedValue('<node></node>')
    const provider = new ADBUITreeProvider({ dumpUI: mockDumpUI } as any)
    const tree = await provider.dumpUITree()
    expect(tree.className).toBe('android.view.View')
    expect(tree.children).toEqual([])
  })

  it('should parse deeply nested UI', async () => {
    const xml = `<node index="0" text="" class="android.widget.FrameLayout" bounds="[0,0][1080,1920]" clickable="false">
  <node index="1" text="" class="android.widget.LinearLayout" bounds="[0,0][1080,500]" clickable="false">
    <node index="2" text="Submit" class="android.widget.Button" bounds="[400,50][680,130]" clickable="true"></node>
  </node>
</node>`
    const mockDumpUI = jest.fn().mockResolvedValue(xml)
    const provider = new ADBUITreeProvider({ dumpUI: mockDumpUI } as any)
    const tree = await provider.dumpUITree()
    expect(tree.children[0].className).toContain('LinearLayout')
    expect(tree.children[0].children[0].text).toBe('Submit')
  })
})