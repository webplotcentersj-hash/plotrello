import { PHI_CLIENT_LOGOS, phiAsset } from '../phiContent'

function clientNameFromPath(path: string): string {
  const match = path.match(/LOGO-(\d+)/i)
  return match ? `Cliente ${match[1]}` : 'Cliente Plot'
}

export default function PhiLogoMarquee() {
  const sequence = [...PHI_CLIENT_LOGOS, ...PHI_CLIENT_LOGOS]

  return (
    <section className="phi-marquee-outer" aria-label="Logos de clientes">
      <div className="phi-marquee-track">
        <div className="phi-marquee-viewport">
          <div className="phi-marquee-inner">
            {sequence.map((src, index) => (
              <div key={`${src}-${index}`} className="phi-marquee-logo-wrap">
                <img
                  src={phiAsset(src)}
                  alt={clientNameFromPath(src)}
                  className="phi-marquee-logo"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
