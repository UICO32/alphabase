(function () {
  var stored = localStorage.getItem('hepta-theme')
  var mode = stored === 'dark' || stored === 'light' ? stored : 'light'
  var resolved = mode
  if (mode === 'system') resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', resolved)
  var isDark = resolved === 'dark'
  var r = document.documentElement.style
  r.setProperty('--sp-bg', isDark ? '#18181b' : '#fafaf9')
  r.setProperty('--sp-panel', isDark ? '#27272a' : '#f5f5f4')
  r.setProperty('--sp-text', isDark ? '#e4e4e7' : '#18181b')
  r.setProperty('--sp-muted', isDark ? '#71717a' : '#a8a29e')
  r.setProperty('--sp-bar-from', isDark ? '#3f3f46' : '#e7e5e4')
  r.setProperty('--sp-bar-mid', isDark ? '#52525b' : '#f0efee')
  r.setProperty('--sp-border', isDark ? '#3f3f46' : '#e7e5e4')
  r.setProperty('--sp-fill', isDark ? '#e4e4e7' : '#18181b')
  var ac = localStorage.getItem('hepta-accent-color')
  if (ac) {
    var b = isDark ? 'color-mix(in srgb,' + ac + ' 72%,#ffffff)' : ac
    var hv = isDark ? 'color-mix(in srgb,' + ac + ' 58%,#ffffff)' : 'color-mix(in srgb,' + ac + ' 86%,#000000)'
    var so = 'color-mix(in srgb,' + b + ' 12%,transparent)'
    var sh = isDark ? 'color-mix(in srgb,' + b + ' 28%,transparent)' : 'color-mix(in srgb,' + b + ' 22%,transparent)'
    var rg = 'color-mix(in srgb,' + b + ' 35%,transparent)'
    r.setProperty('--brand', b); r.setProperty('--brand-hover', hv); r.setProperty('--brand-soft', so)
    r.setProperty('--brand-ring', rg); r.setProperty('--tag-color', b); r.setProperty('--tag-bg', so)
    r.setProperty('--tag-bg-hover', sh); r.setProperty('--card-ref-color', b); r.setProperty('--card-ref-bg', so)
    r.setProperty('--card-ref-bg-hover', sh); r.setProperty('--fg-link', b); r.setProperty('--fg-link-hover', hv)
    r.setProperty('--line-focus', rg)
  }
})()
