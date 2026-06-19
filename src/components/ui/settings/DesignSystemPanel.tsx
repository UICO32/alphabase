import { useState, useEffect, useCallback } from 'react'

type DesignTab = 'colors' | 'typography' | 'spacing' | 'shadows' | 'motion' | 'components'

// ─── helpers ────────────────────────────────────────────────

function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function useTokenValues(tokens: string[]): Record<string, string> {
  const [values, setValues] = useState<Record<string, string>>({})

  const refresh = useCallback(() => {
    const next: Record<string, string> = {}
    for (const t of tokens) {
      next[t] = getCSSVar(t)
    }
    setValues(next)
  }, [tokens])

  useEffect(() => {
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [refresh])

  return values
}

// ─── token lists ────────────────────────────────────────────

const COLOR_TOKENS = [
  { label: 'Surface', tokens: [
    '--surface-app', '--surface-panel', '--surface-panel-solid', '--surface-panel-alt',
    '--surface-panel-hover', '--surface-card', '--surface-card-hover', '--surface-card-active',
    '--surface-input', '--surface-overlay',
  ]},
  { label: 'Text', tokens: [
    '--fg-primary', '--fg-secondary', '--fg-tertiary', '--fg-disabled',
    '--fg-inverse', '--fg-link', '--fg-link-hover', '--fg-danger',
  ]},
  { label: 'Border', tokens: [
    '--line-default', '--line-hover', '--line-active', '--line-focus', '--line-danger',
  ]},
  { label: 'Emphasis', tokens: ['--emphasis'] },
  { label: 'Accent', tokens: [
    '--color-accent-blue', '--color-accent-green', '--color-accent-red',
  ]},
]

const TYPO_TOKENS = [
  '--font-size-xs', '--font-size-sm', '--font-size-base', '--font-size-md',
  '--font-size-lg', '--font-size-xl',
  '--font-weight-normal', '--font-weight-medium', '--font-weight-semibold', '--font-weight-bold',
]

const SPACING_TOKENS = [
  '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6',
  '--radius-none', '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-full',
]

const SHADOW_TOKENS = [
  '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl',
  '--shadow-glow-blue', '--shadow-glow-green', '--shadow-glow-red',
  '--shadow-glow-accent', '--card-selected-shadow',
  '--shadow-inner', '--shadow-inner-active',
  '--panel-border-glow',
]

const MOTION_TOKENS = [
  '--ease-default', '--ease-in', '--ease-out', '--ease-bounce', '--ease-smooth',
  '--duration-fast', '--duration-normal', '--duration-slow', '--duration-slower',
]

// flat list of all tokens for the hook
const ALL_TOKENS = [
  ...COLOR_TOKENS.flatMap(g => g.tokens),
  ...TYPO_TOKENS, ...SPACING_TOKENS, ...SHADOW_TOKENS, ...MOTION_TOKENS,
]

// ─── sub-panels ─────────────────────────────────────────────

function ColorSwatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div
        className="w-8 h-8 rounded-md border border-line-default shrink-0"
        style={{ backgroundColor: `var(${name})` }}
      />
      <div className="min-w-0">
        <div className="text-xs font-mono text-fg-primary truncate">{name}</div>
        <div className="text-xs font-mono text-fg-tertiary truncate">{value}</div>
      </div>
    </div>
  )
}

function ColorsPanel({ values }: { values: Record<string, string> }) {
  return (
    <div className="space-y-6">
      {COLOR_TOKENS.map(group => (
        <div key={group.label}>
          <h4 className="text-sm font-medium text-fg-primary mb-2">{group.label}</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {group.tokens.map(t => (
              <ColorSwatch key={t} name={t} value={values[t] || ''} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TypographyPanel({ values }: { values: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-fg-primary mb-2">Font Size</h4>
        <div className="space-y-2">
          {['--font-size-xs', '--font-size-sm', '--font-size-base', '--font-size-md', '--font-size-lg', '--font-size-xl'].map(t => (
            <div key={t} className="flex items-center justify-between">
              <span style={{ fontSize: values[t] || '13px' }} className="text-fg-primary">
                Aa — {t}
              </span>
              <span className="text-xs font-mono text-fg-tertiary">{values[t]}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-fg-primary mb-2">Font Weight</h4>
        <div className="space-y-2">
          {['--font-weight-normal', '--font-weight-medium', '--font-weight-semibold', '--font-weight-bold'].map(t => (
            <div key={t} className="flex items-center justify-between">
              <span style={{ fontWeight: values[t] || '400' }} className="text-fg-primary">
                Aa — {t}
              </span>
              <span className="text-xs font-mono text-fg-tertiary">{values[t]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SpacingPanel({ values }: { values: Record<string, string> }) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-fg-primary mb-2">Spacing</h4>
        <div className="space-y-1.5">
          {['--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6'].map(t => (
            <div key={t} className="flex items-center gap-3">
              <div
                className="h-4 rounded-sm bg-accent-blue"
                style={{ width: values[t] || '4px' }}
              />
              <span className="text-xs font-mono text-fg-secondary">{t}: {values[t]}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-fg-primary mb-2">Radius</h4>
        <div className="flex flex-wrap gap-3">
          {['--radius-none', '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-full'].map(t => (
            <div key={t} className="flex flex-col items-center gap-1">
              <div
                className="w-12 h-12 border-2 border-line-active"
                style={{ borderRadius: values[t] || '0px' }}
              />
              <span className="text-xs font-mono text-fg-tertiary">{t.replace('--radius-', '')}</span>
              <span className="text-xs font-mono text-fg-tertiary">{values[t]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ShadowsPanel({ values }: { values: Record<string, string> }) {
  return (
    <div className="space-y-3">
      {SHADOW_TOKENS.map(t => (
        <div key={t} className="flex items-center gap-4">
          <div
            className="w-16 h-10 rounded-md bg-surface-card shrink-0"
            style={{ boxShadow: values[t] || 'none' }}
          />
          <div className="min-w-0">
            <div className="text-xs font-mono text-fg-primary truncate">{t}</div>
            <div className="text-xs font-mono text-fg-tertiary truncate max-w-[300px]">{values[t]}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function MotionPanel({ values }: { values: Record<string, string> }) {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-fg-primary mb-2">Easing</h4>
        <div className="space-y-2">
          {['--ease-default', '--ease-in', '--ease-out', '--ease-bounce', '--ease-smooth'].map(t => (
            <div key={t} className="flex items-center justify-between">
              <span className="text-xs font-mono text-fg-secondary">{t}</span>
              <span className="text-xs font-mono text-fg-tertiary">{values[t]}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-fg-primary mb-2">Duration</h4>
        <div className="space-y-2">
          {['--duration-fast', '--duration-normal', '--duration-slow', '--duration-slower'].map(t => (
            <div key={t} className="flex items-center justify-between">
              <span className="text-xs font-mono text-fg-secondary">{t}</span>
              <span className="text-xs font-mono text-fg-tertiary">{values[t]}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-fg-primary mb-3">Animation Preview</h4>
        <div className="space-y-3">
          {(['--ease-default', '--ease-bounce'] as const).map(ease => (
            <div key={ease}>
              <div className="text-xs font-mono text-fg-tertiary mb-1">{ease}</div>
              <div className="relative h-6 bg-surface-card-active rounded overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full w-6 rounded bg-accent-blue"
                  style={{
                    animation: `ds-slide 1.5s ${values[ease] || 'ease'} infinite alternate`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <style>{`
          @keyframes ds-slide {
            from { left: 0; }
            to { left: calc(100% - 24px); }
          }
        `}</style>
      </div>
    </div>
  )
}

function ComponentsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-fg-primary mb-3">Glass Panels</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-panel rounded-lg p-4 text-xs text-fg-primary">
            glass-panel
          </div>
          <div className="glass-card rounded-lg p-4 text-xs text-fg-primary">
            glass-card
          </div>
          <div className="glass-panel-large rounded-lg p-4 text-xs text-fg-primary col-span-2">
            glass-panel-large
          </div>
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-fg-primary mb-3">Emphasis Color</h4>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-emphasis" />
          <div className="text-xs text-fg-secondary">bg-emphasis</div>
        </div>
      </div>
    </div>
  )
}

// ─── main panel ─────────────────────────────────────────────

const TABS: { key: DesignTab; label: string }[] = [
  { key: 'colors', label: '色彩' },
  { key: 'typography', label: '排版' },
  { key: 'spacing', label: '间距圆角' },
  { key: 'shadows', label: '阴影' },
  { key: 'motion', label: '动效' },
  { key: 'components', label: '组件' },
]

export function DesignSystemPanel() {
  const [tab, setTab] = useState<DesignTab>('colors')
  const values = useTokenValues(ALL_TOKENS)

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-line-default">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm transition-colors rounded-t-md ${
              tab === t.key
                ? 'bg-surface-card-active text-fg-primary font-medium'
                : 'text-fg-tertiary hover:text-fg-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'colors' && <ColorsPanel values={values} />}
      {tab === 'typography' && <TypographyPanel values={values} />}
      {tab === 'spacing' && <SpacingPanel values={values} />}
      {tab === 'shadows' && <ShadowsPanel values={values} />}
      {tab === 'motion' && <MotionPanel values={values} />}
      {tab === 'components' && <ComponentsPanel />}
    </div>
  )
}
