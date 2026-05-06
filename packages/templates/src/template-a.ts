import type { LpConfig } from '@me/lp-config';
import type { RenderOptions } from './index.js';
import { escapeHtml as e } from './escape.js';
import { renderForm } from './form.js';
import { renderTrackingScript } from './tracking-script.js';

export function renderTemplateA(c: LpConfig, opts: RenderOptions): string {
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
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--t)}
.wrap{max-width:560px;margin:0 auto;padding:48px 20px}
h1{font-size:clamp(28px,5vw,40px);line-height:1.15;margin:0 0 12px}
.sub{font-size:18px;opacity:.85;margin:0 0 28px}
ul{list-style:none;padding:0;margin:0 0 28px}
li{padding:8px 0 8px 28px;position:relative}
li:before{content:"✓";color:var(--a);position:absolute;left:0;font-weight:700}
.hero-img{width:100%;border-radius:12px;margin:0 0 24px}
form{display:grid;gap:12px;background:#fff;color:#111;padding:20px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
input,select,textarea{padding:12px;border:1px solid #ccc;border-radius:8px;font:inherit}
button{padding:14px;border:0;border-radius:8px;background:var(--p);color:#fff;font:600 16px/1 inherit;cursor:pointer}
button:hover{filter:brightness(.95)}
.success{padding:20px;background:#e8f5e9;border-radius:8px;color:#1b5e20;display:none}
</style>
</head>
<body>
<main class="wrap" data-slug="${e(c.slug)}">
${hero.image_url ? `<img class="hero-img" src="${e(hero.image_url)}" alt="">` : ''}
<h1>${e(hero.headline)}</h1>
${hero.subheadline ? `<p class="sub">${e(hero.subheadline)}</p>` : ''}
${bullets.length ? `<ul>${bullets.map((b) => `<li>${e(b)}</li>`).join('')}</ul>` : ''}
${renderForm(form, c.slug)}
<div class="success" id="me-success">${e(form.success_message)}</div>
</main>
${renderTrackingScript(c, opts)}
</body>
</html>`;
}
