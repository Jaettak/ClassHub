// 학교 자료와 사용자가 외부 AI로 정리한 JSON 파일 가져오기.
const SchoolData = (() => {
  const kinds = { calendar: '학사 일정', map: '교내 지도', timetable: '시간표', grades: '성적표', activities: '생기부·활동' };
  const saved = () => Store.get('schoolFiles', []);
  const samples = {
    calendar: [
      { recordType: 'event', date: '2026-04-20', dateEnd: '2026-04-24', title: '시험기간 예시', type: '시험', grades: [1, 2, 3], allDay: true, start: '', end: '', location: '', instructionDayEffect: 'normal', originalText: '시험기간 (20~24)', sourcePage: 1, sourceRow: '4월 4주' },
      { recordType: 'event', date: '2026-09-15', dateEnd: '', title: '재량휴업 예시', type: '휴업', grades: [1, 2, 3], allDay: true, instructionDayEffect: 'no-class', originalText: '재량휴업(15)', sourcePage: 2, sourceRow: '9월 3주' }
    ],
    map: [{ building: '예시동', floor: '2층', width: 1000, height: 700, sourceSheet: '배치도', sourceRows: '1:20', gridLayout: { columns: [{ key: 'A', width: 12 }, { key: 'B', width: 28 }], rows: [{ number: 1, height: 24 }, { number: 2, height: 30 }], mergedRanges: ['A1:A20'], coordinateNote: '원본 엑셀의 너비·높이와 병합 범위를 실제 값으로 모두 기록' }, rooms: [
      { name: '2학년 3반', type: '일반교실', room: '2-3', sourceCell: 'D7', polygon: [[100, 100], [250, 100], [250, 220], [100, 220]], memo: '' },
      { name: '학습실', type: '공용공간', sourceCell: 'H7', polygon: [], memo: '좌표를 확정하지 못하면 빈 배열로 두고 원본 셀을 보존' }
    ], features: [{ name: '계단', type: '이동시설', x: 300, y: 200, sourceCell: 'D5', memo: '' }], paths: [{ name: '복도', points: [[0, 300], [1000, 300]] }], gridCells: [{ cell: 'H7', text: '학습실', mergedRange: '', fill: '', border: '' }], unresolved: [] }],
    timetable: [{ day: 1, period: 1, subject: '과목', teacher: '', room: '', start: '09:00', end: '09:50', effectiveStart: '2026-03-02', effectiveEnd: '2026-07-21', semester: '1학기', weekType: '', notes: '', sourcePage: 1 }],
    grades: [
      { recordType: 'assessment', schoolYear: 2026, grade: 1, semester: 1, exam: '1회고사', examDate: '', subject: '예시 과목', credits: 3, category: '지필', assessmentName: '1회고사', weightPercent: 30, full: 100, score: 75, originalText: '', sourcePage: 1 },
      { recordType: 'courseResult', schoolYear: 2026, grade: 1, semester: 1, exam: '학기말', subject: '예시 과목', credits: 3, score: 84.5, full: 100, rawScore: 85, achievement: 'B', achievementDistribution: { A: 10, B: 25, C: 30, D: 20, E: 15 }, rank: 25, jointRank: 2, studentCount: 200, subjectAverage: 72, achievementCutoffs: { A: 90, B: 80, C: 70, D: 60, E: 40 }, sourcePage: 1 },
      { recordType: 'examResult', schoolYear: 2026, grade: 1, semester: 1, exam: '1학기 중간고사', subject: '예시 과목', score: 82, full: 100, rawScore: 82, rank: 30, jointRank: 1, studentCount: 200, subjectAverage: 68, sourcePage: 1 },
      { recordType: 'completion', schoolYear: 2026, grade: 1, semester: 1, subject: '진로와 직업', credits: 2, completed: true, completionMark: 'P', score: null, sourcePage: 1 },
      { recordType: 'mockExam', schoolYear: 2026, grade: 1, exam: '전국연합학력평가', subject: '국어', score: null, standardScore: null, percentile: null, mockRank: null, mockParticipants: null, mockGradeDistribution: {}, sourcePage: 1 },
      { recordType: 'analysis', schoolYear: 2026, grade: 1, exam: '1회고사', subject: '공통국어1', score: null, statistics: {}, originalText: '', sourcePage: 1 },
      { recordType: 'errorSheet', schoolYear: 2026, grade: 1, exam: '1회고사', subject: '공통국어1', score: null, questions: [{ number: 1, correctAnswer: '', studentAnswer: '', correct: null, points: null }], sourcePage: 1 }
    ],
    activities: [
      { recordType: 'narrative', section: '세부능력및특기사항', schoolYear: 2026, grade: 1, semester: 1, subject: '과목명', title: '과목별 세부능력 및 특기사항', cv: '원문 전체를 생략 없이 기록', sourcePage: 1 },
      { recordType: 'attendance', section: '출결상황', schoolYear: 2026, grade: 1, title: '1학년 출결상황', attendance: { schoolDays: 191, absence: { illness: 0, unexcused: 0, other: 0 }, late: { illness: 0, unexcused: 0, other: 0 }, earlyLeave: { illness: 0, unexcused: 0, other: 0 }, classExit: { illness: 0, unexcused: 0, other: 0 }, remarks: '' }, sourcePage: 1 },
      { recordType: 'award', section: '수상경력', schoolYear: 2026, grade: 1, semester: 2, title: '상 이름', award: { rank: '', date: '2026-01-05', institution: '', eligibleGroup: '', eligibleCount: null }, sourcePage: 1 },
      { recordType: 'narrative', section: '창의적체험활동', subSection: '자율활동', schoolYear: 2026, grade: 1, title: '자율활동 특기사항', hours: null, cv: '원문 전체', sourcePage: 1 }
    ]
  };
  const guides = {
    calendar: '학사연도는 3월부터 다음 해 2월까지 보세요. 주요 행사 내역에서 행사마다 record 1개를 만드세요. 같은 주에 여러 일정이 있으면 분리하고 (22~28), (3.26~4.1)처럼 월을 넘는 기간을 정확히 해석하세요. 학년 대상, 수업 여부, 원문, 월/주·쪽수를 기록하세요. 학년별 월 수업 일수, 학기 합계와 연간 합계는 overview에 기록하세요. 날짜가 미정인 행사는 unresolved에 넣고 날짜를 추측하지 마세요. 아무 행사도 없는 날짜를 일정으로 만들지 마세요.',
    map: '엑셀 시트의 1~5층을 층별 record로 나누세요. 열 너비·행 높이·병합 범위는 gridLayout에, 이름 있는 셀과 공간을 구분하는 의미 있는 빈 셀의 원본 위치·표기는 gridCells에 보존하세요. rooms/features에도 의미별로 분류하세요. 일반교실, 교과교실, 교무실, 도서관, 급식실, 체육시설, 계단, 화장실, 출입구, 실외 공간을 포함하세요. 셀 위치(sourceCell), 병합 범위, 원래 표기와 층을 보존하세요. 윤곽을 실제로 판독할 수 있을 때만 polygon 좌표를 넣으세요. 모르는 좌표는 빈 배열로 남겨도 가져올 수 있습니다. 보이지 않는 소화기·비상구 등은 만들어내지 마세요.',
    timetable: '모든 요일·교시와 적용 시작/종료 날짜를 기록하세요. 과목·교사·교실·시각·학기·격주 여부를 보존하세요. 원본에 없는 시간을 추측하지 마세요.',
    grades: '학년도·학년·학기·시험 단위로 기록하세요. 각 지필·수행 평가 항목은 assessment, 과목의 학기 합계는 courseResult, 시험별 과목 합계는 examResult, 이수 과목은 completion으로 따로 만드세요. 만점, 받은 점수, 반영비율, 원점수, 성취도, A~E 비율, 성취율 구간, 석차·동석차·수강자 수·평균과 체육/예술 세부 점수를 보존하세요. 모의고사는 mockExam으로 기록하고 표준점수·백분위·등급 정보를 보존하세요. 성적분석과 정오답표가 있으면 각각 analysis/errorSheet로 만들고 원본 문항과 통계를 생략하지 마세요. 보이지 않는 칸은 null로 두세요.',
    activities: '학교생활기록부의 과목별 세부능력, 창의적체험활동 하위 영역, 학년별 출결, 수상, 자격증, 독서, 행동특성 등 원본의 각 영역을 별도 record로 만드세요. 긴 서술은 cv에 원문 전체를 보존하고 요약으로 대체하지 마세요. 출결은 수업일수와 결석·지각·조퇴·결과 각각의 질병/미인정/기타 숫자를 attendance에, 수상은 이름·등급·날짜·수여기관·참가대상을 award에 넣으세요. 원본의 빈 칸을 임의로 0으로 바꾸지 마세요.'
  };
  const fieldGuides = {
    calendar: { overview: 'academicYear, semesterInstructionDays.first/second의 학년별 일수, monthlyInstructionDays의 {month, byGrade}, annualInstructionDays, weeklyRows의 원본 월/주·날짜 칸·주요 행사 원문을 기록', records: '날짜가 확정된 행사만 기록. date/dateEnd, title, type, grades, instructionDayEffect, originalText, sourcePage, sourceRow', unresolved: '예: 새학년 준비기간(미정)처럼 날짜가 없는 행사는 {title, originalText, reason, sourcePage}로 기록' },
    map: { records: '건물의 층마다 하나. width/height는 표시용 좌표계이며 원본 셀 구조와 별도로 기록', gridLayout: '원본 열 너비·행 높이·병합 범위와 좌표 해석을 기록', gridCells: '원본의 이름 있는 셀과 공간 구분에 중요한 빈 셀을 {cell,text,mergedRange,fill,border}로 기록', rooms: '장소 이름, 종류, 교실 번호, sourceCell, polygon. 좌표를 모르면 polygon=[]', features: '위치가 확인된 출입구·계단·안전시설 등만 {name,type,x,y,sourceCell}로 기록', paths: '확인된 복도·이동 경로의 점 목록. 원본에 없으면 []' },
    timetable: { records: '요일 day(월=1~금=5), 교시 period, 과목, 교사, 교실, 수업 시작/끝, effectiveStart/effectiveEnd' },
    grades: { assessment: '지필/수행 각각의 이름, 반영비율, 만점, 받은 점수', courseResult: '학기 과목별 합계·원점수·성취도·성취도 분포·석차·동석차·수강자 수·과목평균·성취율 구간', examResult: '중간/기말 등 고사별 과목 합계와 석차·동석차·평균', completion: '교양과목 등의 학점·이수 여부·P 표기', mockExam: '영역·과목·원점수·표준점수·백분위·등급·응시자 수·등급 비율', analysis: '표준점수 분석과 원문 통계', errorSheet: '고사별 정오답·문항 번호·정답·선택 답·배점. 긴 목록은 원문 그대로 보존' },
    activities: { narrative: '과목별 세특, 창의적체험활동 하위영역, 행동특성 등의 cv에 원문 전체 보존', attendance: '학년별 수업일수 및 결석·지각·조퇴·결과의 질병/미인정/기타 건수와 특기사항', award: '수상명·등급·날짜·수여기관·참가대상·참가인원', others: '자격증·독서·봉사·학교스포츠클럽·인적/학적 사항은 각 영역을 별도 record로 기록하고 원문 추가 열 보존' }
  };
  const makeTemplate = (kind) => ({ format: 'ClassHubSchoolData', version: 2, kind,
    instructions: '이 파일과 원본 자료를 사용자가 선택한 외부 AI에 함께 전달하세요. records에는 원본의 실제 항목을 빠짐없이 넣으세요. examples는 필드 설명용이며 records에 복사하지 마세요. 원본에서 확인되지 않는 값은 빈 문자열 또는 null로 두고 추측하지 마세요. 원문의 추가 열은 해당 record에 원래 이름으로 보존하세요. 날짜는 YYYY-MM-DD, 시간은 HH:MM입니다. 완성된 UTF-8 JSON 파일만 반환하세요.',
    extractionGuide: guides[kind], fieldGuide: fieldGuides[kind],
    sourceAndReview: '원본의 표 제목, 항목명, 쪽수와 판독하기 어려운 부분을 기록하세요. 가져오기 전 사용자가 원본과 결과를 대조해야 합니다. 개인 정보가 담긴 원본 자료의 외부 AI 전달 여부는 사용자가 직접 결정합니다.',
    source: { documentTitle: '', schoolYear: null, schoolName: '', sourceType: 'HWP/XLSX/PDF/이미지/나이스플러스 화면', capturedAt: '', pagesOrSheets: [], note: '' },
    overview: kind === 'calendar' ? { academicYear: null, semesterInstructionDays: { first: { '1': null, '2': null, '3': null }, second: { '1': null, '2': null, '3': null } }, monthlyInstructionDays: [], annualInstructionDays: { '1': null, '2': null, '3': null }, weeklyRows: [] } : {},
    examples: samples[kind], unresolved: [], records: [] });
  const validDate = (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    const date = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === s;
  };
  const text = (s, limit = 120) => typeof s === 'string' ? s.trim().slice(0, limit) : '';
  const numeric = (value) => value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value);
  function floorView(floor, after = () => {}, floorIndex = -1) {
    const w = floor.width || 1000, height = floor.height || 700;
    const rooms = floor.rooms || [], facilities = floor.features || [];
    const update = (patch) => {
      Store.set('schoolPlaces', Store.get('schoolPlaces', []).map((row, index) => (floor.id ? row.id === floor.id : index === floorIndex) ? { ...row, ...patch } : row));
      after();
    };
    let adding = false;
    const shapes = rooms.map((room, index) => {
      if (!Array.isArray(room.polygon) || room.polygon.length < 3) return null;
      const points = room.polygon.map((p) => p.join(',')).join(' ');
      const center = room.polygon.reduce((sum, p) => [sum[0] + Number(p[0]) / room.polygon.length, sum[1] + Number(p[1]) / room.polygon.length], [0, 0]);
      return sv('g', { onclick: (event) => { if (adding) return; event.stopPropagation(); const m = App.modal({ title: room.name, body: h('p', null, `${room.type || ''} · ${room.room || ''} · ${room.memo || ''}`), footer: [h('button', { class: 'btn', type: 'button', onclick: () => {
        const name = prompt('장소 이름', room.name)?.trim(); if (!name) return; update({ rooms: rooms.map((item, i) => i === index ? { ...item, name } : item) }); m.close();
      } }, '이름 변경')] }); } },
        sv('polygon', { points, fill: '#e9ddff', stroke: '#7452ab', 'stroke-width': 3 }),
        sv('text', { x: center[0], y: center[1], 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 18, fill: '#27324c' }, room.name));
    });
    const paths = (floor.paths || []).filter((path) => Array.isArray(path.points) && path.points.length > 1).map((path) => sv('polyline', {
      points: path.points.map((p) => p.join(',')).join(' '), fill: 'none', stroke: '#aab7c9', 'stroke-width': 12, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    const features = facilities.map((f, index) => sv('g', { onclick: (event) => { if (adding) return; event.stopPropagation(); const m = App.modal({ title: f.name, body: h('p', null, f.memo || f.type || '시설'), footer: [
      h('button', { class: 'btn', type: 'button', onclick: () => { const name = prompt('마커 이름', f.name)?.trim(); if (!name) return; update({ features: facilities.map((item, i) => i === index ? { ...item, name } : item) }); m.close(); } }, '이름 변경'),
      h('button', { class: 'btn', type: 'button', onclick: () => { adding = { index }; m.close(); App.toast('지도에서 새 위치를 누르세요.'); } }, '위치 변경'),
      h('button', { class: 'btn danger', type: 'button', onclick: () => { if (!confirm('이 마커를 지울까요?')) return; update({ features: facilities.filter((_, i) => i !== index) }); m.close(); } }, '삭제')] }); } },
      sv('circle', { cx: f.x, cy: f.y, r: 9, fill: f.type === '안전시설' ? '#e44747' : '#2f6bff' }),
      sv('text', { x: Number(f.x) + 12, y: f.y, 'font-size': 15, fill: '#27324c' }, f.name)));
    const map = sv('svg', { viewBox: `0 0 ${w} ${height}`, role: 'img', 'aria-label': `${floor.name} 교내 지도`, onclick: (event) => {
      if (!adding) return;
      const point = map.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
      const at = point.matrixTransform(map.getScreenCTM().inverse());
      const x = Math.max(0, Math.min(w, Math.round(at.x))), y = Math.max(0, Math.min(height, Math.round(at.y)));
      if (typeof adding === 'object') update({ features: facilities.map((item, index) => index === adding.index ? { ...item, x, y } : item) });
      else { const name = prompt('새 마커 이름 (예: 소화기, 상담실)')?.trim(); if (name) update({ features: [...facilities, { name, type: '마커', x, y }] }); }
      adding = false;
    } },
        sv('rect', { x: 0, y: 0, width: w, height, fill: '#f7f9fc' }), paths, shapes, features);
    return h('details', { class: 'school-floor' }, h('summary', null, floor.name),
      h('div', { class: 'school-map-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => { adding = true; App.toast('지도에서 마커를 놓을 위치를 누르세요.'); } }, '＋ 마커 추가'),
        h('button', { class: 'btn', type: 'button', onclick: () => { const name = prompt('지도 이름', floor.name)?.trim(); if (name) update({ name }); } }, '지도 이름 변경')),
      map,
      rooms.some((room) => !Array.isArray(room.polygon) || room.polygon.length < 3)
        ? h('div', { class: 'school-doc-list' }, h('b', null, '위치를 확정하지 못한 장소'),
          rooms.filter((room) => !Array.isArray(room.polygon) || room.polygon.length < 3)
            .map((room) => h('p', null, `${room.name}${room.sourceCell ? ` · 원본 ${room.sourceCell}` : ''}`))) : null,
      h('p', { class: 'muted' }, `방 ${rooms.length}개 · 시설 ${facilities.length}개`));
  }
  function normalize(kind, row, index) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw Error(`${index + 1}번째 항목이 잘못됐어요.`);
    const fingerprint = JSON.stringify(row).split('').reduce((n, ch) => (Math.imul(n, 31) + ch.charCodeAt(0)) >>> 0, 0);
    const id = `school-${kind}-${fingerprint.toString(36)}`;
    if (kind === 'calendar') {
      if (!validDate(row.date) || !text(row.title)) throw Error(`${index + 1}번째 학사 일정의 날짜·이름을 확인해 주세요.`);
      if (row.dateEnd && (!validDate(row.dateEnd) || row.dateEnd < row.date)) throw Error(`${index + 1}번째 학사 일정의 마지막 날짜를 확인해 주세요.`);
      return { id, date: row.date, dateEnd: row.dateEnd || '', start: /^\d\d:\d\d$/.test(row.start || '') ? row.start : '09:00', end: /^\d\d:\d\d$/.test(row.end || '') ? row.end : '09:00', title: text(row.title), memo: [row.type, row.location, row.description, row.notes].filter(Boolean).join(' · ').slice(0, 3000), color: '#35c27a', checkable: false, sourceSchoolImport: true, sourceDetails: row };
    }
    if (kind === 'activities') {
      if ((row.date && !validDate(row.date)) || !text(row.title || row.section || row.subject)) throw Error(`${index + 1}번째 활동의 날짜·이름을 확인해 주세요.`);
      const attendance = row.attendance;
      const attendanceSummary = attendance ? `수업일수 ${attendance.schoolDays ?? '미기재'} · 결석 ${Object.values(attendance.absence || {}).filter((n) => numeric(n) !== null).reduce((sum, n) => sum + Number(n), 0)}일` : '';
      return { id, date: row.date || '', title: text(row.title || row.section || row.subject), subject: text(row.subject), type: text(row.type || row.section) || '기타', grade: row.grade || '', semester: row.semester || '', desc: [row.desc, attendanceSummary, row.role, row.achievement, row.evidence].filter(Boolean).join('\n').slice(0, 5000), cv: text(row.cv, 30000), cvDone: row.cvDone !== false, memo: text(row.memo, 3000), created: Date.now(), sourceSchoolImport: true, sourceDetails: row };
    }
    if (kind === 'grades') {
      const score = numeric(row.score), full = numeric(row.full) ?? 100;
      if (score === null) return { id, subject: text(row.subject || row.title || row.recordType), exam: text(row.exam), examDate: validDate(row.examDate) ? row.examDate : '', reportOnly: true, sourceSchoolImport: true, sourceDetails: row };
      if (!text(row.subject) || !Number.isFinite(score) || !Number.isFinite(full) || score < 0 || full <= 0 || score > full) throw Error(`${index + 1}번째 성적의 과목·점수를 확인해 주세요.`);
      return { id, subject: text(row.subject), exam: text(row.exam || row.assessmentName) || '기타', examDate: validDate(row.examDate) ? row.examDate : '', grade: Number(row.grade) || 1, semester: Number(row.semester) || 1, score, full,
        recordType: text(row.recordType), schoolYear: numeric(row.schoolYear), credits: numeric(row.credits), category: text(row.category), assessmentName: text(row.assessmentName), weightPercent: numeric(row.weightPercent), rawScore: numeric(row.rawScore),
        rank: numeric(row.rank), classRank: numeric(row.classRank), jointRank: numeric(row.jointRank), studentCount: numeric(row.studentCount), avg: numeric(row.avg ?? row.subjectAverage), stdDev: numeric(row.stdDev),
        achievement: text(row.achievement), achievementRate: numeric(row.achievementRate), standardScore: numeric(row.standardScore), percentile: numeric(row.percentile), mockRank: numeric(row.mockRank), mockParticipants: numeric(row.mockParticipants),
        achievementDistribution: row.achievementDistribution || null, achievementCutoffs: row.achievementCutoffs || null,
        ...Object.fromEntries(['A', 'B', 'C', 'D', 'E'].map((grade) => ['rate' + grade, numeric(row['rate' + grade] ?? row.achievementDistribution?.[grade])])),
        ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => ['mockRate' + (i + 1), numeric(row['mockRate' + (i + 1)])])),
        memo: text(row.memo, 3000), created: Date.now(), sourceSchoolImport: true, sourceDetails: row };
    }
    if (kind === 'map') {
      if (!text(row.building) || !text(row.floor) || !Array.isArray(row.rooms) || !Array.isArray(row.features)) throw Error(`${index + 1}번째 층의 건물·층·방·시설을 확인해 주세요.`);
      const width = Number(row.width), height = Number(row.height);
      if (!(width > 0 && width <= 10000 && height > 0 && height <= 10000)) throw Error(`${index + 1}번째 층의 지도 크기를 확인해 주세요.`);
      const point = (p) => Array.isArray(p) && p.length === 2 && p.every((n, i) => n !== '' && n != null && Number.isFinite(Number(n)) && Number(n) >= 0 && Number(n) <= (i ? height : width));
      for (const room of row.rooms) if (!room || !text(room.name) || (room.polygon != null && (!Array.isArray(room.polygon) || (room.polygon.length && (room.polygon.length < 3 || !room.polygon.every(point)))))) throw Error(`${index + 1}번째 층의 방 이름·윤곽 좌표를 확인해 주세요.`);
      for (const feature of row.features) if (!text(feature.name) || !point([feature.x, feature.y])) throw Error(`${index + 1}번째 층의 시설 이름·좌표를 확인해 주세요.`);
      if (row.paths && (!Array.isArray(row.paths) || row.paths.some((path) => !Array.isArray(path.points) || path.points.length < 2 || !path.points.every(point)))) throw Error(`${index + 1}번째 층의 복도·동선 좌표를 확인해 주세요.`);
      return { id, name: `${text(row.building)} ${text(row.floor)}`, building: text(row.building), floor: text(row.floor), width, height, rooms: row.rooms, features: row.features, paths: Array.isArray(row.paths) ? row.paths : [], sourceSheet: text(row.sourceSheet), sourcePage: row.sourcePage || null, sourceDetails: row };
    }
    if (kind === 'timetable') {
      const day = Number(row.day), period = Number(row.period);
      if (!Number.isInteger(day) || day < 1 || day > 5 || !Number.isInteger(period) || period < 1 || period > 14 || !text(row.subject)) throw Error(`${index + 1}번째 수업의 요일(월=1~금=5)·교시·과목을 확인해 주세요.`);
      if ((row.start || row.end) && (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.start || '') || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.end || '') || row.end <= row.start)) throw Error(`${index + 1}번째 수업의 시작·끝 시간을 확인해 주세요.`);
      return { day, period, subject: text(row.subject), teacher: text(row.teacher), room: text(row.room), start: text(row.start), end: text(row.end), sourceDetails: row };
    }
    throw Error('지원하지 않는 자료 종류예요.');
  }
  function importFile(after, expectedKind = null) {
    const input = h('input', { type: 'file', accept: '.json,application/json' });
    input.onchange = async () => {
      try {
        if (!input.files[0] || input.files[0].size > 8 * 1024 * 1024) throw Error('8MB 이하 JSON 파일을 선택해 주세요.');
        const data = JSON.parse(await input.files[0].text());
        if (data.format !== 'ClassHubSchoolData' || ![1, 2].includes(data.version) || !kinds[data.kind] || !Array.isArray(data.records) || data.records.length > 1500) throw Error('양식 종류·버전·항목 수를 확인해 주세요.');
        if (expectedKind && data.kind !== expectedKind) throw Error('이 화면에 맞는 종류의 양식 파일을 선택해 주세요.');
        const rows = data.records.map((row, i) => normalize(data.kind, row, i));
        if (!rows.length) throw Error('가져올 항목이 없어요.');
        const preview = h('div', { class: 'school-import-preview' }, h('p', null, `${kinds[data.kind]} ${rows.length}개를 가져옵니다. ${data.kind === 'timetable' ? '같은 요일·교시는 새 내용으로 바뀌고 다른 칸은 유지됩니다.' : '기존 기록은 유지합니다.'}`),
          data.version === 2 && Array.isArray(data.unresolved) && data.unresolved.length ? h('p', { class: 'hint' }, `날짜·위치를 확정하지 못한 항목 ${data.unresolved.length}개는 원문 확인용으로 보관합니다.`) : null,
          h('ul', null, rows.map((row) => h('li', null, row.date || row.examDate || row.day || '', ' ', row.title || row.subject || row.name))));
        const m = App.modal({ title: '가져오기 확인', wide: true, body: preview, footer: [h('button', { class: 'btn primary', type: 'button', onclick: () => {
          if (data.kind === 'timetable') {
            const tt = Store.get('timetable', { days: ['월', '화', '수', '목', '금'], periods: 6, cells: [], periodTimes: [] });
            const periods = Math.max(tt.periods || 6, ...rows.map((r) => r.period));
            tt.days = ['월', '화', '수', '목', '금']; tt.periods = periods;
            tt.cells = Array.from({ length: 5 }, (_, d) => Array.from({ length: periods }, (_, p) => tt.cells?.[d]?.[p] || null));
            tt.periodTimes = Array.from({ length: periods }, (_, p) => tt.periodTimes?.[p] || { start: '', end: '' });
            rows.forEach((r) => { tt.cells[r.day - 1][r.period - 1] = { subject: r.subject, teacher: r.teacher, room: r.room, sourceDetails: r.sourceDetails }; if (r.start && r.end) tt.periodTimes[r.period - 1] = { start: r.start, end: r.end }; });
            Store.set('timetable', tt);
          } else if (data.kind === 'grades') {
            const current = Store.get('grades', []), extras = Store.get('schoolReportExtras', []);
            Store.set('grades', [...current, ...rows.filter((r) => !r.reportOnly && !current.some((x) => x.id === r.id))]);
            Store.set('schoolReportExtras', [...extras, ...rows.filter((r) => r.reportOnly && !extras.some((x) => x.id === r.id))]);
          } else {
            const key = { calendar: 'events', grades: 'grades', activities: 'activities', map: 'schoolPlaces' }[data.kind];
            const old = Store.get(key, []); const ids = new Set(old.map((r) => r.id));
            Store.set(key, [...old, ...rows.filter((r) => !ids.has(r.id))]);
          }
          if (data.version === 2) {
            const packages = Store.get('schoolImportPackages', []);
            const packageId = `school-package-${data.kind}-${JSON.stringify({ source: data.source, records: data.records }).split('').reduce((n, ch) => (Math.imul(n, 31) + ch.charCodeAt(0)) >>> 0, 0).toString(36)}`;
            const entry = { id: packageId, kind: data.kind, source: data.source || {}, overview: data.overview || {}, unresolved: Array.isArray(data.unresolved) ? data.unresolved : [], importedAt: Date.now() };
            Store.set('schoolImportPackages', [...packages.filter((p) => p.id !== packageId), entry]);
          }
          m.close(); after(); App.toast('확인한 자료를 가져왔어요.');
        } }, '확인하고 가져오기')] });
      } catch (e) { App.toast(e.message || '파일을 읽지 못했어요.'); }
    };
    input.click();
  }
  async function addFile(after, fixedKind = null) {
    const input = h('input', { type: 'file', accept: 'image/*,.pdf,.hwp,.hwpx,.xlsx,.xls,application/pdf' });
    input.onchange = async () => {
      const file = input.files[0]; if (!file) return;
      if (file.size > 12 * 1024 * 1024) return App.toast('12MB 이하 파일을 선택해 주세요.');
      const kind = fixedKind || prompt('자료 종류를 입력해 주세요: 지도 또는 학사 일정', '지도');
      if (!['지도', '학사 일정'].includes(kind)) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const id = uid();
        try { await Store.putImg('school-' + id, { data: reader.result, type: file.type }); Store.set('schoolFiles', [{ id, kind, name: file.name, created: Date.now() }, ...saved()]); after(); }
        catch (_) { App.toast('파일 저장에 실패했어요.'); }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }
  function tools(kind, after = () => App.refresh()) {
    const buttons = [
      h('button', { class: 'btn', type: 'button', onclick: () => App.download(`ClassHub-${kind}-양식.json`, new Blob([JSON.stringify(makeTemplate(kind), null, 2)], { type: 'application/json' })) }, `${kinds[kind]} AI 정리 양식 받기`),
      h('button', { class: 'btn', type: 'button', onclick: () => importFile(after, kind) }, '정리된 JSON 가져오기')
    ];
    if (kind === 'calendar' || kind === 'map') buttons.unshift(h('button', { class: 'btn', type: 'button', onclick: () => addFile(after, kind === 'map' ? '지도' : '학사 일정') }, '원본 파일 저장'));
    const files = kind === 'calendar' || kind === 'map' ? saved().filter((item) => item.kind === (kind === 'map' ? '지도' : '학사 일정')) : [];
    const packages = Store.get('schoolImportPackages', []).filter((item) => item.kind === kind);
    return h('details', { class: 'school-import-tools' }, h('summary', null, `${kinds[kind]} 자료 가져오기`),
      h('p', { class: 'hint' }, '원본과 양식을 원하는 외부 AI에 직접 보내 정리한 JSON을 확인한 뒤 가져오세요.'),
      h('div', { class: 'set-row set-btns' }, buttons),
      packages.length ? h('details', { class: 'school-source-detail' }, h('summary', null, `가져온 원본 요약 ${packages.length}건`), packages.map((item) =>
        h('details', null, h('summary', null, item.source?.documentTitle || kinds[kind]),
          h('pre', null, JSON.stringify({ source: item.source, overview: item.overview, unresolved: item.unresolved }, null, 2))))) : null,
      files.length ? h('div', { class: 'school-doc-list' }, files.map((item) => h('div', { class: 'school-file-row' }, h('b', null, item.name),
        h('button', { class: 'btn', type: 'button', onclick: async () => { const file = await Store.getImg('school-' + item.id); if (!file) return App.toast('이 기기에 원본 파일이 없어요.'); const blob = await (await fetch(file.data)).blob(); const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); } }, '보기'),
        h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (!confirm('이 파일을 삭제할까요?')) return; await Store.delImg('school-' + item.id); Store.set('schoolFiles', saved().filter((x) => x.id !== item.id)); after(); } }, '삭제')))) : null);
  }
  function renderMap(root) {
    const panel = h('section', { class: 'panel' });
    const draw = () => panel.replaceChildren(h('h1', { class: 'page-title' }, '학교 지도'), tools('map', draw),
      h('div', { class: 'school-places' }, Store.get('schoolPlaces', []).length
        ? Store.get('schoolPlaces', []).map((floor, index) => floorView(floor, draw, index))
        : h('p', { class: 'empty-box' }, '지도를 가져오면 층별 지도가 여기에 나타나요.')));
    root.append(panel); draw();
  }
  function render(root) {
    const content = h('div', { class: 'school-tab-content' });
    let active = 'calendar';
    const kindSelect = h('select', { 'aria-label': 'AI 정리 양식 종류' }, Object.entries(kinds).map(([value, label]) => h('option', { value }, label)));
    const fileRow = (item) => h('div', { class: 'school-file-row' }, h('b', null, item.name),
      h('button', { class: 'btn', type: 'button', onclick: async () => { const file = await Store.getImg('school-' + item.id); if (!file) return App.toast('이 기기에 원본 파일이 없어요.'); const blob = await (await fetch(file.data)).blob(); const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); } }, '보기'),
      h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (!confirm('이 파일을 삭제할까요?')) return; await Store.delImg('school-' + item.id); Store.set('schoolFiles', saved().filter((x) => x.id !== item.id)); draw(); } }, '삭제'));
    const draw = () => {
      const tabs = h('div', { class: 'school-tabs' }, [['calendar', '학사 일정'], ['map', '학교 지도'], ['reports', '성적표·생기부']].map(([key, label]) =>
        h('button', { type: 'button', class: 'btn' + (key === active ? ' primary' : ''), onclick: () => { active = key; draw(); } }, label)));
      const files = active === 'reports' ? [] : saved().filter((item) => item.kind === (active === 'map' ? '지도' : '학사 일정'));
      const fileList = h('div', { class: 'school-doc-list' }, files.length ? files.map(fileRow) : h('p', { class: 'muted' }, '이 기기에 저장한 파일이 없어요.'));
      const details = active === 'calendar'
        ? h('div', { class: 'school-calendar-list' }, Store.get('events', []).filter((row) => row.sourceSchoolImport).map((row) => h('button', { class: 'btn', type: 'button', onclick: () => Calendar.showEvent(row, draw) }, `${row.date}${row.dateEnd ? ' ~ ' + row.dateEnd : ''} · ${row.title}`)))
        : active === 'map'
          ? h('div', { class: 'school-places' }, Store.get('schoolPlaces', []).map(floorView))
          : h('div', { class: 'school-source-list' }, [...(Settings.protectedTab('grades') ? [] : [...Store.get('grades', []), ...Store.get('schoolReportExtras', [])]), ...(Settings.protectedTab('activities') ? [] : Store.get('activities', []))].filter((row) => row.sourceSchoolImport && row.sourceDetails || row.reportOnly).map((row) =>
            h('details', null, h('summary', null, `${row.subject || ''} ${row.title || row.exam || ''} ${row.date || row.examDate || ''}`), h('pre', null, JSON.stringify(row.sourceDetails, null, 2)))));
      content.replaceChildren(tabs, active === 'reports' ? null : fileList, details);
    };
    root.append(h('section', { class: 'panel' }, h('h1', { class: 'page-title' }, '학교 자료'),
      h('div', { class: 'set-row set-btns' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => addFile(draw) }, '지도·학사 일정 파일 저장'),
        kindSelect,
        h('button', { class: 'btn', type: 'button', onclick: () => App.download(`ClassHub-${kindSelect.value}-양식.json`, new Blob([JSON.stringify(makeTemplate(kindSelect.value), null, 2)], { type: 'application/json' })) }, 'AI 정리 양식 받기'),
        h('button', { class: 'btn', type: 'button', onclick: () => importFile(() => App.refresh()) }, '정리된 JSON 가져오기')),
      h('p', { class: 'hint' }, '원본 자료와 양식 파일을 원하는 AI에 직접 보내 정리한 뒤, 완성된 JSON을 가져오세요. 내용을 확인한 후 저장합니다. 원본 파일은 이 기기에만 저장됩니다.'),
      content));
    draw();
  }
  return { renderMap, tools, normalize, makeTemplate };
})();
App.registerView('schoolmap', { label: '학교 지도', icon: 'schoolmap', render: SchoolData.renderMap });
