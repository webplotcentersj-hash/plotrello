import { BrowserRouter, Routes, Route } from 'react-router-dom'
import TabletFirmaPage from './pages/TabletFirmaPage'
import TabletFirmaSelectPage from './pages/TabletFirmaSelectPage'
import '../app.css'
import './App.css'

function TabletFirmaApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TabletFirmaSelectPage />} />
        <Route path="/:id" element={<TabletFirmaPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default TabletFirmaApp

