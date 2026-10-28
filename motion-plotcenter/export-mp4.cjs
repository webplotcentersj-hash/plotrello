// Exporta la animación a MP4 (1920x1080, 30 fps) renderizando cada cuadro de forma determinista.
// Uso (desde la raíz del proyecto):  node motion-plotcenter/export-mp4.cjs [salida.mp4]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const FPS = 30;
const out = path.resolve(process.argv[2] || path.join(__dirname, 'plotcenter-motion.mp4'));
const ffmpeg = process.env.FFMPEG || 'ffmpeg';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/') + '?rec');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  const total = await page.evaluate(() => window.__total);
  const frames = Math.ceil(total * FPS);

  const ff = spawn(ffmpeg, [
    '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'medium', '-movflags', '+faststart', out
  ], { stdio: ['pipe', 'ignore', 'inherit'] });
  const done = new Promise((res, rej) => { ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg salió con código ' + c))); });

  for (let i = 0; i < frames; i++) {
    await page.evaluate(t => window.__seek(t), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 100 === 0) console.log(`frame ${i}/${frames}`);
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log('listo:', out);
})().catch(e => { console.error(e); process.exit(1); });
