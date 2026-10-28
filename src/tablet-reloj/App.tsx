import { useEffect } from 'react'
import TabletRelojPage from './pages/TabletRelojPage'
import PlotLabConnectivityBanner from '../components/PlotLabConnectivityBanner'
import { ensureRelojSyncHandlerRegistered } from './services/relojTabletApi'
import { syncQueueFlush } from '../utils/syncQueue'
import '../app.css'
import './App.css'

function TabletRelojApp() {
  useEffect(() => {
    ensureRelojSyncHandlerRegistered()
    if (navigator.onLine) void syncQueueFlush()
    const onOnline = () => {
      ensureRelojSyncHandlerRegistered()
      void syncQueueFlush()
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  return (
    <div className="tablet-reloj-app">
      <PlotLabConnectivityBanner compact />
      <TabletRelojPage />
    </div>
  )
}

export default TabletRelojApp
