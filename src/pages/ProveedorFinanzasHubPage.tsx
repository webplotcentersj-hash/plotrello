import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import ProveedorFinanzasHub, { type FinanzasTab } from '../components/compras/ProveedorFinanzasHub'
import './DeudasProveedoresPage.css'

type HubPageProps = { initialTab: FinanzasTab }

function ProveedorFinanzasHubPage({ initialTab }: HubPageProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { canManageCompras, loading: authLoading } = useAuth()
  const [proveedorNombre, setProveedorNombre] = useState<string | undefined>()
  const [finanzasCounts, setFinanzasCounts] = useState({
    movimientos: 0,
    pagos: 0,
    deudaCc: 0
  })

  const idProveedorParam = searchParams.get('id_proveedor')
  const idProveedor = idProveedorParam ? Number(idProveedorParam) : undefined

  useEffect(() => {
    if (authLoading) return
    if (!canManageCompras) {
      navigate('/')
    }
  }, [authLoading, canManageCompras, navigate])

  useEffect(() => {
    if (!idProveedor) {
      setProveedorNombre(undefined)
      void apiService.getDeudaCcProveedores().then((r) => {
        if (r.success && r.data) {
          setFinanzasCounts({
            movimientos: 0,
            pagos: 0,
            deudaCc: r.data.rows.length
          })
        }
      })
      return
    }
    void apiService.getProveedoresConFinanzas().then((r) => {
      if (r.success && r.data) {
        const p = r.data.find((x) => x.id === idProveedor)
        if (p) {
          setProveedorNombre(p.razon_social || p.nombre)
          setFinanzasCounts({
            movimientos: p.finanzas.movimientos_count,
            pagos: p.finanzas.pagos_count,
            deudaCc: p.finanzas.deuda_cc_count
          })
        }
      }
    })
  }, [idProveedor])

  if (authLoading || !canManageCompras) {
    return (
      <div className="deudas-prov-page">
        <div className="deudas-prov-loading">Cargando…</div>
      </div>
    )
  }

  return (
    <ProveedorFinanzasHub
      mode="page"
      initialTab={initialTab}
      idProveedor={idProveedor}
      proveedorNombre={proveedorNombre}
      movimientosCount={finanzasCounts.movimientos}
      pagosCount={finanzasCounts.pagos}
      deudaCcCount={finanzasCounts.deudaCc}
    />
  )
}

export function MovimientosProveedoresPage() {
  return <ProveedorFinanzasHubPage initialTab="movimientos" />
}

export function PagosProveedoresPage() {
  return <ProveedorFinanzasHubPage initialTab="pagos" />
}

export function DeudasProveedoresPage() {
  return <ProveedorFinanzasHubPage initialTab="deudas" />
}

export function DeudaCcProveedoresPage() {
  return <ProveedorFinanzasHubPage initialTab="deuda-cc" />
}

export default MovimientosProveedoresPage
