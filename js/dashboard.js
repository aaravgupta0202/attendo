// Dashboard — Attendo v2.1
document.addEventListener('DOMContentLoaded', () => {

  // ── DOM refs ──
  const setupPrompt      = document.getElementById('setupPrompt');
  const heroStats        = document.getElementById('heroStats');
  const scheduleSection  = document.getElementById('scheduleSection');
  const classesContainer = document.getElementById('classesContainer');
  const emptyDay         = document.getElementById('emptyDay');
  const swipeGuide       = document.getElementById('swipeGuide');
  const statTotal        = document.getElementById('statTotal');
  const statAttended     = document.getElementById('statAttended');
  const statMissed       = document.getElementById('statMissed');
  const dayPill          = document.getElementById('dayPill');
  const scheduleCount    = document.getElementById('scheduleCount');
  const dateChip         = document.getElementById('dateChip');
  const undoBtn          = document.getElementById('undoBtn');
  const markAllBtn       = document.getElementById('markAllBtn');
  const refreshBtn       = document.getElementById('refreshBtn');
  const menuBtn          = document.getElementById('menuBtn');
  const sideMenu         = document.getElementById('sideMenu');
  const menuClose        = document.getElementById('menuClose');
  const menuOverlay      = document.getElementById('menuOverlay');
  const storageFill      = document.getElementById('storageFill');
  const storageText      = document.getElementById('storageText');

  // Ring geometry — viewBox="0 0 60 60", cx=cy=30, r=24
  // stroke-width=5.5 → inner radius ≈ 21.25px → inner diameter ≈ 42.5px
  // circumference = 2π × 24 ≈ 150.796
  const RING_R = 24;
  const RING_C = +(2 * Math.PI * RING_R).toFixed(3); // 150.796

  let undoStack = [];

  // ── Boot ──
  init();

  function init() {
    updateDateChip();
    dayPill.textContent = Utils.getDayName(new Date());
    checkSetup();
    loadClasses();
    setupMenu();
    setupActions();
    updateStorage();

    // First-run welcome
    const settings = JSON.parse(localStorage.getItem('attendo_settings') || '{}');
    if (settings.firstRun !== false) {
      setTimeout(() => {
        Utils.showToast('Welcome! Set up your subjects to get started.', 'info', 5000);
        settings.firstRun = false;
        localStorage.setItem('attendo_settings', JSON.stringify(settings));
      }, 900);
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeMenu();
    });
  }

  function updateDateChip() {
    dateChip.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    });
  }

  // ── Setup check ──
  function checkSetup() {
    const subjects  = Storage.getSubjects();
    const timetable = Storage.getTimetable();
    const ok = subjects.length > 0 && Object.values(timetable).some(d => d.length > 0);
    setupPrompt.classList.toggle('hidden', ok);
    heroStats.classList.toggle('hidden', !ok);
    scheduleSection.classList.toggle('hidden', !ok);
  }

  // ── Load classes ──
  function loadClasses() {
    const today        = new Date();
    const dayName      = Utils.getDayName(today).toLowerCase();
    const subjectIds   = Storage.getSubjectsForDay(dayName);
    const subjects     = Storage.getSubjects();
    const todayHistory = Storage.getHistoryForDate(Utils.formatDate(today));
    
    // Include extra classes added for today
    const historySubjectIds = todayHistory.entries.map(e => e.subjectId);
    const allSubjectIds = [...new Set([...subjectIds, ...historySubjectIds])];
    
    const todaySubs = subjects.filter(s => allSubjectIds.includes(s.id));

    const attended = todayHistory.entries.filter(e => e.status === 'attended').length;
    const missed   = todayHistory.entries.filter(e => e.status === 'missed').length;

    statTotal.textContent    = todaySubs.length;
    statAttended.textContent = attended;
    statMissed.textContent   = missed;
    scheduleCount.textContent = todaySubs.length
      ? todaySubs.length + ' class' + (todaySubs.length !== 1 ? 'es' : '') + ' today'
      : 'No classes today';

    classesContainer.innerHTML = '';

    if (todaySubs.length === 0) {
      emptyDay.classList.remove('hidden');
      swipeGuide.classList.add('hidden');
      return;
    }

    emptyDay.classList.add('hidden');
    swipeGuide.classList.remove('hidden');

    todaySubs.forEach((subject, i) => {
      const card = buildCard(subject, todayHistory);
      card.style.animationDelay = (i * 0.07) + 's';
      card.classList.add('animate-up');
      classesContainer.appendChild(card);
      attachSwipe(card, subject.id);
    });

    updateUndoBtn();
  }

  // ── Build card ──
  function buildCard(subject, todayHistory) {
    const pct    = Utils.calculatePercentage(subject.attended, subject.total);
    const risk   = Utils.getRiskLevel(pct, subject.target);
    const status = (todayHistory.entries.find(e => e.subjectId === subject.id) || {}).status || 'pending';

    const fillClass  = risk === 'low' ? 'fill-emerald' : risk === 'medium' ? 'fill-amber' : 'fill-rose';
    const ringColor  = risk === 'low' ? '#10b981'      : risk === 'medium' ? '#f59e0b'    : '#f43f5e';

    // Clamp pct 0–100, compute dashoffset
    const clamped    = Math.min(Math.max(pct, 0), 100);
    const dashOffset = +(RING_C * (1 - clamped / 100)).toFixed(2);

    const riskMeta = {
      low:    { cls: 'on-track',  icon: 'fa-circle-check',          label: 'On Track' },
      medium: { cls: 'watch-out', icon: 'fa-triangle-exclamation',   label: 'Watch Out' },
      high:   { cls: 'at-risk',   icon: 'fa-circle-exclamation',     label: 'At Risk' }
    };
    const riskInfo = riskMeta[risk] || riskMeta.high;

    const statusMeta = {
      pending:   { icon: 'fa-clock',        label: 'Pending' },
      attended:  { icon: 'fa-circle-check', label: 'Attended' },
      missed:    { icon: 'fa-circle-xmark', label: 'Absent' },
      cancelled: { icon: 'fa-ban',          label: 'Cancelled' }
    };
    const statusInfo = statusMeta[status] || statusMeta.pending;

    const card = document.createElement('div');
    card.className = 'class-card';
    card.dataset.subjectId = subject.id;
    card.classList.add('marked-' + status);
    card.style.setProperty('--card-color', subject.color || '#4f46e5');

    // SVG ring: viewBox="0 0 60 60", cx=cy=30, r=RING_R
    card.innerHTML =
      '<div class="card-stripe"></div>' +

      '<div class="swipe-badge swipe-badge-present">' +
        '<i class="fas fa-circle-check"></i> Present' +
      '</div>' +
      '<div class="swipe-badge swipe-badge-absent">' +
        '<i class="fas fa-circle-xmark"></i> Absent' +
      '</div>' +

      '<div class="card-body">' +
        '<div class="card-info">' +
          '<div class="subject-title">' + Utils.escapeHtml(subject.name) + '</div>' +
          '<span class="risk-tag ' + riskInfo.cls + '">' +
            '<i class="fas ' + riskInfo.icon + '"></i> ' + riskInfo.label +
          '</span>' +
        '</div>' +

        '<div class="ring-wrap">' +
          '<svg class="ring-svg" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">' +
            '<circle class="ring-bg"   cx="30" cy="30" r="' + RING_R + '"/>' +
            '<circle class="ring-fill" cx="30" cy="30" r="' + RING_R + '"' +
              ' stroke="' + ringColor + '"' +
              ' stroke-dasharray="' + RING_C + '"' +
              ' stroke-dashoffset="' + dashOffset + '"/>' +
          '</svg>' +
          '<div class="ring-label">' + pct + '%</div>' +
        '</div>' +
      '</div>' +

      '<div class="card-progress">' +
        '<div class="progress-meta">' +
          '<span>' + subject.attended + '/' + subject.total + ' attended</span>' +
          '<span>Target: ' + subject.target + '%</span>' +
        '</div>' +
        '<div class="progress-track">' +
          '<div class="progress-fill ' + fillClass + '" style="width:' + clamped + '%"></div>' +
        '</div>' +
      '</div>' +

      '<div class="card-footer">' +
        '<div class="status-row">' +
          '<div class="status-icon ' + status + '">' +
            '<i class="fas ' + statusInfo.icon + '"></i>' +
          '</div>' +
          '<span>' + statusInfo.label + '</span>' +
        '</div>' +
        '<div class="swipe-hint">' +
          '<span><i class="fas fa-arrow-left"></i> Absent</span>' +
          '<span>Present <i class="fas fa-arrow-right"></i></span>' +
        '</div>' +
      '</div>';

    return card;
  }

  function updateCardStatus(card, status) {
    const meta = {
      pending:   { icon: 'fa-clock',        label: 'Pending' },
      attended:  { icon: 'fa-circle-check', label: 'Attended' },
      missed:    { icon: 'fa-circle-xmark', label: 'Absent' },
      cancelled: { icon: 'fa-ban',          label: 'Cancelled' }
    };
    const info = meta[status] || meta.pending;
    const iconEl  = card.querySelector('.status-icon');
    const labelEl = card.querySelector('.status-row > span');
    if (iconEl)  { iconEl.className = 'status-icon ' + status; iconEl.innerHTML = '<i class="fas ' + info.icon + '"></i>'; }
    if (labelEl) { labelEl.textContent = info.label; }
  }

  // ── Swipe ──
  // Uses direct rAF-driven transform (no CSS transition on transform while dragging)
  // Spring-back uses CSS transition; fly-out is instant requestAnimationFrame
  function attachSwipe(card, subjectId) {
    let active = false;
    let startX = 0, dx = 0, vel = 0, lastX = 0, lastT = 0;
    let tapPossible = true;
    let rafId = null;

    function onStart(e) {
      if (e.type === 'touchstart') e.preventDefault();
      active = true;
      tapPossible = true;
      dx = 0; vel = 0;
      startX = lastX = e.touches ? e.touches[0].clientX : e.clientX;
      lastT  = Date.now();

      // Suppress CSS transition on transform while dragging
      card.style.transition = 'border-color 120ms ease, background 120ms ease';

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onEnd);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend',  onEnd);
    }

    function onMove(e) {
      if (!active) return;
      if (e.type === 'touchmove') e.preventDefault();

      const cx  = e.touches ? e.touches[0].clientX : e.clientX;
      const now = Date.now();
      const dt  = now - lastT || 1;

      dx   = cx - startX;
      vel  = (cx - lastX) / dt;
      lastX = cx; lastT = now;

      if (Math.abs(dx) > 6) tapPossible = false;

      // Apply transform — natural feel with slight damping at extremes
      const travel = dx * 0.44;
      const rot    = dx * 0.025; // subtle tilt
      card.style.transform = 'translateX(' + travel + 'px) rotate(' + rot + 'deg)';

      // Tint + badge
      if (dx > 30) {
        card.classList.add('sw-right'); card.classList.remove('sw-left');
      } else if (dx < -30) {
        card.classList.add('sw-left');  card.classList.remove('sw-right');
      } else {
        card.classList.remove('sw-right', 'sw-left');
      }
    }

    function onEnd() {
      if (!active) return;
      active = false;

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend',  onEnd);

      const absDx  = Math.abs(dx);
      const absVel = Math.abs(vel * 1000); // convert to px/s

      const shouldCommit = absDx > 88 || (absDx > 36 && absVel > 380);

      if (shouldCommit) {
        const dir    = dx > 0 ? 1 : -1;
        const status = dir > 0 ? 'attended' : 'missed';

        markAttendance(subjectId, status);
        updateCardStatus(card, status);
        refreshStats();

        // Snap back and color code instead of removing
        card.style.transition = 'transform 0.48s cubic-bezier(0.16,1,0.3,1), border-color 120ms ease, background 120ms ease';
        card.style.transform  = '';
        card.classList.remove('sw-right', 'sw-left');
        card.classList.remove('marked-attended', 'marked-missed', 'marked-cancelled', 'marked-pending');
        card.classList.add('marked-' + status);

      } else if (tapPossible) {
        // Barely moved — treat as a tap → cancelled.
        // (Handled here, not via a 'click' listener: touchstart's
        // preventDefault() above suppresses the browser's synthetic
        // click after a touch tap, so click never fires on mobile.)
        card.style.transition = 'transform 0.48s cubic-bezier(0.16,1,0.3,1), border-color 120ms ease, background 120ms ease';
        card.style.transform  = '';
        card.classList.remove('sw-right', 'sw-left');

        markAttendance(subjectId, 'cancelled');
        updateCardStatus(card, 'cancelled');
        card.classList.remove('marked-attended', 'marked-missed', 'marked-cancelled', 'marked-pending');
        card.classList.add('marked-cancelled');
        refreshStats();
        card.style.animation = 'none';
        void card.offsetWidth; // force reflow
        card.style.animation = 'shake 0.35s ease';

      } else {
        // Spring back — feels like elastic
        card.style.transition = 'transform 0.48s cubic-bezier(0.16,1,0.3,1), border-color 120ms ease, background 120ms ease';
        card.style.transform  = '';
        card.classList.remove('sw-right', 'sw-left');
      }
    }

    card.addEventListener('mousedown',  onStart);
    card.addEventListener('touchstart', onStart, { passive: false });
  }

  function refreshStats() {
    const today   = new Date();
    const dayName = Utils.getDayName(today).toLowerCase();
    const subs    = Storage.getSubjects().filter(s => Storage.getSubjectsForDay(dayName).includes(s.id));
    const hist    = Storage.getHistoryForDate(Utils.formatDate(today));
    statTotal.textContent    = subs.length;
    statAttended.textContent = hist.entries.filter(e => e.status === 'attended').length;
    statMissed.textContent   = hist.entries.filter(e => e.status === 'missed').length;
  }

  // ── Attendance ──
  function markAttendance(subjectId, status) {
    const today  = Utils.formatDate();
    const result = Storage.markAttendance(today, subjectId, status);
    if (result.success && result.changed) {
      undoStack.push({ subjectId, date: today, prevStatus: result.prevStatus });
      updateUndoBtn();
      const msgs  = { attended: 'Marked present', missed: 'Marked absent', cancelled: 'Marked cancelled' };
      const types = { attended: 'success', missed: 'error', cancelled: 'info' };
      Utils.showToast(msgs[status], types[status]);
    }
  }

  function updateUndoBtn() {
    undoBtn.disabled = undoStack.length === 0;
  }

  // ── Menu ──
  function openMenu()  { sideMenu.classList.add('open'); menuOverlay.classList.add('show'); }
  function closeMenu() { sideMenu.classList.remove('open'); menuOverlay.classList.remove('show'); }

  function setupMenu() {
    menuBtn.addEventListener('click', openMenu);
    menuClose.addEventListener('click', closeMenu);
    menuOverlay.addEventListener('click', closeMenu);
  }

  function updateStorage() {
    const info = Utils.calculateStorageUsage();
    storageFill.style.width = info.percentage + '%';
    storageText.textContent  = info.formatted + ' used';
  }

  // ── Actions ──
  function setupActions() {
    undoBtn.addEventListener('click', () => {
      const action = undoStack.pop();
      if (!action) return;
      updateUndoBtn();
      if (Storage.revertAttendance(action.date, action.subjectId, action.prevStatus)) {
        loadClasses();
        Utils.showToast('Undo successful', 'success');
      }
    });

    refreshBtn.addEventListener('click', () => {
      loadClasses();
      Utils.showToast('Refreshed', 'info');
    });

    markAllBtn.addEventListener('click', () => {
      const ids = Storage.getSubjectsForDay(Utils.getDayName(new Date()).toLowerCase());
      ids.forEach(id => markAttendance(id, 'attended'));
      setTimeout(() => loadClasses(), 150);
      Utils.showToast('All marked present', 'success');
    });

    document.getElementById('menuExport').addEventListener('click', () => {
      const data = Storage.exportData();
      const url  = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), {
        href: url, download: 'attendo-' + Utils.formatDate() + '.json'
      });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Utils.showToast('Exported!', 'success');
      closeMenu();
    });

    document.getElementById('menuImport').addEventListener('click', () => {
      document.getElementById('importInput').click();
      closeMenu();
    });
    document.getElementById('importInput').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const result = Storage.importData(ev.target.result);
          if (result.success) {
            Utils.showToast('Data imported!', 'success');
            setTimeout(() => location.reload(), 900);
          } else {
            Utils.showToast('Import failed: ' + result.error, 'error');
          }
        } catch (_) { Utils.showToast('Invalid file', 'error'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('menuReset').addEventListener('click', () => {
      if (confirm('Reset ALL data? This cannot be undone.')) {
        Storage.clearAllData();
        Utils.showToast('All data cleared', 'info');
        setTimeout(() => location.reload(), 900);
      }
      closeMenu();
    });

    // ── Extra Class Modal Logic ──
    const extraClassModal = document.getElementById('extraClassModal');
    const extraClassOverlay = document.getElementById('extraClassOverlay');
    const extraClassList = document.getElementById('extraClassList');
    const extraClassSelect = document.getElementById('extraClassSelect');
    const openModalBtn = document.getElementById('addExtraClassBtn');
    const closeModalBtn = document.getElementById('extraClassClose');
    const confirmClassBtn = document.getElementById('extraClassConfirmBtn');

    function openExtraClassModal() {
      // Populate custom list
      extraClassList.innerHTML = '';
      extraClassSelect.value = '';
      
      Storage.getSubjects().forEach(s => {
        const item = document.createElement('div');
        item.className = 'custom-selector-item';
        item.textContent = s.name;
        item.dataset.value = s.id;
        item.addEventListener('click', () => {
          extraClassList.querySelectorAll('.custom-selector-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          extraClassSelect.value = s.id;
        });
        extraClassList.appendChild(item);
      });
      extraClassModal.classList.remove('hidden');
      extraClassOverlay.classList.add('active');
      // small delay to allow display:block before adding active class for transition
      requestAnimationFrame(() => extraClassModal.classList.add('active'));
    }

    function closeExtraClassModal() {
      extraClassModal.classList.remove('active');
      extraClassOverlay.classList.remove('active');
      setTimeout(() => extraClassModal.classList.add('hidden'), 300);
    }

    openModalBtn.addEventListener('click', openExtraClassModal);
    closeModalBtn.addEventListener('click', closeExtraClassModal);
    extraClassOverlay.addEventListener('click', closeExtraClassModal);

    confirmClassBtn.addEventListener('click', () => {
      const subjectId = extraClassSelect.value;
      if (!subjectId) {
        Utils.showToast('Please select a subject', 'warning');
        return;
      }
      const today = Utils.formatDate(new Date());
      // Mark as pending to create the history entry without affecting stats
      Storage.markAttendance(today, subjectId, 'pending');
      closeExtraClassModal();
      loadClasses();
      Utils.showToast('Extra class added!', 'success');
    });
  }

});
