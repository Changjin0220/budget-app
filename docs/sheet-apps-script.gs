/**
 * 구글시트(주식 포트폴리오) → 가계부 앱 자산 탭 연결
 * '종목별현황' 탭의 평가액을 하루 한 번 Supabase portfolio_snapshots 표로 보냄.
 * 붙여넣는 곳: 시트 메뉴 확장 프로그램 → Apps Script
 */
const SUPABASE_URL = 'https://heoplfkxrvmzvoiqgtnd.supabase.co';
const SUPABASE_KEY = '여기에_anon_public_키_붙여넣기'; // 가계부 앱 설정에 넣은 것과 같은 키

// 시트를 열면 위쪽 메뉴에 '가계부'가 생김
function onOpen() {
  SpreadsheetApp.getUi().createMenu('가계부')
    .addItem('지금 가계부로 보내기', 'sendToBudget')
    .addItem('매일 자동 보내기 켜기', 'setupDailyTrigger')
    .addToUi();
}

function sendToBudget() {
  const sh = SpreadsheetApp.getActive().getSheetByName('종목별현황');
  // D~S열: 증권사, 계좌, 종목명, 시장, 그룹키, 섹터, 통화, 수량, 평균단가, 투자원금, 현재가, 가격출처, 환율, 평가금액, 평가손익, 수익률
  const rows = sh.getRange('D6:S205').getValues();
  const n = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const holdings = rows
    .filter((r) => r[0] && n(r[7]) > 0)
    .map((r) => ({
      broker: String(r[0]), account: String(r[1] || ''), name: String(r[2]), market: String(r[3] || ''),
      currency: String(r[6] || ''), qty: n(r[7]), avg: n(r[8]), cost: Math.round(n(r[9])),
      price: n(r[10]), fx: n(r[12]), value: Math.round(n(r[13])), pnl: Math.round(n(r[14])), rate: n(r[15]),
    }));
  const total = holdings.reduce((a, h) => ({ cost: a.cost + h.cost, value: a.value + h.value, pnl: a.pnl + h.pnl }),
    { cost: 0, value: 0, pnl: 0 });
  const day = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd');
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/portfolio_snapshots?on_conflict=day', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    payload: JSON.stringify({ day: day, data: { holdings: holdings, total: total }, updated_at: new Date().toISOString() }),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code >= 300) throw new Error('가계부 전송 실패 ' + code + ': ' + res.getContentText().slice(0, 200));
  try { SpreadsheetApp.getActive().toast(holdings.length + '종목, 평가액 ' + total.value.toLocaleString() + '원 보냄', '가계부'); } catch (e) {}
}

// 매일 아침 7시(미국장 마감 후)에 자동으로 보내기. 한 번만 실행하면 됨
function setupDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'sendToBudget')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendToBudget').timeBased().everyDays(1).atHour(7).inTimezone('Asia/Seoul').create();
  try { SpreadsheetApp.getActive().toast('매일 아침 7시에 자동으로 보내요', '가계부'); } catch (e) {}
}
