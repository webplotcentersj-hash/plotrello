import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { RrhhNovedad } from '../types/api'
import { RRHH_NOVEDAD_GRUPOS, etiquetaCodigoRrhhNovedad } from '../utils/rrhhNovedadCatalog'
import { downloadRrhhNovedadNotificacionPdf } from '../utils/rrhhNovedadNotificacionPdf'
import { useSignatureCanvas } from '../hooks/useSignatureCanvas'
import apiService from '../services/api'
import '../pages/RecursosHumanosNovedadesPage.css'

type Props = {
  novedad: RrhhNovedad
  empleadoNombre: string
  onClose: () => void
  onEdit?: () => void
  onNovedadUpdated?: (novedad: RrhhNovedad) => void
}

const RrhhNovedadDetailModal = ({
  novedad: novedadProp,
  empleadoNombre,
  onClose,
  onEdit,
  onNovedadUpdated
}: Props) => {
  const [novedad, setNovedad] = useState(novedadProp)
  const [refirmar, setRefirmar] = useState(false)
  const [savingFirma, setSavingFirma] = useState(false)

  const grupoLabel =
    RRHH_NOVEDAD_GRUPOS.find((g) => g.value === novedad.grupo)?.label ?? novedad.grupo
  const codigoLabel = etiquetaCodigoRrhhNovedad(novedad.codigo)

  const yaFirmado = !!novedad.firma_data_url && !refirmar
  const { canvasRef, firmaDataUrl, limpiarFirma } = useSignatureCanvas({
    enabled: !yaFirmado
  })

  useEffect(() => {
    setNovedad(novedadProp)
    setRefirmar(false)
  }, [novedadProp])

  const periodo =
    novedad.fecha_hasta !== novedad.fecha_desde
      ? `${novedad.fecha_desde} al ${novedad.fecha_hasta}`
      : novedad.fecha_desde

  const descargarPdf = () => {
    downloadRrhhNovedadNotificacionPdf({
      novedad,
      empleadoNombre,
      grupoLabel,
      codigoLabel,
      firmaDataUrl: firmaDataUrl || novedad.firma_data_url,
      firmadoAt: novedad.firmado_at
    })
  }

  const guardarFirma = async () => {
    const firma = firmaDataUrl
    if (!firma) {
      alert('El empleado debe firmar antes de guardar.')
      return
    }
    setSavingFirma(true)
    try {
      const res = await apiService.rrhhNovedadGuardarFirma(novedad.id, firma)
      if (!res.success || !res.data) {
        alert(res.error || 'No se pudo guardar la firma.')
        return
      }
      setNovedad(res.data)
      setRefirmar(false)
      onNovedadUpdated?.(res.data)
    } finally {
      setSavingFirma(false)
    }
  }

  return (
    <div
      className="rrhh-novedades-modal-overlay rrhh-novedades-modal-overlay--detail"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rrhh-novedad-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="rrhh-novedades-detail-card" onClick={(e) => e.stopPropagation()}>
        <header className="rrhh-novedades-detail-head">
          <div>
            <p className="rrhh-novedades-notif-kicker">Notificación laboral</p>
            <h3 id="rrhh-novedad-detail-title">Novedad RRHH</h3>
            <p className="rrhh-novedades-detail-sub">
              Nº {novedad.id} · {empleadoNombre}
            </p>
          </div>
          <button
            type="button"
            className="rrhh-novedades-modal-close"
            aria-label="Cerrar"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="rrhh-novedades-detail-scroll">
          <article className="rrhh-novedades-notif-doc" aria-label="Notificación de novedad">
            <div className="rrhh-novedades-notif-doc-head">
              <span className="rrhh-novedades-notif-doc-brand">Plot Lab</span>
              <span
                className={`rrhh-novedades-detail-badge rrhh-novedades-detail-badge--${novedad.grupo}`}
              >
                {grupoLabel}
              </span>
            </div>

            <h4 className="rrhh-novedades-notif-doc-title">Notificación de novedad laboral</h4>
            <p className="rrhh-novedades-notif-doc-intro">
              Por medio de la presente se deja constancia de la novedad registrada. El/La empleado/a
              firma en señal de conformidad y toma conocimiento de la misma.
            </p>

            <dl className="rrhh-novedades-notif-fields">
              <div>
                <dt>Empleado</dt>
                <dd>{empleadoNombre}</dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{codigoLabel}</dd>
              </div>
              <div>
                <dt>Período</dt>
                <dd>{periodo}</dd>
              </div>
              {novedad.grupo === 'tardanza_retiro' && novedad.duracion_minutos != null ? (
                <div>
                  <dt>Duración</dt>
                  <dd>{novedad.duracion_minutos} minutos</dd>
                </div>
              ) : null}
              {novedad.grupo === 'horas_extra' && novedad.horas_extra_cantidad != null ? (
                <div>
                  <dt>Horas extra</dt>
                  <dd>{novedad.horas_extra_cantidad} h</dd>
                </div>
              ) : null}
              {novedad.id_solicitud_permiso != null ? (
                <div>
                  <dt>Permiso vinculado</dt>
                  <dd>#{novedad.id_solicitud_permiso}</dd>
                </div>
              ) : null}
              <div>
                <dt>Registro</dt>
                <dd>
                  {novedad.created_at
                    ? format(parseISO(novedad.created_at), 'd MMM yyyy, HH:mm', { locale: es })
                    : '—'}
                </dd>
              </div>
            </dl>

            {novedad.observaciones?.trim() ? (
              <div className="rrhh-novedades-notif-obs">
                <span className="rrhh-novedades-detail-obs-label">Observaciones</span>
                <p>{novedad.observaciones}</p>
              </div>
            ) : null}

            <div className="rrhh-novedades-notif-firma-block">
              <span className="rrhh-novedades-detail-obs-label">Firma del empleado</span>
              {yaFirmado ? (
                <div className="rrhh-novedades-notif-firma-guardada">
                  <img src={novedad.firma_data_url!} alt={`Firma de ${empleadoNombre}`} />
                  {novedad.firmado_at ? (
                    <p className="rrhh-novedades-notif-firma-fecha">
                      Firmado el{' '}
                      {format(parseISO(novedad.firmado_at), "d 'de' MMMM yyyy, HH:mm", {
                        locale: es
                      })}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="linklike"
                    onClick={() => setRefirmar(true)}
                  >
                    Volver a firmar
                  </button>
                </div>
              ) : (
                <>
                  <p className="rrhh-novedades-notif-firma-hint">
                    Pedile al operario que firme con el dedo o el mouse en el recuadro.
                  </p>
                  <div className="rrhh-novedades-notif-canvas-wrap">
                    <canvas ref={canvasRef} className="rrhh-novedades-notif-canvas" />
                  </div>
                  {firmaDataUrl ? (
                    <div className="rrhh-novedades-notif-firma-actions">
                      <span className="rrhh-novedades-notif-firma-ok">Firma lista</span>
                      <button
                        type="button"
                        className="linklike"
                        onClick={limpiarFirma}
                        disabled={savingFirma}
                      >
                        Limpiar
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </article>

          {novedad.adjuntos?.length ? (
            <div className="rrhh-novedades-detail-adj">
              <span className="rrhh-novedades-detail-obs-label">Adjuntos</span>
              <ul className="rrhh-novedades-detail-adj-list">
                {novedad.adjuntos.map((a, i) => (
                  <li key={a.url + i}>
                    {a.mime.startsWith('image/') ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rrhh-novedades-detail-thumb-wrap"
                      >
                        <img
                          src={a.url}
                          alt={a.nombre}
                          className="rrhh-novedades-detail-thumb"
                          loading="lazy"
                        />
                        <span className="rrhh-novedades-detail-file-name">{a.nombre}</span>
                      </a>
                    ) : (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="rrhh-novedades-detail-file-link"
                      >
                        <span className="rrhh-novedades-detail-file-icon" aria-hidden>
                          📄
                        </span>
                        {a.nombre}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <footer className="rrhh-novedades-detail-foot">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="btn-secondary" onClick={descargarPdf}>
            Descargar PDF
          </button>
          {!yaFirmado ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void guardarFirma()}
              disabled={savingFirma || !firmaDataUrl}
            >
              {savingFirma ? 'Guardando…' : 'Guardar firma'}
            </button>
          ) : null}
          {onEdit ? (
            <button type="button" className="btn-primary" onClick={onEdit}>
              Editar
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  )
}

export default RrhhNovedadDetailModal
