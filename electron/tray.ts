import { app, Tray, Menu, type BrowserWindow, type NativeImage, nativeImage } from 'electron'
import { join } from 'path'

let tray: Tray | null = null
let isQuitting = false

export function setIsQuitting(val: boolean): void {
  isQuitting = val
}

export function getIsQuitting(): boolean {
  return isQuitting
}

export function createTray(mainWindow: BrowserWindow): void {
  if (tray) return

  const iconPath = join(app.getAppPath(), 'build', 'icon.ico')
  let icon: NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty()
    }
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('Alphabase')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        setIsQuitting(true)
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
