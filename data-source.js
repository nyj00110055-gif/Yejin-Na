'use strict';
(() => {
  function validate(rows) {
    if (!Array.isArray(rows)) throw new Error('판매 데이터 응답 형식이 올바르지 않습니다.');
    const ids = new Set();
    for (const r of rows) {
      if (!r || !Number.isSafeInteger(r.id) || ids.has(r.id) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || Number.isNaN(Date.parse(r.date)) ||
          new Date(r.date).toISOString().slice(0,10) !== r.date ||
          !['region','store','category','staff'].every(k => typeof r[k] === 'string' && r[k].trim()) ||
          !(r.plan === null || typeof r.plan === 'string') ||
          !(r.quantity === null || Number.isSafeInteger(r.quantity) && r.quantity >= 0) ||
          !Number.isSafeInteger(r.revenue) || r.revenue < 0) {
        throw new Error('판매 데이터의 필수 항목 또는 숫자·날짜 형식을 확인해주세요.');
      }
      ids.add(r.id);
    }
    return rows;
  }
  async function request(url, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {return await fetch(url, {...options, cache:'no-store', signal:controller.signal});}
    finally {clearTimeout(timer);}
  }
  window.loadSalesData = async () => {
    const config = window.DASHBOARD_CONFIG;
    if (!config || !['snapshot','supabase'].includes(config.source)) throw new Error('데이터 연결 설정이 없습니다.');
    if (config.source === 'snapshot') {
      const response = await request('data/sales.json');
      if (!response.ok) throw new Error('저장된 판매 데이터를 불러오지 못했습니다. HTTP 서버로 실행해주세요.');
      return {rows:validate(await response.json()), source:'snapshot'};
    }
    let base;
    try {base = new URL(config.supabaseUrl);}
    catch {throw new Error('Supabase API URL 설정을 확인해주세요.');}
    if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co') ||
        base.pathname !== '/' || base.search || base.hash || base.username || base.password ||
        typeof config.supabasePublishableKey !== 'string' || !config.supabasePublishableKey.startsWith('sb_publishable_')) {
      throw new Error('Supabase Project URL과 Publishable key 설정을 확인해주세요.');
    }
    const rows = [];
    let expected = null, lastId = null;
    while (true) {
      const url = new URL('/rest/v1/store_sales', base);
      url.search = new URLSearchParams({select:'id,date,region,store,category,plan,quantity,revenue,staff', order:'id.asc', limit:'1000', offset:String(rows.length)});
      const response = await request(url, {headers:{apikey:config.supabasePublishableKey, Prefer:'count=exact'}});
      if (!response.ok) {
        if ([401,403].includes(response.status)) throw new Error('Supabase 키 또는 읽기 권한을 확인해주세요.');
        if (response.status === 404) throw new Error('Supabase store_sales 테이블이 없습니다. 초기화 SQL을 실행해주세요.');
        throw new Error(`Supabase 조회에 실패했습니다 (HTTP ${response.status}). 잠시 후 새로고침해주세요.`);
      }
      const batch = await response.json();
      if (!Array.isArray(batch)) throw new Error('Supabase 응답 형식이 올바르지 않습니다.');
      const count = response.headers.get('content-range')?.split('/')[1];
      if (count && count !== '*') {
        const value = Number(count);
        if (!Number.isSafeInteger(value) || value < 0) throw new Error('Supabase 전체 행 수를 확인할 수 없습니다.');
        if (expected !== null && expected !== value) throw new Error('조회 중 데이터가 변경되었습니다. 다시 불러와주세요.');
        expected = value;
      }
      validate(batch);
      for (const row of batch) {
        if (lastId !== null && row.id <= lastId) throw new Error('페이지 조회 중 데이터 순서가 변경되거나 중복되었습니다. 다시 불러와주세요.');
        lastId = row.id;
      }
      rows.push(...batch);
      if (expected !== null && rows.length >= expected) {
        if (rows.length !== expected) throw new Error('Supabase 데이터 건수가 일치하지 않습니다.');
        break;
      }
      if (!batch.length) {
        if (expected !== null && rows.length !== expected) throw new Error('판매 데이터를 모두 읽지 못했습니다. 다시 불러와주세요.');
        break;
      }
      if (rows.length >= 1000000) throw new Error('조회 가능한 데이터 규모를 초과했습니다. 서버 집계가 필요합니다.');
    }
    return {rows:validate(rows), source:'supabase'};
  };
})();
