// A local-only comparison aid, not another approval ledger or public route.
import { fatalAudioAudit } from "./audio-audit-inventory.mjs";

export function renderAudioAuditReport(report) {
  const payload = JSON.stringify({ ...report, items: report.items.map(row => ({ ...row, integrity_failed: fatalAudioAudit([], [row]) || row.flags.includes("orphan_file") })) }).replaceAll("<", "\\u003c");
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NexusLearn audio listening audit</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#17233f;font:16px/1.6 system-ui,sans-serif}
main{max-width:1100px;margin:auto;padding:32px 20px}h1,h2{line-height:1.2}header,.panel{padding:24px;background:white;border:1px solid #c8d2df;border-radius:16px;margin-bottom:20px}
header{background:#17233f;color:white}.warning{padding:14px;background:#fff2cb;border-radius:8px;color:#624600}
.filters{display:flex;gap:16px;flex-wrap:wrap}label{display:flex;flex-direction:column;font-weight:600}input,select,button{font:inherit;border:1px solid #718096;border-radius:8px;padding:9px;background:white;color:#17233f;min-height:44px}
button{cursor:pointer}button:disabled{opacity:.5;cursor:default}:focus-visible{outline:3px solid #006a73;outline-offset:3px}
.row{border-top:1px solid #d5dce5;padding:16px 0;display:flex;gap:16px;align-items:center}.row div{flex:1;min-width:0}.id{overflow-wrap:anywhere;font-size:14px}small{display:block}audio{width:100%;margin:12px 0}.pager{display:flex;align-items:center;gap:16px}#script{font-size:20px}#hash{overflow-wrap:anywhere;font:12px/1.6 monospace}
@media(max-width:600px){main{padding:16px 10px}.row{align-items:start;flex-direction:column}input{width:100%}}
</style>
<main><header><p>PRIVATE • READ-ONLY AUDIT</p><h1>Listen, compare, then review</h1>
<p id="totals"></p><p>Decoding proves playable, non-silent signal—not accurate words, naturalness or appropriate teaching pace. Script-rate flags are screening heuristics, not educational standards. This is a snapshot: regenerate the audit after changing any clip or script. Missing historical generation-speed settings cannot be inferred from the current generator.</p></header>
<p id="integrity-summary" class="warning" role="alert" hidden></p>
<section class="panel" aria-labelledby="player-title"><h2 id="player-title" tabindex="-1">Selected recording</h2>
<p id="selected">Choose a recording below.</p><p id="script"></p><audio id="player" controls preload="none"></audio>
<div class="pager"><button id="original" disabled>Original 1×</button><button id="slower" disabled>Slower comparison 0.9×</button></div>
<p id="rate" role="status">Original file. No approval is recorded.</p><p id="hash"></p>
<p class="warning">Slower comparison only: playback speed does not regenerate the ElevenLabs file. Confirm pronunciation against the script and listen at original speed before recording a named decision in Admin → Audio listening QA. No approval is recorded here.</p></section>
<section class="panel" aria-labelledby="queue-title"><h2 id="queue-title">Recording queue</h2>
<div class="filters"><label>Year<select id="year" aria-label="Year"><option value="">All years</option>${[1,2,3,4,5,6,7].map(y => `<option value="${y}">Year ${y}</option>`).join("")}</select></label>
<label>Kind<select id="kind" aria-label="Kind"><option value="">All kinds</option><option value="lesson">Lesson</option><option value="vocabulary">Vocabulary</option></select></label>
<label>Review lane<select id="lane" aria-label="Review lane"><option value="pace">Pace flags</option><option value="integrity">Integrity faults</option><option value="all">All recordings</option><option value="short">Short scripts: listen individually</option></select></label>
<label>Search pack or script<input id="search" type="search"></label></div>
<p id="count" role="status"></p><div id="rows"></div><div class="pager"><button id="previous">Previous</button><span id="page"></span><button id="next">Next</button></div>
</section></main><script type="application/json" id="audit-data">${payload}</script><script>
const data=JSON.parse(document.getElementById('audit-data').textContent);
const el=id=>document.getElementById(id), player=el('player');
let page=0;
el('totals').textContent=data.total_files+' files audited • '+data.generated_at+' • '+(data.inventory_issues?.length??0)+' inventory issues';
const faulty=data.items.filter(r=>r.integrity_failed).length;
if(faulty||data.inventory_issues?.length){el('integrity-summary').hidden=false;el('integrity-summary').textContent='AUDIT FAILED: '+faulty+' recordings with integrity faults. Inventory issues: '+JSON.stringify(data.inventory_issues??[])+'. Inspect the affected files before listening approval.';el('lane').value='integrity';}
function resetPlayer(){player.pause();player.removeAttribute('src');player.load();el('original').disabled=el('slower').disabled=true;el('selected').textContent='Choose a recording below.';el('script').textContent=el('hash').textContent='';el('rate').textContent='Original file. No approval is recorded.';}
function select(row){
 resetPlayer();
 // Do not allow source data to construct remote or traversal URLs.
 if(!/^\\/audio\\/[a-zA-Z0-9_./-]+\\.(mp3|wav|ogg|m4a)$/i.test(row.file)||row.file.split('/').some(p=>p==='.'||p==='..')){el('rate').textContent='Unsafe audio path: cannot play.';return;}
 player.src='../../../../apps/web/public'+row.file;player.playbackRate=1;player.preservesPitch=true;player.load();
 el('original').disabled=el('slower').disabled=false;el('selected').textContent=row.id;el('script').textContent=row.text??'Script unavailable';el('hash').textContent='Audited audio SHA-256: '+row.sha256;
 el('player-title').focus();
}
function setRate(rate){player.pause();player.currentTime=0;player.playbackRate=rate;player.preservesPitch=true;el('rate').textContent=rate===1?'Original 1×. No approval is recorded.':'Slower comparison only — 0.9×. Production file is unchanged.';}
el('original').onclick=()=>setRate(1);el('slower').onclick=()=>setRate(.9);
player.addEventListener('ratechange',()=>{el('rate').textContent=player.playbackRate===1?'Original 1×. No approval is recorded.':'Comparison playback '+player.playbackRate+'×. Production file is unchanged.';});
player.addEventListener('error',()=>{el('rate').textContent='Playback failed. Keep this report in generated/coverage beside its matching repository checkout.';});
function render(){
 resetPlayer();const term=el('search').value.toLowerCase();
 const rows=data.items.filter(r=>(!el('year').value||String(r.year)===el('year').value)&&(!el('kind').value||r.kind===el('kind').value)&&(el('lane').value==='all'||el('lane').value==='integrity'&&r.integrity_failed||el('lane').value==='pace'&&r.flags.some(f=>f.startsWith('pace_review'))||el('lane').value==='short'&&r.pace?.status==='short_script_listen')&&((r.id??'')+' '+(r.text??'')).toLowerCase().includes(term));
 rows.sort((a,b)=>(a.year??8)-(b.year??8)||(b.pace?.wpm??0)-(a.pace?.wpm??0));
 const pages=Math.max(1,Math.ceil(rows.length/25));page=Math.min(page,pages-1);el('rows').replaceChildren();
 for(const row of rows.slice(page*25,page*25+25)){
  const article=document.createElement('article');article.className='row';const details=document.createElement('div'),title=document.createElement('strong'),info=document.createElement('small'),button=document.createElement('button');
  title.className='id';title.textContent=row.id??row.file;info.textContent='Year '+row.year+' • '+row.kind+' • '+(row.pcm?.duration_seconds??'?')+'s • '+(row.pace?.wpm??'?')+' script words/min • '+(row.pace?.status??'unmeasurable')+' • Flags: '+(row.flags.join(', ')||'none');
  details.append(title,info);button.textContent='Listen / compare';button.setAttribute('aria-label','Listen to '+(row.id??row.file));button.onclick=()=>select(row);article.append(details,button);el('rows').append(article);
 }
 el('count').textContent=rows.length+' matching recordings';el('page').textContent='Page '+(page+1)+' of '+pages;el('previous').disabled=page===0;el('next').disabled=page>=pages-1;
}
for(const id of ['year','kind','lane','search'])el(id).addEventListener('input',()=>{page=0;render();});
el('previous').onclick=()=>{page--;render();};el('next').onclick=()=>{page++;render();};window.addEventListener('pagehide',()=>player.pause());render();
</script></html>`;
}
