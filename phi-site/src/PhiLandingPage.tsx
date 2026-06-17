import { useEffect } from 'react'
import PhiNavigation from './components/PhiNavigation'
import PhiHero from './components/PhiHero'
import PhiLogoMarquee from './components/PhiLogoMarquee'
import PhiServices from './components/PhiServices'
import PhiAbout from './components/PhiAbout'
import PhiPortfolio from './components/PhiPortfolio'
import PhiFooter from './components/PhiFooter'
import './phi-landing.css'

const ONEST_FONT =
  'https://fonts.googleapis.com/css2?family=Onest:wght@500;700&display=swap'

export default function PhiLandingPage() {
  useEffect(() => {
    document.title = 'phi (φ) · Plot Design'

    let link = document.querySelector<HTMLLinkElement>('link[data-phi-font]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = ONEST_FONT
      link.setAttribute('data-phi-font', 'true')
      document.head.appendChild(link)
    }
  }, [])

  return (
    <div className="phi-root">
      <PhiNavigation />
      <PhiHero />
      <PhiLogoMarquee />
      <PhiServices />
      <PhiAbout />
      <PhiPortfolio />
      <PhiFooter />
    </div>
  )
}
