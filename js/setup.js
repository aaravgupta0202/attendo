// setup.js — Attendo v2
document.addEventListener('DOMContentLoaded', () => {

  // ── Constants ─────────────────────────────────────────────
  const COLORS = [
    '#4f46e5','#0ea5e9','#10b981','#f59e0b','#f43f5e',
    '#8b5cf6','#06b6d4','#16a34a','#f97316','#ec4899',
    '#7c3aed','#0891b2','#65a30d','#ea580c','#db2777'
  ];

  const DAYS = [
    { key: 'monday',    short: 'Mon' },
    { key: 'tuesday',   short: 'Tue' },
    { key: 'wednesday', short: 'Wed' },
    { key: 'thursday',  short: 'Thu' },
    { key: 'friday',    short: 'Fri' },
    { key: 'saturday',  short: 'Sat' },
    { key: 'sunday',    short: 'Sun' }
  ];

  // ── State ─────────────────────────────────────────────────
  let currentStep  = 1;
  let selectedId   = null;   // pill tapped on mobile
  let dragId       = null;   // pill being dragged on desktop

  // ── Boot ─────────────────────────────────────────────────
  renderSubjects();
  setupStep1();
  setupStep2Nav();
  setupStep3Nav();

  // ── Stepper ──────────────────────────────────────────────
  function goTo(n) {
    if (n === 2 && Storage.getSubjects().length === 0) {
      Utils.showToast('Add at least one subject first', 'warning');
      return;
    }
    currentStep = n;
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('step' + n).classList.add('active');
    updateStepper();
    if (n === 2) renderTimetable();
    if (n === 3) renderTargets();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateStepper() {
    [1, 2, 3].forEach(i => {
      const node   = document.getElementById('sn' + i);
      const circle = document.getElementById('sc' + i);
      node.classList.remove('active', 'done');
      if (i < currentStep) {
        node.classList.add('done');
        circle.innerHTML = '<i class="fas fa-check"></i>';
      } else if (i === currentStep) {
        node.classList.add('active');
        circle.textContent = i;
      } else {
        circle.textContent = i;
      }
    });
    [1, 2].forEach(i => {
      const line = document.getElementById('sc-line' + i);
      line.classList.toggle('done', i < currentStep);
    });
  }

  // ── Step 1: Subjects ─────────────────────────────────────
  function setupStep1() {
    const input = document.getElementById('subjectInput');
    const addBtn = document.getElementById('addSubjectBtn');

    addBtn.addEventListener('click', addSubject);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') addSubject(); });
    document.getElementById('toStep2').addEventListener('click', () => goTo(2));

    // ── AI Auto-fill ──
    const aiToggle = document.getElementById('aiToggle');
    const aiContent = document.getElementById('aiContent');
    const aiToggleIcon = document.getElementById('aiToggleIcon');
    
    aiToggle.addEventListener('click', () => {
      aiContent.classList.toggle('active');
      aiToggleIcon.className = aiContent.classList.contains('active') ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
    });

    document.getElementById('aiCopyBtn').addEventListener('click', () => {
      const templateText = document.getElementById('aiTemplate').textContent;
      navigator.clipboard.writeText(templateText).then(() => {
        Utils.showToast('Template copied!', 'success');
      }).catch(() => {
        Utils.showToast('Failed to copy', 'warning');
      });
    });

    document.getElementById('aiApplyBtn').addEventListener('click', () => {
      const jsonStr = document.getElementById('aiInput').value.trim();
      if (!jsonStr) {
        Utils.showToast('Please paste the JSON first.', 'warning');
        return;
      }
      try {
        const data = JSON.parse(jsonStr);
        if (!data.subjects || !Array.isArray(data.subjects) || !data.timetable) {
          throw new Error('Invalid format');
        }

        // Clear existing data
        localStorage.setItem(Storage.KEYS.SUBJECTS, JSON.stringify([]));
        localStorage.setItem(Storage.KEYS.TIMETABLE, JSON.stringify({
          sunday: [], monday: [], tuesday: [], wednesday: [],
          thursday: [], friday: [], saturday: []
        }));

        // Add subjects
        const subjectIdMap = {};
        data.subjects.forEach((name, i) => {
           if (typeof name !== 'string' || !name.trim()) return;
           const color = COLORS[i % COLORS.length];
           Storage.addSubject({ name, target: 75, color });
        });
        
        // Map names to generated IDs
        const newSubjects = Storage.getSubjects();
        newSubjects.forEach(s => {
           subjectIdMap[s.name.toLowerCase()] = s.id;
        });

        // Build Timetable
        const tt = Storage.getTimetable();
        Object.keys(data.timetable).forEach(day => {
           const d = day.toLowerCase();
           if (tt[d] !== undefined && Array.isArray(data.timetable[day])) {
              data.timetable[day].forEach(subj => {
                 if (typeof subj !== 'string') return;
                 const id = subjectIdMap[subj.toLowerCase()];
                 if (id && !tt[d].includes(id)) {
                    tt[d].push(id);
                 }
              });
           }
        });
        Storage.saveTimetable(tt);

        renderSubjects();
        Utils.showToast('Timetable applied successfully!', 'success');
        
        // Clean up UI and jump to Step 3
        document.getElementById('aiInput').value = '';
        aiContent.classList.remove('active');
        aiToggleIcon.className = 'fas fa-chevron-down';
        goTo(3);
      } catch (e) {
        console.error('AI JSON Error:', e);
        Utils.showToast('Invalid JSON. Ensure it matches the exact format.', 'rose');
      }
    });
  }

  function addSubject() {
    const input = document.getElementById('subjectInput');
    const name  = input.value.trim();
    const err   = Utils.validateSubjectName(name);
    if (err) { Utils.showToast(err, 'warning'); return; }

    const existing = Storage.getSubjects();
    if (existing.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      Utils.showToast('Subject already exists', 'warning');
      return;
    }

    const color = COLORS[existing.length % COLORS.length];
    Storage.addSubject({ name, target: 75, color });
    input.value = '';
    input.focus();
    renderSubjects();
    Utils.showToast(name + ' added', 'success');
  }

  function renderSubjects() {
    const list     = document.getElementById('subjectsList');
    const subjects = Storage.getSubjects();
    list.innerHTML = '';

    if (!subjects.length) {
      list.innerHTML =
        '<div class="empty-subjects-hint">' +
          '<i class="fas fa-book-open"></i>' +
          'No subjects yet — add your first one above.' +
        '</div>';
      return;
    }

    subjects.forEach(s => {
      const row = document.createElement('div');
      row.className = 'subject-row';
      const safeName  = Utils.escapeHtml(s.name);
      const safeColor = Utils.sanitizeColor(s.color);
      row.innerHTML =
        '<div class="subject-color-swatch" style="background:' + safeColor + '"></div>' +
        '<div class="subject-row-info">' +
          '<div class="subject-row-name">' + safeName + '</div>' +
          '<div class="subject-row-meta">Target: ' + s.target + '%</div>' +
        '</div>' +
        '<button class="subject-row-del" title="Delete ' + safeName + '">' +
          '<i class="fas fa-trash-alt"></i>' +
        '</button>';

      row.querySelector('.subject-row-del').addEventListener('click', () => {
        if (!confirm('Delete "' + s.name + '"?')) return;
        Storage.deleteSubject(s.id);
        renderSubjects();
        Utils.showToast(s.name + ' removed', 'info');
      });

      list.appendChild(row);
    });
  }

  // ── Step 2: Timetable ────────────────────────────────────
  function setupStep2Nav() {
    document.getElementById('toStep1Back').addEventListener('click', () => goTo(1));
    document.getElementById('toStep3').addEventListener('click', () => goTo(3));
  }

  function renderTimetable() {
    const subjects  = Storage.getSubjects();
    const timetable = Storage.getTimetable();

    // ── Pool pills ──
    const pool = document.getElementById('subjectPool');
    pool.innerHTML = '';
    subjects.forEach(s => {
      const pill = document.createElement('div');
      pill.className = 'pool-pill';
      pill.dataset.id = s.id;
      pill.draggable = true;
      pill.innerHTML =
        '<span class="pool-dot" style="background:' + Utils.sanitizeColor(s.color) + '"></span>' + Utils.escapeHtml(s.name);

      // Desktop drag
      pill.addEventListener('dragstart', e => {
        dragId = s.id;
        e.dataTransfer.setData('text/plain', s.id);
        pill.classList.add('dragging');
        clearTapSelection();
      });
      pill.addEventListener('dragend', () => {
        pill.classList.remove('dragging');
        dragId = null;
      });

      // Mobile tap-to-select
      pill.addEventListener('click', () => {
        if (selectedId === s.id) {
          clearTapSelection();
        } else {
          clearTapSelection();
          selectedId = s.id;
          pill.classList.add('selected');
          // Highlight day columns as targets
          document.querySelectorAll('.day-col').forEach(c => c.classList.add('tap-target'));
          Utils.showToast('Now tap a day to assign ' + s.name, 'info', 2000);
        }
      });

      pool.appendChild(pill);
    });

    // ── Day columns ──
    const grid = document.getElementById('dayGrid');
    grid.innerHTML = '';

    DAYS.forEach(day => {
      const assigned = (timetable[day.key] || [])
        .map(id => subjects.find(s => s.id === id))
        .filter(Boolean);

      const col = document.createElement('div');
      col.className = 'day-col';
      col.dataset.day = day.key;

      // Chips HTML
      const chipsHtml = assigned.map(s =>
        '<div class="day-chip" style="background:' + Utils.sanitizeColor(s.color) + '">' +
          Utils.escapeHtml(s.name) +
          '<button class="chip-del" data-id="' + Utils.escapeHtml(s.id) + '" data-day="' + day.key + '" aria-label="Remove">' +
            '<i class="fas fa-times"></i>' +
          '</button>' +
        '</div>'
      ).join('');

      col.innerHTML =
        '<div class="day-col-head">' + day.short + '</div>' +
        '<div class="day-subjects">' +
          chipsHtml +
          (assigned.length === 0
            ? '<div class="day-col-empty">Drop<br>here</div>'
            : '') +
        '</div>';

      // Drag-over highlight
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
      col.addEventListener('dragleave', e => {
        if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
      });
      col.addEventListener('drop', e => {
        e.preventDefault();
        col.classList.remove('drag-over');
        const id = e.dataTransfer.getData('text/plain') || dragId;
        if (id) { assignToDay(id, day.key); dragId = null; }
      });

      // Tap-to-assign
      col.addEventListener('click', e => {
        // Don't fire if clicking a chip-del button
        if (e.target.closest('.chip-del')) return;
        if (selectedId) {
          assignToDay(selectedId, day.key);
          clearTapSelection();
        }
      });

      grid.appendChild(col);
    });

    // Wire chip delete buttons
    grid.querySelectorAll('.chip-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        removeFromDay(btn.dataset.id, btn.dataset.day);
      });
    });
  }

  function clearTapSelection() {
    selectedId = null;
    document.querySelectorAll('.pool-pill').forEach(p => p.classList.remove('selected'));
    document.querySelectorAll('.day-col').forEach(c => c.classList.remove('tap-target'));
  }

  function assignToDay(subjectId, dayKey) {
    const tt = Storage.getTimetable();
    if (!tt[dayKey]) tt[dayKey] = [];
    if (!tt[dayKey].includes(subjectId)) {
      tt[dayKey].push(subjectId);
      Storage.saveTimetable(tt);
    }
    renderTimetable();
  }

  function removeFromDay(subjectId, dayKey) {
    const tt = Storage.getTimetable();
    if (!tt[dayKey]) return;
    tt[dayKey] = tt[dayKey].filter(id => id !== subjectId);
    Storage.saveTimetable(tt);
    renderTimetable();
  }

  // ── Step 3: Targets ──────────────────────────────────────
  function setupStep3Nav() {
    document.getElementById('toStep2Back').addEventListener('click', () => goTo(2));
    document.getElementById('saveBtn').addEventListener('click', saveTargets);
  }

  function renderTargets() {
    const subjects = Storage.getSubjects();
    const list     = document.getElementById('targetsList');
    list.innerHTML  = '';

    subjects.forEach(s => {
      const card = document.createElement('div');
      card.className = 'target-card';
      const safeId    = Utils.escapeHtml(s.id);
      const safeName  = Utils.escapeHtml(s.name);
      const safeColor = Utils.sanitizeColor(s.color);
      card.innerHTML =
        '<div class="target-card-head">' +
          '<div class="target-card-name">' +
            '<span class="target-card-name-dot" style="background:' + safeColor + '"></span>' +
            safeName +
          '</div>' +
          '<div class="target-pct" id="tpct_' + safeId + '">' + s.target + '%</div>' +
        '</div>' +
        '<input type="range" class="target-slider"' +
          ' min="50" max="100" step="5"' +
          ' value="' + s.target + '"' +
          ' data-id="' + safeId + '">' +
        '<div class="target-hint" id="thint_' + safeId + '">' + hintHTML(s.target) + '</div>' +
        '<div class="baseline-row">' +
          '<div class="baseline-label"><i class="fas fa-clock-rotate-left"></i> So far</div>' +
          '<div class="baseline-fields">' +
            '<div class="baseline-field">' +
              '<input type="number" min="0" step="1" inputmode="numeric"' +
                ' class="baseline-total" data-id="' + safeId + '" value="' + s.total + '">' +
              '<span>Held</span>' +
            '</div>' +
            '<div class="baseline-field">' +
              '<input type="number" min="0" step="1" inputmode="numeric"' +
                ' class="baseline-attended" data-id="' + safeId + '" value="' + s.attended + '">' +
              '<span>Attended</span>' +
            '</div>' +
          '</div>' +
        '</div>';

      card.querySelector('.target-slider').addEventListener('input', e => {
        const v = parseInt(e.target.value);
        document.getElementById('tpct_' + s.id).textContent  = v + '%';
        document.getElementById('thint_' + s.id).innerHTML    = hintHTML(v);
      });

      const totalInput    = card.querySelector('.baseline-total');
      const attendedInput = card.querySelector('.baseline-attended');
      const validateBaseline = () => {
        const held = Math.max(0, parseInt(totalInput.value) || 0);
        const att  = Math.max(0, parseInt(attendedInput.value) || 0);
        const overAttended = att > held;
        attendedInput.closest('.baseline-field').classList.toggle('error', overAttended);
        if (overAttended) {
          Utils.showToast('Attended can\'t be more than classes held', 'warning');
        }
      };
      totalInput.addEventListener('input', validateBaseline);
      attendedInput.addEventListener('input', validateBaseline);

      list.appendChild(card);
    });
  }

  function hintHTML(val) {
    if (val >= 85) return '<i class="fas fa-circle-check hint-high"></i><span class="hint-high">High commitment — great target</span>';
    if (val >= 75) return '<i class="fas fa-graduation-cap hint-mid"></i><span class="hint-mid">Standard requirement</span>';
    return '<i class="fas fa-triangle-exclamation hint-low"></i><span class="hint-low">Low — may affect eligibility</span>';
  }

  function saveTargets() {
    document.querySelectorAll('.target-slider').forEach(slider => {
      const id      = slider.dataset.id;
      const totalEl = document.querySelector('.baseline-total[data-id="' + id + '"]');
      const attEl   = document.querySelector('.baseline-attended[data-id="' + id + '"]');

      const updates = { target: parseInt(slider.value) };

      if (totalEl && attEl) {
        const held = Math.max(0, parseInt(totalEl.value) || 0);
        const att  = Math.min(held, Math.max(0, parseInt(attEl.value) || 0));
        updates.total    = held;
        updates.attended = att;
      }

      Storage.updateSubject(id, updates);
    });
    Utils.showToast('Setup saved!', 'success');
    document.getElementById('targetsList').style.display = 'none';
    document.getElementById('step3Nav').style.display    = 'none';
    document.getElementById('doneCard').classList.remove('hidden');
  }

});
