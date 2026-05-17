const DEBUG = process.env.HEPTA_DEBUG === '1'

function prefix(level: string) {
  return level === 'debug' ? '[clipper:debug]' : `[clipper:${level}]`
}

export const log = {
  info(msg: string) { console.log(`${prefix('info')} ${msg}`) },
  debug(msg: string) { DEBUG && console.log(`${prefix('debug')} ${msg}`) },
  warn(msg: string) { console.warn(`${prefix('warn')} ${msg}`) },
  error(msg: string) { console.error(`${prefix('error')} ${msg}`) },
}
