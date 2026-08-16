import { useEffect, useState, type ReactNode } from 'react'

function renderChangelogLine(line: string, index: number): ReactNode {
  const trimmed = line.trim()
  if (!trimmed) return <div key={index} className="h-3" />

  const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed)
  if (heading) {
    const level = heading[1].length
    return (
      <div
        key={index}
        className={level === 1
          ? 'mb-3 text-xl font-semibold text-fg-primary'
          : level === 2
            ? 'mb-2 mt-5 text-base font-semibold text-fg-primary'
            : 'mb-1.5 mt-4 text-sm font-semibold text-fg-primary'}
      >
        {heading[2]}
      </div>
    )
  }

  const listItem = /^[-*]\s+(.+)$/.exec(trimmed)
  if (listItem) {
    return (
      <div key={index} className="flex gap-2 py-0.5 text-sm leading-6 text-fg-secondary">
        <span aria-hidden className="text-fg-tertiary">•</span>
        <span>{listItem[1]}</span>
      </div>
    )
  }

  return <p key={index} className="text-sm leading-6 text-fg-secondary">{trimmed}</p>
}

export function AboutSettings() {
  const [version, setVersion] = useState('')
  const [changelog, setChangelog] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const appApi = window.electronAPI?.app
    if (!appApi) {
      setLoadFailed(true)
      return
    }

    void Promise.all([appApi.getVersion(), appApi.readChangelog()])
      .then(([nextVersion, nextChangelog]) => {
        if (cancelled) return
        setVersion(nextVersion)
        setChangelog(nextChangelog)
        setLoadFailed(!nextChangelog)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })

    return () => { cancelled = true }
  }, [])

  return (
    <div className="space-y-6">
      <section>
        <div className="text-lg font-semibold text-fg-primary">AlphaBase</div>
        <div className="mt-1 text-sm text-fg-secondary">版本 {version || '读取中…'}</div>
      </section>

      <section>
        <div className="mb-3 text-sm font-medium text-fg-primary">更新日志</div>
        <div className="rounded-lg border border-line-default bg-surface-panel-alt px-5 py-4">
          {changelog
            ? changelog.split(/\r?\n/).map(renderChangelogLine)
            : <div className="text-sm text-fg-tertiary">{loadFailed ? '暂时无法读取更新日志' : '正在读取更新日志…'}</div>}
        </div>
      </section>
    </div>
  )
}
