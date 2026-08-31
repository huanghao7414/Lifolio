/* ═══════════════════════════════════════════
   Lifolio · 量化人生簿 — 交互逻辑
   页面切换 / AI 面板 / 详情页 / 设置控件
   ═══════════════════════════════════════════ */
(function () {
  'use strict';

  var screens = document.querySelectorAll('.screen');
  var tabbar = document.getElementById('tabbar');
  var tabItems = document.querySelectorAll('.tab-item');
  var currentTab = 'home';      // 当前所在标签页
  var aiOrigin = 'home';        // 打开 AI 面板前所在的标签页

  /* ── 工具：切换到指定标签页 ── */
  function showTab(tab) {
    screens.forEach(function (s) {
      s.classList.toggle('active', s.dataset.tab === tab);
    });
    tabItems.forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    tabbar.classList.add('visible');
    currentTab = tab;
    // 让内容区回到顶部
    var content = document.querySelector('#screen-' + tab + ' .content');
    if (content) content.scrollTop = 0;
  }

  /* ── 工具：切换到任意屏幕（不联动标签栏） ── */
  function showScreen(id) {
    screens.forEach(function (s) {
      s.classList.toggle('active', s.id === id);
    });
  }

  /* ── 标签栏点击 ── */
  tabItems.forEach(function (item) {
    item.addEventListener('click', function () {
      showTab(item.dataset.tab);
    });
  });

  /* ── AI FAB：打开深色 AI 面板 ── */
  document.getElementById('btn-ai').addEventListener('click', function () {
    aiOrigin = currentTab;
    tabbar.classList.remove('visible');
    showScreen('screen-ai');
  });

  /* ── 关闭 AI 面板：返回之前标签页 ── */
  document.getElementById('btn-close-ai').addEventListener('click', function () {
    showTab(aiOrigin);
  });

  /* ── 物品卡片 → 物品详情 ── */
  document.querySelectorAll('.item-card').forEach(function (card) {
    card.addEventListener('click', function () {
      var item = card.dataset.item;
      updateDetail(item);
      tabbar.classList.remove('visible');
      showScreen('screen-detail');
    });
  });

  /* ── 详情页返回：回到物品页 ── */
  document.getElementById('btn-back').addEventListener('click', function () {
    showTab('items');
  });

  /* ── 详情页数据（与设计稿一致） ── */
  var DETAIL_DATA = {
    airpods: {
      hero: 'airpods',
      name: 'AirPods Pro 2',
      cat: '电子产品',
      price: '¥1,899',
      value: '¥1,280',
      uses: '186 次',
      cost: '¥ 4.30',
      chartNote: '当前估值 ¥1,280 · 预计 2027 年 9 月残值 ¥680',
      advice: '建议继续持有 — 近 30 天使用频率上升 12%，当前二手行情稳定。AirPods 是你通勤高频使用的物品。'
    },
    iphone: {
      hero: 'iphone',
      name: 'iPhone 15 Pro',
      cat: '电子产品',
      price: '¥7,999',
      value: '¥5,200',
      uses: '412 次',
      cost: '¥ 6.80',
      chartNote: '当前估值 ¥5,200 · 预计 2028 年 6 月残值 ¥2,680',
      advice: '建议继续持有 — 相机与日常工具属性让你的 iPhone 使用频率保持高位，折旧速度低于同类机型平均水平。'
    },
    kindle: {
      hero: 'kindle',
      name: 'Kindle Paperwhite',
      cat: '数码阅读',
      price: '¥998',
      value: '¥420',
      uses: '38 次',
      cost: '¥ 15.20',
      chartNote: '当前估值 ¥420 · 预计 2028 年 3 月残值 ¥220',
      advice: '建议保留 — 虽然使用频率偏低，但二手折价空间有限。如果 90 天内仍低频使用，可考虑挂闲鱼。'
    },
    switch: {
      hero: 'switch',
      name: 'Switch OLED',
      cat: '游戏设备',
      price: '¥2,399',
      value: '¥1,050',
      uses: '12 次',
      cost: '¥ 112.40',
      chartNote: '当前估值 ¥1,050 · 预计 2027 年 12 月残值 ¥820',
      advice: '建议考虑出售 — 已闲置 90 天，使用频率持续走低。当前二手行情处于高位，是出手的好时机。'
    }
  };

  var HERO_ICONS = {
    airpods: '<svg width="140" height="140" viewBox="0 0 140 140" fill="none"><path d="M52 38c-8 6-13 16-13 27s5 21 13 27" stroke="rgba(255,255,255,.92)" stroke-width="7" stroke-linecap="round"/><circle cx="86" cy="47" r="20" stroke="rgba(255,255,255,.92)" stroke-width="7"/><path d="M86 67v36" stroke="rgba(255,255,255,.92)" stroke-width="7" stroke-linecap="round"/></svg>',
    iphone: '<svg width="100" height="140" viewBox="0 0 100 140" fill="none"><rect x="8" y="4" width="84" height="132" rx="20" stroke="rgba(255,255,255,.92)" stroke-width="6"/><rect x="34" y="14" width="32" height="8" rx="4" fill="rgba(255,255,255,.92)"/><circle cx="50" cy="66" r="20" stroke="rgba(255,255,255,.92)" stroke-width="6"/></svg>',
    kindle: '<svg width="104" height="140" viewBox="0 0 104 140" fill="none"><rect x="12" y="8" width="80" height="124" rx="10" stroke="rgba(255,255,255,.92)" stroke-width="6"/><path d="M30 46h44M30 66h32M30 86h44" stroke="rgba(255,255,255,.92)" stroke-width="6" stroke-linecap="round"/><circle cx="46" cy="110" r="5" fill="rgba(255,255,255,.92)"/></svg>',
    switch: '<svg width="140" height="104" viewBox="0 0 140 104" fill="none"><rect x="8" y="16" width="50" height="72" rx="16" stroke="rgba(255,255,255,.92)" stroke-width="6"/><rect x="82" y="16" width="50" height="72" rx="16" stroke="rgba(255,255,255,.92)" stroke-width="6"/><path d="M58 32c8.5 7 14 15 14 23.5S66.5 76 58 83" stroke="rgba(255,255,255,.92)" stroke-width="6"/><circle cx="33" cy="52" r="9" fill="rgba(255,255,255,.92)"/><circle cx="107" cy="52" r="9" fill="rgba(255,255,255,.92)"/></svg>'
  };

  function updateDetail(item) {
    var d = DETAIL_DATA[item] || DETAIL_DATA.airpods;
    document.querySelector('.detail-hero').className = 'detail-hero item-img-' + d.hero;
    document.querySelector('.detail-hero').innerHTML = HERO_ICONS[d.hero];
    document.querySelector('.detail-name').textContent = d.name;
    document.querySelector('.cat-tag').textContent = d.cat;
    var keys = document.querySelectorAll('.key-data .key-value');
    keys[0].textContent = d.price;
    keys[1].textContent = d.value;
    keys[2].textContent = d.uses;
    document.querySelector('.cost-value').textContent = d.cost;
    document.querySelector('.chart-note').textContent = d.chartNote;
    document.querySelector('.ai-advice .ai-text').textContent = d.advice;
  }

  /* ── 设置页：AI 语气分段控件 ── */
  var segs = document.querySelectorAll('#segmented-tone .seg');
  segs.forEach(function (seg) {
    seg.addEventListener('click', function () {
      segs.forEach(function (s) {
        s.classList.remove('seg-on');
        s.classList.add('seg-off');
      });
      seg.classList.add('seg-on');
      seg.classList.remove('seg-off');
    });
  });

  /* ── 设置页：iCloud 开关 ── */
  var sw = document.getElementById('switch-icloud');
  sw.addEventListener('click', function () {
    var on = sw.classList.toggle('switch-on');
    sw.classList.toggle('switch-off', !on);
    sw.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  /* ── AI 面板：发送消息模拟 ── */
  var sendBtn = document.getElementById('btn-send');
  var chat = document.querySelector('.chat');
  var thinking = document.querySelector('.bubble-thinking');
  var userBubble = document.querySelector('.bubble-user');

  sendBtn.addEventListener('click', function () {
    var last = chat.lastElementChild;
    if (last === thinking) {
      // 上一次还在"思考"：把它当作回复完成
      thinking.style.display = 'none';
      return;
    }
    // 追加一条用户消息 + 显示思考中
    var msg = document.createElement('div');
    msg.className = 'bubble-user';
    msg.textContent = userBubble.textContent; // 复用示例文本
    chat.insertBefore(msg, thinking);
    thinking.style.display = 'flex';
    chat.scrollTop = chat.scrollHeight;
  });

  /* ── AI 面板：确认记录按钮 → 收起思考中提示 ── */
  document.querySelector('.btn-confirm').addEventListener('click', function () {
    var done = document.createElement('div');
    done.className = 'bubble-ai';
    done.style.border = 'none';
    done.innerHTML = '<div class="bubble-ai-text" style="color:#34C759">已确认 ✓ 这笔消费已计入本月账单</div>';
    chat.insertBefore(done, thinking);
    thinking.style.display = 'none';
    chat.scrollTop = chat.scrollHeight;
  });

  /* ── 启动：默认首页 ── */
  showTab('home');
})();
