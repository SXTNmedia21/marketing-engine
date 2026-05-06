import type { LpConfig } from '@me/lp-config';
import type { RenderOptions } from './index.js';

export function renderTrackingScript(c: LpConfig, opts: RenderOptions): string {
  const cfg = JSON.stringify({
    slug: c.slug,
    campaign_id: c.tracking.campaign_id,
    ad_id: c.tracking.ad_id ?? null,
    variant: c.tracking.variant ?? null,
    request_id: opts.request_id,
    visitor_id: opts.visitor_id,
    events_endpoint: opts.events_endpoint,
    form_endpoint: opts.form_endpoint,
  });
  return `<script>(function(){var ME=${cfg};window.__ME__=ME;
var qs=function(s,r){return (r||document).querySelector(s)};
var send=function(type,payload){try{navigator.sendBeacon(ME.events_endpoint,JSON.stringify({type:type,slug:ME.slug,visitor_id:ME.visitor_id,campaign_id:ME.campaign_id,ad_id:ME.ad_id,variant:ME.variant,ts:Date.now(),payload:payload||{}}))}catch(e){}};
send('pageview',{viewport:{w:innerWidth,h:innerHeight},lang:navigator.language,ref:document.referrer});
var depths=[25,50,75,100],fired={};
addEventListener('scroll',function(){var d=Math.round((scrollY+innerHeight)/document.body.scrollHeight*100);depths.forEach(function(m){if(d>=m&&!fired[m]){fired[m]=1;send('scroll_depth',{milestone:m})}})},{passive:true});
var hb=0;setInterval(function(){if(document.hasFocus()){hb+=15;send('engagement',{seconds:hb})}},15000);
var f=qs('#me-form');if(f){f.addEventListener('submit',function(ev){ev.preventDefault();send('form_submit_attempt',{});var data=Object.fromEntries(new FormData(f));fetch(ME.form_endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slug:ME.slug,visitor_id:ME.visitor_id,campaign_id:ME.campaign_id,ad_id:ME.ad_id,fields:data,ts:Date.now()})}).then(function(r){if(r.ok){send('form_submit_success',{});f.style.display='none';var s=qs('#me-success');if(s)s.style.display='block'}else{send('form_submit_failed',{status:r.status})}}).catch(function(e){send('form_submit_failed',{error:String(e)})})})}
addEventListener('beforeunload',function(){send('exit',{seconds:hb})});
})();</script>`;
}
