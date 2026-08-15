export function getWaveformColors() {
  if (typeof document === 'undefined') {
    return {
      waveColor: 'oklch(0.56 0 0)',
      progressColor: '#f76046',
      cursorColor: 'oklch(0.145 0 0)',
    }
  }

  const root = document.documentElement
  const read = (name: string, fallback: string) => {
    const value = getComputedStyle(root).getPropertyValue(name).trim()
    return value || fallback
  }

  return {
    waveColor: read('--muted-foreground', 'oklch(0.56 0 0)'),
    progressColor: read('--primary', '#f76046'),
    cursorColor: read('--foreground', 'oklch(0.145 0 0)'),
  }
}
