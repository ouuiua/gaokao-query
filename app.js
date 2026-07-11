(function () {
  'use strict';

  const state = {
    results: [],
    filtered: [],
    page: 1,
    pageSize: 15,
    filter: 'all',
    sort: 'match',
    query: null,
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  function init() {
    bindEvents();
    smoothScroll();
  }

  function bindEvents() {
    $('#search-form').addEventListener('submit', function (e) {
      e.preventDefault();
      search();
    });

    $('#search-form').addEventListener('reset', function () {
      setTimeout(function () { $('#results').style.display = 'none'; }, 10);
    });

    $$('.filter-tag').forEach(function (tag) {
      tag.addEventListener('click', function () {
        $$('.filter-tag').forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');
        state.filter = this.dataset.filter;
        applyFilter();
        render();
      });
    });

    $('#sort-by').addEventListener('change', function () {
      state.sort = this.value;
      applySort();
      render();
    });
  }

  function search() {
    const scoreType = $('#score-type').value;
    const score = parseInt($('#score').value);
    const batch = $('#batch').value;
    const keyword = $('#keyword').value.trim().toLowerCase();

    if (!scoreType || isNaN(score)) {
      showToast('请选择科类并输入分数', 'warning');
      return;
    }

    if (score < 200 || score > 750) {
      showToast('请输入有效分数（200-750）', 'error');
      return;
    }

    $('#loading').style.display = 'flex';

    setTimeout(function () {
      state.query = { type: scoreType, score: score, batch: batch, keyword: keyword };
      state.results = matchSchools(scoreType, score, batch, keyword);
      applyFilter();
      applySort();
      state.page = 1;
      render();
      $('#loading').style.display = 'none';
      $('#results').style.display = 'block';
      $('#results-summary').textContent =
        '共 ' + state.filtered.length + ' 所学校，' + countMajors(state.filtered) + ' 个专业';
      setTimeout(function () { $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    }, 500);
  }

  function matchSchools(type, score, batch, keyword) {
    var results = [];
    HEIBEI_DATA.forEach(function (school) {
      // 科类匹配
      if (school.subjects.indexOf(type) === -1) return;

      // 批次匹配
      if (batch && school.batch.indexOf(batch) === -1) return;

      // 关键词匹配
      if (keyword) {
        var nameMatch = school.name.toLowerCase().indexOf(keyword) !== -1;
        var cityMatch = school.city.toLowerCase().indexOf(keyword) !== -1;
        var majorMatch = false;
        school.majors.forEach(function (m) {
          if (m.name.toLowerCase().indexOf(keyword) !== -1) majorMatch = true;
        });
        if (!nameMatch && !cityMatch && !majorMatch) return;
      }

      // 筛选匹配的专业
      var matchedMajors = [];
      school.majors.forEach(function (maj) {
        if (maj.subject !== type) return;
        if (keyword) {
          var inCat = false;
          for (var c = 0; c < school.majors.length; c++) {
            if (school.majors[c].name.toLowerCase().indexOf(keyword) !== -1) { inCat = true; break; }
          }
          if (!inCat && maj.name.toLowerCase().indexOf(keyword) === -1) return;
        }
        matchedMajors.push(maj);
      });

      if (matchedMajors.length === 0) return;

      // 计算匹配分数
      var minOfAll = 999, maxOfAll = 0;
      matchedMajors.forEach(function (m) {
        if (m.minScore < minOfAll) minOfAll = m.minScore;
        if (m.avgScore > maxOfAll) maxOfAll = m.avgScore;
      });

      var avgOfMajors = (minOfAll + maxOfAll) / 2;
      var gap = avgOfMajors - score;

      results.push({
        school: school,
        majors: matchedMajors,
        minScore: minOfAll,
        avgScore: maxOfAll,
        gap: gap,
        matchScore: calcMatch(gap, school, type),
      });
    });

    return results;
  }

  function calcMatch(gap, school, type) {
    var s = 50;
    if (gap <= -10) s += 35;
    else if (gap <= 0) s += 25;
    else if (gap <= 10) s += 15;
    else if (gap <= 20) s += 8;
    else if (gap <= 40) s += 3;
    else s += 0;

    if (school.tier.indexOf('211') !== -1) s += 5;
    if (school.tier.indexOf('双一流') !== -1) s += 5;
    if (school.tier.indexOf('省重点') !== -1) s += 3;

    return Math.min(s, 100);
  }

  function classify(gap) {
    if (gap <= -5) return '保';
    if (gap <= 15) return '稳';
    return '冲';
  }

  function applyFilter() {
    if (state.filter === 'all') {
      state.filtered = state.results.slice();
      return;
    }
    state.filtered = state.results.filter(function (r) {
      return classify(r.gap) === state.filter;
    });
  }

  function applySort() {
    var s = state.sort;
    state.filtered.sort(function (a, b) {
      if (s === 'match') return b.matchScore - a.matchScore;
      if (s === 'score-desc') return b.minScore - a.minScore;
      if (s === 'score-asc') return a.minScore - b.minScore;
      if (s === 'name') return a.school.name.localeCompare(b.school.name, 'zh');
      return 0;
    });
  }

  function render() {
    var container = $('#results-list');
    var start = (state.page - 1) * state.pageSize;
    var pageData = state.filtered.slice(start, start + state.pageSize);

    if (pageData.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">&#128269;</div><h3>未找到匹配结果</h3><p>请调整分数或筛选条件</p></div>';
      $('#pagination').innerHTML = '';
      return;
    }

    var html = '';
    pageData.forEach(function (item, i) {
      var cls = classify(item.gap);
      var clsLabel = { '冲': '冲刺', '稳': '稳妥', '保': '保底' }[cls];
      var clsColor = { '冲': '#ef4444', '稳': '#f59e0b', '保': '#10b981' }[cls];
      var tierColor = item.school.tier.indexOf('211') !== -1 ? '#e53935'
        : item.school.tier.indexOf('双一流') !== -1 ? '#9c27b0'
        : item.school.tier.indexOf('省重点') !== -1 ? '#ff9800'
        : item.school.tier.indexOf('民办') !== -1 ? '#607d8b'
        : item.school.tier.indexOf('专科') !== -1 ? '#4caf50' : '#999';

      html += '<div class="result-card" style="animation-delay:' + (i * 0.05) + 's">'
        + '<div class="card-head">'
        + '<h3 class="school-name">' + item.school.name + '</h3>'
        + '<span class="tier-badge" style="background:' + tierColor + '">' + item.school.tier + '</span>'
        + '</div>'
        + '<div class="card-meta">'
        + '<span class="city">' + item.school.city + '</span>'
        + '<span class="match">匹配 ' + item.matchScore + '%</span>'
        + '<span class="classify" style="background:' + clsColor + ';color:#fff;">' + clsLabel + '</span>'
        + '</div>'
        + '<div class="majors-list">';

      item.majors.forEach(function (m) {
        var mCls = classify((m.minScore + m.avgScore) / 2 - state.query.score);
        var mColor = { '冲': '#ef4444', '稳': '#f59e0b', '保': '#10b981' }[mCls];
        var mLabel = { '冲': '冲刺', '稳': '稳妥', '保': '保底' }[mCls];
        html += '<div class="major-row">'
          + '<span class="major-name">' + m.name + '</span>'
          + '<span class="major-scores">最低 <strong>' + m.minScore + '</strong> / 平均 <strong>' + m.avgScore + '</strong></span>'
          + '<span class="major-rank">位次约 ' + m.rank.toLocaleString() + '</span>'
          + '<span class="major-tag" style="background:' + mColor + ';color:#fff;">' + mLabel + '</span>'
          + '</div>';
      });

      html += '</div></div>';
    });

    container.innerHTML = html;
    renderPagination();
  }

  function renderPagination() {
    var total = state.filtered.length;
    var totalPages = Math.ceil(total / state.pageSize);
    if (totalPages <= 1) { $('#pagination').innerHTML = ''; return; }

    var html = '<div class="page-info">第 ' + state.page + ' / ' + totalPages + ' 页（共 ' + total + ' 所）</div><div class="page-btns">';
    html += '<button class="page-btn' + (state.page <= 1 ? ' disabled' : '') + '" data-p="' + (state.page - 1) + '">&lt; 上一页</button>';

    var sp = Math.max(1, state.page - 2);
    var ep = Math.min(totalPages, sp + 4);
    for (var i = sp; i <= ep; i++) {
      html += '<button class="page-btn' + (i === state.page ? ' active' : '') + '" data-p="' + i + '">' + i + '</button>';
    }

    html += '<button class="page-btn' + (state.page >= totalPages ? ' disabled' : '') + '" data-p="' + (state.page + 1) + '">下一页 &gt;</button>';
    html += '</div>';
    $('#pagination').innerHTML = html;

    $$('.page-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = parseInt(this.dataset.p);
        if (p && p !== state.page) { state.page = p; render(); }
      });
    });
  }

  function countMajors(results) {
    var sum = 0;
    for (var i = 0; i < results.length; i++) sum += results[i].majors.length;
    return sum;
  }

  function showToast(msg, type) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:8px;color:#fff;font-size:14px;z-index:10000;background:'
      + (type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6')
      + ';box-shadow:0 4px 12px rgba(0,0,0,0.2);font-weight:600;';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2500);
  }

  function smoothScroll() {
    // 无锚点链接，不需要
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
