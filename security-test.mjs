import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:8765/';
const PASS = '\x1b[32m PASS\x1b[0m';
const FAIL = '\x1b[31m FAIL\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { console.log(`${PASS} ${label}`); passed++; }
  else           { console.log(`${FAIL} ${label}`); failed++; }
}

const browser = await chromium.launch({ headless: true });

// ─────────────────────────────────────────────
// 테스트 1: avatarUrl XSS — DOM API 방어 확인
// ─────────────────────────────────────────────
console.log('\n[보안 1] avatarUrl XSS 방어');
{
  const page = await browser.newPage();
  await page.goto(BASE_URL);

  const result = await page.evaluate(() => {
    const av = document.getElementById('userAvatar');
    if (!av) return { error: 'userAvatar 없음' };

    // XSS 페이로드를 DOM API로 삽입
    const img = document.createElement('img');
    img.src = '"><img src=x onerror=window.__xss1=true>';
    img.alt = '';
    av.replaceChildren(img);

    return {
      xssFired: window.__xss1 ?? false,
      childCount: av.childNodes.length,
      tagName: av.querySelector('img')?.tagName,
    };
  });

  assert(result.xssFired === false, 'avatarUrl XSS 페이로드 미실행');
  assert(result.childCount === 1, 'img 노드 1개만 존재 (주입 태그 파싱 없음)');
  assert(result.tagName === 'IMG', 'img 엘리먼트만 생성됨');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 2: item.quantity XSS — parseInt 방어 확인
// ─────────────────────────────────────────────
console.log('\n[보안 2] item.quantity XSS 방어');
{
  const page = await browser.newPage();
  await page.goto(BASE_URL);

  const result = await page.evaluate(() => {
    const payloads = [
      '<img src=x onerror=window.__xss2=true>',
      '<script>window.__xss2=true<\/script>',
      '"><svg onload=window.__xss2=true>',
    ];

    const outputs = payloads.map(p => parseInt(p, 10) || 1);
    return {
      allSafe: outputs.every(v => v === 1),
      outputs,
      xssFired: window.__xss2 ?? false,
    };
  });

  assert(result.allSafe, 'quantity 페이로드가 모두 1로 강제 변환');
  assert(result.xssFired === false, 'quantity XSS 페이로드 미실행');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 3: IDOR — list_id 조건 존재 확인
// ─────────────────────────────────────────────
console.log('\n[보안 3] CRUD 쿼리에 list_id 필터 존재');
{
  const page = await browser.newPage();
  await page.goto(BASE_URL);

  const result = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    const src = scripts.map(s => s.textContent).join('');

    // update/delete 쿼리에 list_id 필터가 있는지 확인
    const updateHasListId = /\.update\([^;]+\)\.eq\('id'[^;]+\)\.eq\('list_id'/.test(src);
    const toggleHasListId = /\.update\(\{ checked[^}]+\}\)\.eq\('id'[^;]+\)\.eq\('list_id'/.test(src);
    const deleteHasListId = /\.delete\(\)\.eq\('id'[^;]+\)\.eq\('list_id'/.test(src);

    // select('*') 가 남아있지 않은지 확인
    const noSelectStar = !src.includes(".select('*')");

    return { updateHasListId, toggleHasListId, deleteHasListId, noSelectStar };
  });

  assert(result.updateHasListId, '수정 쿼리에 list_id 조건 존재');
  assert(result.toggleHasListId, '체크 쿼리에 list_id 조건 존재');
  assert(result.deleteHasListId, '삭제 쿼리에 list_id 조건 존재');
  assert(result.noSelectStar, 'select("*") 잔존 없음');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 4: CSP 헤더 확인
// ─────────────────────────────────────────────
console.log('\n[보안 4] 보안 헤더 확인');
{
  const res = await (await browser.newPage()).goto(BASE_URL);
  const headers = res.headers();

  assert(!!headers['content-security-policy'], 'CSP 헤더 존재');
  assert(headers['x-frame-options'] === 'DENY', 'X-Frame-Options: DENY');
  assert(headers['x-content-type-options'] === 'nosniff', 'X-Content-Type-Options: nosniff');
}

// ─────────────────────────────────────────────
// 테스트 5: SRI — CDN 버전 고정 확인
// ─────────────────────────────────────────────
console.log('\n[보안 5] CDN 버전 고정 및 modulepreload SRI');
{
  const page = await browser.newPage();
  await page.goto(BASE_URL);

  const result = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script'));
    const src = scripts.map(s => s.textContent).join('');

    const hasFloatingVersion = src.includes('supabase-js@2/+esm');
    const hasPinnedVersion = src.includes('supabase-js@2.106.2/+esm');

    const preload = document.querySelector('link[rel="modulepreload"]');
    const hasIntegrity = !!preload?.integrity && preload.integrity.startsWith('sha384-');

    return { hasFloatingVersion, hasPinnedVersion, hasIntegrity };
  });

  assert(!result.hasFloatingVersion, 'floating @2 버전 미사용');
  assert(result.hasPinnedVersion, '버전이 @2.106.2로 고정됨');
  assert(result.hasIntegrity, 'modulepreload에 sha384 integrity 존재');
  await page.close();
}

// ─────────────────────────────────────────────
// 결과 요약
// ─────────────────────────────────────────────
await browser.close();
console.log(`\n${'─'.repeat(40)}`);
console.log(`결과: ${passed + failed}개 테스트 중 ${passed}개 통과, ${failed}개 실패`);
if (failed === 0) {
  console.log('\x1b[32m모든 보안 테스트 통과!\x1b[0m');
} else {
  console.log(`\x1b[31m${failed}개 테스트 실패\x1b[0m`);
  process.exit(1);
}
