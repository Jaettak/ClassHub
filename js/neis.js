// NEIS 교육정보 개방포털 공개 조회: 학교 검색, 급식
const Neis = (() => {
  const BASE = 'https://open.neis.go.kr/hub/';
  const ALLERGY = ['', '난류', '우유', '메밀', '땅콩', '대두', '밀', '고등어', '게', '새우', '돼지고기', '복숭아', '토마토', '아황산류', '호두', '닭고기', '쇠고기', '오징어', '조개류', '잣'];

  const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const isoDate = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

  // 공개 샘플 조회는 첫 5건만 반환한다.
  async function call(service, params) {
    const get = async (i) => {
      const q = new URLSearchParams({ Type: 'json', pIndex: i, pSize: 5, ...params });
      let res;
      try { res = await fetch(BASE + service + '?' + q); } catch (e) { throw new Error('인터넷에 연결되어 있지 않거나 NEIS 서버에 접속할 수 없어요.'); }
      if (!res.ok) throw new Error(`NEIS 서버 응답 오류 (${res.status})`);
      const data = await res.json();
      if (data.RESULT) {
        if (data.RESULT.CODE === 'INFO-200') return { rows: [], total: 0 };
        throw new Error(data.RESULT.MESSAGE || 'NEIS 오류');
      }
      const body = data[service];
      if (!body) return { rows: [], total: 0 };
      const code = body[0].head[1] && body[0].head[1].RESULT && body[0].head[1].RESULT.CODE;
      if (code && code !== 'INFO-000') return { rows: [], total: 0 };
      return { rows: body[1] ? body[1].row : [], total: body[0].head[0].list_total_count };
    };
    const first = await get(1);
    return first;
  }

  async function searchSchools(name) {
    const r = await call('schoolInfo', { SCHUL_NM: name });
    return {
      total: r.total,
      list: r.rows.map((x) => ({ name: x.SCHUL_NM, atpt: x.ATPT_OFCDC_SC_CODE, code: x.SD_SCHUL_CODE, kind: x.SCHUL_KND_SC_NM, region: x.LCTN_SC_NM, addr: x.ORG_RDNMA || '' })),
    };
  }

  function parseDishes(text) {
    return String(text || '').split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean).map((s) => {
      const m = s.match(/\s*\(([\d.]+)\)\s*$/);
      return { name: (m ? s.slice(0, m.index) : s).trim(), allergens: m ? m[1].split('.').filter(Boolean).map(Number) : [] };
    });
  }
  const lines = (t) => String(t || '').split(/<br\s*\/?>/i).map((s) => s.trim()).filter(Boolean);

  // { '2026-10-26': [{ kind:'중식', dishes, cal, ntr, origin }] }
  async function meals(school, from, to) {
    const params = { ATPT_OFCDC_SC_CODE: school.atpt, SD_SCHUL_CODE: school.code };
    // 샘플 응답은 하루에 최대 5건. 날짜를 나누어 한 주 전체를 가져온다.
    const dates = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) dates.push(new Date(d));
    const results = await Promise.all(dates.map((d) => call('mealServiceDietInfo', { ...params, MLSV_YMD: ymd(d) })));
    const rows = results.flatMap((r) => r.rows);
    const out = {};
    const seen = new Set();
    rows.forEach((x) => {
      const d = isoDate(x.MLSV_YMD);
      const code = Number(x.MMEAL_SC_CODE);
      const id = `${d}|${code}`;
      if (seen.has(id)) return;
      seen.add(id);
      (out[d] = out[d] || []).push({ code, kind: ({ 1: '조식', 2: '중식', 3: '석식' })[code] || x.MMEAL_SC_NM, dishes: parseDishes(x.DDISH_NM), cal: x.CAL_INFO || '', ntr: lines(x.NTR_INFO), origin: lines(x.ORPLC_INFO) });
    });
    Object.values(out).forEach((l) => l.sort((a, b) => a.code - b.code));
    return out;
  }

  // 학교 검색 창. 고르면 onPick(school) 호출
  function pickSchool(onPick) {
    const q = h('input', { type: 'search', placeholder: '학교 이름 (예: 서울고)', maxLength: 30 });
    const list = h('div', { class: 'sch-list' });
    const info = h('p', { class: 'muted' }, '학교 이름을 입력하고 검색해 주세요.');
    const m = App.modal({ title: '학교 찾기', body: [h('div', { class: 'sch-search' }, q, h('button', { class: 'btn primary', type: 'button', onclick: search }, '검색')), info, list] });
    async function search() {
      const name = q.value.trim();
      if (name.length < 2) { info.textContent = '두 글자 이상 입력해 주세요.'; return; }
      info.textContent = '찾는 중…';
      list.replaceChildren();
      try {
        const r = await searchSchools(name);
        info.textContent = r.list.length ? (r.total > r.list.length ? `${r.total}개 중 ${r.list.length}개만 보여요. 더 정확히 검색해 보세요.` : `${r.list.length}개를 찾았어요.`) : '검색 결과가 없어요.';
        list.replaceChildren(...r.list.map((s) => h('button', { type: 'button', class: 'sch-item', onclick: () => { m.close(); onPick(s); } },
          h('b', null, s.name), h('small', null, `${s.region} · ${s.kind}${s.addr ? ' · ' + s.addr : ''}`))));
      } catch (e) { info.textContent = e.message; }
    }
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
    setTimeout(() => q.focus(), 50);
  }

  return { searchSchools, meals, pickSchool, ALLERGY, ymd };
})();
