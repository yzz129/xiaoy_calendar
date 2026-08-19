import { useEffect, useState } from 'react'
const STORAGE_KEY = 'xiaoy-calendar:v2'
const LEGACY_STORAGE_KEY = 'berry-calendar:v1'
const initialState = { entries: {}, notes: {}, theme: 'light' }

function loadState() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...initialState, ...JSON.parse(raw) } : initialState
  } catch {
    return initialState
  }
}

export function useCalendarStore() {
  const [store, setStore] = useState(loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  }, [store])

  const updateEntry = (dateKey, patch) => {
    setStore((current) => ({
      ...current,
      entries: {
        ...current.entries,
        [dateKey]: { status: '', duration: 1, ...current.entries[dateKey], ...patch },
      },
    }))
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

  const toggleTheme = () => {
    setStore((current) => ({ ...current, theme: current.theme === 'light' ? 'berry-night' : 'light' }))
  }

  return { store, updateEntry, addNote, updateNote, removeNote, toggleTheme }
}
