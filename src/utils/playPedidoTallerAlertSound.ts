/** Alerta breve para pedido a Taller Gráfico (no depende de archivos externos). */
export function playPedidoTallerAlertSound(): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const beep = (freq: number, when: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, when)
      gain.gain.setValueAtTime(0.0001, when)
      gain.gain.exponentialRampToValueAtTime(0.12, when + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, when + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(when)
      osc.stop(when + dur + 0.02)
    }
    const t0 = ctx.currentTime + 0.05
    beep(880, t0, 0.18)
    beep(1174, t0 + 0.22, 0.2)
    beep(880, t0 + 0.48, 0.22)
    ctx.resume().catch(() => {})
    window.setTimeout(() => {
      ctx.close().catch(() => {})
    }, 1200)
  } catch {
    /* sin audio */
  }
}
