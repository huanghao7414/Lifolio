/* ═══════════════════════════════════════════
   Lifolio Web · 量化人生簿 — 交互逻辑
   导航切换 / 物品详情 / AI 对话 / 设置控件
   ═══════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── 页面元信息 ── */
  var PAGE_META = {
    home:     { title: '首页', sub: '8月31日 星期一' },
    items:    { title: '物品', sub: '32 件物品 · AI 总估值 ¥ 86,200' },
    value:    { title: '价值', sub: 'AI 综合评估你的生活价值健康度' },
    settings: { title: '设置', sub: '个性化你的 Lifolio' }
  };

  var navItems = document.querySelectorAll('.nav-item');
  var pages = document.querySelectorAll('.page');
  var pageTitle = document.getElementById('page-title');
  var pageSub = document.getElementById('page-sub');
  var aiScreen = document.getElementById('ai-screen');

  function showPage(name) {
    pages.forEach(function (p) { p.classList.toggle('active', p.id === 'page-' + name); });
    navItems.forEach(function (n) { n.classList.toggle('active', n.dataset.page === name); });
    pageTitle.textContent = PAGE_META[name].title;
    pageSub.textContent = PAGE_META[name].sub;
    try { history.replaceState(null, '', '#' + name); } catch (e) {}
  }

  navItems.forEach(function (item) {
    item.addEventListener('click', function () { showPage(item.dataset.page); });
  });

  /* data-goto 跳转（查看完整报告 / 评分卡 / 录物品） */
  document.querySelectorAll('[data-goto]').forEach(function (el) {
    el.addEventListener('click', function () { showPage(el.dataset.goto); });
  });

  /* ── AI 对话屏开关 ── */
  document.getElementById('btn-open-ai').addEventListener('click', function () {
    aiScreen.classList.add('open');
  });
  document.getElementById('btn-close-ai').addEventListener('click', function () {
    aiScreen.classList.remove('open');
  });
  document.getElementById('qa-add').addEventListener('click', function () {
    aiScreen.classList.add('open');
    document.getElementById('ai-input').focus();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') aiScreen.classList.remove('open');
  });

  /* ── 物品数据（与设计稿一致） ── */
  var ICONS = {
    airpods: '<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><path d="M27 20c-4 3-6.5 8-6.5 13.5S23 50 27 53" stroke="#fff" stroke-opacity=".9" stroke-width="4" stroke-linecap="round"/><circle cx="44" cy="24" r="10" stroke="#fff" stroke-opacity=".9" stroke-width="4"/><rect x="42" y="34" width="4" height="18" rx="2" fill="#fff" fill-opacity=".9"/></svg>',
    iphone: '<svg width="52" height="72" viewBox="0 0 52 72" fill="none"><rect x="4" y="2" width="44" height="68" rx="11" stroke="#fff" stroke-opacity=".9" stroke-width="3"/><rect x="17" y="8" width="18" height="4" rx="2" fill="#fff" fill-opacity=".9"/><circle cx="26" cy="34" r="11" stroke="#fff" stroke-opacity=".9" stroke-width="3"/></svg>',
    kindle: '<svg width="54" height="72" viewBox="0 0 54 72" fill="none"><rect x="6" y="4" width="42" height="64" rx="6" stroke="#fff" stroke-opacity=".9" stroke-width="3"/><rect x="16" y="22.5" width="22" height="3" rx="1.5" fill="#fff" fill-opacity=".9"/><rect x="16" y="32.5" width="16" height="3" rx="1.5" fill="#fff" fill-opacity=".9"/><rect x="16" y="42.5" width="22" height="3" rx="1.5" fill="#fff" fill-opacity=".9"/><circle cx="24" cy="56" r="2.5" fill="#fff" fill-opacity=".9"/></svg>',
    switch: '<svg width="72" height="54" viewBox="0 0 72 54" fill="none"><rect x="4" y="8" width="26" height="38" rx="9" stroke="#fff" stroke-opacity=".9" stroke-width="3.5"/><rect x="42" y="8" width="26" height="38" rx="9" stroke="#fff" stroke-opacity=".9" stroke-width="3.5"/><path d="M30 17c4.5 3.5 7.5 8 7.5 12.5S34.5 40 30 43.5" stroke="#fff" stroke-opacity=".9" stroke-width="3.5"/><circle cx="17" cy="27" r="4.5" fill="#fff" fill-opacity=".9"/><circle cx="55" cy="27" r="4.5" fill="#fff" fill-opacity=".9"/></svg>',
    sony: '<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><path d="M18 44V34a18 18 0 0 1 36 0v10" stroke="#fff" stroke-opacity=".9" stroke-width="4" stroke-linecap="round"/><rect x="12" y="40" width="14" height="20" rx="6" stroke="#fff" stroke-opacity=".9" stroke-width="4"/><rect x="46" y="40" width="14" height="20" rx="6" stroke="#fff" stroke-opacity=".9" stroke-width="4"/></svg>',
    hhkb: '<svg width="72" height="54" viewBox="0 0 72 54" fill="none"><rect x="4" y="10" width="64" height="34" rx="8" stroke="#fff" stroke-opacity=".9" stroke-width="3.5"/><rect x="12" y="19" width="7" height="7" rx="1.6" fill="#fff" fill-opacity=".9"/><rect x="23" y="19" width="7" height="7" rx="1.6" fill="#fff" fill-opacity=".9"/><rect x="34" y="19" width="7" height="7" rx="1.6" fill="#fff" fill-opacity=".9"/><rect x="45" y="19" width="7" height="7" rx="1.6" fill="#fff" fill-opacity=".9"/><rect x="12" y="30" width="26" height="7" rx="1.6" fill="#fff" fill-opacity=".9"/><rect x="42" y="30" width="7" height="7" rx="1.6" fill="#fff" fill-opacity=".9"/></svg>'
  };

  var ITEMS = [
    {
      id: 'airpods', name: 'AirPods Pro 2', grad: 'g-airpods', icon: 'airpods',
      value: '¥1,280', worth: '值 92', worthClass: 'worth-high', label: 'AI 估值', hot: false,
      meta: '电子产品 · 2024年9月购入 · 累计使用 186 次', price: '¥1,899', cost: '¥ 4.30',
      advice: '建议继续持有 — 近 30 天使用频率上升 12%，当前二手行情稳定。'
    },
    {
      id: 'iphone', name: 'iPhone 15 Pro', grad: 'g-iphone', icon: 'iphone',
      value: '¥5,200', worth: '值 88', worthClass: 'worth-high', label: 'AI 估值', hot: false,
      meta: '电子产品 · 2024年10月购入 · 累计使用 412 次', price: '¥7,999', cost: '¥ 6.80',
      advice: '建议继续持有 — 相机与日常工具属性让使用频率保持高位，折旧速度低于同类机型平均水平。'
    },
    {
      id: 'kindle', name: 'Kindle Paperwhite', grad: 'g-kindle', icon: 'kindle',
      value: '¥420', worth: '值 76', worthClass: 'worth-high', label: 'AI 估值', hot: false,
      meta: '数码阅读 · 2023年6月购入 · 累计使用 38 次', price: '¥998', cost: '¥ 15.20',
      advice: '建议保留 — 虽然使用频率偏低，但二手折价空间有限。如果 90 天内仍低频使用，可考虑挂闲鱼。'
    },
    {
      id: 'switch', name: 'Switch OLED', grad: 'g-switch', icon: 'switch',
      value: '¥1,050', worth: '值 64', worthClass: 'worth-low', label: 'AI 估值 · 闲置 90 天', hot: true,
      meta: '游戏设备 · 2023年3月购入 · 累计使用 12 次', price: '¥2,399', cost: '¥ 112.40',
      advice: '建议考虑出售 — 已闲置 90 天，使用频率持续走低。当前二手行情处于高位，是出手的好时机。'
    },
    {
      id: 'sony', name: 'Sony WH-1000XM5', grad: 'g-sony', icon: 'sony',
      value: '¥1,680', worth: '值 85', worthClass: 'worth-high', label: 'AI 估值', hot: false,
      meta: '电子产品 · 2024年3月购入 · 累计使用 204 次', price: '¥2,899', cost: '¥ 5.96',
      advice: '建议继续持有 — 降噪耳机是你的通勤刚需，使用频率稳定，残值率健康。'
    },
    {
      id: 'hhkb', name: 'HHKB 机械键盘', grad: 'g-hhkb', icon: 'hhkb',
      value: '¥1,150', worth: '值 71', worthClass: 'worth-high', label: 'AI 估值', hot: false,
      meta: '数码配件 · 2024年1月购入 · 累计使用 156 次', price: '¥1,999', cost: '¥ 5.44',
      advice: '建议继续持有 — 工作日高频使用，静电容键盘保值性好，二手行情稳定。'
    }
  ];

  /* ── 渲染物品网格 ── */
  var grid = document.getElementById('item-grid');
  ITEMS.forEach(function (item, idx) {
    var card = document.createElement('div');
    card.className = 'item-card' + (idx === 0 ? ' selected' : '');
    card.dataset.id = item.id;
    card.innerHTML =
      '<div class="item-img ' + item.grad + '">' + ICONS[item.icon] + '</div>' +
      '<div class="item-name">' + item.name + '</div>' +
      '<div class="item-value-row">' +
        '<div class="item-value-col">' +
          '<span class="item-value-label' + (item.hot ? ' item-value-label-hot' : '') + '">' + item.label + '</span>' +
          '<span class="item-value">' + item.value + '</span>' +
        '</div>' +
        '<span class="worth ' + item.worthClass + '">' + item.worth + '</span>' +
      '</div>';
    card.addEventListener('click', function () {
      document.querySelectorAll('.item-card').forEach(function (c) { c.classList.remove('selected'); });
      card.classList.add('selected');
      updateDetail(item);
    });
    grid.appendChild(card);
  });

  /* ── 详情面板更新 ── */
  var detailHero = document.getElementById('detail-hero');
  function updateDetail(item) {
    detailHero.className = 'detail-hero ' + item.grad;
    detailHero.innerHTML = ICONS[item.icon];
    document.getElementById('detail-name').textContent = item.name;
    document.getElementById('detail-meta').textContent = item.meta;
    document.getElementById('detail-price').textContent = item.price;
    document.getElementById('detail-value').textContent = item.value;
    document.getElementById('detail-cost').textContent = item.cost;
    document.getElementById('detail-advice').textContent = item.advice;
  }
  updateDetail(ITEMS[0]);

  /* ── 筛选 chips ── */
  document.querySelectorAll('.chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      document.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('chip-on'); });
      chip.classList.add('chip-on');
    });
  });

  /* ── 设置：AI 语气分段控件 ── */
  var segs = document.querySelectorAll('#segmented-tone .seg');
  segs.forEach(function (seg) {
    seg.addEventListener('click', function () {
      segs.forEach(function (s) { s.classList.remove('seg-on'); });
      seg.classList.add('seg-on');
    });
  });

  /* ── 设置：iCloud 开关 ── */
  var sw = document.getElementById('switch-icloud');
  sw.addEventListener('click', function () {
    var on = sw.classList.toggle('switch-on');
    sw.classList.toggle('switch-off', !on);
    sw.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  /* ── AI 对话：发送消息 ── */
  var chatCol = document.getElementById('chat-col');
  var aiInput = document.getElementById('ai-input');
  var thinking = document.getElementById('bubble-thinking');

  function sendMessage() {
    var text = aiInput.value.trim();
    if (!text) return;
    aiInput.value = '';

    var row = document.createElement('div');
    row.className = 'bubble-row-right';
    var bubble = document.createElement('div');
    bubble.className = 'bubble-user';
    bubble.textContent = text;
    row.appendChild(bubble);
    chatCol.insertBefore(row, thinking);

    thinking.style.display = 'flex';
    chatCol.scrollTop = chatCol.scrollHeight;

    // 模拟 AI 回复
    setTimeout(function () {
      thinking.style.display = 'none';
      var reply = document.createElement('div');
      reply.className = 'bubble-ai-plain';
      reply.innerHTML =
        '<div class="ai-tag">✦ AI 回答</div>' +
        '<div class="bubble-ai-text">收到，我来帮你分析。根据最近的消费记录，这笔支出已自动分类并计入本月账单。你可以在「价值」页查看最新的生活价值健康度变化。</div>';
      chatCol.appendChild(reply);
      chatCol.scrollTop = chatCol.scrollHeight;
    }, 1600);
  }

  document.getElementById('btn-send').addEventListener('click', sendMessage);
  aiInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') sendMessage();
  });

  /* ── AI 对话：确认记录 ── */
  document.getElementById('btn-confirm').addEventListener('click', function () {
    var done = document.createElement('div');
    done.className = 'bubble-ai-plain';
    done.innerHTML = '<div class="bubble-ai-text" style="color:#34C759">已确认 ✓ 这笔消费已计入本月账单</div>';
    chatCol.insertBefore(done, thinking);
    thinking.style.display = 'none';
    chatCol.scrollTop = chatCol.scrollHeight;
  });

  /* 初始显示"AI 正在思考"气泡，还原设计稿静态画面 */

  /* ── 启动（支持 hash 直达，如 #items / #ai） ── */
  var initial = (location.hash || '').replace('#', '');
  if (initial === 'ai') {
    showPage('home');
    aiScreen.classList.add('open');
  } else {
    showPage(PAGE_META[initial] ? initial : 'home');
  }
})();
