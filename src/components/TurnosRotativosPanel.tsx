import { useMemo, useState } from 'react'
import type { UsuarioRecord } from '../types/api'
import { getArgentinaDateString } from '../utils/dateUtils'
import {
  slotsDefaultCiclo,
  type RotacionAsignacion,
  type RotacionPlantilla,
  type RotacionSlot
} from '../utils/rrhhTurnosRotativos'
import {
  asignarARotacion,
  crearRotacion,
  desactivarAsignacion,
  guardarSlotsRotacion,
  setRotacionActiva
} from '../services/rrhhTurnosRotativosService'

type Props = {
  usuarios: UsuarioRecord[]
  plantillas: RotacionPlantilla[]
  asignaciones: RotacionAsignacion[]
  onChanged: () => void
}

export default function TurnosRotativosPanel({
  usuarios,
  plantillas,
  asignaciones,
  onChanged
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('Rotación 14 días')
  const [ciclo, setCiclo] = useState(14)
  const [ancla, setAncla] = useState(getArgentinaDateString)
  const [color, setColor] = useState('#6366f1')
  const [editId, setEditId] = useState<number | null>(null)
  const [slotsEdit, setSlotsEdit] = useState<RotacionSlot[]>([])
  const [asigRot, setAsigRot] = useState('')
  const [asigUser, setAsigUser] = useState('')
  const [asigFase, setAsigFase] = useState(0)
  const [asigDesde, setAsigDesde] = useState(getArgentinaDateString)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const activos = useMemo(() => plantillas.filter((p) => p.activo), [plantillas])
  const asignacionesActivas = useMemo(
    () => asignaciones.filter((a) => a.activo),
    [asignaciones]
  )

  const crear = async () => {
    setBusy(true)
    setMsg(null)
    const r = await crearRotacion({
      nombre,
      ciclo_dias: ciclo,
      fecha_ancla: ancla,
      color,
      slots: slotsDefaultCiclo(ciclo)
    })
    setBusy(false)
    if (!r.ok) {
      setMsg(r.error || 'No se pudo crear')
      return
    }
    setMsg('Rotación creada. Editá los horarios del ciclo y asigná empleados.')
    onChanged()
  }

  const abrirEdicionSlots = (p: RotacionPlantilla) => {
    setEditId(p.id)
    setSlotsEdit(
      p.slots.length
        ? p.slots.map((s) => ({ ...s }))
        : slotsDefaultCiclo(p.ciclo_dias)
    )
  }

  const guardarSlots = async () => {
    if (editId == null) return
    setBusy(true)
    setMsg(null)
    const r = await guardarSlotsRotacion(editId, slotsEdit)
    setBusy(false)
    if (!r.ok) {
      setMsg(r.error || 'No se pudieron guardar los días')
      return
    }
    setEditId(null)
    onChanged()
  }

  const asignar = async () => {
    if (!asigRot || !asigUser) return
    setBusy(true)
    setMsg(null)
    const r = await asignarARotacion({
      id_rotacion: Number(asigRot),
      id_usuario: Number(asigUser),
      fase_offset: asigFase,
      fecha_desde: asigDesde
    })
    setBusy(false)
    if (!r.ok) {
      setMsg(r.error || 'No se pudo asignar')
      return
    }
    setAsigUser('')
    onChanged()
  }

  if (!abierto) {
    return (
      <div className="rrhh-rotativos-bar">
        <button type="button" className="btn-secondary" onClick={() => setAbierto(true)}>
          Turnos rotativos ({activos.length} activas · {asignacionesActivas.length} asignados)
        </button>
      </div>
    )
  }

  return (
    <div className="rrhh-rotativos-panel">
      <div className="rrhh-rotativos-panel-head">
        <h3>Turnos rotativos</h3>
        <button type="button" className="btn-link" onClick={() => setAbierto(false)}>
          Cerrar
        </button>
      </div>
      <p className="rrhh-turnos-help">
        Definí un ciclo (ej. 7 o 14 días), horarios por día del ciclo, y asigná empleados con un desfase
        (fase) para que no todos empiecen el mismo día.
      </p>

      {msg ? <p className="rrhh-turnos-msg">{msg}</p> : null}

      <div className="rrhh-rotativos-create">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre"
          aria-label="Nombre rotación"
        />
        <label>
          Ciclo
          <input
            type="number"
            min={2}
            max={56}
            value={ciclo}
            onChange={(e) => setCiclo(Number(e.target.value) || 7)}
          />
        </label>
        <label>
          Ancla
          <input type="date" value={ancla} onChange={(e) => setAncla(e.target.value)} />
        </label>
        <label>
          Color
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void crear()}>
          Crear rotación
        </button>
      </div>

      <ul className="rrhh-rotativos-list">
        {plantillas.map((p) => (
          <li key={p.id} className={!p.activo ? 'is-off' : ''}>
            <span className="rrhh-rotativos-dot" style={{ background: p.color }} />
            <div>
              <strong>{p.nombre}</strong>
              <small>
                {p.ciclo_dias} días · ancla {p.fecha_ancla}
                {!p.activo ? ' · inactiva' : ''}
              </small>
            </div>
            <div className="rrhh-rotativos-actions">
              <button type="button" className="btn-secondary" onClick={() => abrirEdicionSlots(p)}>
                Días
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() =>
                  void setRotacionActiva(p.id, !p.activo).then((r) => {
                    if (!r.ok) setMsg(r.error || 'Error')
                    else onChanged()
                  })
                }
              >
                {p.activo ? 'Pausar' : 'Activar'}
              </button>
            </div>
          </li>
        ))}
        {plantillas.length === 0 ? (
          <li className="rrhh-turnos-help">Todavía no hay rotaciones. Creá una arriba.</li>
        ) : null}
      </ul>

      {editId != null ? (
        <div className="rrhh-rotativos-slots">
          <h4>Días del ciclo</h4>
          <div className="rrhh-rotativos-slots-grid">
            {slotsEdit.map((s, idx) => (
              <div key={s.dia_offset} className="rrhh-rotativos-slot">
                <span>D{s.dia_offset + 1}</span>
                <input
                  type="text"
                  value={s.etiqueta}
                  onChange={(e) => {
                    const next = [...slotsEdit]
                    next[idx] = { ...s, etiqueta: e.target.value }
                    setSlotsEdit(next)
                  }}
                  aria-label={`Etiqueta día ${s.dia_offset + 1}`}
                />
                <label className="rrhh-rotativos-franco">
                  <input
                    type="checkbox"
                    checked={s.es_franco}
                    onChange={(e) => {
                      const next = [...slotsEdit]
                      next[idx] = {
                        ...s,
                        es_franco: e.target.checked,
                        hora_entrada: e.target.checked ? null : s.hora_entrada || '08:00',
                        hora_salida: e.target.checked ? null : s.hora_salida || '17:00'
                      }
                      setSlotsEdit(next)
                    }}
                  />
                  Franco
                </label>
                {!s.es_franco ? (
                  <>
                    <input
                      type="time"
                      value={s.hora_entrada || ''}
                      onChange={(e) => {
                        const next = [...slotsEdit]
                        next[idx] = { ...s, hora_entrada: e.target.value }
                        setSlotsEdit(next)
                      }}
                    />
                    <input
                      type="time"
                      value={s.hora_salida || ''}
                      onChange={(e) => {
                        const next = [...slotsEdit]
                        next[idx] = { ...s, hora_salida: e.target.value }
                        setSlotsEdit(next)
                      }}
                    />
                  </>
                ) : null}
              </div>
            ))}
          </div>
          <div className="rrhh-rotativos-actions">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void guardarSlots()}>
              Guardar días
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditId(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div className="rrhh-rotativos-asignar">
        <h4>Asignar empleado</h4>
        <div className="rrhh-rotativos-asignar-row">
          <select value={asigRot} onChange={(e) => setAsigRot(e.target.value)}>
            <option value="">Rotación…</option>
            {activos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <select value={asigUser} onChange={(e) => setAsigUser(e.target.value)}>
            <option value="">Empleado…</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
          <label>
            Fase
            <input
              type="number"
              min={0}
              max={55}
              value={asigFase}
              onChange={(e) => setAsigFase(Number(e.target.value) || 0)}
            />
          </label>
          <label>
            Desde
            <input type="date" value={asigDesde} onChange={(e) => setAsigDesde(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !asigRot || !asigUser}
            onClick={() => void asignar()}
          >
            Asignar
          </button>
        </div>
      </div>

      {asignacionesActivas.length > 0 ? (
        <ul className="rrhh-rotativos-asignados">
          {asignacionesActivas.map((a) => {
            const p = plantillas.find((x) => x.id === a.id_rotacion)
            const u = usuarios.find((x) => x.id === a.id_usuario)
            return (
              <li key={a.id}>
                <strong>{u?.nombre || `Usuario ${a.id_usuario}`}</strong>
                <span>
                  {p?.nombre || `Rotación ${a.id_rotacion}`} · fase {a.fase_offset} · desde {a.fecha_desde}
                  {a.fecha_hasta ? ` → ${a.fecha_hasta}` : ''}
                </span>
                <button
                  type="button"
                  className="btn-link"
                  disabled={busy}
                  onClick={() =>
                    void desactivarAsignacion(a.id).then((r) => {
                      if (!r.ok) setMsg(r.error || 'Error')
                      else onChanged()
                    })
                  }
                >
                  Quitar
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
