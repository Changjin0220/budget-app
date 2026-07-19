let seed = Date.now()
export function uid(prefix = 'id') {
  seed += 1
  return `${prefix}_${seed.toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}
