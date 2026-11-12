// 학교 자료와 사용자가 외부 AI로 정리한 JSON 파일 가져오기.
const SchoolData = (() => {
  const kinds = { calendar: '학사 일정', map: '교내 지도', timetable: '시간표', grades: '성적표', activities: '생기부·활동' };
  const saved = () => Store.get('schoolFiles', []);
  const samples = {
    calendar: [
      { recordType: 'event', date: '2026-04-20', dateEnd: '2026-04-24', title: '시험기간 예시', type: '시험', grades: [1, 2, 3], allDay: true, start: '', end: '', location: '', instructionDayEffect: 'normal', originalText: '시험기간 (20~24)', sourcePage: 1, sourceRow: '4월 4주' },
      { recordType: 'event', date: '2026-09-15', dateEnd: '', title: '재량휴업 예시', type: '휴업', grades: [1, 2, 3], allDay: true, instructionDayEffect: 'no-class', originalText: '재량휴업(15)', sourcePage: 2, sourceRow: '9월 3주' }
    ],
    map: [{ building: '예시동', floor: '2층', floorImageFile: '예시동-2층.png', width: 1000, height: 700, sourceSheet: '배치도',
      rooms: [{ name: '2학년 3반', type: '일반교실', sourceCell: 'D7', polygon: [] }],
      features: [{ name: '계단', type: '이동시설', x: 300, y: 200, sourceCell: 'D5' }], unresolved: [] }],
    timetable: [{ day: 1, period: 1, subject: '과목', teacher: '', room: '', start: '09:00', end: '09:50', effectiveStart: '2026-03-02', effectiveEnd: '2026-07-21', semester: '1학기', weekType: '', notes: '', sourcePage: 1 }],
    grades: [
      { recordType: 'assessment', courseKey: '2026-1-1-example', schoolYear: 2026, grade: 1, semester: 1, exam: '1회고사', examDate: '', subject: '예시 과목', courseArea: '보통교과', credits: 3, category: '지필', assessmentName: '1회고사', weightPercent: 30, full: 100, score: 75, originalText: '', sourcePage: 1 },
      { recordType: 'courseResult', courseKey: '2026-1-1-example', schoolYear: 2026, grade: 1, semester: 1, exam: '학기말', subject: '예시 과목', courseArea: '보통교과', credits: 3, score: 84.5, full: 100, rawScore: 85, achievement: 'B', achievementDistribution: { A: 10, B: 25, C: 30, D: 20, E: 15 }, rankGrade: 2, classRank: 25, jointRank: 2, studentCount: 200, subjectAverage: 72, achievementBands: { A: '90% 이상', B: '80% 이상~90% 미만', C: '70% 이상~80% 미만', D: '60% 이상~70% 미만', E: '40% 이상~60% 미만' }, sourcePage: 1 },
      { recordType: 'examResult', courseKey: '2026-1-1-example', schoolYear: 2026, grade: 1, semester: 1, exam: '1학기 중간고사', subject: '예시 과목', score: 82, full: 100, rawScore: 82, classRank: null, jointRank: null, studentCount: null, subjectAverage: null, sourcePage: 1 },
      { recordType: 'completion', schoolYear: 2026, grade: 1, semester: 1, subject: '진로와 직업', credits: 2, completed: true, completionMark: 'P', score: null, sourcePage: 1 },
      { recordType: 'mockExam', schoolYear: 2026, grade: 1, exam: '예시 모의고사', examDate: '', subject: '예시 과목', area: '예시 영역', electiveSubject: '', score: null, full: 100, standardScore: null, standardScoreRange: '', percentile: null, rank: null, schoolRank: '', schoolParticipants: null, nationalRank: '', nationalParticipants: null, nationalCumulativePercent: null, mockGradeDistribution: { '1': null, '2': null, '3': null }, standardScoreAnalysis: { topThreeMean: null, bestThreeMean: null, nationalMean: null }, answerSheet: [{ number: 1, markedAnswer: '', correctAnswer: '', result: '', points: null, difficulty: '' }], sourcePage: 1 },
      { recordType: 'analysis', schoolYear: 2026, grade: 1, exam: '1회고사', subject: '공통국어1', score: null, statistics: {}, originalText: '', sourcePage: 1 },
      { recordType: 'errorSheet', schoolYear: 2026, grade: 1, exam: '1회고사', subject: '공통국어1', score: null, questions: [{ number: 1, correctAnswer: '', studentAnswer: '', correct: null, points: null }], sourcePage: 1 }
    ],
    activities: [
      { recordType: 'activity', section: '세부능력및특기사항', sourceSection: '공통국어1 세부능력 및 특기사항', schoolYear: 2026, grade: 1, semester: 1, title: '발표 자료 분석 활동', subject: '공통국어1', type: 'etc', desc: '원문에서 확인되는 실제 활동·역할·결과를 짧게 정리', cv: '해당 활동을 뒷받침하는 원문 부분만 인용', sourceExcerpt: '원문의 관련 구절', reportStatus: 'provided', sourcePage: 1 },
      { recordType: 'narrative', section: '세부능력및특기사항', schoolYear: 2026, grade: 1, semester: 1, subjects: ['과목명'], title: '과목별 세부능력 및 특기사항', cv: '원문 전체를 생략 없이 기록', reportStatus: 'provided', sourcePage: 1 },
      { recordType: 'attendance', section: '출결상황', schoolYear: 2026, grade: 1, title: '1학년 출결상황', attendance: { schoolDays: 191, absence: { illness: 0, unexcused: 0, other: 0 }, late: { illness: 0, unexcused: 0, other: 0 }, earlyLeave: { illness: 0, unexcused: 0, other: 0 }, classExit: { illness: 0, unexcused: 0, other: 0 }, remarks: '' }, sourcePage: 1 },
      { recordType: 'award', section: '수상경력', schoolYear: 2026, grade: 1, semester: 2, title: '상 이름', award: { rank: '', date: '2026-01-05', institution: '', eligibleGroup: '', eligibleCount: null }, sourcePage: 1 },
      { recordType: 'narrative', section: '창의적체험활동', subSection: '자율·자치활동', schoolYear: 2026, grade: 1, title: '자율·자치활동 특기사항', hours: null, cv: '원문 전체', reportStatus: 'provided', sourcePage: 1 },
      { recordType: 'volunteer', section: '봉사활동실적', schoolYear: 2026, grade: 1, title: '봉사활동 예시', date: '2026-05-01', dateEnd: '', organization: '', activity: '', hours: 2, cumulativeHours: 2, sourcePage: 1 },
      { recordType: 'courseRecord', section: '교과학습발달상황', schoolYear: 2026, grade: 1, semester: 1, title: '과목명', subject: '과목명', courseArea: '보통교과', credits: 3, rawScore: null, subjectAverage: null, achievement: '', achievementDistribution: {}, classRank: null, studentCount: null, remarks: '', reportStatus: 'provided', sourcePage: 1 }
    ]
  };
  const guides = {
    calendar: '학사연도는 3월부터 다음 해 2월까지 보세요. 주요 행사 내역에서 행사마다 record 1개를 만드세요. 같은 주에 여러 일정이 있으면 분리하고 (22~28), (3.26~4.1)처럼 월을 넘는 기간을 정확히 해석하세요. 학년 대상, 수업 여부, 원문, 월/주·쪽수를 기록하세요. 학년별 월 수업 일수, 학기 합계와 연간 합계는 overview에 기록하세요. 날짜가 미정인 행사는 unresolved에 넣고 날짜를 추측하지 마세요. 아무 행사도 없는 날짜를 일정으로 만들지 마세요.',
    map: '원본에서 층별 지도 영역을 정확히 잘라 각각 별도 이미지(PNG 등)로 내보내세요. 글자가 읽히도록 회전·기울기·대비·해상도를 개선하되 원본에 없는 선이나 시설을 만들지 마세요. JSON은 층 이름, 해당 이미지 파일 이름(floorImageFile), 판독한 방·시설 목록과 원본 위치의 근거만 담습니다. 정확한 지도 좌표를 판독했을 때만 rooms.polygon 또는 features의 x,y를 넣으세요. 불확실한 장소·소화기·비상구는 unresolved에 남기고 추측하지 마세요. 앱에서 각 층 이미지는 따로 첨부합니다.',
    timetable: '모든 요일·교시와 적용 시작/종료 날짜를 기록하세요. 과목·교사·교실·시각·학기·격주 여부를 보존하세요. 원본의 빈 교시는 subject를 비워 두어도 됩니다. 시작 시각만 있고 종료 시각이 없으면 end를 빈 문자열로 두세요. 원본에 없는 시간을 추측하지 마세요.',
    grades: '학년도·학년·학기·시험 단위로 기록하세요. 같은 학기 과목의 평가 항목·고사 결과·학기말 결과에는 같은 courseKey를 쓰세요. 각 지필·수행 항목은 assessment, 학기 합계는 courseResult, 고사별 결과는 examResult, 이수 과목은 completion으로 따로 만드세요. 합계와 반올림 원점수, 성취도별 분포율과 성취율 구간 원문을 보존하세요. 석차등급은 rankGrade(1~5), 석차는 classRank, 동석차 인원은 jointRank로 서로 구분하고 원문에 있는 값만 기록하세요. 수강자 수와 과목 평균도 각각 보존하세요. 체육·예술의 A~C, 교양의 P처럼 표에 없는 등급은 만들지 마세요. 모의고사는 영역·선택과목별 mockExam으로 나누고 원점수·표준점수·백분위·등급, 학교/전국 석차와 응시자 수, 누적 백분율, 보통학력 비교표, 표준점수 분석, 문항별 정오답을 원문대로 기록하세요. 빈 칸은 0으로 바꾸지 말고 null로 두세요.',
    activities: '학교생활기록부를 통째 활동 하나로 복사하지 마세요. 세특과 창의적체험활동 문단에서 원문으로 확인되는 서로 다른 실제 활동마다 recordType=activity를 별도로 만들고 title, subject 또는 subjects 배열, 역할·행동·결과를 담은 desc, 근거 sourceExcerpt, 원문 섹션 sourceSection을 기록하세요. type은 원문에서 수행평가임을 명시한 때만 perf, 자율 auto, 동아리 club, 봉사 volunteer, 진로 career, 독서 reading으로 기록하고 종류를 확인할 수 없으면 etc로 두세요. 세특에 나온 활동을 수행평가로 추측하지 마세요. 과목의 성취도 A/B/C나 단순 이수 정보는 활동이 아니므로 courseRecord로 분리하세요. 출결은 attendance, 수상은 award, 봉사 실적은 volunteer로 분리하고 원문 전체는 narrative로 별도 보존하세요. 여러 과목을 묶은 세특은 subjects 배열로 연결하세요. 낯선 과목·표현·약어는 공식 교육과정이나 학교 자료를 검색해 확인하고, 확인되지 않으면 unresolved에 넣어 추측하지 마세요. 0, 빈 칸, 해당 학년 기록 미제공은 다르므로 reportStatus에 provided/notProvided/empty를 기록하고 미제공 값을 0으로 만들지 마세요.'
  };
  const fieldGuides = {
    calendar: { overview: 'academicYear, semesterInstructionDays.first/second의 학년별 일수, monthlyInstructionDays의 {month, byGrade}, annualInstructionDays, weeklyRows의 원본 월/주·날짜 칸·주요 행사 원문을 기록', records: '날짜가 확정된 행사만 기록. date/dateEnd, title, type, grades, instructionDayEffect, originalText, sourcePage, sourceRow', unresolved: '예: 새학년 준비기간(미정)처럼 날짜가 없는 행사는 {title, originalText, reason, sourcePage}로 기록' },
    map: { records: '층마다 하나. building, floor, floorImageFile, width, height를 기록. 방과 시설 좌표는 선택 사항', floorImageFile: '외부 AI가 별도 생성한 해당 층 이미지 파일 이름. JSON과 함께 사용자가 층별로 첨부', rooms: '확인한 장소의 이름·종류·원본 근거. 좌표를 모르면 polygon=[]', features: '위치가 확인된 시설만 x,y를 기록. 위치를 모르면 unresolved에 기록', unresolved: '확인되지 않은 시설·글씨·층·위치를 원본 근거와 함께 기록' },
    timetable: { records: '요일 day(월=1~금=5), 교시 period, 과목, 교사, 교실, 수업 시작/끝, effectiveStart/effectiveEnd' },
    grades: { assessment: '지필/수행 각각의 이름, 반영비율, 만점, 받은 점수', courseResult: '학기 과목별 합계·원점수·성취도·성취도 분포·석차등급(rankGrade)·석차(classRank)·동석차 인원(jointRank)·수강자 수·과목평균·성취율 구간. 없는 값은 null', examResult: '중간/기말 등 고사별 과목 합계와 석차등급(rankGrade)·석차(classRank)·동석차·평균', completion: '교양과목 등의 학점·이수 여부·P 표기', mockExam: '영역(area)·선택과목·원점수(score/full)·표준점수와 범위·백분위·등급(rank)·학교/전국 석차와 응시자 수·누적 백분율·등급별 비율(mockGradeDistribution)·표준점수 분석(standardScoreAnalysis)·문항별 답안(answerSheet). 이미지에 없는 값은 null', analysis: '표준점수 분석과 원문 통계', errorSheet: '고사별 정오답·문항 번호·정답·선택 답·배점. 긴 목록은 원문 그대로 보존' },
    activities: { activity: '문단에서 확인한 실제 활동 하나마다 record 하나. title, subject, type, desc, sourceExcerpt, sourceSection, grade, semester를 기록', narrative: '과목별 세특, 창의적체험활동 하위영역, 행동특성 등의 cv에 원문 전체 보존. 활동 목록에 자동으로 섞지 않음', attendance: '학년별 수업일수 및 결석·지각·조퇴·결과의 질병/미인정/기타 건수와 특기사항', award: '수상명·등급·날짜·수여기관·참가대상·참가인원', others: '자격증·독서·봉사·학교스포츠클럽·인적/학적 사항은 각 영역을 별도 record로 기록하고 원문 추가 열 보존' }
  };
  const makeTemplate = (kind) => ({ format: 'ClassHubSchoolData', version: 2, kind,
    instructions: '이 파일과 원본 자료를 사용자가 선택한 외부 AI에 함께 전달하세요. records에는 원본의 실제 항목을 빠짐없이 넣으세요. examples는 필드 설명용이며 records에 복사하지 마세요. 낯선 과목명, 약어, 표기나 제도를 만나면 공식 교육과정·학교·나이스 자료를 검색해 근거를 확인하세요. 확인할 수 없으면 unresolved에 원문과 확인할 점을 기록하고 추측하지 마세요. 원본에서 확인되지 않는 값은 빈 문자열 또는 null로 두세요. 원문의 추가 열은 해당 record에 원래 이름으로 보존하세요. 날짜는 YYYY-MM-DD, 시간은 HH:MM입니다. 완성된 UTF-8 JSON 파일만 반환하세요.',
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
  function gridFallback(floor) {
    const source = floor.sourceDetails || floor;
    const columns = source.gridLayout?.columns, rows = source.gridLayout?.rows, cells = source.gridCells;
    if (!Array.isArray(columns) || !Array.isArray(rows) || !Array.isArray(cells) || !columns.length || !rows.length) return null;
    const colIndex = new Map(columns.map((column, i) => [String(column.key).toUpperCase(), i]));
    const rowIndex = new Map(rows.map((row, i) => [Number(row.number), i]));
    const xs = [0], ys = [0];
    columns.forEach((column) => xs.push(xs.at(-1) + Math.max(8, Number(column.width || 0) * 7 + 5)));
    rows.forEach((row) => ys.push(ys.at(-1) + Math.max(8, Number(row.height || 0) * 4 / 3)));
    const cellAt = (address) => {
      const found = /^([A-Z]+)(\d+)$/.exec(String(address || '').toUpperCase());
      return found ? [colIndex.get(found[1]), rowIndex.get(Number(found[2]))] : [];
    };
    const shapes = cells.map((cell) => {
      const [col, row] = cellAt(cell.cell);
      if (col == null || row == null) return null;
      const span = String(cell.mergedRange || '').split(':');
      if (span.length === 2 && span[0] !== cell.cell) return null;
      const [endCol, endRow] = span.length === 2 ? cellAt(span[1]) : [col, row];
      if (endCol == null || endRow == null) return null;
      const x = xs[col], y = ys[row], width = xs[endCol + 1] - x, height = ys[endRow + 1] - y;
      const label = text(cell.text, 200);
      return sv('g', null,
        sv('rect', { x, y, width, height, fill: /^#[0-9a-f]{6}$/i.test(cell.fill || '') ? cell.fill : label ? '#fff' : '#f8fafc', stroke: cell.border ? '#8898ab' : '#e2e8f0', 'stroke-width': cell.border ? 1.1 : .5 }),
        label ? sv('text', { x: x + width / 2, y: y + height / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': Math.max(7, Math.min(14, height * .45, width / Math.max(1, label.length) * 1.6)), fill: '#29374b' }, label.slice(0, 24), sv('title', null, label)) : null);
    });
    return sv('g', { class: 'school-grid-fallback', transform: `scale(${floor.width / xs.at(-1)} ${floor.height / ys.at(-1)})` }, shapes);
  }
  function floorView(floor, after = () => {}, floorIndex = -1) {
    const w = floor.width || 1000, height = floor.height || 700;
    const rooms = floor.rooms || [], facilities = floor.features || [];
    const imageKey = `school-floor-${floor.id || floorIndex}`;
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
    const imageLayer = sv('image', { x: 0, y: 0, width: w, height, preserveAspectRatio: 'none' });
    Store.getImg(imageKey).then((file) => { if (file?.data) { imageLayer.setAttribute('href', file.data); map.classList.add('has-floor-image'); } });
    const map = sv('svg', { viewBox: `0 0 ${w} ${height}`, role: 'img', 'aria-label': `${floor.name} 교내 지도`, onclick: (event) => {
      if (!adding) return;
      const point = map.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
      const at = point.matrixTransform(map.getScreenCTM().inverse());
      const x = Math.max(0, Math.min(w, Math.round(at.x))), y = Math.max(0, Math.min(height, Math.round(at.y)));
      if (typeof adding === 'object') update({ features: facilities.map((item, index) => index === adding.index ? { ...item, x, y } : item) });
      else { const name = prompt('새 마커 이름 (예: 소화기, 상담실)')?.trim(); if (name) update({ features: [...facilities, { name, type: '마커', x, y }] }); }
      adding = false;
    } },
        sv('rect', { x: 0, y: 0, width: w, height, fill: '#f7f9fc' }), imageLayer, shapes.every((shape) => !shape) ? gridFallback(floor) : null, paths, shapes, features);
    return h('details', { class: 'school-floor' }, h('summary', null, floor.name),
      h('div', { class: 'school-map-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => {
          const input = h('input', { type: 'file', accept: 'image/*' });
          input.onchange = () => { const file = input.files[0]; if (!file) return; if (file.size > 12 * 1024 * 1024) return App.toast('12MB 이하 층 이미지를 선택해 주세요.'); const reader = new FileReader(); reader.onload = async () => { await Store.putImg(imageKey, { data: reader.result, type: file.type }); after(); }; reader.readAsDataURL(file); };
          input.click();
        } }, '층 이미지 첨부'),
        h('button', { class: 'btn', type: 'button', onclick: () => { adding = true; App.toast('지도에서 마커를 놓을 위치를 누르세요.'); } }, '＋ 마커 추가'),
        h('button', { class: 'btn', type: 'button', onclick: () => { const name = prompt('지도 이름', floor.name)?.trim(); if (name) update({ name }); } }, '지도 이름 변경')),
      map,
      rooms.some((room) => !Array.isArray(room.polygon) || room.polygon.length < 3)
        ? h('div', { class: 'school-doc-list' }, h('b', null, '위치를 확정하지 못한 장소'),
          rooms.filter((room) => !Array.isArray(room.polygon) || room.polygon.length < 3)
            .map((room) => h('p', null, `${room.name}${room.sourceCell ? ` · 원본 ${room.sourceCell}` : ''}`))) : null,
      h('p', { class: 'muted' }, `${floor.floorImageFile ? `이미지 파일 ${floor.floorImageFile} · ` : ''}방 ${rooms.length}개 · 시설 ${facilities.length}개 · 첨부 이미지는 이 기기에 저장돼요.`));
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
      const absenceValues = Object.values(attendance?.absence || {}).filter((n) => numeric(n) !== null);
      const attendanceSummary = attendance ? `수업일수 ${attendance.schoolDays ?? '미기재'} · 결석 ${absenceValues.length ? absenceValues.reduce((sum, n) => sum + Number(n), 0) + '일' : '미기재'}` : '';
      const typeName = text(row.type);
      let type = ({ 수행평가: 'perf', 자율: 'auto', 동아리: 'club', 봉사: 'volunteer', 진로: 'career', 독서: 'reading', 기타: 'etc' })[typeName] || (['perf', 'auto', 'club', 'volunteer', 'career', 'reading', 'etc'].includes(typeName) ? typeName : row.recordType === 'volunteer' ? 'volunteer' : 'etc');
      if (type === 'perf' && !/수행평가|수행 평가/.test([row.title, row.desc, row.assessmentName, row.sourceExcerpt].join(' '))) type = 'etc';
      const subjects = Array.isArray(row.subjects) ? row.subjects.map((name) => text(name)).filter(Boolean) : text(row.subject) ? [text(row.subject)] : [];
      return { id, date: row.date || '', title: text(row.title || row.section || row.subject), subject: subjects[0] || '', subjects, type, recordType: text(row.recordType), grade: row.grade || '', semester: row.semester || '', reportStatus: text(row.reportStatus), desc: [row.desc, attendanceSummary, row.role, row.evidence].filter(Boolean).join('\n').slice(0, 5000), cv: text(row.cv, 30000), cvDone: row.cvDone === true, memo: text(row.memo, 3000), created: Date.now(), sourceSchoolImport: true, sourceDetails: row };
    }
    if (kind === 'grades') {
      const score = numeric(row.score), full = numeric(row.full) ?? 100;
      if (score === null) return { id, subject: text(row.subject || row.title || row.recordType), exam: text(row.exam), examDate: validDate(row.examDate) ? row.examDate : '', reportOnly: true, sourceSchoolImport: true, sourceDetails: row };
      if (!text(row.subject) || !Number.isFinite(score) || !Number.isFinite(full) || score < 0 || full <= 0 || score > full) throw Error(`${index + 1}번째 성적의 과목·점수를 확인해 주세요.`);
      return { id, subject: text(row.subject), exam: text(row.exam || row.assessmentName) || '기타', examDate: validDate(row.examDate) ? row.examDate : '', grade: Number(row.grade) || 1, semester: Number(row.semester) || 1, score, full,
        recordType: text(row.recordType), courseKey: text(row.courseKey), courseArea: text(row.courseArea), schoolYear: numeric(row.schoolYear), credits: numeric(row.credits), category: text(row.category), assessmentName: text(row.assessmentName), weightPercent: numeric(row.weightPercent), rawScore: numeric(row.rawScore),
        rank: row.recordType === 'mockExam' ? numeric(row.rank) : numeric(row.rankGrade ?? row.gradeLevel ?? row.gradeRank ?? row['석차등급']), classRank: numeric(row.classRank ?? row.rankPosition ?? row['석차']), jointRank: numeric(row.jointRank), studentCount: numeric(row.studentCount), avg: numeric(row.avg ?? row.subjectAverage), stdDev: numeric(row.stdDev),
        achievement: text(row.achievement), achievementRate: numeric(row.achievementRate), standardScore: numeric(row.standardScore), percentile: numeric(row.percentile), mockRank: numeric(row.mockRank), mockParticipants: numeric(row.mockParticipants),
        area: text(row.area), electiveSubject: text(row.electiveSubject), standardScoreRange: text(row.standardScoreRange), schoolRank: text(row.schoolRank), schoolParticipants: numeric(row.schoolParticipants), nationalRank: text(row.nationalRank), nationalParticipants: numeric(row.nationalParticipants), nationalCumulativePercent: numeric(row.nationalCumulativePercent), mockGradeDistribution: row.mockGradeDistribution || null, standardScoreAnalysis: row.standardScoreAnalysis || null, answerSheet: Array.isArray(row.answerSheet) ? row.answerSheet : [],
        achievementDistribution: row.achievementDistribution || null, achievementCutoffs: row.achievementCutoffs || null, achievementBands: row.achievementBands || null,
        ...Object.fromEntries(['A', 'B', 'C', 'D', 'E'].map((grade) => ['rate' + grade, numeric(row['rate' + grade] ?? row.achievementDistribution?.[grade])])),
        ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => ['mockRate' + (i + 1), numeric(row['mockRate' + (i + 1)])])),
        memo: text(row.memo, 3000), created: Date.now(), sourceSchoolImport: true, sourceDetails: row };
    }
    if (kind === 'map') {
      if (!text(row.floor)) throw Error(`${index + 1}번째 층의 층 이름을 확인해 주세요.`);
      const rooms = Array.isArray(row.rooms) ? row.rooms : [], features = Array.isArray(row.features) ? row.features : [];
      const width = Number(row.width || 1000), height = Number(row.height || 700);
      if (!(width > 0 && width <= 10000 && height > 0 && height <= 10000)) throw Error(`${index + 1}번째 층의 지도 크기를 확인해 주세요.`);
      const point = (p) => Array.isArray(p) && p.length === 2 && p.every((n, i) => n !== '' && n != null && Number.isFinite(Number(n)) && Number(n) >= 0 && Number(n) <= (i ? height : width));
      for (const room of rooms) if (!room || !text(room.name) || (room.polygon != null && (!Array.isArray(room.polygon) || (room.polygon.length && (room.polygon.length < 3 || !room.polygon.every(point)))))) throw Error(`${index + 1}번째 층의 방 이름·윤곽 좌표를 확인해 주세요.`);
      for (const feature of features) if (!text(feature.name) || !point([feature.x, feature.y])) throw Error(`${index + 1}번째 층의 시설 이름·좌표를 확인해 주세요.`);
      if (row.paths && (!Array.isArray(row.paths) || row.paths.some((path) => !Array.isArray(path.points) || path.points.length < 2 || !path.points.every(point)))) throw Error(`${index + 1}번째 층의 복도·동선 좌표를 확인해 주세요.`);
      return { id, name: [text(row.building), text(row.floor)].filter(Boolean).join(' '), building: text(row.building), floor: text(row.floor), floorImageFile: text(row.floorImageFile), width, height, rooms, features, paths: Array.isArray(row.paths) ? row.paths : [], sourceSheet: text(row.sourceSheet), sourcePage: row.sourcePage || null, sourceDetails: row };
    }
    if (kind === 'timetable') {
      const day = Number(row.day), period = Number(row.period);
      if (!Number.isInteger(day) || day < 1 || day > 5 || !Number.isInteger(period) || period < 1 || period > 14) throw Error(`${index + 1}번째 수업의 요일(월=1~금=5)·교시를 확인해 주세요.`);
      const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
      if ((row.start && !timePattern.test(row.start)) || (row.end && !timePattern.test(row.end)) || (row.start && row.end && row.end <= row.start)) throw Error(`${index + 1}번째 수업의 시작·끝 시간을 확인해 주세요.`);
      return { day, period, subject: text(row.subject), teacher: text(row.teacher), room: text(row.room), start: text(row.start), end: text(row.end), sourceDetails: row };
    }
    throw Error('지원하지 않는 자료 종류예요.');
  }
  function importFile(after, expectedKind = null, targetId = null) {
    const input = h('input', { type: 'file', accept: '.json,application/json' });
    input.onchange = async () => {
      try {
        if (!input.files[0] || input.files[0].size > 8 * 1024 * 1024) throw Error('8MB 이하 JSON 파일을 선택해 주세요.');
        const data = JSON.parse(await input.files[0].text());
        if (data.format !== 'ClassHubSchoolData' || ![1, 2].includes(data.version) || !kinds[data.kind] || !Array.isArray(data.records) || data.records.length > 1500) throw Error('양식 종류·버전·항목 수를 확인해 주세요.');
        if (expectedKind && data.kind !== expectedKind) throw Error('이 화면에 맞는 종류의 양식 파일을 선택해 주세요.');
        const packageId = `school-package-${data.kind}-${JSON.stringify({ source: data.source, records: data.records }).split('').reduce((n, ch) => (Math.imul(n, 31) + ch.charCodeAt(0)) >>> 0, 0).toString(36)}`;
        const rows = data.records.map((row, i) => ({ ...normalize(data.kind, row, i), sourcePackageId: packageId }));
        if (!rows.length) throw Error('가져올 항목이 없어요.');
        const preview = h('div', { class: 'school-import-preview' }, h('p', null, `${kinds[data.kind]} ${rows.length}개를 가져옵니다. ${data.kind === 'timetable' ? '같은 요일·교시는 새 내용으로 바뀌고 다른 칸은 유지됩니다.' : '기존 기록은 유지합니다.'}`),
          data.kind === 'timetable' && rows.some((row) => row.start && !row.end) ? h('p', { class: 'hint' }, '원본에 종료 시각이 없는 수업은 시작 시각만 가져옵니다. 교시별 시간 설정에서 종료 시각을 확인해 주세요.') : null,
          data.version === 2 && Array.isArray(data.unresolved) && data.unresolved.length ? h('p', { class: 'hint' }, `날짜·위치를 확정하지 못한 항목 ${data.unresolved.length}개는 원문 확인용으로 보관합니다.`) : null,
          h('ul', null, rows.map((row) => h('li', null, row.date || row.examDate || row.day || '', ' ', row.title || row.subject || row.name))));
        const m = App.modal({ title: '가져오기 확인', wide: true, body: preview, footer: [h('button', { class: 'btn primary', type: 'button', onclick: () => {
          if (data.kind === 'timetable') {
            const activeTarget = typeof targetId === 'function' ? targetId() : targetId;
            const friendList = Store.get('ttFriends', []);
            const friendIndex = activeTarget && activeTarget !== 'me' ? friendList.findIndex((friend) => friend.id === activeTarget) : -1;
            const tt = friendIndex >= 0 ? friendList[friendIndex] : Store.get('timetable', { days: ['월', '화', '수', '목', '금'], periods: 6, cells: [], periodTimes: [] });
            const periods = Math.max(tt.periods || 6, ...rows.map((r) => r.period));
            tt.days = ['월', '화', '수', '목', '금']; tt.periods = periods;
            tt.cells = Array.from({ length: 5 }, (_, d) => Array.from({ length: periods }, (_, p) => tt.cells?.[d]?.[p] || null));
            tt.periodTimes = Array.from({ length: periods }, (_, p) => tt.periodTimes?.[p] || { start: '', end: '' });
            rows.forEach((r) => { tt.cells[r.day - 1][r.period - 1] = r.subject ? { subject: r.subject, teacher: r.teacher, room: r.room, sourceDetails: r.sourceDetails } : null; if (r.start || r.end) { const old = tt.periodTimes[r.period - 1]; tt.periodTimes[r.period - 1] = { start: r.start || old.start, end: r.end || old.end }; } });
            if (friendIndex >= 0) { friendList[friendIndex] = tt; Store.set('ttFriends', friendList); }
            else Store.set('timetable', tt);
          } else if (data.kind === 'grades') {
            const current = Store.get('grades', []), extras = Store.get('schoolReportExtras', []);
            Store.set('grades', [...current, ...rows.filter((r) => !r.reportOnly && !current.some((x) => x.id === r.id))]);
            Store.set('schoolReportExtras', [...extras, ...rows.filter((r) => r.reportOnly && !extras.some((x) => x.id === r.id))]);
          } else {
            const key = { calendar: 'events', grades: 'grades', activities: 'activities', map: 'schoolPlaces' }[data.kind];
            const old = Store.get(key, []); const ids = new Set(old.map((r) => r.id));
            Store.set(key, [...old, ...rows.filter((r) => !ids.has(r.id))]);
          }
          {
            const packages = Store.get('schoolImportPackages', []);
            const entry = { id: packageId, kind: data.kind, recordIds: rows.map((row) => row.id), source: data.source || {}, overview: data.overview || {}, unresolved: Array.isArray(data.unresolved) ? data.unresolved : [], importedAt: Date.now() };
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
  function tools(kind, after = () => App.refresh(), targetId = null) {
    const buttons = [
      h('button', { class: 'btn', type: 'button', onclick: () => App.download(`ClassHub-${kind}-양식.json`, new Blob([JSON.stringify(makeTemplate(kind), null, 2)], { type: 'application/json' })) }, `${kinds[kind]} AI 정리 양식 받기`),
      h('button', { class: 'btn', type: 'button', onclick: () => importFile(after, kind, targetId) }, '정리된 JSON 가져오기')
    ];
    if (kind === 'calendar' || kind === 'map') buttons.unshift(h('button', { class: 'btn', type: 'button', onclick: () => addFile(after, kind === 'map' ? '지도' : '학사 일정') }, '원본 파일 저장'));
    const files = kind === 'calendar' || kind === 'map' ? saved().filter((item) => item.kind === (kind === 'map' ? '지도' : '학사 일정')) : [];
    const packages = Store.get('schoolImportPackages', []).filter((item) => item.kind === kind);
    return h('details', { class: 'school-import-tools' }, h('summary', null, `${kinds[kind]} 자료 가져오기`),
      h('p', { class: 'hint' }, '원본과 양식을 원하는 외부 AI에 직접 보내세요. AI가 모르는 과목·약어는 공식 자료를 검색해 확인하게 하고, 확인되지 않은 값은 미확인으로 남기세요. 정리된 JSON은 원본과 대조한 뒤 가져오세요.'),
      h('div', { class: 'set-row set-btns' }, buttons),
      packages.length ? h('details', { class: 'school-source-detail' }, h('summary', null, `가져온 원본 요약 ${packages.length}건`), packages.map((item) =>
        h('details', null, h('summary', null, item.source?.documentTitle || kinds[kind]),
          h('pre', null, JSON.stringify({ source: item.source, overview: item.overview, unresolved: item.unresolved }, null, 2)),
          h('button', { class: 'btn danger', type: 'button', onclick: () => {
            if (!confirm('이 가져오기 기록과 해당 파일로 추가한 항목을 삭제할까요?')) return;
            const ids = new Set(item.recordIds || []);
            const keys = { calendar: ['events'], grades: ['grades', 'schoolReportExtras'], activities: ['activities'], map: ['schoolPlaces'] }[kind] || [];
            keys.forEach((key) => Store.set(key, Store.get(key, []).filter((row) => row.sourcePackageId !== item.id && !(ids.has(row.id) && row.sourceSchoolImport && !row.sourcePackageId))));
            Store.set('schoolImportPackages', Store.get('schoolImportPackages', []).filter((row) => row.id !== item.id)); after();
          } }, '가져온 자료 삭제')))) : null,
      files.length ? h('div', { class: 'school-doc-list' }, files.map((item) => h('div', { class: 'school-file-row' }, h('b', null, item.name),
        h('button', { class: 'btn', type: 'button', onclick: async () => { const file = await Store.getImg('school-' + item.id); if (!file) return App.toast('이 기기에 원본 파일이 없어요.'); const blob = await (await fetch(file.data)).blob(); const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); } }, '보기'),
        h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (!confirm('이 파일을 삭제할까요?')) return; await Store.delImg('school-' + item.id); Store.set('schoolFiles', saved().filter((x) => x.id !== item.id)); after(); } }, '삭제')))) : null);
  }
  const MAP_AI_GUIDE = `학교 지도 사진을 층별로 바로 올릴 수 있게 준비해 주세요.\n1. 사진에서 각 층 도면을 정확히 잘라 별도의 PNG 또는 JPG 파일로 만들어 주세요.\n2. 기울기·회전·대비·가독성을 보정하되 원본에 없는 선, 글자, 방, 안전시설을 새로 만들지 마세요.\n3. 한 층당 한 파일로 내보내고 파일명을 '건물명-층.png'처럼 알아보기 쉽게 붙여 주세요. 여러 건물이면 건물별로 분리해 주세요.\n4. 판독한 교실·계단·화장실·소화기 등은 이미지와 별도로 간단한 목록으로 알려 주세요. 불확실한 글자나 위치는 불확실하다고 표시해 주세요.\n5. 원본 사진과 보정한 이미지를 비교해 빠진 영역이 없는지 확인해 주세요. 완성된 층별 이미지 파일을 사용자에게 주세요.`;
  let openFloorId = null;
  function uploadFloorImages(after, replaceFloor = null) {
    const input = h('input', { type: 'file', accept: 'image/*', multiple: !replaceFloor });
    input.onchange = () => saveFloorImages(input.files, after, replaceFloor);
    input.click();
  }
  async function saveFloorImages(selectedFiles, after, replaceFloor = null) {
      const files = [...selectedFiles]; if (!files.length) return;
      if (files.some((file) => !file.type.startsWith('image/'))) return App.toast('지도 사진 파일만 올려 주세요.');
      if (files.some((file) => file.size > 12 * 1024 * 1024)) return App.toast('각 지도 사진은 12MB 이하여야 해요.');
      const read = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      const dimensions = (data) => new Promise((resolve) => { const image = new Image(); image.onload = () => resolve([image.naturalWidth, image.naturalHeight]); image.onerror = () => resolve([1000, 700]); image.src = data; });
      try {
        const added = [];
        for (const file of files) {
          const data = await read(file), [width, height] = await dimensions(data), id = replaceFloor?.id || uid();
          await Store.putImg(`school-floor-${id}`, { data, type: file.type });
          if (replaceFloor) {
            Store.set('schoolPlaces', Store.get('schoolPlaces', []).map((row) => row.id === id ? { ...row, floorImageFile: file.name, width, height,
              features: (row.features || []).map((marker) => ({ ...marker, x: Math.round(Number(marker.x) / (row.width || width) * width), y: Math.round(Number(marker.y) / (row.height || height) * height) })) } : row));
          } else added.push({ id, name: file.name.replace(/\.[^.]+$/, ''), floorImageFile: file.name, width, height, rooms: [], features: [], paths: [] });
        }
        if (added.length) Store.set('schoolPlaces', [...Store.get('schoolPlaces', []), ...added]);
        openFloorId = replaceFloor?.id || added.at(-1)?.id || null;
        after(); App.toast(replaceFloor ? '층 지도 사진을 교체했어요.' : `층별 지도 ${added.length}장을 저장했어요.`);
      } catch (_) { App.toast('지도 사진을 저장하지 못했어요.'); }
  }
  function photoFloorView(floor, after) {
    const w = floor.width || 1000, height = floor.height || 700, features = floor.features || [];
    const imageKey = `school-floor-${floor.id}`;
    const update = (patch) => { Store.set('schoolPlaces', Store.get('schoolPlaces', []).map((row) => row.id === floor.id ? { ...row, ...patch } : row)); after(); };
    const zoom = h('input', { type: 'range', min: 1, max: 3, step: .25, value: 1, 'aria-label': '지도 확대' });
    const image = sv('image', { x: 0, y: 0, width: w, height, preserveAspectRatio: 'none' });
    const map = sv('svg', { viewBox: `0 0 ${w} ${height}`, role: 'img', 'aria-label': `${floor.name} 지도 사진` },
      sv('rect', { x: 0, y: 0, width: w, height, fill: '#eef1f6' }), image);
    Store.getImg(imageKey).then((file) => { if (file?.data) image.setAttribute('href', file.data); else map.append(sv('text', { x: w / 2, y: height / 2, 'text-anchor': 'middle', fill: '#667386', 'font-size': Math.max(20, w / 35) }, '층 지도 사진을 첨부해 주세요')); });
    const size = Math.max(12, Math.min(w, height) / 35);
    let placing = false;
    const markerForm = (source, at) => {
      const name = h('input', { type: 'text', value: source?.name || '', placeholder: '장소 이름', maxLength: 60 });
      const note = h('textarea', { rows: 3, value: source?.memo || '', placeholder: '설명 (선택)' });
      const color = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(source?.color || '') ? source.color : '#e44747' });
      const shape = h('select', null, [['pin', '위치 핀'], ['circle', '동그라미'], ['star', '별'], ['triangle', '세모'], ['square', '네모'], ['heart', '하트'], ['diamond', '마름모']].map(([value, label]) => h('option', { value, selected: (source?.shape || 'pin') === value }, label)));
      const showLabel = h('input', { type: 'checkbox', checked: !!source?.showLabel });
      const dialog = App.modal({ title: source ? '마커 수정' : '마커 추가', body: [App.field('이름', name), App.field('설명', note), h('div', { class: 'row2' }, App.field('색', color), App.field('모양', shape)), h('label', { class: 'check' }, showLabel, '지도 위에 이름 표시')], footer: [
        source ? h('button', { class: 'btn danger', type: 'button', onclick: () => { update({ features: features.filter((item) => item !== source) }); dialog.close(); } }, '삭제') : null,
        source ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { placing = source; dialog.close(); App.toast('사진에서 새 위치를 눌러 주세요.'); } }, '위치 변경') : null,
        h('button', { class: 'btn primary', type: 'button', onclick: () => { if (!name.value.trim()) return App.toast('마커 이름을 입력해 주세요.'); const next = { ...(source || {}), ...(at || {}), name: name.value.trim(), memo: note.value.trim(), color: color.value, shape: shape.value, showLabel: showLabel.checked }; update({ features: source ? features.map((item) => item === source ? next : item) : [...features, next] }); dialog.close(); } }, '저장')] });
    };
    features.forEach((marker) => {
      const x = Number(marker.x), y = Number(marker.y), color = /^#[0-9a-f]{6}$/i.test(marker.color || '') ? marker.color : '#e44747';
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const shape = marker.shape === 'diamond' ? sv('path', { d: `M${x} ${y-size} L${x+size} ${y} ${x} ${y+size} ${x-size} ${y}Z`, fill: color })
        : marker.shape === 'circle' ? sv('circle', { cx: x, cy: y, r: size * .8, fill: color })
          : marker.shape === 'square' ? sv('rect', { x: x-size*.8, y: y-size*.8, width: size*1.6, height: size*1.6, rx: size*.12, fill: color })
            : marker.shape === 'triangle' ? sv('path', { d: `M${x} ${y-size} L${x+size} ${y+size*.8} L${x-size} ${y+size*.8}Z`, fill: color })
              : marker.shape === 'heart' ? sv('path', { d: `M${x} ${y+size} C${x-size*2} ${y-size*.2} ${x-size} ${y-size*1.5} ${x} ${y-size*.55} C${x+size} ${y-size*1.5} ${x+size*2} ${y-size*.2} ${x} ${y+size}Z`, fill: color })
                : marker.shape === 'star' ? sv('path', { d: Array.from({ length: 10 }, (_, i) => `${i ? 'L' : 'M'}${x+Math.sin(i*Math.PI/5)*(i%2 ? size*.45 : size)} ${y-Math.cos(i*Math.PI/5)*(i%2 ? size*.45 : size)}`).join(' ')+'Z', fill: color })
                  : sv('path', { d: `M${x} ${y+size*1.3} C${x-size*.6} ${y+size*.25} ${x-size} ${y-size*.2} ${x-size} ${y-size*.7} A${size} ${size} 0 1 1 ${x+size} ${y-size*.7} C${x+size} ${y-size*.2} ${x+size*.6} ${y+size*.25} ${x} ${y+size*1.3}Z`, fill: color });
      map.append(sv('g', { class: 'school-photo-marker', onclick: (event) => { event.stopPropagation(); const dialog = App.modal({ title: marker.name, body: h('p', null, marker.memo || '설명이 없어요.'), footer: [h('button', { class: 'btn primary', type: 'button', onclick: () => { dialog.close(); markerForm(marker); } }, '수정')] }); } }, shape,
        marker.shape === 'pin' ? sv('circle', { cx: x, cy: y-size*.7, r: size*.25, fill: '#fff' }) : null,
        marker.showLabel ? sv('text', { x, y: y-size*1.45, 'text-anchor': 'middle', class: 'school-marker-label', 'font-size': Math.max(22, size*1.2) }, marker.name) : null,
        sv('title', null, marker.name)));
    });
    map.addEventListener('click', (event) => {
      if (!placing) return;
      const point = map.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
      const at = point.matrixTransform(map.getScreenCTM().inverse());
      const location = { x: Math.round(Math.max(0, Math.min(w, at.x))), y: Math.round(Math.max(0, Math.min(height, at.y))) };
      if (typeof placing === 'object') update({ features: features.map((item) => item === placing ? { ...item, ...location } : item) });
      else markerForm(null, location);
      placing = false;
    });
    const scroller = h('div', { class: 'school-photo-scroll' }, map);
    const applyZoom = (next, clientX, clientY) => {
      const rect = scroller.getBoundingClientRect();
      const offsetX = clientX-rect.left, offsetY = clientY-rect.top;
      const oldWidth = map.getBoundingClientRect().width, oldHeight = map.getBoundingClientRect().height;
      const anchorX = (scroller.scrollLeft+offsetX)/oldWidth, anchorY = (scroller.scrollTop+offsetY)/oldHeight;
      zoom.value = Math.max(1, Math.min(3, next));
      map.style.width = `${Number(zoom.value)*100}%`;
      scroller.classList.toggle('zoomed', Number(zoom.value) > 1);
      scroller.scrollLeft = anchorX*map.getBoundingClientRect().width-offsetX;
      scroller.scrollTop = anchorY*map.getBoundingClientRect().height-offsetY;
    };
    zoom.addEventListener('input', () => { const r = scroller.getBoundingClientRect(); applyZoom(Number(zoom.value), r.left+r.width/2, r.top+r.height/2); });
    scroller.addEventListener('wheel', (event) => { event.preventDefault(); applyZoom(Number(zoom.value)+(event.deltaY < 0 ? .2 : -.2), event.clientX, event.clientY); }, { passive: false });
    let pan = null;
    scroller.addEventListener('pointerdown', (event) => { if (placing || Number(zoom.value) <= 1 || event.target.closest('.school-photo-marker')) return; pan = { id: event.pointerId, x: event.clientX, y: event.clientY, left: scroller.scrollLeft, top: scroller.scrollTop }; scroller.setPointerCapture(event.pointerId); });
    scroller.addEventListener('pointermove', (event) => { if (!pan || pan.id !== event.pointerId) return; scroller.scrollLeft = pan.left+pan.x-event.clientX; scroller.scrollTop = pan.top+pan.y-event.clientY; });
    const stopPan = (event) => { if (pan?.id === event.pointerId) pan = null; };
    scroller.addEventListener('pointerup', stopPan); scroller.addEventListener('pointercancel', stopPan);
    return h('details', { class: 'school-floor school-photo-floor', open: floor.id === openFloorId, ontoggle: (event) => { if (event.currentTarget.open) openFloorId = floor.id; else if (openFloorId === floor.id) openFloorId = null; } }, h('summary', null, floor.name),
      h('div', { class: 'school-map-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => { const name = prompt('층 이름', floor.name)?.trim(); if (name) update({ name }); } }, '이름 변경'),
        h('button', { class: 'btn', type: 'button', onclick: () => { placing = true; App.toast('사진에서 마커를 놓을 위치를 눌러 주세요.'); } }, '마커 추가'),
        h('button', { class: 'btn', type: 'button', onclick: () => uploadFloorImages(after, floor) }, '사진 교체'),
        h('button', { class: 'btn', type: 'button', onclick: () => uploadFloorImages(after) }, '다른 층 사진 추가'),
        h('label', { class: 'school-zoom' }, '확대', zoom),
        h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (!confirm(`${floor.name} 지도를 삭제할까요?`)) return; await Store.delImg(imageKey); Store.set('schoolPlaces', Store.get('schoolPlaces', []).filter((row) => row.id !== floor.id)); after(); } }, '지도 삭제')),
      scroller, h('p', { class: 'muted' }, `${floor.floorImageFile || '사진 미첨부'} · 마커 ${features.length}개 · 사진은 이 기기에 저장돼요.`));
  }
  function renderMap(root) {
    const panel = h('section', { class: 'panel' });
    const dropZone = h('div', { class: 'school-photo-drop' }, '지도 사진을 여기로 끌어 놓으세요');
    dropZone.addEventListener('dragover', (event) => { if ([...(event.dataTransfer?.types || [])].includes('Files')) { event.preventDefault(); dropZone.classList.add('drag-over'); } });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (event) => { event.preventDefault(); dropZone.classList.remove('drag-over'); saveFloorImages(event.dataTransfer.files, draw); });
    const draw = () => panel.replaceChildren(h('h1', { class: 'page-title' }, '학교 지도'),
      dropZone,
      h('div', { class: 'school-photo-start' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => uploadFloorImages(draw) }, '＋ 층별 지도 사진 올리기'),
        h('button', { class: 'btn ghost', type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(MAP_AI_GUIDE); App.toast('AI에 보낼 안내를 복사했어요.'); } catch (_) { App.modal({ title: 'AI에 보낼 안내', body: h('textarea', { rows: 12, value: MAP_AI_GUIDE }) }); } } }, 'AI에 보낼 사진 준비 안내'),
        h('p', { class: 'hint' }, '층별 지도 사진을 여기로 끌어 놓거나 버튼으로 올리세요. 사진 위에 마커를 직접 추가할 수 있어요.')),
      h('div', { class: 'school-places' }, Store.get('schoolPlaces', []).length
        ? Store.get('schoolPlaces', []).map((floor) => photoFloorView(floor, draw))
        : h('p', { class: 'empty-box' }, '층별 지도 사진을 올리면 여기에 나타나요.')));
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
      content.replaceChildren(...[tabs, active === 'reports' ? null : fileList, details].filter(Boolean));
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
