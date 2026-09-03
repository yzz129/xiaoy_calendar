import { useEffect, useRef, useState } from 'react'
import { authFetch } from './auth'
import { getDateKeysInRange } from './date-utils'
import { DEFAULT_SURFACE_OPACITY, normalizeSurfaceOpacity } from './theme-settings'
import { normalizeAdaptivePalette } from './theme-palette'
const STORAGE_KEY = 'xiaoy-calendar:v3'
const PREVIOUS_STORAGE_KEY = 'xiaoy-calendar:v2'
const LEGACY_STORAGE_KEY = 'berry-calendar:v1'
const LEGACY_OWNER_KEY = 'xiaoy-calendar:legacy-owner:v1'
const PLAN_TYPE_DATA_VERSION = 1
const DEFAULT_SKIN = { enabled: false, revision: '', focusX: .5, focusY: .45, palette: null }
const initialState = {
  entries: {},
  notes: {},
  plans: [],
  planProgress: {},
  planTaskOverrides: {},
  planTypeDataVersion: PLAN_TYPE_DATA_VERSION,
  theme: 'light',
  fontTheme: 'cloud',
  surfaceOpacity: DEFAULT_SURFACE_OPACITY,
  skin: DEFAULT_SKIN,
}

function isPlanType(value) {
  return value === 'study' || value === 'work'
}

function normalizePlan(plan, resetLegacyType = false) {
  const planType = isPlanType(plan?.planType)
    ? plan.planType
    : resetLegacyType
      ? 'study'
      : isPlanType(plan?.type) ? plan.type : 'study'

  return { ...plan, planType, type: planType }
}

function normalizeState(parsed) {
  const resetLegacyPlanType = parsed.planTypeDataVersion !== PLAN_TYPE_DATA_VERSION
  const skin = parsed.skin && typeof parsed.skin === 'object' ? parsed.skin : DEFAULT_SKIN
  return {
    ...initialState,
    ...parsed,
    entries: parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {},
    notes: parsed.notes && typeof parsed.notes === 'object' ? parsed.notes : {},
    plans: Array.isArray(parsed.plans)
      ? parsed.plans.map((plan) => normalizePlan(plan, resetLegacyPlanType))
      : [],
    planProgress: parsed.planProgress && typeof parsed.planProgress === 'object' ? parsed.planProgress : {},
    planTaskOverrides: parsed.planTaskOverrides && typeof parsed.planTaskOverrides === 'object'
      ? parsed.planTaskOverrides
      : {},
    theme: parsed.theme === 'berry-night' ? 'berry-night' : 'light',
    fontTheme: parsed.fontTheme === 'system' ? 'system' : 'cloud',
    surfaceOpacity: normalizeSurfaceOpacity(parsed.surfaceOpacity),
    skin: {
      enabled: Boolean(skin.enabled && skin.revision),
      revision: String(skin.revision || '').slice(0, 40),
      focusX: Math.max(0, Math.min(1, Number.isFinite(Number(skin.focusX)) ? Number(skin.focusX) : .5)),
      focusY: Math.max(0, Math.min(1, Number.isFinite(Number(skin.focusY)) ? Number(skin.focusY) : .45)),
      palette: normalizeAdaptivePalette(skin.palette),
    },
    planTypeDataVersion: PLAN_TYPE_DATA_VERSION,
  }
}

function userStorageKey(userId) {
  return `${STORAGE_KEY}:${userId}`
}

function loadState(userId) {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    const key = userStorageKey(userId)
    let raw = localStorage.getItem(key)
    if (!raw && !localStorage.getItem(LEGACY_OWNER_KEY)) {
      raw = localStorage.getItem(PREVIOUS_STORAGE_KEY)
      if (raw) {
        localStorage.setItem(key, raw)
        localStorage.setItem(LEGACY_OWNER_KEY, userId)
      }
    }
    if (!raw) return initialState
    return normalizeState(JSON.parse(raw))
  } catch {
    return initialState
  }
}

export function useCalendarStore(userId) {
  const [store, setStore] = useState(() => loadState(userId))
  const [syncReady, setSyncReady] = useState(false)
  const storeRef = useRef(store)
  const lastSyncedSnapshotRef = useRef('')
  const lastCloudUpdatedAtRef = useRef('')
  const syncInFlightRef = useRef(false)

  useEffect(() => {
    storeRef.current = store
  }, [store])

  useEffect(() => {
    localStorage.setItem(userStorageKey(userId), JSON.stringify(store))
  }, [store, userId])

  useEffect(() => {
    let active = true
    let loading = false
    let settled = false
    let retryTimer
    setSyncReady(false)
    lastSyncedSnapshotRef.current = ''
    lastCloudUpdatedAtRef.current = ''
    const loadCloudSnapshot = async () => {
      if (!active || settled || loading || navigator.onLine === false) return
      loading = true
      try {
        const response = await authFetch('/api/sync')
        const payload = await response.json().catch(() => ({}))
        if (!active || !response.ok) throw new Error('cloud-sync-unavailable')
        if (payload.snapshot) {
          const cloudState = normalizeState(payload.snapshot)
          lastSyncedSnapshotRef.current = JSON.stringify(cloudState)
          lastCloudUpdatedAtRef.current = payload.updatedAt || ''
          storeRef.current = cloudState
          setStore(cloudState)
        } else {
          // 云端还没有快照时，保留当前设备缓存，并在同步就绪后创建首份云端数据。
          lastSyncedSnapshotRef.current = JSON.stringify(normalizeState(initialState))
        }
        settled = true
        if (active) setSyncReady(true)
      } catch {
        if (active && !settled) retryTimer = window.setTimeout(loadCloudSnapshot, 10000)
      } finally {
        loading = false
      }
    }
    const retryWhenOnline = () => loadCloudSnapshot()
    loadCloudSnapshot()
    window.addEventListener('online', retryWhenOnline)
    return () => {
      active = false
      window.clearTimeout(retryTimer)
      window.removeEventListener('online', retryWhenOnline)
    }
  }, [userId])

  useEffect(() => {
    if (!syncReady) return undefined
    let active = true

    const pullCloudSnapshot = async () => {
      if (!active || navigator.onLine === false || syncInFlightRef.current) return
      const localSnapshot = JSON.stringify(storeRef.current)
      if (localSnapshot !== lastSyncedSnapshotRef.current) return
      syncInFlightRef.current = true
      try {
        const response = await authFetch('/api/sync')
        const payload = await response.json().catch(() => ({}))
        if (!active || !response.ok || !payload.snapshot) return
        const updatedAt = payload.updatedAt || ''
        if (updatedAt && lastCloudUpdatedAtRef.current && updatedAt <= lastCloudUpdatedAtRef.current) return
        const cloudState = normalizeState(payload.snapshot)
        const serialized = JSON.stringify(cloudState)
        lastCloudUpdatedAtRef.current = updatedAt
        lastSyncedSnapshotRef.current = serialized
        if (serialized !== JSON.stringify(storeRef.current)) {
          storeRef.current = cloudState
          setStore(cloudState)
        }
      } catch {
        // 离线或临时网络错误时继续使用当前缓存，下次聚焦或联网后再拉取。
      } finally {
        syncInFlightRef.current = false
      }
    }

    const refreshWhenActive = () => {
      if (document.visibilityState === 'visible') pullCloudSnapshot()
    }
    const interval = window.setInterval(refreshWhenActive, 30000)
    window.addEventListener('focus', refreshWhenActive)
    window.addEventListener('online', refreshWhenActive)
    document.addEventListener('visibilitychange', refreshWhenActive)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshWhenActive)
      window.removeEventListener('online', refreshWhenActive)
      document.removeEventListener('visibilitychange', refreshWhenActive)
    }
  }, [syncReady, userId])

  useEffect(() => {
    if (!syncReady) return undefined
    const serialized = JSON.stringify(store)
    if (serialized === lastSyncedSnapshotRef.current) return undefined
    let cancelled = false
    let retryTimer

    const pushSnapshot = async () => {
      if (cancelled || navigator.onLine === false) return
      if (syncInFlightRef.current) {
        retryTimer = window.setTimeout(pushSnapshot, 750)
        return
      }
      syncInFlightRef.current = true
      try {
        const response = await authFetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshot: store }),
        })
        const payload = await response.json().catch(() => ({}))
        if (cancelled || !response.ok) return
        lastSyncedSnapshotRef.current = serialized
        lastCloudUpdatedAtRef.current = payload.updatedAt || lastCloudUpdatedAtRef.current
      } catch {
        // 保留本地缓存；重新联网或下一次修改时会再次同步。
      } finally {
        syncInFlightRef.current = false
      }
    }

    const timer = window.setTimeout(pushSnapshot, 700)
    const retryWhenOnline = () => pushSnapshot()
    window.addEventListener('online', retryWhenOnline)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.clearTimeout(retryTimer)
      window.removeEventListener('online', retryWhenOnline)
    }
  }, [store, syncReady, userId])

  const updateEntry = (dateKey, patch) => {
    setStore((current) => ({
      ...current,
      entries: {
        ...current.entries,
        [dateKey]: { status: '', duration: 1, ...current.entries[dateKey], ...patch },
      },
    }))
  }

  const updateEntriesRange = (startKey, endKey, patch, weekdays) => {
    const dateKeys = getDateKeysInRange(startKey, endKey, weekdays)
    setStore((current) => {
      const entries = { ...current.entries }
      dateKeys.forEach((dateKey) => {
        entries[dateKey] = { status: '', duration: 1, ...entries[dateKey], ...patch }
      })
      return { ...current, entries }
    })
    return dateKeys.length
  }

  const addNote = (dateKey) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setStore((current) => ({
      ...current,
      notes: {
        ...current.notes,
        [dateKey]: [...(current.notes[dateKey] || []), { id, text: '', done: false }],
      },
    }))
    return id
  }

  const createNote = (dateKey, text, done = false) => {
    const value = String(text || '').trim().slice(0, 300)
    if (!value) return ''
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setStore((current) => ({
      ...current,
      notes: {
        ...current.notes,
        [dateKey]: [...(current.notes[dateKey] || []), { id, text: value, done: Boolean(done) }],
      },
    }))
    return id
  }

  const updateNote = (dateKey, noteId, patch) => {
    setStore((current) => ({
      ...current,
      notes: {
        ...current.notes,
        [dateKey]: (current.notes[dateKey] || []).map((note) =>
          note.id === noteId ? { ...note, ...patch } : note,
        ),
      },
    }))
  }

  const removeNote = (dateKey, noteId) => {
    setStore((current) => ({
      ...current,
      notes: {
        ...current.notes,
        [dateKey]: (current.notes[dateKey] || []).filter((note) => note.id !== noteId),
      },
    }))
  }

  const createPlan = (plan) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setStore((current) => ({
      ...current,
      plans: [...current.plans, normalizePlan({ ...plan, id, createdAt: new Date().toISOString() })],
    }))
    return id
  }

  const createPlans = (plans) => {
    const candidates = Array.isArray(plans) ? plans.filter(Boolean).slice(0, 4) : []
    if (!candidates.length) return []
    const stamp = Date.now()
    const created = candidates.map((plan, index) => normalizePlan({
      ...plan,
      id: `${stamp}-${index}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
    }))
    setStore((current) => ({ ...current, plans: [...current.plans, ...created] }))
    return created.map((plan) => plan.id)
  }

  const updatePlan = (planId, patch) => {
    setStore((current) => ({
      ...current,
      plans: current.plans.map((plan) => plan.id === planId ? normalizePlan({ ...plan, ...patch }) : plan),
    }))
  }

  const removePlan = (planId) => {
    setStore((current) => {
      const nextProgress = { ...current.planProgress }
      const nextOverrides = { ...current.planTaskOverrides }
      delete nextProgress[planId]
      delete nextOverrides[planId]
      return {
        ...current,
        plans: current.plans.filter((plan) => plan.id !== planId),
        planProgress: nextProgress,
        planTaskOverrides: nextOverrides,
      }
    })
  }

  const togglePlanTask = (planId, progressKey) => {
    setStore((current) => {
      const currentPlanProgress = current.planProgress[planId] || {}
      const nextPlanProgress = { ...currentPlanProgress }
      if (nextPlanProgress[progressKey]) delete nextPlanProgress[progressKey]
      else nextPlanProgress[progressKey] = true
      return {
        ...current,
        planProgress: {
          ...current.planProgress,
          [planId]: nextPlanProgress,
        },
      }
    })
  }

  const setPlanTaskDone = (planId, progressKey, done) => {
    setStore((current) => {
      const nextPlanProgress = { ...(current.planProgress[planId] || {}) }
      if (done) nextPlanProgress[progressKey] = true
      else delete nextPlanProgress[progressKey]
      return {
        ...current,
        planProgress: { ...current.planProgress, [planId]: nextPlanProgress },
      }
    })
  }

  const updatePlanTask = (planId, dateKey, taskId, patch) => {
    setStore((current) => {
      const planOverrides = current.planTaskOverrides[planId] || {}
      const dayOverride = planOverrides[dateKey] || {}
      let nextDayOverride

      if (taskId === 'base') {
        nextDayOverride = { ...dayOverride, ...patch }
        if (typeof nextDayOverride.title === 'string') {
          nextDayOverride.title = nextDayOverride.title.trim()
          if (!nextDayOverride.title) delete nextDayOverride.title
        }
        if (!nextDayOverride.skipped) delete nextDayOverride.skipped
      } else {
        nextDayOverride = {
          ...dayOverride,
          extras: (dayOverride.extras || []).map((task) => (
            task.id === taskId ? { ...task, ...patch, title: patch.title?.trim() || task.title } : task
          )),
        }
      }

      return {
        ...current,
        planTaskOverrides: {
          ...current.planTaskOverrides,
          [planId]: { ...planOverrides, [dateKey]: nextDayOverride },
        },
      }
    })
  }

  const addPlanTask = (planId, dateKey, title) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setStore((current) => {
      const planOverrides = current.planTaskOverrides[planId] || {}
      const dayOverride = planOverrides[dateKey] || {}
      const extra = { id, title: title.trim(), createdAt: new Date().toISOString() }
      return {
        ...current,
        planTaskOverrides: {
          ...current.planTaskOverrides,
          [planId]: {
            ...planOverrides,
            [dateKey]: { ...dayOverride, extras: [...(dayOverride.extras || []), extra] },
          },
        },
      }
    })
    return id
  }

  const removePlanTask = (planId, dateKey, taskId) => {
    setStore((current) => {
      const planOverrides = current.planTaskOverrides[planId] || {}
      const dayOverride = planOverrides[dateKey] || {}
      const progress = { ...(current.planProgress[planId] || {}) }
      const nextDayOverride = taskId === 'base'
        ? { ...dayOverride, skipped: true }
        : { ...dayOverride, extras: (dayOverride.extras || []).filter((task) => task.id !== taskId) }

      delete progress[taskId === 'base' ? dateKey : `extra:${taskId}`]
      return {
        ...current,
        planProgress: { ...current.planProgress, [planId]: progress },
        planTaskOverrides: {
          ...current.planTaskOverrides,
          [planId]: { ...planOverrides, [dateKey]: nextDayOverride },
        },
      }
    })
  }

  const resetPlanTask = (planId, dateKey) => {
    setStore((current) => {
      const planOverrides = current.planTaskOverrides[planId] || {}
      const dayOverride = { ...(planOverrides[dateKey] || {}) }
      delete dayOverride.title
      delete dayOverride.skipped
      return {
        ...current,
        planTaskOverrides: {
          ...current.planTaskOverrides,
          [planId]: { ...planOverrides, [dateKey]: dayOverride },
        },
      }
    })
  }

  const movePlanTask = (planId, fromDateKey, toDateKey, taskId) => {
    if (!toDateKey || fromDateKey === toDateKey) return
    setStore((current) => {
      const planOverrides = current.planTaskOverrides[planId] || {}
      const source = planOverrides[fromDateKey] || {}
      const target = planOverrides[toDateKey] || {}
      const progress = { ...(current.planProgress[planId] || {}) }
      let nextSource
      let movedTask

      if (taskId === 'base') {
        const plan = current.plans.find((item) => item.id === planId)
        const title = source.title?.trim() || plan?.dailyTask?.trim() || plan?.title || '规划任务'
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
        movedTask = { id, title, movedFrom: fromDateKey, createdAt: new Date().toISOString() }
        nextSource = { ...source, skipped: true }
        if (progress[fromDateKey]) {
          progress[`extra:${id}`] = true
          delete progress[fromDateKey]
        }
      } else {
        movedTask = (source.extras || []).find((task) => task.id === taskId)
        if (!movedTask) return current
        nextSource = { ...source, extras: (source.extras || []).filter((task) => task.id !== taskId) }
      }

      return {
        ...current,
        planProgress: { ...current.planProgress, [planId]: progress },
        planTaskOverrides: {
          ...current.planTaskOverrides,
          [planId]: {
            ...planOverrides,
            [fromDateKey]: nextSource,
            [toDateKey]: { ...target, extras: [...(target.extras || []), movedTask] },
          },
        },
      }
    })
  }

  const toggleTheme = () => {
    setStore((current) => ({ ...current, theme: current.theme === 'light' ? 'berry-night' : 'light' }))
  }

  const updateThemeSettings = (settings) => {
    setStore((current) => normalizeState({ ...current, ...settings }))
  }

  return {
    store,
    updateEntry,
    updateEntriesRange,
    addNote,
    createNote,
    updateNote,
    removeNote,
    createPlan,
    createPlans,
    updatePlan,
    removePlan,
    togglePlanTask,
    setPlanTaskDone,
    updatePlanTask,
    addPlanTask,
    removePlanTask,
    resetPlanTask,
    movePlanTask,
    toggleTheme,
    updateThemeSettings,
  }
}
