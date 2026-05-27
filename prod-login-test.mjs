import { chromium } from 'playwright';

const URL = 'https://shopping-listapp-lilac-chi.vercel.app/';
const PASS = '\x1b[32m PASS\x1b[0m';
const FAIL = '\x1b[31m FAIL\x1b[0m';
let passed = 0, failed = 0;

function assert(cond, label) {
  if (cond) { console.log(`${PASS} ${label}`); passed++; }
  else       { console.log(`${FAIL} ${label}`); failed++; }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// 콘솔 에러 수집
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

console.log('\n[이름 로그인 E2E 테스트] 배포 사이트 직접 검증\n');

// 1. 페이지 로드
console.log('--- 1. 페이지 로드 ---');
await page.goto(URL, { waitUntil: 'networkidle' });
const title = await page.title();
console.log(`  title: ${title}`);
assert(title.length > 0, '페이지 타이틀 존재');

// 2. 로그인 화면 확인
console.log('\n--- 2. 로그인 화면 확인 ---');
const nameInput = page.locator('#nameInput, input[placeholder*="이름"], input[type="text"]').first();
const nameInputVisible = await nameInput.isVisible().catch(() => false);
assert(nameInputVisible, '이름 입력 필드 표시됨');

// 3. 이름 입력
console.log('\n--- 3. 이름 입력 및 로그인 ---');
if (nameInputVisible) {
  await nameInput.fill('테스트유저');
  console.log('  이름 "테스트유저" 입력 완료');
}

// 이름 로그인 버튼 클릭 (#nameBtn)
const loginBtn = page.locator('#nameBtn');
const loginBtnVisible = await loginBtn.isVisible().catch(() => false);
assert(loginBtnVisible, '이름 로그인 버튼(#nameBtn) 표시됨');

if (loginBtnVisible) {
  await loginBtn.click();
  console.log('  #nameBtn 클릭');
}

// 4. 로그인 후 상태 확인 (최대 8초 대기)
console.log('\n--- 4. 로그인 후 앱 상태 확인 ---');
try {
  await page.waitForSelector('#fab', { timeout: 8000 });
  const listTitle = await page.evaluate(() => document.querySelector('#listTitle, .list-title, h1, h2')?.innerText || '');
  console.log(`  리스트 타이틀: ${listTitle}`);
  assert(true, '앱 메인 UI 로드됨 (FAB 버튼 표시)');
} catch {
  const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 400));
  console.log('  현재 화면:', bodySnippet);
  assert(false, '앱 메인 UI 로드됨 (FAB 버튼 표시)');
}

// 5. localStorage 확인 (userId, userName 저장됨)
console.log('\n--- 5. 인증 상태 저장 확인 ---');
const storage = await page.evaluate(() => ({
  userId: localStorage.getItem('userId'),
  userName: localStorage.getItem('userName'),
  listId: localStorage.getItem('listId'),
}));
console.log(`  userId: ${storage.userId}`);
console.log(`  userName: ${storage.userName}`);
console.log(`  listId: ${storage.listId}`);

assert(!!storage.userId && !storage.userId.startsWith('u_'), 'userId가 Supabase UUID 형식 (익명 로그인 성공)');
assert(storage.userName === '테스트유저', `userName 저장됨: ${storage.userName}`);
assert(!!storage.listId, `listId 저장됨: ${storage.listId}`);

// 6. 아이템 추가 테스트 (FAB → 모달 → 입력 → 제출)
console.log('\n--- 6. 아이템 추가 테스트 ---');
await page.locator('#fab').click();
await page.waitForSelector('#newName', { timeout: 4000 });
const itemInputVisible = await page.locator('#newName').isVisible().catch(() => false);
assert(itemInputVisible, '아이템 입력 모달 열림 (#newName 표시)');

if (itemInputVisible) {
  await page.locator('#newName').fill('테스트 우유');
  await page.locator('#addSubmitBtn').click();
  await page.waitForTimeout(2000);

  const itemText = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.item-name')).map(el => el.innerText.trim()).filter(t => t.includes('우유'))
  );
  console.log('  추가된 아이템:', itemText);
  assert(itemText.length > 0, '"테스트 우유" 아이템 화면에 표시됨');
}

// 7. 콘솔 에러 확인
console.log('\n--- 7. JS 콘솔 에러 확인 ---');
const authErrors = consoleErrors.filter(e =>
  e.includes('auth') || e.includes('signIn') || e.includes('JWT') || e.includes('RLS') || e.includes('401') || e.includes('403')
);
console.log(`  전체 콘솔 에러: ${consoleErrors.length}개`);
if (authErrors.length > 0) console.log('  인증 관련 에러:', authErrors);
assert(authErrors.length === 0, '인증 관련 JS 에러 없음');

await browser.close();

console.log(`\n${'─'.repeat(45)}`);
console.log(`결과: ${passed + failed}개 테스트 중 ${passed}개 통과, ${failed}개 실패`);
if (failed === 0) console.log('\x1b[32m배포 사이트 이름 로그인 정상!\x1b[0m');
else { console.log(`\x1b[31m${failed}개 실패\x1b[0m`); process.exit(1); }
