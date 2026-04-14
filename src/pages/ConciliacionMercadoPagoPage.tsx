import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ConciliacionMpSession } from '../types/conciliacionMp'
import {
  defaultReconciliationRules,
  type HeuristicMatch,
  type NormalizedMovement,
  type ReconciliationRules
} from '../features/conciliacion-mp/domain/types'
import {
  runReconciliation,
  summarizeUnmatched,
  computeMetrics,
  suggestMpCandidatesForBank
} from '../features/conciliacion-mp/domain/reconciliation-engine'
import { normalizeBankRows, normalizeMercadoPagoRows } from '../features/conciliacion-mp/parsers/normalizeMovements'
import { listWorkbookSheetNames, readSheetRows } from '../features/conciliacion-mp/parsers/spreadsheetCore'
import { analyzeUnmatchedWithGemini, type GeminiMpAnalysisResult } from '../features/conciliacion-mp/gemini/conciliacionMpGemini'
import { downloadCsv, buildMatchesCsvRows, buildMovementsCsvRows } from '../features/conciliacion-mp/export/csvExport'
import './ConciliacionBancariaPage.css'

type TabId = 'carga' | 'dashboard' | 'revision' | 'export'

const PIE_COLORS = ['#10b981', '#f59e0b', '#6366f1']

const ConciliacionMercadoPagoPage = () => {
  const navigate = useNavigate()
  const { canManageCompras, loading: authLoading } = useAuth()

  const [activeTab, setActiveTab] = useState<TabId>('carga')

  const [bankFile, setBankFile] = useState<File | null>(null)
  const [mpFile, setMpFile] = useState<File | null>(null)
  const [bankSheets, setBankSheets] = useState<string[]>([])
  const [mpSheets, setMpSheets] = useState<string[]>([])
  const [bankSheet, setBankSheet] = useState('')
  const [mpSheet, setMpSheet] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const [bankRows, setBankRows] = useState<NormalizedMovement[]>([])
  const [mpRows, setMpRows] = useState<NormalizedMovement[]>([])
  const [rules, setRules] = useState<ReconciliationRules>({ ...defaultReconciliationRules })

  const [matches, setMatches] = useState<HeuristicMatch[]>([])
  const [userMatches, setUserMatches] = useState<HeuristicMatch[]>([])
  const [engineRun, setEngineRun] = useState(false)

  const [geminiLoading, setGeminiLoading] = useState(false)
  const [geminiError, setGeminiError] = useState<string | null>(null)
  const [geminiResult, setGeminiResult] = useState<GeminiMpAnalysisResult | null>(null)

  const [sessions, setSessions] = useState<ConciliacionMpSession[]>([])
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const [revisionSearch, setRevisionSearch] = useState('')
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null)
  const [selectedMpIds, setSelectedMpIds] = useState<Set<string>>(() => new Set())
  const [manualNote, setManualNote] = useState('')

  const mergedMatches = useMemo(() => [...matches, ...userMatches], [matches, userMatches])

  const bankById = useMemo(() => new Map(bankRows.map((b) => [b.id, b])), [bankRows])
  const mpById = useMemo(() => new Map(mpRows.map((m) => [m.id, m])), [mpRows])

  const displayMetrics = useMemo(() => {
    if (!engineRun || bankRows.length === 0) return null
    return computeMetrics(bankRows, mpRows, mergedMatches)
  }, [engineRun, bankRows, mpRows, mergedMatches])

  const matchedMpIds = useMemo(() => {
    const s = new Set<string>()
    mergedMatches.forEach((x) => x.mpIds.forEach((id) => s.add(id)))
    return s
  }, [mergedMatches])

  const matchedBankIds = useMemo(() => {
    const s = new Set<string>()
    mergedMatches.forEach((x) => x.bankIds.forEach((id) => s.add(id)))
    return s
  }, [mergedMatches])

  const { unmatchedBank, unmatchedMp } = useMemo(
    () => summarizeUnmatched(bankRows, mpRows, mergedMatches),
    [bankRows, mpRows, mergedMatches]
  )

  const filteredUnmatchedBank = useMemo(() => {
    const q = revisionSearch.trim().toLowerCase()
    if (!q) return unmatchedBank
    return unmatchedBank.filter(
      (b) =>
        b.descripcion.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q) ||
        (b.referencia ?? '').toLowerCase().includes(q) ||
        String(b.importeNeto).includes(q)
    )
  }, [unmatchedBank, revisionSearch])

  const selectedBank = selectedBankId ? bankById.get(selectedBankId) ?? null : null

  const mpCandidates = useMemo(() => {
    if (!selectedBank || !engineRun) return []
    return suggestMpCandidatesForBank(selectedBank, mpRows, matchedMpIds, rules, 40)
  }, [selectedBank, engineRun, mpRows, matchedMpIds, rules])

  const geminiForSelectedBank = useMemo(() => {
    if (!geminiResult || !selectedBankId) return { matches: [] as GeminiMpAnalysisResult['suggested_matches'], groups: [] }
    const sm = geminiResult.suggested_matches.filter((s) => s.bank_ids?.includes(selectedBankId))
    const gr = geminiResult.grouping_suggestions.filter((g) => g.bank_id === selectedBankId)
    return { matches: sm, groups: gr }
  }, [geminiResult, selectedBankId])

  const pieData = useMemo(() => {
    if (!displayMetrics) return []
    const pend = displayMetrics.totalBank - displayMetrics.matchedBankCount
    return [
      { name: 'Banco conciliado', value: displayMetrics.matchedBankCount },
      { name: 'Banco pendiente', value: Math.max(0, pend) }
    ]
  }, [displayMetrics])

  const pieDataMp = useMemo(() => {
    if (!displayMetrics) return []
    const pend = displayMetrics.totalMp - displayMetrics.matchedMpCount
    return [
      { name: 'MP conciliado', value: displayMetrics.matchedMpCount },
      { name: 'MP pendiente', value: Math.max(0, pend) }
    ]
  }, [displayMetrics])

  const loadSessions = useCallback(async () => {
    const r = await apiService.getConciliacionMpSessions(20)
    if (r.success && r.data) setSessions(r.data)
  }, [])

  useEffect(() => {
    if (authLoading || !canManageCompras) return
    void loadSessions()
  }, [authLoading, canManageCompras, loadSessions])

  const resetSessionUi = () => {
    setEngineRun(false)
    setMatches([])
    setUserMatches([])
    setGeminiResult(null)
    setSelectedBankId(null)
    setSelectedMpIds(new Set())
    setManualNote('')
  }

  const onBankFile = async (f: File | null) => {
    setBankFile(f)
    setBankRows([])
    setBankSheets([])
    setBankSheet('')
    setParseError(null)
    resetSessionUi()
    if (!f) return
    try {
      const ab = await f.arrayBuffer()
      setBankSheets(listWorkbookSheetNames(ab))
      setBankSheet(listWorkbookSheetNames(ab)[0] ?? '')
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'No se pudo leer la planilla banco')
    }
  }

  const onMpFile = async (f: File | null) => {
    setMpFile(f)
    setMpRows([])
    setMpSheets([])
    setMpSheet('')
    setParseError(null)
    resetSessionUi()
    if (!f) return
    try {
      const ab = await f.arrayBuffer()
      setMpSheets(listWorkbookSheetNames(ab))
      setMpSheet(listWorkbookSheetNames(ab)[0] ?? '')
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'No se pudo leer el extracto MP')
    }
  }

  const parseBoth = async () => {
    if (!bankFile || !mpFile || !bankSheet || !mpSheet) {
      setParseError('Elegí ambos archivos y las hojas.')
      return
    }
    setParsing(true)
    setParseError(null)
    try {
      const abB = await bankFile.arrayBuffer()
      const abM = await mpFile.arrayBuffer()
      const rawB = readSheetRows(abB, bankSheet)
      const rawM = readSheetRows(abM, mpSheet)
      const b = normalizeBankRows(rawB, bankSheet, rules.excludeSaldoRows)
      const m = normalizeMercadoPagoRows(rawM, mpSheet)
      setBankRows(b)
      setMpRows(m)
      resetSessionUi()
      if (b.length === 0) setParseError('Planilla banco: 0 movimientos válidos (revisá fechas e importes).')
      else if (m.length === 0) setParseError('Mercado Pago: 0 movimientos válidos.')
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Error parseando archivos')
    } finally {
      setParsing(false)
    }
  }

  const runEngine = () => {
    if (bankRows.length === 0 || mpRows.length === 0) return
    const { matches: m } = runReconciliation(bankRows, mpRows, rules)
    setMatches(m)
    setUserMatches([])
    setEngineRun(true)
    setGeminiResult(null)
    setActiveTab('dashboard')
  }

  const runGemini = async () => {
    if (!engineRun || !displayMetrics) return
    if (unmatchedBank.length === 0 && unmatchedMp.length === 0) {
      setGeminiError('No hay pendientes para analizar.')
      return
    }
    setGeminiLoading(true)
    setGeminiError(null)
    setGeminiResult(null)
    try {
      const result = await analyzeUnmatchedWithGemini({
        unmatchedBank,
        unmatchedMp,
        rules
      })
      setGeminiResult(result)
      setActiveTab('revision')
    } catch (e) {
      setGeminiError(e instanceof Error ? e.message : 'Error en análisis Gemini')
    } finally {
      setGeminiLoading(false)
    }
  }

  const toggleMpSelect = (id: string) => {
    setSelectedMpIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const addManualMatch = () => {
    if (!selectedBank || selectedMpIds.size === 0) return
    if (matchedBankIds.has(selectedBank.id)) {
      alert('Este movimiento banco ya está conciliado.')
      return
    }
    const ids = [...selectedMpIds]
    for (const id of ids) {
      if (matchedMpIds.has(id)) {
        alert(`El MP ${id} ya está emparejado.`)
        return
      }
    }
    const mpMovs = ids.map((id) => mpById.get(id)).filter(Boolean) as NormalizedMovement[]
    const sumMp = mpMovs.reduce((s, x) => s + x.importeNeto, 0)
    const diff = Math.abs(selectedBank.importeNeto - sumMp)
    const note = manualNote.trim()
    setUserMatches((prev) => [
      ...prev,
      {
        bankIds: [selectedBank.id],
        mpIds: ids,
        matchType: 'manual',
        score: diff < rules.tolAmountAbs + 1 ? 95 : 70,
        phase: 0,
        reason: note ? `Manual: ${note}` : `Conciliación manual (${ids.length} MP, Δ $${diff.toFixed(2)})`,
        diffAmount: diff
      }
    ])
    setSelectedMpIds(new Set())
    setManualNote('')
  }

  const saveSession = async () => {
    if (!bankFile || !mpFile || !displayMetrics) {
      alert('Parseá archivos y ejecutá el motor antes de guardar.')
      return
    }
    setSaveMsg(null)
    const resp = await apiService.crearConciliacionMpSession({
      bank_file_name: bankFile.name,
      mp_file_name: mpFile.name,
      bank_sheet_name: bankSheet,
      mp_sheet_name: mpSheet,
      rules_snapshot: { ...rules } as unknown as Record<string, unknown>,
      bank_movements: bankRows,
      mp_movements: mpRows,
      heuristic_matches: mergedMatches,
      metrics: { ...displayMetrics } as unknown as Record<string, unknown>,
      status: 'ready'
    })
    if (!resp.success || !resp.data) {
      alert(resp.error || 'No se pudo guardar (¿aplicaste el patch SQL en Supabase?)')
      return
    }
    setSaveMsg(`Sesión guardada: ${resp.data.id}`)
    if (geminiResult) {
      await apiService.registrarConciliacionMpAiRun({
        session_id: resp.data.id,
        scope: 'unmatched',
        input_payload: { rules } as unknown as Record<string, unknown>,
        output_payload: geminiResult as unknown as Record<string, unknown>
      })
    }
    await loadSessions()
  }

  const exportMatches = () => {
    if (mergedMatches.length === 0) return
    downloadCsv(`conciliacion-matches-${Date.now()}.csv`, buildMatchesCsvRows(mergedMatches, bankById, mpById))
  }

  const exportPendingBank = () => {
    if (unmatchedBank.length === 0) return
    downloadCsv(`conciliacion-pendientes-banco-${Date.now()}.csv`, buildMovementsCsvRows(unmatchedBank, 'banco'))
  }

  const exportPendingMp = () => {
    if (unmatchedMp.length === 0) return
    downloadCsv(`conciliacion-pendientes-mp-${Date.now()}.csv`, buildMovementsCsvRows(unmatchedMp, 'mercado_pago'))
  }

  const exportJsonSnapshot = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            rules,
            metrics: displayMetrics,
            matches: mergedMatches,
            pendientes_banco: unmatchedBank.map((b) => b.id),
            pendientes_mp: unmatchedMp.map((m) => m.id)
          },
          null,
          2
        )
      ],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conciliacion-snapshot-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Cargando...</p>
      </div>
    )
  }

  if (!canManageCompras) {
    return (
      <div className="conciliacion-page">
        <p>No tenés permiso.</p>
        <button type="button" className="btn-primary" onClick={() => navigate('/compras/dashboard')}>
          Volver
        </button>
      </div>
    )
  }

  const tabBtn = (id: TabId, label: string) => (
    <button
      type="button"
      key={id}
      className={activeTab === id ? 'btn-primary' : 'btn-secondary'}
      style={{ marginRight: 8 }}
      onClick={() => setActiveTab(id)}
    >
      {label}
    </button>
  )

  return (
    <div className="conciliacion-page">
      <header className="conciliacion-header">
        <div className="header-content">
          <div>
            <h1>Conciliación planilla banco vs Mercado Pago</h1>
            <p className="subtitle">
              Motor por fases, revisión manual con candidatos, Gemini como asistente y exportación. Las conciliaciones
              manuales se suman al motor antes de guardar o exportar.
            </p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate('/compras/dashboard')}>
              ← Dashboard compras
            </button>
            <button type="button" className="btn-action" onClick={() => navigate('/compras/conciliacion-bancaria')}>
              Conciliación bancaria
            </button>
          </div>
        </div>
      </header>

      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {tabBtn('carga', '1. Carga y reglas')}
        {tabBtn('dashboard', '2. Dashboard')}
        {tabBtn('revision', '3. Revisión manual')}
        {tabBtn('export', '4. Exportar')}
      </div>

      {activeTab === 'carga' && (
        <section className="plotai-section">
          <div className="plotai-grid">
            <div className="plotai-card">
              <h3>Planilla banco / contable</h3>
              <input
                type="file"
                accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(e) => void onBankFile(e.target.files?.[0] ?? null)}
              />
              {bankSheets.length > 1 && (
                <label className="plotai-help" style={{ display: 'block', marginTop: 8 }}>
                  Hoja:{' '}
                  <select value={bankSheet} onChange={(e) => setBankSheet(e.target.value)}>
                    {bankSheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="plotai-card">
              <h3>Extracto Mercado Pago</h3>
              <input
                type="file"
                accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(e) => void onMpFile(e.target.files?.[0] ?? null)}
              />
              {mpSheets.length > 1 && (
                <label className="plotai-help" style={{ display: 'block', marginTop: 8 }}>
                  Hoja:{' '}
                  <select value={mpSheet} onChange={(e) => setMpSheet(e.target.value)}>
                    {mpSheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="plotai-card plotai-card--wide">
              <h3>Reglas y acciones</h3>
              <div
                className="plotai-totals"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}
              >
                <label>
                  Tol. monto abs
                  <input
                    type="number"
                    step={0.01}
                    value={rules.tolAmountAbs}
                    onChange={(e) => setRules((r) => ({ ...r, tolAmountAbs: Number(e.target.value) || 0 }))}
                  />
                </label>
                <label>
                  Ventana días
                  <input
                    type="number"
                    value={rules.dateWindowDays}
                    onChange={(e) => setRules((r) => ({ ...r, dateWindowDays: Number(e.target.value) || 0 }))}
                  />
                </label>
                <label>
                  Máx. grupo MP
                  <input
                    type="number"
                    min={2}
                    max={8}
                    value={rules.maxGroupSize}
                    onChange={(e) => setRules((r) => ({ ...r, maxGroupSize: Number(e.target.value) || 2 }))}
                  />
                </label>
                <label>
                  Score mín.
                  <input
                    type="number"
                    value={rules.minScoreAccept}
                    onChange={(e) => setRules((r) => ({ ...r, minScoreAccept: Number(e.target.value) || 0 }))}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={rules.excludeSaldoRows}
                    onChange={(e) => setRules((r) => ({ ...r, excludeSaldoRows: e.target.checked }))}
                  />
                  Excluir filas saldo inicio/final
                </label>
              </div>
              <div className="plotai-actions" style={{ marginTop: 12 }}>
                <button type="button" className="btn-primary" disabled={parsing} onClick={() => void parseBoth()}>
                  {parsing ? 'Leyendo…' : 'Leer archivos'}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={bankRows.length === 0 || mpRows.length === 0}
                  onClick={runEngine}
                >
                  Ejecutar motor heurístico
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!engineRun || geminiLoading}
                  onClick={() => void runGemini()}
                >
                  {geminiLoading ? 'Analizando con Gemini…' : 'Analizar con AI (Gemini)'}
                </button>
                <button type="button" className="btn-action" disabled={!displayMetrics} onClick={() => void saveSession()}>
                  Guardar sesión en BD
                </button>
              </div>
              {parseError && <div className="plotai-issues" style={{ marginTop: 10 }}>{parseError}</div>}
              {saveMsg && <div className="plotai-ok" style={{ marginTop: 10 }}>{saveMsg}</div>}
            </div>
          </div>
          {bankRows.length > 0 && mpRows.length > 0 && (
            <p className="plotai-help" style={{ marginTop: 8 }}>
              Leídos: {bankRows.length} banco · {mpRows.length} Mercado Pago · matches manuales: {userMatches.length}
            </p>
          )}
        </section>
      )}

      {activeTab === 'dashboard' && displayMetrics && (
        <section className="plotai-section">
          <div className="plotai-card plotai-card--wide">
            <h3>Métricas (motor + manuales)</h3>
            <div className="plotai-totals">
              <div>
                <strong>Banco conciliado:</strong> {displayMetrics.matchedBankCount}/{displayMetrics.totalBank} (
                {displayMetrics.pctBankReconciled}%)
              </div>
              <div>
                <strong>MP conciliado:</strong> {displayMetrics.matchedMpCount}/{displayMetrics.totalMp} (
                {displayMetrics.pctMpReconciled}%)
              </div>
              <div>
                <strong>Agrupaciones 1→N (motor):</strong> {displayMetrics.groupedMatches}
              </div>
              <div>
                <strong>Conciliaciones manuales:</strong> {userMatches.length}
              </div>
              <div>
                <strong>Suma |importe| banco:</strong> $
                {displayMetrics.sumBankAbs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
              <div>
                <strong>Suma |importe| MP:</strong> $
                {displayMetrics.sumMpAbs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
            <div className="plotai-card">
              <h4>Banco: conciliado vs pendiente</h4>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} label>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, 'Movimientos']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="plotai-card">
              <h4>Mercado Pago: conciliado vs pendiente</h4>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pieDataMp} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} label>
                      {pieDataMp.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[(i + 1) % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, 'Movimientos']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          {mergedMatches.length > 0 && (
            <div className="plotai-card plotai-card--wide" style={{ marginTop: 16 }}>
              <h3>Matches ({mergedMatches.length})</h3>
              <div style={{ maxHeight: 320, overflow: 'auto', fontSize: 13 }}>
                <table className="data-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Fase</th>
                      <th>Tipo</th>
                      <th>Score</th>
                      <th>Banco</th>
                      <th>MP</th>
                      <th>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedMatches.slice(0, 200).map((m, i) => (
                      <tr key={i}>
                        <td>{m.phase}</td>
                        <td>{m.matchType}</td>
                        <td>{m.score}</td>
                        <td>{m.bankIds.length}</td>
                        <td>{m.mpIds.length}</td>
                        <td>{m.reason.slice(0, 140)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mergedMatches.length > 200 && <p className="plotai-help">… y {mergedMatches.length - 200} más (exportá CSV)</p>}
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'dashboard' && !displayMetrics && (
        <p className="plotai-help">Ejecutá el motor desde la pestaña «Carga y reglas» para ver el dashboard.</p>
      )}

      {activeTab === 'revision' && (
        <section className="plotai-section">
          {!engineRun ? (
            <p className="plotai-help">Primero ejecutá el motor heurístico.</p>
          ) : (
            <>
              <div className="plotai-card plotai-card--wide" style={{ marginBottom: 16 }}>
                <h3>Pendientes banco ({unmatchedBank.length})</h3>
                <input
                  type="search"
                  placeholder="Buscar por descripción, importe, referencia…"
                  value={revisionSearch}
                  onChange={(e) => setRevisionSearch(e.target.value)}
                  style={{ width: '100%', maxWidth: 480, marginBottom: 8, padding: 8 }}
                />
                <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid #334155', borderRadius: 8 }}>
                  <table className="data-table" style={{ width: '100%', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th />
                        <th>Fecha</th>
                        <th>Importe</th>
                        <th>Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUnmatchedBank.slice(0, 200).map((b) => (
                        <tr
                          key={b.id}
                          style={{
                            cursor: 'pointer',
                            background: selectedBankId === b.id ? 'rgba(99,102,241,0.15)' : undefined
                          }}
                          onClick={() => {
                            setSelectedBankId(b.id)
                            setSelectedMpIds(new Set())
                          }}
                        >
                          <td>{selectedBankId === b.id ? '▶' : ''}</td>
                          <td>{b.fecha.slice(0, 10)}</td>
                          <td>{b.importeNeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                          <td>{b.descripcion.slice(0, 80)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedBank && (
                <div className="plotai-grid">
                  <div className="plotai-card">
                    <h3>Movimiento banco seleccionado</h3>
                    <div className="plotai-totals" style={{ fontSize: 14 }}>
                      <div>
                        <strong>ID:</strong> {selectedBank.id}
                      </div>
                      <div>
                        <strong>Fecha:</strong> {selectedBank.fecha.slice(0, 10)}
                      </div>
                      <div>
                        <strong>Importe:</strong>{' '}
                        {selectedBank.importeNeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </div>
                      <div>
                        <strong>Clasif.:</strong> {selectedBank.classification}
                      </div>
                      <div>
                        <strong>Detalle:</strong> {selectedBank.descripcion}
                      </div>
                      {selectedBank.referencia && (
                        <div>
                          <strong>Ref.:</strong> {selectedBank.referencia}
                        </div>
                      )}
                    </div>
                    <label className="plotai-help" style={{ display: 'block', marginTop: 12 }}>
                      Nota (opcional)
                      <input
                        type="text"
                        value={manualNote}
                        onChange={(e) => setManualNote(e.target.value)}
                        style={{ width: '100%', marginTop: 4 }}
                        placeholder="Ej. agrupación aprobada por supervisor"
                      />
                    </label>
                    <div className="plotai-actions" style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={selectedMpIds.size === 0}
                        onClick={addManualMatch}
                      >
                        Conciliar selección manual
                      </button>
                    </div>
                  </div>

                  <div className="plotai-card plotai-card--wide">
                    <h3>Candidatos Mercado Pago (heurística)</h3>
                    <p className="plotai-help">Marcá una o más filas MP y conciliá. Solo se listan MP aún libres y con el mismo signo.</p>
                    <div style={{ maxHeight: 320, overflow: 'auto' }}>
                      <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>✓</th>
                            <th>Score</th>
                            <th>Fecha</th>
                            <th>Importe</th>
                            <th>Descripción</th>
                            <th>Hint</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mpCandidates.map((c) => (
                            <tr key={c.mp.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selectedMpIds.has(c.mp.id)}
                                  onChange={() => toggleMpSelect(c.mp.id)}
                                />
                              </td>
                              <td>{c.score}</td>
                              <td>{c.mp.fecha.slice(0, 10)}</td>
                              <td>{c.mp.importeNeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                              <td>{c.mp.descripcion.slice(0, 60)}</td>
                              <td className="plotai-help">{c.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {mpCandidates.length === 0 && <p className="plotai-help">Sin candidatos con estos criterios.</p>}
                    </div>
                  </div>
                </div>
              )}

              {geminiResult && selectedBankId && (
                <div className="plotai-card plotai-card--wide" style={{ marginTop: 16 }}>
                  <h3>Gemini para este banco</h3>
                  {geminiForSelectedBank.matches.length === 0 && geminiForSelectedBank.groups.length === 0 ? (
                    <p className="plotai-help">No hay sugerencias explícitas para este ID en la última corrida de IA.</p>
                  ) : (
                    <>
                      <ul>
                        {geminiForSelectedBank.matches.map((s, i) => (
                          <li key={i}>
                            <strong>{s.confidence_score}%</strong> — {s.explanation}
                            <div className="plotai-help">MP: {(s.mp_ids ?? []).join(', ')}</div>
                          </li>
                        ))}
                      </ul>
                      <ul>
                        {geminiForSelectedBank.groups.map((g, i) => (
                          <li key={i}>
                            Agrupación: {(g.mp_ids ?? []).join(', ')} — {g.explanation}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              {geminiResult && !selectedBankId && (
                <div className="plotai-card plotai-card--wide" style={{ marginTop: 16 }}>
                  <h3>Resumen Gemini (completo)</h3>
                  <p className="plotai-help">Seleccioná un banco pendiente para filtrar sugerencias por movimiento.</p>
                  <ul>
                    {geminiResult.observations.slice(0, 15).map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {activeTab === 'export' && (
        <section className="plotai-section">
          <div className="plotai-card plotai-card--wide">
            <h3>Exportar</h3>
            <p className="plotai-help">CSV con BOM para abrir en Excel. JSON incluye métricas y listas de IDs pendientes.</p>
            <div className="plotai-actions" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn-primary" disabled={mergedMatches.length === 0} onClick={exportMatches}>
                CSV matches (todos)
              </button>
              <button type="button" className="btn-primary" disabled={unmatchedBank.length === 0} onClick={exportPendingBank}>
                CSV pendientes banco
              </button>
              <button type="button" className="btn-primary" disabled={unmatchedMp.length === 0} onClick={exportPendingMp}>
                CSV pendientes MP
              </button>
              <button type="button" className="btn-secondary" disabled={!displayMetrics} onClick={exportJsonSnapshot}>
                JSON snapshot
              </button>
            </div>
          </div>
        </section>
      )}

      {geminiError && (
        <div className="plotai-issues" style={{ marginTop: 16 }}>
          <strong>Gemini</strong>: {geminiError}
        </div>
      )}

      {activeTab !== 'revision' && geminiResult && (
        <div className="plotai-card plotai-card--wide" style={{ marginTop: 16 }}>
          <h3>Último análisis Gemini (global)</h3>
          {geminiResult.global_warnings?.length > 0 && (
            <div className="plotai-issues">
              {geminiResult.global_warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          )}
          <h4>Sugerencias</h4>
          <ol>
            {geminiResult.suggested_matches.slice(0, 20).map((s, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <strong>{s.confidence_score}%</strong> — {s.explanation}
              </li>
            ))}
          </ol>
        </div>
      )}

      {sessions.length > 0 && (
        <div className="plotai-reports" style={{ marginTop: 24 }}>
          <h3>Sesiones recientes</h3>
          <ul className="plotai-help">
            {sessions.map((s) => (
              <li key={s.id}>
                {new Date(s.created_at).toLocaleString('es-AR')} — {s.bank_file_name} / {s.mp_file_name} —{' '}
                {(s.metrics as { pctBankReconciled?: number })?.pctBankReconciled ?? '?'}% banco
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default ConciliacionMercadoPagoPage
