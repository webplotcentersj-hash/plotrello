export function getPlotLabEmbedOrigin(): string {
  const fromEnv = String(import.meta.env.VITE_PLOTLAB_EMBED_ORIGIN || '').trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase()
    if (
      host === 'localhost' ||
      host.includes('vercel.app') ||
      host.includes('plotcenter.com.ar')
    ) {
      return window.location.origin
    }
  }

  return 'https://plotrello.vercel.app'
}

export function buildEmbedWidgetSnippet(embedOrigin = getPlotLabEmbedOrigin()): string {
  return `<iframe id="plotai-widget-iframe"
  src="${embedOrigin}/embed/chat-widget"
  title="Chat Plot Center"
  allow="microphone"
  width="88"
  height="88"
  style="border: none; position: fixed; bottom: 20px; right: 20px; z-index: 9999;"
></iframe>
<script>
(function() {
  var ORIGIN = '${embedOrigin}';
  window.addEventListener('message', function(e) {
    if (e.origin !== ORIGIN || !e.data || e.data.type !== 'plotai-widget-resize') return;
    var iframe = document.getElementById('plotai-widget-iframe');
    if (!iframe) return;
    if (e.data.fullscreen) {
      iframe.style.width = '100vw';
      iframe.style.height = '100dvh';
      iframe.style.maxWidth = '100vw';
      iframe.style.maxHeight = '100dvh';
      iframe.style.bottom = '0';
      iframe.style.right = '0';
      iframe.style.left = '0';
      iframe.style.top = '0';
      iframe.style.borderRadius = '0';
    } else {
      iframe.style.width = e.data.width + 'px';
      iframe.style.height = e.data.height + 'px';
      iframe.style.left = 'auto';
      iframe.style.top = 'auto';
      iframe.style.bottom = '20px';
      iframe.style.right = '20px';
      iframe.style.borderRadius = '';
    }
  });
})();
</script>`
}

export function buildEmbedPageSnippet(embedOrigin = getPlotLabEmbedOrigin()): string {
  return `<iframe
  src="${embedOrigin}/embed/chat"
  title="Chat Plot Center"
  allow="microphone"
  width="100%"
  height="560"
  style="border: none; border-radius: 8px; min-height: 420px; max-height: 100dvh;"
></iframe>`
}

export const EMBED_STAFF_POLL_INTERVAL_MS = 4000
