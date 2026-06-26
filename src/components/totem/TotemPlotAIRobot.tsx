import './TotemPlotAIRobot.css'

export type TotemRobotState = 'idle' | 'greeting' | 'listening' | 'thinking' | 'speaking'

type Props = {
  state: TotemRobotState
}

/** Robot local animado — sin texto, reacciona al hablar/escuchar. */
export default function TotemPlotAIRobot({ state }: Props) {
  const active = state !== 'idle'
  const speaking = state === 'speaking'
  const listening = state === 'listening'
  const thinking = state === 'thinking'

  return (
    <div
      className="totem-bot"
      data-state={state}
      role="img"
      aria-label={
        speaking
          ? 'PlotAI hablando'
          : listening
            ? 'PlotAI escuchando'
            : thinking
              ? 'PlotAI pensando'
              : 'PlotAI en espera'
      }
    >
      <div className="totem-bot__aura" aria-hidden />
      <div className="totem-bot__waves totem-bot__waves--left" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="totem-bot__wave" style={{ animationDelay: `${i * 0.22}s` }} />
        ))}
      </div>
      <div className="totem-bot__waves totem-bot__waves--right" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="totem-bot__wave" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>

      <div className="totem-bot__figure">
        <div className="totem-bot__antenna totem-bot__antenna--l" aria-hidden>
          <span className="totem-bot__antenna-ball" />
        </div>
        <div className="totem-bot__antenna totem-bot__antenna--r" aria-hidden>
          <span className="totem-bot__antenna-ball" />
        </div>

        <div className="totem-bot__head">
          <div className="totem-bot__visor">
            <div className="totem-bot__eye totem-bot__eye--l">
              <span className="totem-bot__eye-core" />
              <span className="totem-bot__eye-shine" />
            </div>
            <div className="totem-bot__eye totem-bot__eye--r">
              <span className="totem-bot__eye-core" />
              <span className="totem-bot__eye-shine" />
            </div>
          </div>
          <div className="totem-bot__mouth">
            {(speaking || listening) &&
              Array.from({ length: 9 }).map((_, i) => (
                <span
                  key={i}
                  className="totem-bot__bar"
                  style={{ animationDelay: `${i * 0.06}s` }}
                />
              ))}
            {thinking && (
              <>
                <span className="totem-bot__think-dot" />
                <span className="totem-bot__think-dot" />
                <span className="totem-bot__think-dot" />
              </>
            )}
            {!active && <span className="totem-bot__mouth-smile" aria-hidden />}
          </div>
        </div>

        <div className="totem-bot__neck" aria-hidden />

        <div className="totem-bot__torso">
          <span className="totem-bot__chest-light" aria-hidden />
          <div className="totem-bot__arm totem-bot__arm--l" aria-hidden />
          <div className="totem-bot__arm totem-bot__arm--r" aria-hidden />
        </div>

        <div className="totem-bot__legs" aria-hidden>
          <span className="totem-bot__leg" />
          <span className="totem-bot__leg" />
        </div>
      </div>

      {speaking && (
        <div className="totem-bot__voice-ring" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  )
}
