let webglAvailability

export function canUseWebGL() {
  if (webglAvailability !== undefined) return webglAvailability
  if (typeof document === 'undefined') return false

  let context
  try {
    const canvas = document.createElement('canvas')
    context = canvas.getContext('webgl2') || canvas.getContext('webgl')
    webglAvailability = Boolean(context)
  } catch {
    webglAvailability = false
  } finally {
    try {
      context?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      // The detached probe canvas can be collected if the extension is unavailable.
    }
  }

  return webglAvailability
}
