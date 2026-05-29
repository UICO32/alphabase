import { useState, useCallback } from 'react'

export type DialogType = 'trash' | 'settings' | 'workspacePicker' | 'clipUrlBar'

interface DialogState {
  showTrash: boolean
  showSettings: boolean
  showWorkspacePicker: boolean
  showClipUrlBar: boolean
}

export function useAppDialogs() {
  const [showTrash, setShowTrash] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false)
  const [showClipUrlBar, setShowClipUrlBar] = useState(false)

  const openDialog = useCallback((type: DialogType) => {
    switch (type) {
      case 'trash':
        setShowTrash(true)
        break
      case 'settings':
        setShowSettings(true)
        break
      case 'workspacePicker':
        setShowWorkspacePicker(true)
        break
      case 'clipUrlBar':
        setShowClipUrlBar(true)
        break
    }
  }, [])

  const closeDialog = useCallback((type: DialogType) => {
    switch (type) {
      case 'trash':
        setShowTrash(false)
        break
      case 'settings':
        setShowSettings(false)
        break
      case 'workspacePicker':
        setShowWorkspacePicker(false)
        break
      case 'clipUrlBar':
        setShowClipUrlBar(false)
        break
    }
  }, [])

  return {
    showTrash,
    setShowTrash,
    showSettings,
    setShowSettings,
    showWorkspacePicker,
    setShowWorkspacePicker,
    showClipUrlBar,
    setShowClipUrlBar,
    openDialog,
    closeDialog,
  } as DialogState & {
    setShowTrash: (v: boolean) => void
    setShowSettings: (v: boolean) => void
    setShowWorkspacePicker: (v: boolean) => void
    setShowClipUrlBar: (v: boolean) => void
    openDialog: (type: DialogType) => void
    closeDialog: (type: DialogType) => void
  }
}
