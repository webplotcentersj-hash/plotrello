import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiService from '../services/api'
import type { ConciliacionMpSession } from '../types/conciliacionMp'
import {
  defaultReconciliationRules,
  type HeuristicMatch,
  type NormalizedMovement,
  type ReconciliationMetrics,
  type ReconciliationRules
} from '../features/conciliacion-mp/domain/types'
import { runReconciliation, summarizeUnmatched } from '../features/conciliacion-mp/domain/reconciliation-engine'
import { normalizeBankRows, normalizeMercadoPagoRows } from '../features/conciliacion-mp/parsers/normalizeMovements'
import { listWorkbookSheetNames, readSheetRows } from '../features/conciliacion-mp/parsers/spreadsheetCore'
import { analyzeUnmatchedWithGemini, type GeminiMpAnalysisResult } from '../features/conciliacion-mp/gemini/conciliacionMpGemini'
import './ConciliacionBancariaPage.css'

const ConciliacionMercadoPagoPage = () => {
  const navigate = useNavigate()
  const { canManageCompras, loading: authLoading } = useAuth()

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
  const [metrics, setMetrics] = useState<ReconciliationMetrics | null>(null)
  const [engineRun, setEngineRun] = useState(false)

  const [geminiLoading, setGeminiLoading] = useState(false)
  const [geminiError, setGeminiError] = useState<string | null>(null)
  const [geminiResult, setGeminiResult] = useState<GeminiMpAnalysisResult | null>(null)

  const [sessions, setSessions] = useState<ConciliacionMpSession[]>([])
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    const r = await apiService.getConciliacionMpSessions(20)
    if (r.success && r.data) setSessions(r.data)
  }, [])

  useEffect(() => {
    if (authLoading || !canManageCompras) return
    void loadSessions()
  }, [authLoading, canManageCompras, loadSessions])

  const onBankFile = async (f: File | null) => {
    setBankFile(f)
    setBankRows([])
    setBankSheets([])
    setBankSheet('')
    setParseError(null)
    setEngineRun(false)
    setMatches([])
    setMetrics(null)
    setGeminiResult(null)
    if (!f) return
    try {
      const ab = await f.arrayBuffer()
      const names = listWorkbookSheetNames(ab)
      setBankSheets(names)
      setBankSheet(names[0] ?? '')
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
    setEngineRun(false)
    setMatches([])
    setMetrics(null)
    setGeminiResult(null)
    if (!f) return
    try {
      const ab = await f.arrayBuffer()
      const names = listWorkbookSheetNames(ab)
      setMpSheets(names)
      setMpSheet(names[0] ?? '')
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
      setEngineRun(false)
      setMatches([])
      setMetrics(null)
      setGeminiResult(null)
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
    const { matches: m, metrics: met } = runReconciliation(bankRows, mpRows, rules)
    setMatches(m)
    setMetrics(met)
    setEngineRun(true)
    setGeminiResult(null)
  }

  const runGemini = async () => {
    if (!engineRun || !metrics) return
    const { unmatchedBank, unmatchedMp } = summarizeUnmatched(bankRows, mpRows, matches)
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
    } catch (e) {
      setGeminiError(e instanceof Error ? e.message : 'Error en análisis Gemini')
    } finally {
      setGeminiLoading(false)
    }
  }

  const saveSession = async () => {
    if (!bankFile || !mpFile || !metrics) {
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
      heuristic_matches: matches,
      metrics: { ...metrics } as unknown as Record<string, unknown>,
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

  return (
    <div className="conciliacion-page">
      <header className="conciliacion-header">
        <div className="header-content">
          <div>
            <h1>Conciliación planilla banco vs Mercado Pago</h1>
            <p className="subtitle">
              Motor heurístico por fases (exacto → ventana de fechas → texto → tolerancia → referencia → agrupación).
              Gemini solo sugiere sobre pendientes; no concilia solo.
            </p>
          </div>
          <div className="header-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate('/compras/dashboard')}>
              ← Dashboard compras
            </button>
            <button type="button" className="btn-action" onClick={() => navigate('/compras/conciliacion-bancaria')}>
              Conciliación bancaria (compras)
            </button>
          </div>
        </div>
      </header>

      <section className="plotai-section">
        <div className="plotai-grid">
          <div className="plotai-card">
            <h3>1) Planilla banco / contable</h3>
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
            <h3>2) Extracto Mercado Pago</h3>
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
            <h3>3) Reglas rápidas</h3>
            <div className="plotai-totals" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
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
              <button type="button" className="btn-action" disabled={!metrics} onClick={() => void saveSession()}>
                Guardar sesión en BD
              </button>
            </div>
            {parseError && <div className="plotai-issues" style={{ marginTop: 10 }}>{parseError}</div>}
            {saveMsg && <div className="plotai-ok" style={{ marginTop: 10 }}>{saveMsg}</div>}
          </div>
        </div>

        {bankRows.length > 0 && mpRows.length > 0 && (
          <p className="plotai-help" style={{ marginTop: 8 }}>
            Leídos: {bankRows.length} banco · {mpRows.length} Mercado Pago
          </p>
        )}

        {metrics && (
          <div className="plotai-card plotai-card--wide" style={{ marginTop: 16 }}>
            <h3>Métricas</h3>
            <div className="plotai-totals">
              <div>
                <strong>Banco conciliado:</strong> {metrics.matchedBankCount}/{metrics.totalBank} ({metrics.pctBankReconciled}%)
              </div>
              <div>
                <strong>MP conciliado:</strong> {metrics.matchedMpCount}/{metrics.totalMp} ({metrics.pctMpReconciled}%)
              </div>
              <div>
                <strong>Agrupaciones 1→N:</strong> {metrics.groupedMatches}
              </div>
              <div>
                <strong>Suma |importe| banco:</strong> ${metrics.sumBankAbs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
              <div>
                <strong>Suma |importe| MP:</strong> ${metrics.sumMpAbs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}

        {matches.length > 0 && (
          <div className="plotai-card plotai-card--wide" style={{ marginTop: 16 }}>
            <h3>Matches ({matches.length})</h3>
            <div style={{ maxHeight: 280, overflow: 'auto', fontSize: 13 }}>
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
                  {matches.slice(0, 150).map((m, i) => (
                    <tr key={i}>
                      <td>{m.phase}</td>
                      <td>{m.matchType}</td>
                      <td>{m.score}</td>
                      <td>{m.bankIds.length}</td>
                      <td>{m.mpIds.length}</td>
                      <td>{m.reason.slice(0, 120)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {matches.length > 150 && <p className="plotai-help">… y {matches.length - 150} más</p>}
            </div>
          </div>
        )}

        {geminiError && (
          <div className="plotai-issues" style={{ marginTop: 16 }}>
            <strong>Gemini</strong>: {geminiError}
          </div>
        )}

        {geminiResult && (
          <div className="plotai-card plotai-card--wide" style={{ marginTop: 16 }}>
            <h3>Resultado Analizar con AI (Gemini)</h3>
            {geminiResult.global_warnings?.length > 0 && (
              <div className="plotai-issues">
                {geminiResult.global_warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}
            <h4>Sugerencias de match</h4>
            <ol>
              {geminiResult.suggested_matches.slice(0, 30).map((s, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  <strong>{s.confidence_score}%</strong> — {s.explanation}
                  <div className="plotai-help">{s.recommended_action}</div>
                </li>
              ))}
            </ol>
            <h4>Agrupaciones sugeridas</h4>
            <ul>
              {geminiResult.grouping_suggestions.slice(0, 20).map((g, i) => (
                <li key={i}>
                  {g.bank_id}: {g.mp_ids?.length ?? 0} MP — {g.explanation}
                </li>
              ))}
            </ul>
            <h4>Observaciones</h4>
            <ul>
              {geminiResult.observations.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
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
      </section>
    </div>
  )
}

export default ConciliacionMercadoPagoPage
