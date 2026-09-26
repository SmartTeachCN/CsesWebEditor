/*
 * doc.js —— CSES 文档设置编辑器（版本 / v2 configuration.cycle / 格式检查）
 */
function docFieldValue(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
function docFieldSet(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null) el.value = String(value);
}
function docInt(value, fallback, min) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return fallback;
  return (min !== undefined && n < min) ? min : n;
}

const csesDoc = {
  init() {
    try { storage.init(); } catch (e) { console.warn('storage.init failed', e); }
    this.render();
  },
  version() {
    try { return storage.getCsesVersion(); } catch { return 1; }
  },
  config() {
    if (!currentData.configuration) {
      currentData.configuration = (typeof window !== 'undefined' && window.cses)
        ? window.cses.defaultConfiguration()
        : { name: '', description: '', cycle: { work_count: 5, rest_count: 2, spans: [] } };
    }
    if (!currentData.configuration.cycle) currentData.configuration.cycle = { work_count: 5, rest_count: 2, spans: [] };
    if (!Array.isArray(currentData.configuration.cycle.spans)) currentData.configuration.cycle.spans = [];
    return currentData.configuration;
  },
  render() {
    const v = this.version();
    const mode = storage.getOutputMode();
    const cfg = this.config();
    const cycle = cfg.cycle;
    docFieldSet('doc-output-mode', mode);
    docFieldSet('doc-version', mode === 'cy2' ? 2 : 1);
    docFieldSet('doc-config-name', cfg.name || '');
    docFieldSet('doc-config-description', cfg.description || '');
    docFieldSet('doc-cycle-work', cycle.work_count);
    docFieldSet('doc-cycle-rest', cycle.rest_count);
    this.renderSpans(cycle.spans);
    this.toggleSections(v);
    this.runCheck();
    const hint = document.getElementById('doc-mode-hint');
    if (hint) {
      hint.textContent = (mode === 'cy1' || mode === 'cy2')
        ? `当前导出格式：${storage.getOutputModeLabel(mode)} —— 本地导出为 YAML，导入时自动识别版本。`
        : `当前导出格式：${storage.getOutputModeLabel(mode)}（非 CSES 格式）。下面的 configuration 只在导出 CSES v2 时写入，如需导出 CSES 请切换为 CSES v1 / v2。`;
    }
  },
  toggleSections(v) {
    document.querySelectorAll('.v2-only').forEach((el) => { el.style.display = (v === 2) ? '' : 'none'; });
    document.querySelectorAll('.v1-only').forEach((el) => { el.style.display = (v === 2) ? 'none' : ''; });
  },
  renderSpans(spans) {
    const box = document.getElementById('doc-cycle-spans');
    if (!box) return;
    box.innerHTML = '';
    if (!Array.isArray(spans) || spans.length === 0) {
      const tip = document.createElement('div');
      tip.style.color = '#888';
      tip.textContent = '暂无时间跨度，点击下方“新增跨度”添加';
      box.appendChild(tip);
      return;
    }
    spans.forEach((span, index) => {
      const row = document.createElement('div');
      row.className = 'span-row';

      const sel = document.createElement('select');
      [['work', '工作日'], ['rest', '休息日']].forEach(([value, text]) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        sel.appendChild(opt);
      });
      sel.value = span.activity === 'rest' ? 'rest' : 'work';
      sel.addEventListener('change', () => this.updateSpan(index, 'activity', sel.value));

      const count = document.createElement('input');
      count.type = 'number';
      count.min = '1';
      count.step = '1';
      count.style.width = '90px';
      count.value = String(span.count);
      count.addEventListener('change', () => this.updateSpan(index, 'count', docInt(count.value, 1, 1)));

      const del = document.createElement('fluent-button');
      del.textContent = '删除';
      del.addEventListener('click', () => this.removeSpan(index));

      row.appendChild(sel);
      row.appendChild(count);
      row.appendChild(del);
      box.appendChild(row);
    });
  },
  touch() {
    try { window.markUnsynced && window.markUnsynced(); } catch {}
    try { storage.save(); } catch (e) { console.warn('storage.save failed', e); }
    this.runCheck();
  },
  setVersion(value) {
    // 兼容旧接口：版本 -> 导出格式（CSES v1 / v2）
    return this.setOutputMode(value === '2' || value === 2 ? 'cy2' : 'cy1');
  },
  setOutputMode(value) {
    const mode = storage.setOutputMode(value, { silent: true, noRefresh: true });
    try { storage.syncVersionSelectors(); } catch {}
    this.render();
    try { window.refreshFormatChecker && window.refreshFormatChecker(); } catch {}
    if (mode === 'cy2') {
      const affected = (currentData.schedules || []).filter((s) => s && s.weeks && s.weeks !== 'all');
      if (affected.length) {
        alert(`已切换为 ${storage.getOutputModeLabel(mode)}。<br>CSES v2 规范不包含 weeks（单双周）字段，当前有 ${affected.length} 张课表设置了单双周，导出为 v2 时该信息会被忽略。`,
          '格式切换提示');
      }
    }
    return mode;
  },
  setName(value) {
    this.config().name = value || '';
    this.touch();
  },
  setDescription(value) {
    this.config().description = value || '';
    this.touch();
  },
  setCycleCount(kind, value) {
    const cycle = this.config().cycle;
    cycle[kind] = docInt(value, kind === 'work_count' ? 5 : 2, 2);
    docFieldSet(kind === 'work_count' ? 'doc-cycle-work' : 'doc-cycle-rest', cycle[kind]);
    this.touch();
  },
  addSpan() {
    this.config().cycle.spans.push({ activity: 'work', count: 1 });
    this.renderSpans(this.config().cycle.spans);
    this.touch();
  },
  updateSpan(index, key, value) {
    const spans = this.config().cycle.spans;
    if (!spans[index]) return;
    if (key === 'activity') spans[index].activity = (value === 'rest') ? 'rest' : 'work';
    else spans[index].count = docInt(value, 1, 1);
    this.touch();
  },
  removeSpan(index) {
    const spans = this.config().cycle.spans;
    if (!spans[index]) return;
    spans.splice(index, 1);
    this.renderSpans(spans);
    this.touch();
  },
  fillSpansByCount() {
    const cycle = this.config().cycle;
    cycle.spans = [
      { activity: 'work', count: cycle.work_count },
      { activity: 'rest', count: cycle.rest_count }
    ];
    this.renderSpans(cycle.spans);
    this.touch();
  },
  runCheck() {
    const box = document.getElementById('doc-check-result');
    if (!box) return;
    let result;
    try {
      result = storage.validate();
    } catch (e) {
      box.textContent = '检查失败：' + (e && e.message ? e.message : e);
      return;
    }
    const lines = [];
    lines.push(`当前导出格式：${storage.getOutputModeLabel()}（CSES v${this.version()} 规范）`);
    (result.errors || []).forEach((e) => lines.push('错误：' + e));
    (result.warnings || []).forEach((w) => lines.push('警告：' + w));
    if (!result.errors.length && !result.warnings.length) lines.push('未发现格式问题。');
    box.textContent = lines.join('\n');
    box.className = 'check-issues ' + (result.ok ? (result.warnings && result.warnings.length ? 'warn' : 'ok') : 'error');
  },
  previewDoc() {
    try {
      const doc = storage.buildDoc();
      const text = JSON.stringify(doc, null, 2);
      const area = document.getElementById('doc-preview');
      if (area) area.value = text;
    } catch (e) {
      alert('生成预览失败：' + (e && e.message ? e.message : e));
    }
  }
};

try { window.csesDoc = csesDoc; } catch {}
