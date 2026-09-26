/*
 * 「配置」页面（control.html + control.js + control/settings-*.json）测试
 *  - 集控设置地址探测（源码目录 / 构建产物 / 根目录），修复「配置页什么都加载不出来」
 *  - CSES v2 的 configuration（名称 / 描述 / 周期 / spans）在这里编辑并写回
 * 运行：node tests/control.test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const jsyaml = require(path.join(ROOT, 'node_modules', 'js-yaml'));
const cses = require(path.join(ROOT, 'dev', 'scripts', 'cses.js'));

let passed = 0;
function check(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(() => { passed++; console.log('  ok  - ' + name); }, (e) => {
        console.error('  FAIL - ' + name);
        console.error('        ' + (e && e.message));
        process.exitCode = 1;
      });
    }
    passed++;
    console.log('  ok  - ' + name);
  } catch (e) {
    console.error('  FAIL - ' + name);
    console.error('        ' + (e && e.message));
    process.exitCode = 1;
  }
}
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

/* ---------- 1. settings-cy.json 结构 ---------- */
console.log('settings-cy.json');
const settingsCy = JSON.parse(fs.readFileSync(path.join(ROOT, 'control', 'settings-cy.json'), 'utf8'));
check('包含 CSES v2 的 configuration 字段', () => {
  const keys = settingsCy.settings.map((s) => s.keyPath);
  for (const k of ['configuration.name', 'configuration.description', 'configuration.cycle.work_count', 'configuration.cycle.rest_count', 'configuration.cycle.spans']) {
    assert.ok(keys.includes(k), '缺少 ' + k);
  }
});
check('tab 的 settings 列表与 settings 定义一一对应', () => {
  const defined = new Set(settingsCy.settings.map((s) => s.keyPath));
  settingsCy.tabs.forEach((tab) => {
    tab.settings.forEach((k) => assert.ok(defined.has(k), `tab ${tab.eng_name} 引用了未定义的 ${k}`));
  });
});
check('v2 专用字段标了 requiresVersion=2', () => {
  settingsCy.settings
    .filter((s) => s.keyPath.startsWith('configuration.'))
    .forEach((s) => assert.strictEqual(s.requiresVersion, 2, s.keyPath + ' 缺少 requiresVersion'));
});
check('control/cj 与 control/ci 等其它模板仍然可用', () => {
  for (const f of ['settings-cj.json', 'settings-ci.json', 'settings-es.json']) {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'control', f), 'utf8'));
    assert.ok(Array.isArray(j.tabs) && Array.isArray(j.settings), f + ' 结构异常');
  }
});

/* ---------- 2. control.js DOM 流程 ---------- */
let JSDOM;
try {
  ({ JSDOM } = require(path.join(ROOT, 'node_modules', 'jsdom')));
} catch (e) {
  console.error('未安装 jsdom，跳过 DOM 测试');
  console.log('\n通过 ' + passed + ' 项检查' + (process.exitCode ? '（存在失败）' : ''));
  process.exit(process.exitCode || 0);
}

async function domTests() {
  const html = fs.readFileSync(path.join(ROOT, 'dev', 'pages', 'editor', 'control.html'), 'utf8');
  const bodyStart = html.indexOf('<body>');
  const lastScript = html.lastIndexOf('<script>');
  const bodyHtml = html.slice(bodyStart, lastScript);
  const inlineCode = html.slice(lastScript + '<script>'.length, html.indexOf('</script>', lastScript));

  const dom = new JSDOM(`<!DOCTYPE html><html><head></head>${bodyHtml}</body></html>`, {
    runScripts: 'outside-only',
    url: 'http://localhost/dev/pages/editor/control.html',
  });
  const w = dom.window;
  w.jsyaml = jsyaml;
  w.alert = (m) => { w.__alert = String(m); };
  w.localStorage.setItem('output-mode', 'cy2');
  w.localStorage.setItem('csesData', JSON.stringify({ version: 2, subjects: [], schedules: [] }));
  w.localStorage.setItem('currentTerminalId', 'inst-x');

  // fetch 桩：只有「构建产物位置」的地址可用，用来验证候选地址探测
  const requested = [];
  w.fetch = async (url) => {
    const u = String(url);
    requested.push(u);
    if (u === '../../control/settings-cy.json') {
      return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(path.join(ROOT, 'control', 'settings-cy.json'), 'utf8')) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const ctx = dom.getInternalVMContext();
  for (const f of ['cses.js', 'storage.js', 'control.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'dev', 'scripts', f), 'utf8'), ctx, { filename: f });
  }
  const run = (code) => vm.runInContext(code, ctx);

  run(inlineCode);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  await tick(30);

  await check('设置地址探测：源码位置 404 后回退到构建产物位置', () => {
    const dev = requested.indexOf('../../../control/settings-cy.json');
    const built = requested.indexOf('../../control/settings-cy.json');
    assert.ok(dev !== -1, '没有探测源码目录位置：' + requested.join(', '));
    assert.ok(built !== -1, '没有回退到构建产物位置：' + requested.join(', '));
    assert.ok(dev < built, '应先探测源码目录再回退');
    assert.ok(w.document.getElementById('configuration.name'), '回退成功后配置项应已渲染');
  });

  await check('CSES 配置项真的渲染出来了（不再是空白）', () => {
    const tabs = w.document.getElementById('settingsTabs');
    assert.ok(tabs.querySelector('fluent-tabs'), '没有渲染 tabs');
    for (const id of ['configuration.name', 'configuration.description', 'configuration.cycle.work_count', 'configuration.cycle.rest_count', 'configuration.cycle.spans']) {
      assert.ok(w.document.getElementById(id), '缺少控件 ' + id);
    }
    assert.ok(w.document.getElementById('settingsTabs').textContent.includes('CSES 配置'));
  });

  await check('修改配置名称会写回 currentData 与 localStorage', () => {
    const field = w.document.getElementById('configuration.name');
    field.value = '2026年下学期';
    field.dispatchEvent(new w.Event('change'));
    assert.strictEqual(run('currentData.configuration.name'), '2026年下学期');
    const saved = JSON.parse(w.localStorage.getItem('csesData'));
    assert.strictEqual(saved.configuration.name, '2026年下学期');
  });

  await check('修改工作日数会在 spans 为空时自动补全', () => {
    run("currentData.configuration = { name: '', description: '', cycle: { work_count: 5, rest_count: 2, spans: [] } };");
    const field = w.document.getElementById('configuration.cycle.work_count');
    field.value = '6';
    field.dispatchEvent(new w.Event('change'));
    const cycle = JSON.parse(run('JSON.stringify(currentData.configuration.cycle)'));
    assert.strictEqual(cycle.work_count, 6);
    assert.deepStrictEqual(cycle.spans, [{ activity: 'work', count: 6 }, { activity: 'rest', count: 2 }]);
  });

  await check('spans 列表可以新增 / 删除跨度', () => {
    const box = w.document.getElementById('configuration.cycle.spans');
    const addBtn = Array.from(box.querySelectorAll('button')).find((b) => b.textContent === '新增跨度');
    assert.ok(addBtn, '没有新增跨度按钮');
    addBtn.click();
    let spans = JSON.parse(run('JSON.stringify(currentData.configuration.cycle.spans)'));
    assert.strictEqual(spans.length, 3);
    const delBtn = Array.from(box.querySelectorAll('button')).find((b) => b.textContent === '删除');
    assert.ok(delBtn, '没有删除按钮');
    delBtn.click();
    spans = JSON.parse(run('JSON.stringify(currentData.configuration.cycle.spans)'));
    assert.strictEqual(spans.length, 2);
  });

  await check('按总数生成一段工作+一段休息', () => {
    run("currentData.configuration.cycle.spans = [{ activity: 'work', count: 1 }];");
    const box = w.document.getElementById('configuration.cycle.spans');
    // 列表内容需要重绘，重新初始化一次配置页
    run('controlMgr.init();');
    return tick(20).then(() => {
      const btn = Array.from(box.querySelectorAll('button')).find((b) => b.textContent.includes('按总数生成'));
      assert.ok(btn, '没有生成按钮');
      btn.click();
      const spans = JSON.parse(run('JSON.stringify(currentData.configuration.cycle.spans)'));
      assert.deepStrictEqual(spans, [{ activity: 'work', count: 5 }, { activity: 'rest', count: 2 }]);
    });
  });

  await check('切换导出格式为 CSES v1 后 v2 字段隐藏', () => {
    const sel = w.document.getElementById('extraKey.Settings.Format');
    assert.ok(sel, '缺少导出格式选择器');
    sel.value = 'cy1';
    sel.dispatchEvent(new w.Event('change'));
    return tick(30).then(() => {
      assert.strictEqual(run('storage.getOutputMode()'), 'cy1');
      assert.strictEqual(w.document.getElementById('configuration.name'), null, 'v1 下不应显示 configuration 字段');
      assert.strictEqual(run('storage.getInstanceMode("inst-x")'), 'cy1');
    });
  });

  await check('切回 CSES v2 后 v2 字段回来', () => {
    const sel = w.document.getElementById('extraKey.Settings.Format');
    sel.value = 'cy2';
    sel.dispatchEvent(new w.Event('change'));
    return tick(30).then(() => {
      assert.ok(w.document.getElementById('configuration.name'), 'v2 下应显示 configuration 字段');
      assert.strictEqual(run('storage.getInstanceMode("inst-x")'), 'cy2');
    });
  });

  await check('ClassIsland 集控配置（settings-ci.json）也能正常加载渲染', async () => {
    w.fetch = async (url) => {
      const u = String(url);
      if (u.endsWith('control/settings-ci.json')) {
        return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(path.join(ROOT, 'control', 'settings-ci.json'), 'utf8')) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };
    w.localStorage.setItem('output-mode', 'ci');
    run('storage.setOutputMode("ci", {silent:true, noRefresh:true}); controlMgr.init();');
    await tick(30);
    const cards = w.document.querySelectorAll('#settingsTabs .settings-card');
    assert.ok(cards.length >= 20, '集控设置卡片数量异常：' + cards.length);
    assert.ok(w.document.getElementById('extraKey.credentials.UserCredential'), '缺少凭据设置控件');
    assert.ok(!w.document.getElementById('configuration.name'), 'ci 模式下不应出现 CSES 配置');
  });

  await check('全部候选地址都失败时给出提示而不是静默空白', async () => {
    w.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    w.__alert = null;
    run('controlMgr.init();');
    await tick(40);
    assert.ok(String(w.__alert || '').includes('配置加载失败'), '实际提示：' + w.__alert);
  });

  run('window.formatChecker && window.formatChecker.autoTimer && clearInterval(window.formatChecker.autoTimer);');
  w.close();
}

domTests().then(() => {
  console.log('\n通过 ' + passed + ' 项检查' + (process.exitCode ? '（存在失败）' : ''));
  process.exit(process.exitCode || 0);
});
