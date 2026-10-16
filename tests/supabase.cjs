'use strict';
// HTTP integration tests with mocked Supabase responses, not a live DB test.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const baseUrl=process.env.DASHBOARD_URL||'http://127.0.0.1:8001';
const rows=JSON.parse(fs.readFileSync(path.join(root,'data/sales.json'),'utf8'));
const publicConfig={source:'supabase',supabaseUrl:'https://dmctdaeownfrodkahhxy.supabase.co',supabasePublishableKey:'sb_publishable_test_fixture'};
async function configuredPage(browser,handler,config=publicConfig){
 const page=await browser.newPage();
 await page.route('**/runtime-config.js',route=>route.fulfill({contentType:'text/javascript',body:'window.DASHBOARD_CONFIG='+JSON.stringify(config)}));
 await page.route('**/rest/v1/store_sales?**',handler);
 return page;
}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 let offsets=[],snapshotRequests=0;
 const page=await configuredPage(browser,async route=>{
   const url=new URL(route.request().url()),offset=Number(url.searchParams.get('offset'));
   offsets.push(offset);assert.equal(route.request().headers().apikey,publicConfig.supabasePublishableKey);
   assert.equal(url.searchParams.get('order'),'id.asc');assert.equal(url.searchParams.get('limit'),'1000');
   // Simulate a Supabase project with a lower-than-default row limit.
   const batch=rows.slice(offset,offset+500);
   await route.fulfill({status:200,headers:{'content-type':'application/json','access-control-expose-headers':'content-range','content-range':`${offset}-${offset+batch.length-1}/${rows.length}`},body:JSON.stringify(batch)});
 });
 page.on('request',r=>{if(r.url().includes('/data/sales.json'))snapshotRequests++;});
 await page.goto(baseUrl);await page.waitForSelector('#dashboard:not([hidden])');
 assert.deepEqual(offsets,[0,500,1000]);assert.equal(snapshotRequests,0);
 assert.match(await page.locator('#connection-status').innerText(),/Supabase DB/);
 assert.match(await page.locator('.kpi-value').first().innerText(),/515,999,400/);
 assert.equal(await page.locator('#record-count').innerText(),'1,017');
 offsets=[];await page.click('#refresh');await page.waitForSelector('#dashboard:not([hidden])');assert.deepEqual(offsets,[0,500,1000]);
 const future=[{...rows[0],id:2000,date:'2027-02-28',revenue:123456}];
 const dynamic=await configuredPage(browser,route=>route.fulfill({contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':'0-0/1'},body:JSON.stringify(future)}));
 await dynamic.goto(baseUrl);await dynamic.waitForSelector('#dashboard:not([hidden])');await dynamic.selectOption('#period','2027-02');
 assert.equal(await dynamic.locator('#record-count').innerText(),'1');assert.match(await dynamic.locator('#range-label').innerText(),/2027\.02\.28/);assert.match(await dynamic.locator('.kpi-value').first().innerText(),/123,456/);
 for(const status of [401,403,404,500]){
   const failed=await configuredPage(browser,route=>route.fulfill({status,body:'{}'}));let fallback=0;failed.on('request',r=>{if(r.url().includes('/data/sales.json'))fallback++;});
   await failed.goto(baseUrl);await failed.waitForSelector('#error:not([hidden])');assert.equal(await failed.locator('#dashboard').isHidden(),true);assert.equal(fallback,0);await failed.close();
 }
 const empty=await configuredPage(browser,route=>route.fulfill({contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':'*/0'},body:'[]'}));
 await empty.goto(baseUrl);await empty.waitForSelector('#dashboard:not([hidden])');assert.equal(await empty.locator('#record-count').innerText(),'0');assert(await empty.locator('#export').isDisabled());
 const malformed=await configuredPage(browser,route=>route.fulfill({contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':'0-0/1'},body:JSON.stringify([{...rows[0],revenue:'123'}])}));
 await malformed.goto(baseUrl);await malformed.waitForSelector('#error:not([hidden])');
 const duplicate=await configuredPage(browser,route=>route.fulfill({contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':'0-1/2'},body:JSON.stringify([rows[0],rows[0]])}));
 await duplicate.goto(baseUrl);await duplicate.waitForSelector('#error:not([hidden])');
 const capped=await configuredPage(browser,route=>{
   const offset=Number(new URL(route.request().url()).searchParams.get('offset'));return route.fulfill({contentType:'application/json',headers:{'access-control-expose-headers':'content-range','content-range':`${offset}-${offset}/1017`},body:JSON.stringify(offset===0?rows.slice(0,1):[])});
 });
 await capped.goto(baseUrl);await capped.waitForSelector('#error:not([hidden])');
 await browser.close();
 const env={...process.env};delete env.SUPABASE_URL;delete env.SUPABASE_PUBLISHABLE_KEY;delete env.SALES_DATA_SOURCE;
 for(const values of [
  {SUPABASE_URL:publicConfig.supabaseUrl},
  {SUPABASE_PUBLISHABLE_KEY:publicConfig.supabasePublishableKey},
  {SUPABASE_URL:'https://supabase.com/dashboard/project/dmctdaeownfrodkahhxy',SUPABASE_PUBLISHABLE_KEY:publicConfig.supabasePublishableKey},
  {SUPABASE_URL:publicConfig.supabaseUrl,SUPABASE_PUBLISHABLE_KEY:'sb_secret_test_fixture'},
  {SUPABASE_URL:publicConfig.supabaseUrl,SUPABASE_PUBLISHABLE_KEY:'eyJhbGciOiJIUzI1NiJ9.service_role'}
 ]){const result=spawnSync(process.execPath,['scripts/build.cjs'],{cwd:root,env:{...env,...values}});assert.notEqual(result.status,0);}
 let result=spawnSync(process.execPath,['scripts/build.cjs'],{cwd:root,env:{...env,SUPABASE_URL:publicConfig.supabaseUrl,SUPABASE_PUBLISHABLE_KEY:publicConfig.supabasePublishableKey}});assert.equal(result.status,0);
 const config=fs.readFileSync(path.join(root,'dist/runtime-config.js'),'utf8');assert(config.includes('"source":"supabase"'));assert(!fs.existsSync(path.join(root,'dist/supabase')));
 result=spawnSync(process.execPath,['scripts/build.cjs'],{cwd:root,env:{...env,SALES_DATA_SOURCE:'snapshot'}});assert.equal(result.status,0);
 console.log('PASS (mock Supabase): 1017 rows over 3 pages, totals, no snapshot fallback, reload, future date ranges, HTTP errors, empty DB, invalid/duplicate rows, incomplete pages, build config and secret-key rejection.');
})().catch(error=>{console.error(error);process.exit(1);});
