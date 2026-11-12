// 대한민국 공휴일. 고정 날짜는 오프라인에서도 표시하고, 음력·대체공휴일은 연도별로 받아 보완한다.
const Holidays = (() => {
  const fixed = { '01-01': '신정', '03-01': '삼일절', '05-05': '어린이날', '06-06': '현충일', '08-15': '광복절', '10-03': '개천절', '10-09': '한글날', '12-25': '성탄절' };
  const loaded = new Map(), pending = new Map();
  const koreanName = (name) => {
    if (/substitute|substitution/i.test(name)) return '대체공휴일';
    if (/seollal|korean new year|lunar new year/i.test(name)) return '설날';
    if (/chuseok|harvest festival/i.test(name)) return '추석';
    if (/buddha/i.test(name)) return '부처님오신날';
    if (/election/i.test(name)) return '선거일';
    return name;
  };
  const forDate = (date) => {
    const ds = typeof date === 'string' ? date : dateStr(date);
    return loaded.get(Number(ds.slice(0, 4)))?.[ds] || fixed[ds.slice(5)] || '';
  };
  const ensureYear = (year, changed = () => {}) => {
    if (loaded.has(year) || pending.has(year) || year < 2020 || year > 2030) return;
    try {
      const cached = JSON.parse(localStorage.getItem(`classhub-kr-holidays-${year}`) || 'null');
      if (cached && typeof cached === 'object' && !Array.isArray(cached)) { loaded.set(year, cached); return; }
    } catch (_) { /* 손상된 캐시는 새로 받는다. */ }
    const request = fetch(`https://nagerholidays.com/api/v4/Holidays/KR/${year}`)
      .then((response) => { if (!response.ok) throw Error('holiday request failed'); return response.json(); })
      .then((rows) => {
        if (!Array.isArray(rows)) throw Error('holiday data invalid');
        const days = {};
        rows.forEach((row) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || row.countryCode !== 'KR' || !row.holidayTypes?.includes('Public') || row.nationalHoliday === false) return;
          days[row.date] = fixed[row.date.slice(5)] || koreanName(row.name || '공휴일');
        });
        loaded.set(year, days);
        try { localStorage.setItem(`classhub-kr-holidays-${year}`, JSON.stringify(days)); } catch (_) { /* 저장 공간이 없어도 현재 화면은 표시한다. */ }
        changed();
      }).catch(() => { /* 네트워크가 없으면 고정 날짜만 표시한다. */ }).finally(() => pending.delete(year));
    pending.set(year, request);
  };
  return { forDate, ensureYear };
})();
