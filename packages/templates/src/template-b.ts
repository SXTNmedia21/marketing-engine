import type { LpConfig } from '@me/lp-config';
import type { RenderOptions } from './index.js';
import { escapeHtml as e } from './escape.js';
import { renderForm } from './form.js';
import { renderTrackingScript } from './tracking-script.js';

export function renderTemplateB(c: LpConfig, opts: RenderOptions): string {
  const { theme, hero, bullets, form } = c;
  return `<!DOCTYPE html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(hero.headline)}</title>
<meta name="description" content="${e(hero.subheadline ?? '')}">
<style>
:root{--p:${e(theme.primary)};--bg:${e(theme.background)};--t:${e(theme.text)};--a:${e(theme.accent ?? theme.primary)}}
*{box-sizing:border-box}body{margin:0;font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--t)}
.hero{max-width:880px;margin:0 auto;padding:64px 24px 32px;text-align:center}
h1{font-size:clamp(32px,6vw,56px);line-height:1.1;margin:0 0 16px}
.sub{font-size:20px;opacity:.85;margin:0 0 32px}
.section{max-width:720px;margin:0 auto;padding:32px 24px}
.section h2{font-size:28px;margin:0 0 16px}
ul{list-style:none;padding:0}
li{padding:10px 0 10px 32px;position:relative;border-bottom:1px solid rgba(0,0,0,.06)}
li:before{content:"→";color:var(--a);position:absolute;left:0;font-weight:700}
video,iframe{width:100%;border-radius:12px;aspect-ratio:16/9;border:0}
.testimonial{background:rgba(0,0,0,.04);padding:24px;border-radius:12px;font-style:italic}
.form-wrap{max-width:520px;margin:32px auto;padding:0 24px}
form{display:grid;gap:12px;background:#fff;color:#111;padding:24px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08)}
input,select,textarea{padding:12px;border:1px solid #ccc;border-radius:8px;font:inherit}
button{padding:14px;border:0;border-radius:8px;background:var(--p);color:#fff;font:600 16px/1 inherit;cursor:pointer}
.success{padding:20px;background:#e8f5e9;border-radius:8px;color:#1b5e20;display:none}
</style>
</head>
<body>
<header class="hero" data-slug="${e(c.slug)}">
<h1>${e(hero.headline)}</h1>
${hero.subheadline ? `<p class="sub">${e(hero.subheadline)}</p>` : ''}
</header>
${hero.video_url ? `<section class="section"><video controls src="${e(hero.video_url)}"></video></section>` : ''}
${
  bullets.length
    ? `<section class="section"><h2>Hva du får</h2><ul>${bullets.map((b) => `<li>${e(b)}</li>`).join('')}</ul></section>`
    : ''
}
<section class="form-wrap">
${renderForm(form, c.slug)}
<div class="success" id="me-success">${e(form.success_message)}</div>
</section>
${renderTrackingScript(c, opts)}
</body>
</html>`;
}
