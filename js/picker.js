// 기기별 기본 날짜·시간 팝업 대신 같은 모양의 선택창을 사용한다.
const ClassHubPicker = (() => {
  const two = (n) => String(n).padStart(2, '0');
  const button = (label, action, className = 'btn') => {
    const el = document.createElement('button');
    el.type = 'button'; el.className = className; el.textContent = label;
    el.addEventListener('click', action);
    return el;
  };
  const setValue = (input, value, dialog) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    dialog.close();
  };
  const openDate = (input) => {
    const current = /^\d{4}-\d{2}-\d{2}$/.test(input.value) ? input.value : '';
    let shown = current ? new Date(`${current}T12:00:00`) : new Date();
    const body = document.createElement('div'); body.className = 'ch-picker';
    const dialog = App.modal({ title: '날짜 선택', body });
    dialog.back.classList.add('ch-picker-back');
    const min = input.getAttribute('min') || '', max = input.getAttribute('max') || '';
    const allowed = (value) => (!min || value >= min) && (!max || value <= max);
    const render = () => {
      const year = shown.getFullYear(), month = shown.getMonth();
      const heading = document.createElement('strong'); heading.textContent = `${year}년 ${month + 1}월`;
      const nav = document.createElement('div'); nav.className = 'ch-picker-nav';
      nav.append(button('〈', () => { shown = new Date(year, month - 1, 1); render(); }, 'btn ch-picker-arrow'), heading,
        button('〉', () => { shown = new Date(year, month + 1, 1); render(); }, 'btn ch-picker-arrow'));
      const grid = document.createElement('div'); grid.className = 'ch-picker-days';
      '일월화수목금토'.split('').forEach((name) => { const day = document.createElement('span'); day.textContent = name; day.className = 'ch-picker-weekday'; grid.append(day); });
      const offset = new Date(year, month, 1).getDay();
      for (let i = 0; i < offset; i++) grid.append(document.createElement('span'));
      const count = new Date(year, month + 1, 0).getDate();
      for (let day = 1; day <= count; day++) {
        const value = `${year}-${two(month + 1)}-${two(day)}`;
        const cell = button(String(day), () => setValue(input, value, dialog), 'ch-picker-day');
        cell.disabled = !allowed(value);
        if (value === current) cell.classList.add('selected');
        if (value === localDate()) cell.classList.add('today');
        grid.append(cell);
      }
      const foot = document.createElement('div'); foot.className = 'ch-picker-actions';
      foot.append(button('오늘', () => { const value = localDate(); if (allowed(value)) setValue(input, value, dialog); else { shown = new Date(); render(); } }, 'btn ghost'));
      if (!input.required) foot.append(button('지우기', () => setValue(input, '', dialog), 'btn ghost'));
      body.replaceChildren(nav, grid, foot);
    };
    render();
  };
  const localDate = () => {
    const now = new Date(); return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
  };
  const openTime = (input) => {
    const parts = /^\d{2}:\d{2}$/.test(input.value) ? input.value.split(':').map(Number) : [9, 0];
    let hour = parts[0], minute = parts[1];
    const body = document.createElement('div'); body.className = 'ch-picker ch-time-picker';
    const dialog = App.modal({ title: '시간 선택', body });
    dialog.back.classList.add('ch-picker-back');
    const columns = document.createElement('div'); columns.className = 'ch-time-columns';
    const makeColumn = (title, total, selected, choose) => {
      const wrap = document.createElement('div'); wrap.className = 'ch-time-column';
      const label = document.createElement('strong'); label.textContent = title;
      const list = document.createElement('div'); list.className = 'ch-time-list';
      for (let i = 0; i < total; i++) {
        const item = button(two(i), () => { choose(i); [...list.children].forEach((child) => child.classList.remove('selected')); item.classList.add('selected'); }, 'ch-time-option');
        if (i === selected) item.classList.add('selected');
        list.append(item);
      }
      wrap.append(label, list);
      requestAnimationFrame(() => {
        const selected = list.querySelector('.selected');
        if (selected) list.scrollTop = selected.offsetTop - list.clientHeight / 2 + selected.offsetHeight / 2;
      });
      return wrap;
    };
    columns.append(makeColumn('시', 24, hour, (n) => { hour = n; }), makeColumn('분', 60, minute, (n) => { minute = n; }));
    const foot = document.createElement('div'); foot.className = 'ch-picker-actions';
    if (!input.required) foot.append(button('지우기', () => setValue(input, '', dialog), 'btn ghost'));
    foot.append(button('시간 적용', () => setValue(input, `${two(hour)}:${two(minute)}`, dialog), 'btn primary'));
    body.append(columns, foot);
  };
  const openColor = (input) => {
    const current = /^#[0-9a-f]{6}$/i.test(input.value) ? input.value.toLowerCase() : '#000000';
    const body = document.createElement('div'); body.className = 'ch-picker';
    const dialog = App.modal({ title: '색상 선택', body });
    dialog.back.classList.add('ch-picker-back');
    const clamp = (n, max = 1) => Math.min(max, Math.max(0, n));
    const toHex = (rgb) => '#' + rgb.map((n) => Math.round(clamp(n, 255)).toString(16).padStart(2, '0')).join('');
    const fromHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const toHsv = ([r, g, b]) => {
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
      let h = 0;
      if (delta) {
        if (max === r) h = ((g - b) / delta) % 6;
        else if (max === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
      }
      return { h: (h * 60 + 360) % 360, s: max ? delta / max : 0, v: max };
    };
    const toRgb = ({ h, s, v }) => {
      const chroma = v * s, x = chroma * (1 - Math.abs((h / 60) % 2 - 1)), m = v - chroma;
      const sectors = [[chroma, x, 0], [x, chroma, 0], [0, chroma, x], [0, x, chroma], [x, 0, chroma], [chroma, 0, x]];
      return sectors[Math.floor(h / 60) % 6].map((n) => Math.round((n + m) * 255));
    };
    let hsv = toHsv(fromHex(current)), chosen = current;
    const preview = document.createElement('div'); preview.className = 'ch-color-preview';
    const square = document.createElement('div'); square.className = 'ch-color-square'; square.tabIndex = 0; square.setAttribute('aria-label', '채도와 밝기');
    const squareMarker = document.createElement('span'); squareMarker.className = 'ch-color-marker'; square.append(squareMarker);
    const hueBar = document.createElement('div'); hueBar.className = 'ch-color-hue'; hueBar.tabIndex = 0; hueBar.setAttribute('aria-label', '색조');
    const hueMarker = document.createElement('span'); hueMarker.className = 'ch-color-hue-marker'; hueBar.append(hueMarker);
    const hex = document.createElement('input'); hex.type = 'text'; hex.maxLength = 7;
    hex.className = 'ch-color-hex'; hex.setAttribute('aria-label', '색상 코드');
    const rgb = ['R', 'G', 'B'].map((label) => {
      const field = document.createElement('input'); field.type = 'number'; field.min = 0; field.max = 255; field.step = 1;
      field.setAttribute('aria-label', `${label} 값`); return field;
    });
    const rgbRow = document.createElement('div'); rgbRow.className = 'ch-color-rgb';
    rgb.forEach((field, i) => { const label = document.createElement('label'); label.textContent = ['R', 'G', 'B'][i]; label.append(field); rgbRow.append(label); });
    const sync = (origin = '') => {
      chosen = toHex(toRgb(hsv)); preview.style.background = chosen;
      square.style.backgroundColor = `hsl(${hsv.h} 100% 50%)`;
      squareMarker.style.left = `${hsv.s * 100}%`; squareMarker.style.top = `${(1 - hsv.v) * 100}%`;
      hueMarker.style.left = `${hsv.h / 360 * 100}%`;
      if (origin !== 'hex') hex.value = chosen;
      if (origin !== 'rgb') fromHex(chosen).forEach((n, i) => { rgb[i].value = n; });
    };
    const dragOn = (element, choose) => {
      const move = (event) => {
        const rect = element.getBoundingClientRect();
        choose(clamp((event.clientX - rect.left) / rect.width), clamp((event.clientY - rect.top) / rect.height));
        sync();
      };
      element.addEventListener('pointerdown', (event) => { event.preventDefault(); element.setPointerCapture(event.pointerId); move(event); });
      element.addEventListener('pointermove', (event) => { if (element.hasPointerCapture(event.pointerId)) move(event); });
    };
    dragOn(square, (x, y) => { hsv.s = x; hsv.v = 1 - y; });
    dragOn(hueBar, (x) => { hsv.h = Math.min(359.999, x * 360); });
    square.addEventListener('keydown', (event) => {
      if (!event.key.startsWith('Arrow')) return;
      event.preventDefault(); hsv.s = clamp(hsv.s + (event.key === 'ArrowRight' ? .01 : event.key === 'ArrowLeft' ? -.01 : 0));
      hsv.v = clamp(hsv.v + (event.key === 'ArrowUp' ? .01 : event.key === 'ArrowDown' ? -.01 : 0)); sync();
    });
    hueBar.addEventListener('keydown', (event) => {
      if (!event.key.startsWith('Arrow')) return;
      event.preventDefault(); hsv.h = (hsv.h + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1) + 360) % 360; sync();
    });
    hex.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) { hsv = toHsv(fromHex(hex.value)); sync('hex'); } });
    rgb.forEach((field) => field.addEventListener('input', () => {
      const values = rgb.map((item) => Number(item.value));
      if (rgb.every((item) => item.value !== '' && Number.isInteger(Number(item.value)) && Number(item.value) >= 0 && Number(item.value) <= 255)) {
        hsv = toHsv(values); sync('rgb');
      }
    }));
    const foot = document.createElement('div'); foot.className = 'ch-picker-actions';
    foot.append(button('색상 적용', () => { if (!/^#[0-9a-f]{6}$/i.test(hex.value)) return App.toast('색상 코드는 #RRGGBB 형식으로 입력해 주세요.'); setValue(input, chosen, dialog); }, 'btn primary'));
    body.append(preview, square, hueBar, rgbRow, hex, foot); sync();
  };
  const enhance = (input) => {
    const kind = input.type;
    input.type = 'text'; input.readOnly = true;
    input.classList.add('ch-picker-input');
    if (kind === 'color') {
      input.classList.add('ch-color-input');
      const valueProperty = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      Object.defineProperty(input, 'value', {
        configurable: true,
        get() { return valueProperty.get.call(this); },
        set(value) { valueProperty.set.call(this, value); this.style.backgroundColor = this.value; }
      });
      input.style.backgroundColor = input.value;
    }
    input.setAttribute('aria-haspopup', 'dialog');
    input.setAttribute('inputmode', 'none');
    input.addEventListener('click', () => { if (!input.disabled) (kind === 'date' ? openDate : kind === 'time' ? openTime : openColor)(input); });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
    });
  };
  const openSelect = (select) => {
    const options = [...select.options].filter((option) => !option.disabled && !option.closest('optgroup[disabled]'));
    if (!options.length) return;
    const body = document.createElement('div'); body.className = 'ch-picker ch-select-picker';
    const title = select.getAttribute('aria-label') || select.closest('label')?.querySelector('span')?.textContent || '항목 선택';
    const dialog = App.modal({ title, body });
    dialog.back.classList.add('ch-picker-back');
    const list = document.createElement('div'); list.className = 'ch-select-list';
    const draw = (query = '') => {
      const filtered = options.filter((option) => option.textContent.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
      list.replaceChildren(...filtered.map((option) => button(option.textContent, () => setValue(select, option.value, dialog),
        'ch-select-option' + (option.value === select.value ? ' selected' : ''))));
      if (!filtered.length) { const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = '일치하는 항목이 없어요.'; list.append(empty); }
    };
    if (options.length > 12) {
      const search = document.createElement('input'); search.type = 'search'; search.placeholder = '항목 검색';
      search.setAttribute('aria-label', '선택지 검색'); search.addEventListener('input', () => draw(search.value));
      body.append(search); setTimeout(() => search.focus(), 0);
    }
    body.append(list); draw();
  };
  const enhanceSelect = (select) => {
    if (select.multiple) return;
    select.classList.add('ch-select');
    select.setAttribute('aria-haspopup', 'dialog');
    let lastOpen = 0;
    const show = () => { if (select.disabled || Date.now() - lastOpen < 450) return; lastOpen = Date.now(); openSelect(select); };
    select.addEventListener('pointerdown', (event) => { event.preventDefault(); show(); });
    select.addEventListener('click', (event) => { event.preventDefault(); show(); });
    select.addEventListener('keydown', (event) => {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); show(); }
    });
  };
  return { enhance, enhanceSelect };
})();
