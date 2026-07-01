/** Diagnóstico mínimo: sin imports de lib/ ni Gemini. Si falla, el problema es de runtime Vercel. */
export default function handler(_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) {
  res.status(200).json({ ok: true, service: 'ping', ts: new Date().toISOString() })
}
