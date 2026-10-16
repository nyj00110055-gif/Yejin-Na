'use strict';
const $ = selector => document.querySelector(selector);
const fmt = value => new Intl.NumberFormat('ko-KR').format(value);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors = ['#8870df','#b49bec','#cfbff1','#e2d9f4','#eae5f6'];
const state = {data: [], filtered: [], searched: [], grain: 'week', page: 1, sort: 'date', direction: -1, range: ['2026-07-01','2026-09-30']};
const PAGE_SIZE = 10;
const compact = value => value >= 100000000 ? `${(value / 100000000).toFixed(2)}억` : `${fmt(Math.round(value / 10000))}만`;
const total = (rows, key) => rows.reduce((sum, row) => sum + (row[key] ?? 0), 0);
const group = (rows, key) => {
  const map = new Map();
  rows.forEach(row => {
    const name = typeof key === 'function' ? key(row) : row[key];
    if (!map.has(name)) map.set(name, {name, revenue: 0, quantity: 0, count: 0, region: row.region});
    const bucket = map.get(name); bucket.revenue += row.revenue; bucket.quantity += row.quantity ?? 0; bucket.count++;
  });
  return [...map.values()].sort((a,b) => b.revenue - a.revenue || a.name.localeCompare(b.name, 'ko'));
};
function fillOptions(selector, values, first) {
  const el = $(selector), previous = el.value;
  el.innerHTML = `<option value="all">${first}</option>` + [...new Set(values)].sort((a,b) => a.localeCompare(b,'ko')).map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if ([...el.options].some(o => o.value === previous)) el.value = previous;
}
function getRange() {
  const period = $('#period').value;
  if (period === 'custom') return [$('#start-date').value, $('#end-date').value];
  if (period === 'all') return state.range;
  const [year,month]=period.split('-').map(Number);
  return [`${period}-01`, `${period}-${new Date(Date.UTC(year,month,0)).getUTCDate()}`];
}
function update() {
  const [start, end] = getRange();
  $('#custom-dates').hidden = $('#period').value !== 'custom';
  const valid = start && end && start <= end;
  $('#error').hidden = !!valid;
  if (!valid) $('#error').textContent = '시작일과 종료일을 확인해주세요. 시작일은 종료일보다 늦을 수 없습니다.';
  state.filtered = state.data.filter(r => valid && r.date >= start && r.date <= end && ['region','store','category'].every(key => $(`#${key}`).value === 'all' || r[key] === $(`#${key}`).value));
  $('#range-label').textContent = valid ? `${start.replaceAll('-','.')} — ${end.replaceAll('-','.')} 기준` : '날짜 범위를 확인해주세요';
  $('#record-count').textContent = fmt(state.filtered.length);
  renderKpis(); renderTrend(start,end,valid); renderCategories(); renderStores(); renderRegions();
  const missing = state.filtered.filter(r => r.quantity === null).length;
  $('#quality-summary').textContent = `현재 선택: 수량 미기재 ${missing}건`;
  state.page = 1; renderTable();
}
function renderKpis() {
  const rows = state.filtered, revenue = total(rows,'revenue'), quantity = total(rows,'quantity');
  const known = rows.filter(r => r.quantity !== null);
  const average = quantity ? Math.round(total(known, 'revenue') / quantity) : null;
  const stores = new Set(rows.map(r => r.store)).size;
  const cards = [
    ['총 매출액',fmt(revenue),'원','선택 기간의 전체 매출','₩','primary'],
    ['총 판매 수량',fmt(quantity),'개',`수량 미기재 ${rows.length-known.length}건 제외`,'▦',''],
    ['단위당 평균 매출',average === null ? '—' : fmt(average),'원','수량이 기재된 판매 내역 기준','↗',''],
    ['판매 매장 수',fmt(stores),'개',`${fmt(rows.length)}건의 판매 내역 집계`,'▥','']
  ];
  $('#kpis').innerHTML = cards.map(([label,value,unit,note,icon,cls]) => `<article class="kpi ${cls}"><div class="kpi-label">${label}<span class="kpi-icon">${icon}</span></div><div class="kpi-value">${value}<small>${unit}</small></div><div class="kpi-note"><i></i>${note}</div></article>`).join('');
}
const utcDate = str => new Date(`${str}T00:00:00Z`);
const isoDate = date => date.toISOString().slice(0,10);
function bucketKey(date) {
  if (state.grain === 'month') return date.slice(0,7);
  if (state.grain === 'day') return date;
  const d = utcDate(date), offset = (d.getUTCDay()+6)%7;
  d.setUTCDate(d.getUTCDate()-offset); return isoDate(d);
}
function renderTrend(start,end,valid) {
  if (!state.filtered.length || !valid) {
    $('#trend-chart').innerHTML = '<div class="empty">선택 조건에 해당하는 판매 내역이 없습니다.</div>';
    $('#trend-summary').textContent = '선택 조건을 변경해보세요'; return;
  }
  // Bound chart iteration to the source coverage even for a custom range outside it.
  start = start < state.range[0] ? state.range[0] : start;
  end = end > state.range[1] ? state.range[1] : end;
  const sums = new Map();
  for (let d = utcDate(start); isoDate(d) <= end; d.setUTCDate(d.getUTCDate()+1)) sums.set(bucketKey(isoDate(d)), 0);
  state.filtered.forEach(r => {const key=bucketKey(r.date); sums.set(key,(sums.get(key)||0)+r.revenue);});
  const points = [...sums.entries()].sort(([a],[b]) => a.localeCompare(b));
  const W=Math.max(310,$('#trend-chart').clientWidth-24),H=230,left=49,right=22,top=19,bottom=38,plotW=W-left-right,plotH=H-top-bottom;
  const maxRaw = Math.max(...points.map(p=>p[1]),1), unit = Math.pow(10,Math.floor(Math.log10(maxRaw))), max = Math.ceil(maxRaw/unit)*unit;
  const x = i => left + (points.length===1 ? plotW/2 : i*plotW/(points.length-1));
  const y = value => top+plotH-(value/max)*plotH;
  const coords = points.map((p,i) => `${x(i).toFixed(2)},${y(p[1]).toFixed(2)}`);
  const ticks = Array.from({length:5},(_,i) => {const value=max*i/4,yy=y(value); return `<line x1="${left}" x2="${W-right}" y1="${yy}" y2="${yy}" stroke="#eeedf5" stroke-dasharray="3 4"/><text x="${left-11}" y="${yy+3}" text-anchor="end" fill="#b1adbf" font-size="9">${+(value/1000000).toFixed(2)}</text>`;}).join('');
  const label = date => state.grain === 'month' ? `${+date.slice(5)}월` : `${+date.slice(5,7)}.${+date.slice(8,10)}`;
  const labelCount = W < 450 ? 4 : 7;
  const labelIndices = new Set(Array.from({length:Math.min(labelCount,points.length)},(_,i)=>Math.round(i*(points.length-1)/Math.max(1,Math.min(labelCount,points.length)-1))));
  const labels = points.map((p,i) => labelIndices.has(i) ? `<text x="${x(i)}" y="${H-12}" text-anchor="middle" fill="#aaa6b8" font-size="9">${label(p[0])}</text>` : '').join('');
  const line = 'M'+coords.join(' L');
  const area = `${line} L${x(points.length-1)},${y(0)} L${x(0)},${y(0)} Z`;
  const circles = points.map(([date,value],i) => `<circle class="chart-point" tabindex="0" role="img" aria-label="${date}${state.grain==='week'?' 시작 주':''}: ${fmt(value)}원" cx="${x(i)}" cy="${y(value)}" r="${points.length>35?2:3.2}" fill="white" stroke="#937ce7" stroke-width="1.8"><title>${date}${state.grain==='week'?' 시작 주':''} · ${fmt(value)}원</title></circle>`).join('');
  $('#trend-chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${state.grain==='day'?'일':state.grain==='week'?'주':'월'}별 매출 추이"><defs><linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a18bea" stop-opacity=".21"/><stop offset="100%" stop-color="#a18bea" stop-opacity=".01"/></linearGradient></defs>${ticks}<path d="${area}" fill="url(#area-gradient)"/><path d="${line}" fill="none" stroke="#9980e8" stroke-width="2.4" stroke-linejoin="round"/>${circles}${labels}</svg>`;
  const peak = points.reduce((a,b)=> b[1]>a[1]?b:a);
  $('#trend-summary').innerHTML = `최고 매출 <b>${label(peak[0])}${state.grain==='week'?' 시작 주':''}</b> · ${fmt(peak[1])}원`;
}
function renderCategories() {
  const groups = group(state.filtered,'category'), sum=total(state.filtered,'revenue');
  if (!groups.length) {$('#donut').innerHTML='<div class="empty">표시할 데이터가 없습니다</div>'; $('#category-legend').innerHTML='';return;}
  let accumulated=0;
  const segments=groups.map((g,i)=> {const from=accumulated; accumulated+=g.revenue/sum*100; return `${colors[i%colors.length]} ${from}% ${accumulated}%`;});
  $('#donut').innerHTML=`<div class="donut" role="img" aria-label="상품군별 매출 비중. ${groups.map(g=>`${g.name} ${(g.revenue/sum*100).toFixed(1)}%`).join(', ')}" style="background:conic-gradient(${segments.join(',')})"><div class="donut-hole"><span>총 매출액</span><strong>${compact(sum)}<span style="font-size:10px">원</span></strong><small>${groups.length}개 상품군</small></div></div>`;
  $('#category-legend').innerHTML=groups.map((g,i)=>`<div class="category-row"><i class="legend-dot" style="background:${colors[i%colors.length]}"></i><span>${escapeHtml(g.name)}</span><span class="category-amount">${compact(g.revenue)}원</span><span class="percent">${(g.revenue/sum*100).toFixed(1)}%</span></div>`).join('');
}
function renderStores() {
  const groups=group(state.filtered,'store'); $('#store-badge').textContent=`${groups.length}개`;
  const sum=total(state.filtered,'revenue');
  $('#store-ranking').innerHTML=groups.slice(0,5).map((g,i)=>`<div class="rank-row"><span class="rank-number ${i===0?'first':''}">${String(i+1).padStart(2,'0')}</span><span class="rank-name">${escapeHtml(g.name)}<small>${escapeHtml(g.region)} · ${fmt(g.count)}건</small></span><div class="rank-track"><div class="rank-fill" style="width:${g.revenue/groups[0].revenue*100}%"></div></div><span class="rank-value">${compact(g.revenue)}원<small>전체의 ${(g.revenue/sum*100).toFixed(1)}%</small></span></div>`).join('') || '<div class="empty">해당하는 매장이 없습니다</div>';
}
function renderRegions() {
  const groups=group(state.filtered,'region');
  $('#region-chart').innerHTML=groups.map(g=>`<div class="region-row"><span class="region-name">${escapeHtml(g.name)}</span><div class="region-track"><div class="region-fill" style="width:${g.revenue/groups[0].revenue*100}%"></div></div><span class="region-value">${compact(g.revenue)}원</span></div>`).join('')||'<div class="empty">해당하는 지역이 없습니다</div>';
}
function renderTable() {
  const query=$('#search').value.trim().toLocaleLowerCase();
  state.searched=state.filtered.filter(r=>[r.store,r.plan??'미기재',r.staff,r.region,r.category].some(value=>value.toLocaleLowerCase().includes(query)));
  state.searched.sort((a,b)=> {
    const av=a[state.sort],bv=b[state.sort];
    if(av===null)return bv===null?a.id-b.id:1;
    if(bv===null)return -1;
    return (typeof av==='number'?av-bv:av.localeCompare(bv))*state.direction || a.id-b.id;
  });
  const count=state.searched.length, pages=Math.max(1,Math.ceil(count/PAGE_SIZE));
  state.page=Math.min(state.page,pages);
  const start=(state.page-1)*PAGE_SIZE;
  $('#table-badge').textContent=`${fmt(count)}건`;
  $('#table-body').innerHTML=state.searched.slice(start,start+PAGE_SIZE).map(r=>`<tr><td>${r.date.replaceAll('-','.')}</td><td>${escapeHtml(r.region)}</td><td>${escapeHtml(r.store)}</td><td><span class="product-tag">${escapeHtml(r.category)}</span></td><td>${escapeHtml(r.plan??'미기재')}</td><td class="number">${r.quantity===null?'미기재':fmt(r.quantity)}</td><td class="number">${fmt(r.revenue)}원</td><td>${escapeHtml(r.staff)}</td></tr>`).join('')||'<tr><td colspan="8" class="empty">검색 조건에 해당하는 판매 내역이 없습니다.</td></tr>';
  $('#page-info').textContent=count?`총 ${fmt(count)}건 중 ${fmt(start+1)}–${fmt(Math.min(start+PAGE_SIZE,count))}건 표시`:'검색 결과 0건';
  $('#page-number').textContent=`${state.page} / ${pages}`;
  $('#prev').disabled=state.page===1;$('#next').disabled=state.page>=pages;
  $('#export').disabled=count===0;
  document.querySelectorAll('[data-sort]').forEach(button=>{
    const active=state.sort===button.dataset.sort;
    button.closest('th').setAttribute('aria-sort',active?(state.direction===1?'ascending':'descending'):'none');
    button.querySelector('span').textContent=active?(state.direction===1?'↑':'↓'):'↕';
  });
}
function downloadCsv() {
  const cell=value=>`"${String(value??'').replace(/^[=+@\-\t\r]/,'\'$&').replaceAll('"','""')}"`;
  const headers=['판매일','지역','매장명','상품군','요금제','수량','매출액(원)','담당자'];
  const lines=[headers,...state.searched.map(r=>[r.date,r.region,r.store,r.category,r.plan,r.quantity,r.revenue,r.staff])];
  const blob=new Blob(['\ufeff'+lines.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`매장판매실적_${getRange().join('_')}.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function configureDates() {
  const dates = state.data.map(r=>r.date).sort();
  state.range = dates.length ? [dates[0],dates[dates.length-1]] : ['2026-07-01','2026-09-30'];
  const months = [...new Set(dates.map(d=>d.slice(0,7)))];
  $('#period').innerHTML='<option value="all">전체 기간</option>'+months.map(m=>`<option value="${m}">${m.slice(0,4)}년 ${+m.slice(5)}월</option>`).join('')+'<option value="custom">직접 설정</option>';
  ['start-date','end-date'].forEach((id,i)=>{const el=$(`#${id}`);el.min=state.range[0];el.max=state.range[1];el.value=state.range[i];});
  const first=state.range[0],last=state.range[1];
  $('.page-footer>span:last-child').textContent=`${first.slice(0,7)} — ${last.slice(0,7)} · SALES REPORT`;
}
async function init() {
  $('#export').disabled=true;
  try {
    const {rows,source}=await window.loadSalesData();
    state.data=rows;
    configureDates();
    $('#connection-status').innerHTML=`<i></i> ${source==='supabase'?'Supabase DB 연결됨':'엑셀 데이터 · 저장본'}`;
    $('#source-badge').textContent=source==='supabase'?'SUPABASE DATA CONNECTED':'EXCEL SNAPSHOT';
    $('#source-description').textContent=source==='supabase'?`출처: Supabase store_sales · 현재 조회 ${fmt(rows.length)}행. 최초 가져오기: 매장판매실적.xlsx.`:'출처: 매장판매실적.xlsx · 2026.07.01–2026.09.30 · 원본 1,017행.';
    $('#loaded-at').textContent=`${new Intl.DateTimeFormat('ko-KR',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Seoul'}).format(new Date())} (한국 시간) 조회`;
    if(source==='supabase'&&!rows.length) $('#source-description').textContent+=' 데이터가 비어 있다면 초기화 SQL 및 읽기 정책을 확인하세요.';
    fillOptions('#region',state.data.map(r=>r.region),'전체 지역');
    fillOptions('#store',state.data.map(r=>r.store),'전체 매장');
    fillOptions('#category',state.data.map(r=>r.category),'전체 상품군');
    ['period','region','store','category','start-date','end-date'].forEach(id=>$(`#${id}`).addEventListener('change',()=>{
      if(id==='region')fillOptions('#store',state.data.filter(r=>$('#region').value==='all'||r.region===$('#region').value).map(r=>r.store),'전체 매장');
      update();
    }));
    $('#reset').addEventListener('click',()=>{
      ['period','region','category'].forEach(id=>$(`#${id}`).value='all');
      fillOptions('#store',state.data.map(r=>r.store),'전체 매장');$('#store').value='all';
      $('#start-date').value=state.range[0];$('#end-date').value=state.range[1];$('#search').value=''; update();
    });
    document.querySelectorAll('[data-grain]').forEach(button=>button.addEventListener('click',()=>{
      state.grain=button.dataset.grain;
      document.querySelectorAll('[data-grain]').forEach(b=>{b.classList.toggle('selected',b===button);b.setAttribute('aria-pressed',String(b===button));});
      const [start,end]=getRange();renderTrend(start,end,start&&end&&start<=end);
    }));
    $('#search').addEventListener('input',()=>{state.page=1;renderTable();});
    document.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{
      state.direction=state.sort===button.dataset.sort?-state.direction:-1;state.sort=button.dataset.sort;state.page=1;renderTable();
    }));
    $('#prev').addEventListener('click',()=>{state.page--;renderTable();});$('#next').addEventListener('click',()=>{state.page++;renderTable();});
    $('#export').addEventListener('click',downloadCsv);
    document.querySelectorAll('.nav-item').forEach(a=>a.addEventListener('click',()=>{document.querySelectorAll('.nav-item').forEach(item=>item.classList.toggle('active',item===a));}));
    let resizeFrame;
    window.addEventListener('resize',()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{const [s,e]=getRange();renderTrend(s,e,s&&e&&s<=e);});});
    $('#loading').hidden=true;$('#dashboard').hidden=false; update();
  }catch(error){$('#loading').hidden=true;$('#dashboard').hidden=true;$('#error').hidden=false;$('#error').textContent=error.name==='AbortError'?'데이터 조회 시간이 초과되었습니다. 다시 불러와주세요.':`데이터를 불러오지 못했습니다. ${error.message}`;$('#connection-status').textContent='데이터 연결 실패';$('#source-badge').textContent='CONNECTION FAILED';}
}
$('#refresh').addEventListener('click',()=>window.location.reload());
init();
