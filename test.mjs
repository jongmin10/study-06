import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:8765/';
const PASS = '\x1b[32m PASS\x1b[0m';
const FAIL = '\x1b[31m FAIL\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`${PASS} ${label}`);
    passed++;
  } else {
    console.log(`${FAIL} ${label}`);
    failed++;
  }
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();

// 각 테스트 전 localStorage를 초기화하기 위해 매번 새 페이지 사용
async function freshPage() {
  const page = await ctx.newPage();
  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  return page;
}

// ─────────────────────────────────────────────
// 테스트 1: 초기 상태 확인
// ─────────────────────────────────────────────
console.log('\n[테스트 1] 초기 상태');
{
  const page = await freshPage();
  const summary = await page.locator('#summary').innerText();
  assert(summary.includes('0개 항목'), '요약이 "0개 항목"으로 시작');

  const listItems = await page.locator('#list li').count();
  assert(listItems === 0, '리스트 항목 없음');

  const empty = await page.locator('#empty').isVisible();
  assert(empty, '"항목이 없습니다" 문구 표시');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 2: 아이템 추가 — 버튼 클릭
// ─────────────────────────────────────────────
console.log('\n[테스트 2] 아이템 추가 (버튼 클릭)');
{
  const page = await freshPage();
  await page.fill('#itemInput', '우유');
  await page.click('#addBtn');

  const count = await page.locator('#list li').count();
  assert(count === 1, '항목 1개 추가됨');

  const text = await page.locator('#list li .item-text').first().innerText();
  assert(text === '우유', '추가된 항목 텍스트가 "우유"');

  const summary = await page.locator('#summary').innerText();
  assert(summary.includes('1개 항목'), '요약이 1개로 업데이트');

  const inputVal = await page.inputValue('#itemInput');
  assert(inputVal === '', '추가 후 입력창 초기화');

  const empty = await page.locator('#empty').isVisible();
  assert(!empty, '"항목이 없습니다" 문구 숨김');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 3: 아이템 추가 — Enter 키
// ─────────────────────────────────────────────
console.log('\n[테스트 3] 아이템 추가 (Enter 키)');
{
  const page = await freshPage();
  await page.fill('#itemInput', '계란');
  await page.press('#itemInput', 'Enter');

  const count = await page.locator('#list li').count();
  assert(count === 1, 'Enter 키로 항목 추가됨');

  const text = await page.locator('#list li .item-text').first().innerText();
  assert(text === '계란', '추가된 항목 텍스트가 "계란"');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 4: 빈 입력 무시
// ─────────────────────────────────────────────
console.log('\n[테스트 4] 빈 입력 무시');
{
  const page = await freshPage();
  await page.fill('#itemInput', '   ');
  await page.click('#addBtn');

  const count = await page.locator('#list li').count();
  assert(count === 0, '공백만 입력 시 항목 추가 안 됨');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 5: 여러 아이템 추가
// ─────────────────────────────────────────────
console.log('\n[테스트 5] 여러 아이템 추가');
{
  const page = await freshPage();
  const items = ['사과', '바나나', '오렌지'];
  for (const item of items) {
    await page.fill('#itemInput', item);
    await page.press('#itemInput', 'Enter');
  }

  const count = await page.locator('#list li').count();
  assert(count === 3, '3개 항목 모두 추가됨');

  const summary = await page.locator('#summary').innerText();
  assert(summary.includes('3개 항목'), '요약이 3개로 표시');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 6: 체크 기능
// ─────────────────────────────────────────────
console.log('\n[테스트 6] 체크 기능');
{
  const page = await freshPage();
  await page.fill('#itemInput', '두부');
  await page.click('#addBtn');

  const cb = page.locator('#list li input[type="checkbox"]').first();
  assert(!(await cb.isChecked()), '초기 상태: 체크 해제');

  await cb.click();
  assert(await cb.isChecked(), '클릭 후: 체크됨');

  const liClass = await page.locator('#list li').first().getAttribute('class');
  assert(liClass?.includes('checked'), 'li 요소에 .checked 클래스 추가');

  const textDecoration = await page.locator('#list li .item-text').first().evaluate(
    el => getComputedStyle(el).textDecoration
  );
  assert(textDecoration.includes('line-through'), '완료 항목에 취소선 표시');

  const summary = await page.locator('#summary').innerText();
  assert(summary.includes('완료 1개'), '요약에 완료 1개 표시');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 7: 체크 해제
// ─────────────────────────────────────────────
console.log('\n[테스트 7] 체크 해제 (토글)');
{
  const page = await freshPage();
  await page.fill('#itemInput', '치즈');
  await page.click('#addBtn');

  const cb = page.locator('#list li input[type="checkbox"]').first();
  await cb.click(); // 체크
  await cb.click(); // 해제

  assert(!(await cb.isChecked()), '두 번 클릭 후 체크 해제');

  const liClass = await page.locator('#list li').first().getAttribute('class');
  assert(!liClass?.includes('checked'), '.checked 클래스 제거됨');

  const summary = await page.locator('#summary').innerText();
  assert(summary.includes('완료 0개'), '요약에 완료 0개로 복원');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 8: 아이템 삭제
// ─────────────────────────────────────────────
console.log('\n[테스트 8] 아이템 삭제');
{
  const page = await freshPage();
  await page.fill('#itemInput', '빵');
  await page.click('#addBtn');
  await page.fill('#itemInput', '버터');
  await page.click('#addBtn');

  assert(await page.locator('#list li').count() === 2, '삭제 전 2개 항목');

  await page.locator('#list li').first().locator('.delete-btn').click();

  assert(await page.locator('#list li').count() === 1, '삭제 후 1개 항목');

  const remaining = await page.locator('#list li .item-text').first().innerText();
  assert(remaining === '빵', '나머지 항목 "빵" 유지 (최근 추가순)');

  const summary = await page.locator('#summary').innerText();
  assert(summary.includes('1개 항목'), '요약 1개로 업데이트');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 9: 마지막 아이템 삭제 시 empty 표시
// ─────────────────────────────────────────────
console.log('\n[테스트 9] 마지막 항목 삭제 후 empty 표시');
{
  const page = await freshPage();
  await page.fill('#itemInput', '커피');
  await page.click('#addBtn');
  await page.locator('.delete-btn').first().click();

  const empty = await page.locator('#empty').isVisible();
  assert(empty, '마지막 항목 삭제 후 "항목이 없습니다" 표시');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 10: 필터 — 미완료
// ─────────────────────────────────────────────
console.log('\n[테스트 10] 필터 — 미완료');
{
  const page = await freshPage();
  for (const item of ['A', 'B', 'C']) {
    await page.fill('#itemInput', item);
    await page.click('#addBtn');
  }
  // C (index 0, 최근 추가), B (1), A (2) 순서
  // index 0 = C 체크
  await page.locator('#list li').nth(0).locator('input[type="checkbox"]').click();

  await page.locator('[data-filter="active"]').click();

  const count = await page.locator('#list li').count();
  assert(count === 2, '미완료 필터: 2개 표시');

  const texts = await page.locator('#list li .item-text').allInnerTexts();
  assert(!texts.includes('C'), '미완료 필터: 완료 항목 "C" 숨김');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 11: 필터 — 완료
// ─────────────────────────────────────────────
console.log('\n[테스트 11] 필터 — 완료');
{
  const page = await freshPage();
  for (const item of ['X', 'Y', 'Z']) {
    await page.fill('#itemInput', item);
    await page.click('#addBtn');
  }
  await page.locator('#list li').nth(0).locator('input[type="checkbox"]').click(); // Z
  await page.locator('#list li').nth(1).locator('input[type="checkbox"]').click(); // Y

  await page.locator('[data-filter="done"]').click();

  const count = await page.locator('#list li').count();
  assert(count === 2, '완료 필터: 2개 표시');

  const texts = await page.locator('#list li .item-text').allInnerTexts();
  assert(!texts.includes('X'), '완료 필터: 미완료 항목 "X" 숨김');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 12: 필터 — 전체 복귀
// ─────────────────────────────────────────────
console.log('\n[테스트 12] 필터 — 전체 복귀');
{
  const page = await freshPage();
  for (const item of ['P', 'Q']) {
    await page.fill('#itemInput', item);
    await page.click('#addBtn');
  }
  await page.locator('#list li').nth(0).locator('input[type="checkbox"]').click();
  await page.locator('[data-filter="done"]').click();
  await page.locator('[data-filter="all"]').click();

  const count = await page.locator('#list li').count();
  assert(count === 2, '전체 필터로 복귀 시 2개 모두 표시');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 13: 완료 항목 일괄 삭제
// ─────────────────────────────────────────────
console.log('\n[테스트 13] 완료 항목 일괄 삭제');
{
  const page = await freshPage();
  for (const item of ['M', 'N', 'O']) {
    await page.fill('#itemInput', item);
    await page.click('#addBtn');
  }
  // O(0), N(1), M(2)
  await page.locator('#list li').nth(0).locator('input[type="checkbox"]').click(); // O
  await page.locator('#list li').nth(1).locator('input[type="checkbox"]').click(); // N

  await page.locator('#clearBtn').click();

  const count = await page.locator('#list li').count();
  assert(count === 1, '완료 2개 일괄 삭제 후 1개 남음');

  const remaining = await page.locator('#list li .item-text').first().innerText();
  assert(remaining === 'M', '미완료 항목 "M" 유지');
  await page.close();
}

// ─────────────────────────────────────────────
// 테스트 14: localStorage 데이터 유지 (새로고침)
// ─────────────────────────────────────────────
console.log('\n[테스트 14] localStorage 유지 (새로고침)');
{
  const page = await freshPage();
  await page.fill('#itemInput', '노트');
  await page.click('#addBtn');
  await page.locator('#list li').nth(0).locator('input[type="checkbox"]').click();

  await page.reload();

  const count = await page.locator('#list li').count();
  assert(count === 1, '새로고침 후 항목 유지');

  const cb = page.locator('#list li input[type="checkbox"]').first();
  assert(await cb.isChecked(), '새로고침 후 체크 상태 유지');
  await page.close();
}

// ─────────────────────────────────────────────
// 결과 요약
// ─────────────────────────────────────────────
await browser.close();
console.log(`\n${'─'.repeat(40)}`);
console.log(`결과: ${passed + failed}개 테스트 중 ${passed}개 통과, ${failed}개 실패`);
if (failed === 0) {
  console.log('\x1b[32m모든 테스트 통과!\x1b[0m');
} else {
  console.log(`\x1b[31m${failed}개 테스트 실패\x1b[0m`);
  process.exit(1);
}
