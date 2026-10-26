// NEIS 교육정보 개방포털(공식 Open API) 연동: 학교 검색, 급식, 시간표
const Neis = (() => {
  const BASE = 'https://open.neis.go.kr/hub/';
  const TT = { '초등학교': 'elsTimetable', '중학교': 'misTimetable', '고등학교': 'hisTimetable', '특수학교': 'spsTimetable' };
  const ALLERGY = ['', '난류', '우유', '메밀', '땅콩', '대두', '밀', '고등어', '게', '새우', '돼지고기', '복숭아', '토마토', '아황산류', '호두', '닭고기', '쇠고기', '오징어', '조개류', '잣'];

  const key = () => String((Store.get('settings', {}) || {}).neisKey || '').trim();
  const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const isoDate = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

  // 인증키가 없으면 한 번에 5건만 주므로 여러 쪽으로 나눠 가져온다
  async function call(service, params, maxPages) {
    const k = key();
    const size = k ? 1000 : 5;
    const cap = maxPages || (k ? 5 : 30);
    const get = async (i) => {
      const q = new URLSearchParams({ Type: 'json', pIndex: i, pSize: size, ...params });
      if (k) q.set('KEY', k);
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
    const pages = Math.min(cap, Math.ceil(first.total / size));
    const rest = pages > 1 ? await Promise.all(Array.from({ length: pages - 1 }, (_, i) => get(i + 2))) : [];
    return { rows: [first, ...rest].flatMap((r) => r.rows), total: first.total };
  }

  async function searchSchools(name) {
    const r = await call('schoolInfo', { SCHUL_NM: name }, Store.get('settings', {}).neisKey ? 3 : 4);
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
    const r = await call('mealServiceDietInfo', { ATPT_OFCDC_SC_CODE: school.atpt, SD_SCHUL_CODE: school.code, MLSV_FROM_YMD: ymd(from), MLSV_TO_YMD: ymd(to) });
    const out = {};
    r.rows.forEach((x) => {
      const d = isoDate(x.MLSV_YMD);
      (out[d] = out[d] || []).push({ code: Number(x.MMEAL_SC_CODE), kind: x.MMEAL_SC_NM, dishes: parseDishes(x.DDISH_NM), cal: x.CAL_INFO || '', ntr: lines(x.NTR_INFO), origin: lines(x.ORPLC_INFO) });
    });
    Object.values(out).forEach((l) => l.sort((a, b) => a.code - b.code));
    return out;
  }

  // 학년·반의 한 주 시간표 → [{ date, period, subject }]
  async function timetable(school, grade, cls, from, to) {
    const service = TT[school.kind];
    if (!service) throw new Error('이 종류의 학교는 시간표 불러오기를 지원하지 않아요.');
    const r = await call(service, { ATPT_OFCDC_SC_CODE: school.atpt, SD_SCHUL_CODE: school.code, GRADE: grade, CLASS_NM: cls, TI_FROM_YMD: ymd(from), TI_TO_YMD: ymd(to) });
    return r.rows.map((x) => ({ date: isoDate(x.ALL_TI_YMD), period: Number(x.PERIO), subject: String(x.ITRT_CNTNT || '').trim() })).filter((x) => x.subject);
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

  return { searchSchools, meals, timetable, pickSchool, ALLERGY, ymd, hasKey: () => !!key() };
})();
