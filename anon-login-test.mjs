// 이름 로그인(anonymous) 전체 흐름 테스트
const BASE = 'https://ugowzkpuymwuqoqwkvfi.supabase.co';
const ANON_KEY = 'sb_publishable_ZpK0oYqtWxOmeXfUIVy9zA_qLgXNIlz';

const PASS = '\x1b[32m PASS\x1b[0m';
const FAIL = '\x1b[31m FAIL\x1b[0m';
let passed = 0, failed = 0;

function assert(cond, label) {
  if (cond) { console.log(`${PASS} ${label}`); passed++; }
  else       { console.log(`${FAIL} ${label}`); failed++; }
}

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
      ...((method !== 'GET' && method !== 'HEAD') ? { 'Prefer': 'return=representation' } : {}),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: (method === 'GET' || method === 'HEAD') ? undefined : (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

console.log('\n[이름 로그인 테스트] Anonymous sign-in → RLS 통과 검증\n');

// 1. Anonymous sign-in
console.log('--- 1. signInAnonymously ---');
const signIn = await api('POST', '/auth/v1/signup', {});
const token = signIn.data?.access_token;
const userId = signIn.data?.user?.id;
const isAnon = signIn.data?.user?.is_anonymous;
const role = signIn.data?.user?.role;

assert(signIn.status === 200, `HTTP 200 (got ${signIn.status})`);
assert(!!token, 'access_token 발급됨');
assert(role === 'authenticated', `role = authenticated (got ${role})`);
assert(isAnon === true, 'is_anonymous = true');
console.log(`  user_id: ${userId}`);

// 2. lists INSERT (RLS: authenticated 허용)
console.log('\n--- 2. 리스트 생성 (lists INSERT) ---');
const createList = await api('POST', '/rest/v1/lists', { name: '테스트유저의 장바구니' }, token);
const listId = createList.data?.[0]?.id;
const inviteCode = createList.data?.[0]?.invite_code;

assert(createList.status === 201, `lists INSERT HTTP 201 (got ${createList.status})`);
assert(!!listId, `list_id 발급됨: ${listId}`);
assert(!!inviteCode, `invite_code 생성됨: ${inviteCode}`);

// 3. list_members INSERT (RLS: user_id = auth.uid())
console.log('\n--- 3. 멤버 등록 (list_members INSERT) ---');
const joinMember = await api('POST', '/rest/v1/list_members',
  { list_id: listId, user_id: userId, display_name: '테스트유저' }, token);

assert(joinMember.status === 201, `list_members INSERT HTTP 201 (got ${joinMember.status})`);
console.log(`  INSERT 결과:`, JSON.stringify(joinMember.data));

// 4. shopping_items INSERT (RLS: list_members 멤버십 확인)
console.log('\n--- 4. 아이템 추가 (shopping_items INSERT) ---');
const addItem = await api('POST', '/rest/v1/shopping_items',
  { list_id: listId, text: '우유', quantity: 2, category: '유제품', checked: false }, token);
const itemId = addItem.data?.[0]?.id;

assert(addItem.status === 201, `shopping_items INSERT HTTP 201 (got ${addItem.status})`);
assert(addItem.data?.[0]?.text === '우유', '아이템 텍스트 정상 저장');
console.log(`  INSERT 결과:`, JSON.stringify(addItem.data));

// 5. shopping_items UPDATE with list_id filter (IDOR 방어 검증)
console.log('\n--- 5. 아이템 수정 (UPDATE + list_id 필터) ---');
const updateItem = await api('PATCH',
  `/rest/v1/shopping_items?id=eq.${itemId}&list_id=eq.${listId}`,
  { text: '우유(수정됨)', quantity: 3 }, token);

assert(updateItem.status === 200, `shopping_items UPDATE HTTP 200 (got ${updateItem.status})`);
assert(updateItem.data?.[0]?.text === '우유(수정됨)', '수정된 텍스트 반영됨');

// 6. shopping_items SELECT (loadItems 흐름 검증)
console.log('\n--- 6. 아이템 조회 (SELECT) ---');
// select 컬럼 필터 없이 먼저 시도 (진단용)
const listItems = await api('GET',
  `/rest/v1/shopping_items?list_id=eq.${listId}`, null, token);

assert(listItems.status === 200, `shopping_items SELECT HTTP 200 (got ${listItems.status})`);
console.log(`  SELECT 결과:`, JSON.stringify(listItems.data));
assert(listItems.data?.length === 1, `아이템 1개 조회됨 (got ${listItems.data?.length})`);
assert(!('updated_at' in (listItems.data?.[0] || {})), 'updated_at 미노출 (컬럼 최소화 확인)');

// 7. 정리
console.log('\n--- 7. 테스트 데이터 정리 ---');
await api('DELETE', `/rest/v1/shopping_items?list_id=eq.${listId}`, null, token);
await api('DELETE', `/rest/v1/list_members?list_id=eq.${listId}`, null, token);
await api('DELETE', `/rest/v1/lists?id=eq.${listId}`, null, token);

// anonymous user도 auth.users에서 정리 (선택)
await api('POST', '/auth/v1/logout', {}, token);
console.log('  정리 완료');

console.log(`\n${'─'.repeat(45)}`);
console.log(`결과: ${passed + failed}개 테스트 중 ${passed}개 통과, ${failed}개 실패`);
if (failed === 0) console.log('\x1b[32m이름 로그인 전체 흐름 정상!\x1b[0m');
else { console.log(`\x1b[31m${failed}개 실패\x1b[0m`); process.exit(1); }
