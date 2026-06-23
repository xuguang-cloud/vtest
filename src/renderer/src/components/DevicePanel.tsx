import React, { useState, useEffect } from 'react'
import { useIPC } from '../hooks/useIPC'

interface DeviceInfo {
  name: string
  target: string
  apiLevel: number
  abi: string
}

export const DevicePanel: React.FC = () => {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [selected, setSelected] = useState('')
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'error'>('idle')
  const [apkPath, setApkPath] = useState('')
  const [packageName, setPackageName] = useState('')
  const { listAVDs, startAVD, stopAVD, getAVDStatus, invoke } = useIPC()

  useEffect(() => {
    loadDevices()
    loadStatus()
  }, [])

  async function loadDevices() {
    try {
      const avds = await listAVDs()
      setDevices(avds as any)
    } catch (err) {
      console.error(err)
    }
  }

  async function loadStatus() {
    try {
      const s = await getAVDStatus()
      setStatus((s as any).running ? 'running' : 'idle')
    } catch (err) {
      setStatus('error')
    }
  }

  async function handleStart() {
    if (!selected) return
    setStatus('starting')
    try {
      await startAVD(selected)
      setStatus('running')
    } catch (err) {
      setStatus('error')
    }
  }

  async function handleStop() {
    try {
      await stopAVD()
      setStatus('idle')
    } catch (err) {
      setStatus('error')
    }
  }

  async function handleInstall() {
    if (!apkPath) return
    try {
      await invoke('device:install', apkPath)
    } catch (err) {
      console.error(err)
    }
  }

  async function handleLaunch() {
    if (!packageName) return
    try {
      await invoke('device:launch', packageName)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
      <h2 className="text-xl font-semibold">Device Manager</h2>
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded px-3 py-2"
        >
          <option value="">Select AVD</option>
          {devices.map((d) => (
            <option key={d.name} value={d.name}>{d.name} (API {d.apiLevel})</option>
          ))}
        </select>
        <button onClick={handleStart} disabled={status === 'starting'} className="bg-green-600 text-white px-4 py-2 rounded">Start</button>
        <button onClick={handleStop} className="bg-red-600 text-white px-4 py-2 rounded">Stop</button>
      </div>
      <div className="text-sm text-gray-400">Status: {status}</div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={apkPath}
          onChange={(e) => setApkPath(e.target.value)}
          placeholder="APK path"
          className="bg-gray-700 border border-gray-600 rounded px-3 py-2"
        />
        <button onClick={handleInstall} className="bg-blue-600 text-white px-4 py-2 rounded">Install</button>
        <input
          type="text"
          value={packageName}
          onChange={(e) => setPackageName(e.target.value)}
          placeholder="Package name"
          className="bg-gray-700 border border-gray-600 rounded px-3 py-2"
        />
        <button onClick={handleLaunch} className="bg-purple-600 text-white px-4 py-2 rounded">Launch</button>
      </div>
    </div>
  )
}
