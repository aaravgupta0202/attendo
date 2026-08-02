// Statistics Page — Attendo v2
document.addEventListener('DOMContentLoaded', () => {

  // ── Chart.js global defaults ──
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.color = '#64748b';

  // ── Elements ──
  const emptyStats   = document.getElementById('emptyStats');
  const statsContent = document.getElementById('statsContent');
  const ovTotal      = document.getElementById('ovTotal');
  const ovAttended   = document.getElementById('ovAttended');
  const ovPercent    = document.getElementById('ovPercent');
  const subjList     = document.getElementById('subjList');
  const atRiskList   = document.getElementById('atRiskList');
  const safeList     = document.getElementById('safeList');

  let pieChart = null, barChart = null;
  let calYear, calMonth;

  // ── Init ──
  init();

  function init() {
    const subjects = Storage.getSubjects();
    if (subjects.length === 0) {
      emptyStats.classList.remove('hidden');
      statsContent.classList.add('hidden');
      return;
    }

    emptyStats.classList.add('hidden');
    statsContent.classList.remove('hidden');

    const stats = computeStats();
    renderOverview(stats);
    renderCharts(stats);
    renderSubjects(stats);
    initCalendar();
    renderInsights(stats);
    setupActions();
  }

  // ── Compute ──
  function computeStats() {
    const subjects = Storage.getSubjects();
    const history  = Storage.getHistory();

    let total = 0, attended = 0, missed = 0, cancelled = 0;
    subjects.forEach(s => { total += s.total || 0; attended += s.attended || 0; });
    missed = total - attended;

    // Count cancellations from history
    history.forEach(d => d.entries.forEach(e => { if (e.status === 'cancelled') cancelled++; }));

    const overall = total > 0 ? Math.round((attended / total) * 100) : 0;

    // Weekly pattern
    const weekly = { Monday:0, Tuesday:0, Wednesday:0, Thursday:0, Friday:0, Saturday:0, Sunday:0 };
    const weeklyTotal = { Monday:0, Tuesday:0, Wednesday:0, Thursday:0, Friday:0, Saturday:0, Sunday:0 };
    history.forEach(d => {
      const date = new Date(d.date + 'T00:00:00');
      const day = Utils.getDayName(date);
      d.entries.forEach(e => {
        if (e.status === 'attended') { weekly[day]++; weeklyTotal[day]++; }
        else if (e.status === 'missed') weeklyTotal[day]++;
      });
    });

    // Subject stats
    const subjectData = subjects.map(s => {
      const pct = Utils.calculatePercentage(s.attended, s.total);
      const risk = Utils.getRiskLevel(pct, s.target);
      const needed = Utils.calculateNeeded(s.attended, s.total, s.target);
      const safe   = Utils.calculateSafeToMiss(s.attended, s.total, s.target);
      return { ...s, pct, risk, needed, safe };
    }).sort((a, b) => b.pct - a.pct);

    const atRisk = subjectData.filter(s => s.risk === 'high').sort((a,b) => a.pct - b.pct);
    const safeTo = subjectData.filter(s => s.safe > 0).sort((a,b) => b.safe - a.safe);

    return { total, attended, missed, cancelled, overall, weekly, weeklyTotal, subjectData, atRisk, safeTo };
  }

  // ── Overview ──
  function renderOverview(stats) {
    animateCount(ovTotal,    stats.total);
    animateCount(ovAttended, stats.attended);
    ovPercent.textContent = stats.overall + '%';
  }

  function animateCount(el, target) {
    if (target === 0) { el.textContent = '0'; return; }
    let start = 0;
    const duration = 600;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      el.textContent = Math.round(start);
      if (start >= target) clearInterval(timer);
    }, 16);
  }

  // ── Charts ──
  function renderCharts(stats) {
    // Pie chart
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: ['Attended', 'Missed', 'Cancelled'],
        datasets: [{
          data: [stats.attended, stats.missed, stats.cancelled || 0],
          backgroundColor: ['#10b981', '#f43f5e', '#94a3b8'],
          borderWidth: 0,
          hoverOffset: 6,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 16, boxWidth: 12, borderRadius: 4, useBorderRadius: true, font: { size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.raw;
                const tot = ctx.dataset.data.reduce((a,b)=>a+b,0);
                const pct = tot > 0 ? Math.round(val/tot*100) : 0;
                return ` ${val} classes (${pct}%)`;
              }
            }
          }
        },
        cutout: '62%'
      }
    });

    // Bar chart (weekly pattern)
    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const dayShort = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const rates = days.map(d => {
      const tot = stats.weeklyTotal[d];
      const att = stats.weekly[d];
      return tot > 0 ? Math.round(att/tot*100) : 0;
    });

    const barCtx = document.getElementById('barChart').getContext('2d');
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: dayShort,
        datasets: [{
          label: 'Attendance %',
          data: rates,
          backgroundColor: rates.map(r =>
            r >= 85 ? 'rgba(16,185,129,0.8)' :
            r >= 70 ? 'rgba(245,158,11,0.8)' :
            r === 0 ? 'rgba(148,163,184,0.3)' :
                      'rgba(244,63,94,0.8)'
          ),
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 36
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ` ${ctx.raw}%` }
          }
        },
        scales: {
          y: {
            min: 0, max: 100,
            grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
            ticks: { callback: v => v+'%', stepSize: 25, font: { size: 11 } },
            border: { display: false }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } },
            border: { display: false }
          }
        }
      }
    });
  }

  // ── Subject List ──
  function renderSubjects(stats) {
    subjList.innerHTML = '';
    if (!stats.subjectData.length) {
      subjList.innerHTML = '<p style="color:var(--mist);text-align:center;padding:1rem">No subjects found</p>';
      return;
    }

    stats.subjectData.forEach(s => {
      const fillClass = s.risk === 'low' ? 'fill-emerald' : s.risk === 'medium' ? 'fill-amber' : 'fill-rose';
      const badgeClass = s.risk === 'low' ? 'badge-emerald' : s.risk === 'medium' ? 'badge-amber' : 'badge-rose';
      const badgeLabel = s.risk === 'low' ? 'On Track' : s.risk === 'medium' ? 'Watch Out' : 'At Risk';

      const card = document.createElement('div');
      card.className = `subj-card risk-${s.risk}`;
      card.innerHTML = `
        <div class="subj-head">
          <span class="subj-name">${Utils.escapeHtml(s.name)}</span>
          <span class="badge ${badgeClass}">${badgeLabel}</span>
        </div>
        <div class="subj-stats">
          <div class="subj-stat-box">
            <div class="subj-stat-val">${s.pct}%</div>
            <div class="subj-stat-lbl">Current</div>
          </div>
          <div class="subj-stat-box">
            <div class="subj-stat-val">${s.target}%</div>
            <div class="subj-stat-lbl">Target</div>
          </div>
          <div class="subj-stat-box">
            <div class="subj-stat-val" style="color:var(--rose-d)">${s.needed > 0 ? (Number.isFinite(s.needed) ? s.needed : '—') : '–'}</div>
            <div class="subj-stat-lbl">Need</div>
          </div>
          <div class="subj-stat-box">
            <div class="subj-stat-val" style="color:var(--emerald-d)">${s.safe > 0 ? s.safe : '–'}</div>
            <div class="subj-stat-lbl">Can Miss</div>
          </div>
        </div>
        <div class="subj-progress-wrap">
          <div class="subj-progress-meta">
            <span>${s.attended}/${s.total} classes attended</span>
            <span>${s.pct}% / ${s.target}% target</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${fillClass}" style="width:${Math.min(s.pct,100)}%"></div>
          </div>
        </div>
      `;
      subjList.appendChild(card);
    });
  }

  // ── Calendar ──
  function initCalendar() {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    renderCalendar();

    document.getElementById('calPrev').addEventListener('click', () => {
      calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCalendar();
    });
    document.getElementById('calNext').addEventListener('click', () => {
      calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; }
      renderCalendar();
    });
    document.getElementById('calToday').addEventListener('click', () => {
      const n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth();
      renderCalendar();
    });
  }

  function renderCalendar() {
    const grid = document.getElementById('calGrid');
    const label = document.getElementById('calMonthLabel');
    const history = Storage.getHistory();
    const now = new Date();
    const todayStr = Utils.formatDate(now);

    label.textContent = `${Utils.getMonthName(calMonth)} ${calYear}`;
    grid.innerHTML = '';

    // Day headers
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
      const el = document.createElement('div');
      el.className = 'cal-dow';
      el.textContent = d;
      grid.appendChild(el);
    });

    // Build date map from history
    const dateMap = {};
    history.forEach(day => {
      const entries = day.entries.filter(e => e.status !== 'cancelled');
      if (!entries.length) return;
      const att = entries.filter(e => e.status === 'attended').length;
      const tot = entries.length;
      dateMap[day.date] = { att, tot, pct: Math.round(att/tot*100) };
    });

    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = Utils.getDaysInMonth(calYear, calMonth);

    // Empty cells before month
    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement('div');
      el.className = 'cal-cell empty';
      grid.appendChild(el);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const data = dateMap[dateStr];
      const isToday = dateStr === todayStr;

      const el = document.createElement('div');
      el.className = 'cal-cell';
      el.textContent = d;

      if (isToday) {
        el.classList.add('today');
      } else if (data) {
        if (data.att === 0)          el.classList.add('missed');
        else if (data.att < data.tot) el.classList.add('partial');
        else                           el.classList.add('full');
        el.title = `${data.att}/${data.tot} attended (${data.pct}%)`;
      }

      grid.appendChild(el);
    }
  }

  // ── Insights ──
  function renderInsights(stats) {
    // At risk
    atRiskList.innerHTML = '';
    if (!stats.atRisk.length) {
      atRiskList.innerHTML = '<div class="insight-empty">All subjects are on track! 🎉</div>';
    } else {
      stats.atRisk.forEach(s => {
        const row = document.createElement('div');
        row.className = 'insight-row';
        const neededLabel = Number.isFinite(s.needed) ? `${s.needed} needed` : 'target unreachable';
        row.innerHTML = `<span class="insight-subj">${Utils.escapeHtml(s.name)}</span><span class="insight-val">${s.pct}% (${neededLabel})</span>`;
        atRiskList.appendChild(row);
      });
    }

    // Safe to miss
    safeList.innerHTML = '';
    if (!stats.safeTo.length) {
      safeList.innerHTML = '<div class="insight-empty">No buffer classes available</div>';
    } else {
      stats.safeTo.forEach(s => {
        const row = document.createElement('div');
        row.className = 'insight-row';
        row.innerHTML = `<span class="insight-subj">${Utils.escapeHtml(s.name)}</span><span class="insight-val">${s.safe} class${s.safe !== 1 ? 'es' : ''}</span>`;
        safeList.appendChild(row);
      });
    }
  }

  // ── Data Actions ──
  function setupActions() {
    const exportFn = () => {
      const data = Storage.exportData();
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: `attendo-${Utils.formatDate()}.json` });
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      Utils.showToast('Data exported!', 'success');
    };

    const importFn = () => document.getElementById('importFile').click();

    const resetFn = () => {
      if (confirm('Reset ALL data? This cannot be undone.')) {
        Storage.clearAllData();
        Utils.showToast('Data cleared', 'info');
        setTimeout(() => location.reload(), 1000);
      }
    };

    document.getElementById('actExport').addEventListener('click', exportFn);
    document.getElementById('actImport').addEventListener('click', importFn);
    document.getElementById('actReset').addEventListener('click', resetFn);
    document.getElementById('exportStatsBtn').addEventListener('click', exportFn);

    document.getElementById('importFile').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const result = Storage.importData(ev.target.result);
          if (result.success) {
            Utils.showToast('Imported!', 'success');
            setTimeout(() => location.reload(), 1000);
          } else {
            Utils.showToast('Import failed: ' + result.error, 'error');
          }
        } catch { Utils.showToast('Invalid file', 'error'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }
});
