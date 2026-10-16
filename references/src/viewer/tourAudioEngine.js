export class TourAudioEngine {
  constructor(audio, handlers = {}) {
    this.audio = audio
    this.handlers = handlers
    this.generation = 0
    this.token = null
    this.listeners = null
    this.playIntent = 0
    this.pendingPlay = null
  }

  load(url, token) {
    if (url && token?.requestId === this.token?.requestId && token?.chapterIndex === this.token?.chapterIndex && token?.scope === this.token?.scope && this.audio?.src) {
      this.token = token
      return this.generation
    }
    this.unload()
    if (!url || !this.audio) return null
    const generation = this.generation
    this.token = token
    const current = () => generation === this.generation
    const onTimeUpdate = () => current() && this.handlers.onTimeUpdate?.(this.token, this.audio.currentTime, this.audio.duration)
    const onMetadata = () => current() && this.handlers.onMetadata?.(this.token, this.audio.duration)
    const onEnded = () => current() && this.handlers.onEnded?.(this.token)
    const onError = () => current() && this.handlers.onError?.(this.token)
    this.listeners = { timeupdate: onTimeUpdate, seeked: onTimeUpdate, loadedmetadata: onMetadata, durationchange: onMetadata, ended: onEnded, error: onError }
    for (const [name, listener] of Object.entries(this.listeners)) this.audio.addEventListener(name, listener)
    this.audio.src = url
    this.audio.load()
    return generation
  }

  play(generation = this.generation) {
    if (generation !== this.generation || !this.audio) return false
    if (!this.audio.paused) return Promise.resolve(true)
    if (this.pendingPlay) return this.pendingPlay
    const intent = ++this.playIntent
    this.pendingPlay = this.audio.play()
      .then(() => generation === this.generation && intent === this.playIntent)
      .catch(() => {
        if (generation === this.generation && intent === this.playIntent) this.handlers.onError?.(this.token)
        return false
      })
      .finally(() => { this.pendingPlay = null })
    return this.pendingPlay
  }

  pause() {
    this.playIntent += 1
    this.pendingPlay = null
    this.audio?.pause()
  }

  seek(time) {
    if (this.audio && Number.isFinite(time)) this.audio.currentTime = Math.max(0, Math.min(time, Number.isFinite(this.audio.duration) ? this.audio.duration : time))
  }

  setVolume(volume) {
    if (this.audio) this.audio.volume = Math.max(0, Math.min(1, volume))
  }

  setMuted(muted) {
    if (this.audio) this.audio.muted = Boolean(muted)
  }

  unload(expectedToken) {
    if (expectedToken && expectedToken !== this.token) return
    this.generation += 1
    this.playIntent += 1
    this.pendingPlay = null
    if (!this.audio) return
    this.audio.pause()
    if (this.listeners) {
      for (const [name, listener] of Object.entries(this.listeners)) this.audio.removeEventListener(name, listener)
    }
    this.listeners = null
    this.token = null
    this.audio.removeAttribute('src')
    this.audio.load()
  }

  destroy() {
    this.unload()
    this.handlers = {}
  }
}
