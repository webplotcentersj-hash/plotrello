import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../../services/api'
import type { ArticuloEmpresaRecord } from '../../types/api'
import ClienteCatalogoShowcase from './ClienteCatalogoShowcase'
import './ClienteDashboardCatalogoSection.css'

export default function ClienteDashboardCatalogoSection() {
  const navigate = useNavigate()
  const [articulos, setArticulos] = useState<ArticuloEmpresaRecord[]>([])
  const [masVendidosIds, setMasVendidosIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cat, vend] = await Promise.all([
        apiService.getCatalogoComercial({ canal: 'portal', limite: 40 }),
        apiService.getArticulosMasVendidosPortal(12)
      ])
      if (cat.success && cat.data) setArticulos(cat.data.items)
      if (vend.success && vend.data) setMasVendidosIds(vend.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <section className="cliente-dash-catalogo cliente-card" aria-busy="true">
        <p className="cliente-dash-catalogo__loading">Cargando productos…</p>
      </section>
    )
  }

  return (
    <ClienteCatalogoShowcase
      articulos={articulos}
      masVendidosIds={masVendidosIds}
      tituloCarrusel="Productos"
      subtituloCarrusel="Novedades y servicios del catálogo"
      onProductClick={() => navigate('/cliente/catalogo')}
      onVerMasVendidos={() => navigate('/cliente/catalogo')}
    />
  )
}
