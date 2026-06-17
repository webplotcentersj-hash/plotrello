import { phiAsset } from '../phiContent'

const LOGOS = [
  { src: 'logos/application.svg', alt: 'Aplicación' },
  { src: 'logos/business.svg', alt: 'Comercio' },
  { src: 'logos/company.svg', alt: 'Empresa' },
  { src: 'logos/startup.svg', alt: 'Startup' },
  { src: 'logos/venture.svg', alt: 'Venture' },
  { src: 'logos/agency.svg', alt: 'Agencia' }
]

export default function PhiLogoMarquee() {
  const items = [...LOGOS, ...LOGOS, ...LOGOS, ...LOGOS]

  return (
    <div className="phi-marquee-outer" aria-hidden>
      <div className="phi-marquee-track">
        <div className="phi-marquee-inner">
          {items.map((item, index) => (
            <img key={index} src={phiAsset(item.src)} alt="" className="phi-marquee-logo" />
          ))}
        </div>
      </div>
    </div>
  )
}
