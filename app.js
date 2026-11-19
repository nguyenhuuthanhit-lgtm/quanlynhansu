cat << 'EOF' > app.js
(function () {
  const todayStr = new Date().toISOString().slice(0, 10);
  const workDateEl = document.getElementById('workDate');
  const offDateEl = document.getElementById('offDate');

  if (workDateEl && !workDateEl.value) workDateEl.value = todayStr;
  if (offDateEl && !offDateEl.value) offDateEl.value = todayStr;

  function sb() {
    return window.supabaseClient;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return {
        '&': '&',
        '<': '<',
        '>': '>',
        '"': '"',
        "'": '''
      }[m];
    });
  }

  window.loadDashboardData = async function () {
    const client = sb();
    if (!client) return;
    const date = (workDateEl && workDateEl.value) || todayStr;
    if (typeof window.fetchDailySchedule === 'function') {
      await window.fetchDailySchedule(date);
    }
    renderStaffDropdown();
    renderScheduleTable();
  };

  function renderStaffDropdown() {
    const sel = document.getElementById('offStaffSelect');
    if (!sel || !window.rosterState) return;
    sel.innerHTML = (window.rosterState.staffList || [])
      .map(function (s) {
        const typeLabel = Number(s.experience_years) >= 3 ? 'Lam chinh 3-5 nam' : 'Hoc viec';
        return '<option value="' + escapeHtml(s.id) + '">' +
          escapeHtml(s.employee_code) + ' - ' + escapeHtml(s.full_name) +
          ' (' + typeLabel + ')</option>';
      })
      .join('');
  }

  function renderScheduleTable() {
    const tbody = document.getElementById('scheduleBody');
    if (!tbody || !window.rosterState) return;
    const date = (workDateEl && workDateEl.value) || todayStr;
    tbody.innerHTML = '';

    (window.rosterState.staffList || []).forEach(function (s) {
      const rec = window.getOrCreateRoster(s.id, date);
      const hasLeaveReq = !!(window.rosterState.leavesByStaff && window.rosterState.leavesByStaff[s.id]);
      const isOff = !!(rec.is_day_off || hasLeaveReq);
      const isCore = Number(s.experience_years) >= 3;

      const extraHtml = (rec.extra_shifts || [])
        .map(function (val, idx) {
          return '<div class="pill">' +
            '<input type="text" value="' + escapeHtml(val) + '" placeholder="Ca ' + (idx + 3) + '..." ' +
            'onchange="window.onEditExtraShift(\'' + escapeHtml(s.id) + '\', ' + idx + ', this.value)" />' +
            '<button type="button" onclick="window.onRemoveExtraShift(\'' + escapeHtml(s.id) + '\', ' + idx + ')">x</button>' +
            '</div>';
        })
        .join('');

      const breakHtml = (rec.break_off_slots || [])
        .map(function (slot, idx) {
          return '<div class="pill">' +
            '<span>OFF ' + escapeHtml(slot) + '</span>' +
            '<button type="button" onclick="window.onRemoveBreakSlot(\'' + escapeHtml(s.id) + '\', ' + idx + ')">x</button>' +
            '</div>';
        })
        .join('');

      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td><strong>' + escapeHtml(s.employee_code) + '</strong></td>' +
        '<td>' + escapeHtml(s.full_name) + '</td>' +
        '<td>' + (isCore
          ? '<span class="badge-core">Lam chinh (3-5 nam)</span>'
          : '<span class="badge-intern">Hoc viec</span>') + '</td>' +
        '<td><input type="text" value="' + escapeHtml(rec.shift_1) + '" ' + (isOff ? 'disabled' : '') +
          ' placeholder="Vi tri Ca 1" onchange="window.onEditMainShift(\'' + escapeHtml(s.id) + '\', \'shift_1\', this.value)" /></td>' +
        '<td><input type="text" value="' + escapeHtml(rec.shift_2) + '" ' + (isOff ? 'disabled' : '') +
          ' placeholder="Vi tri Ca 2" onchange="window.onEditMainShift(\'' + escapeHtml(s.id) + '\', \'shift_2\', this.value)" /></td>' +
        '<td><div class="pill-list">' + extraHtml + '</div>' +
          '<button type="button" class="btn-primary btn-sm" ' + (isOff ? 'disabled' : '') +
          ' onclick="window.onAddExtraShift(\'' + escapeHtml(s.id) + '\')">+ Them ca sau</button></td>' +
        '<td>' + (isOff ? '<span class="badge-off">OFF CA NGAY</span><br>' : '') +
          '<div class="pill-list">' + breakHtml + '</div></td>' +
        '<td><button type="button" class="btn-warning btn-sm" onclick="window.onToggleDayOff(\'' + escapeHtml(s.id) + '\')">' +
          (isOff ? 'Mo lam lai' : 'Cat ngay OFF') + '</button></td>';
      tbody.appendChild(tr);
    });
  }

  const staffForm = document.getElementById('staffForm');
  if (staffForm) {
    staffForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const client = sb();
      if (!client) {
        alert('Chua ket noi duoc Supabase.');
        return;
      }

      const employee_code = document.getElementById('empCode').value.trim().toUpperCase();
      const full_name = document.getElementById('fullName').value.trim();
      const experience_years = Number(document.getElementById('empLevel').value);

      const { error } = await client.from('profiles').insert({
        employee_code: employee_code,
        full_name: full_name,
        role: 'staff',
        experience_years: experience_years,
        is_active: true
      });

      if (error) {
        alert('Loi them nhan vien: ' + error.message);
        return;
      }

      staffForm.reset();
      await window.loadDashboardData();
    });
  }

  window.onEditMainShift = function (staffId, field, value) {
    const date = (workDateEl && workDateEl.value) || todayStr;
    const rec = window.getOrCreateRoster(staffId, date);
    rec[field] = value;
  };

  window.onAddExtraShift = function (staffId) {
    const date = (workDateEl && workDateEl.value) || todayStr;
    const rec = window.getOrCreateRoster(staffId, date);
    rec.extra_shifts.push('');
    renderScheduleTable();
  };

  window.onEditExtraShift = function (staffId, idx, value) {
    const date = (workDateEl && workDateEl.value) || todayStr;
    const rec = window.getOrCreateRoster(staffId, date);
    rec.extra_shifts[idx] = value;
  };

  window.onRemoveExtraShift = function (staffId, idx) {
    const date = (workDateEl && workDateEl.value) || todayStr;
    const rec = window.getOrCreateRoster(staffId, date);
    rec.extra_shifts.splice(idx, 1);
    renderScheduleTable();
  };

  window.onRemoveBreakSlot = async function (staffId, idx) {
    const date = (workDateEl && workDateEl.value) || todayStr;
    const rec = window.getOrCreateRoster(staffId, date);
    rec.break_off_slots.splice(idx, 1);
    if (typeof window.upsertSingleRoster === 'function') {
      await window.upsertSingleRoster(rec);
    }
    renderScheduleTable();
  };

  window.onToggleDayOff = async function (staffId) {
    const date = (workDateEl && workDateEl.value) || todayStr;
    const rec = window.getOrCreateRoster(staffId, date);
    rec.is_day_off = !rec.is_day_off;
    if (typeof window.upsertSingleRoster === 'function') {
      await window.upsertSingleRoster(rec);
    }
    renderScheduleTable();
  };

  const btnCutDayOff = document.getElementById('btnCutDayOff');
  if (btnCutDayOff) {
    btnCutDayOff.addEventListener('click', async function () {
      const client = sb();
      if (!client) return;
      const staffId = document.getElementById('offStaffSelect').value;
      const date = (offDateEl && offDateEl.value) || (workDateEl && workDateEl.value) || todayStr;
      if (!staffId) return;

      await client.from('leave_requests').insert({
        staff_id: staffId,
        leave_date: date,
        reason: 'Ca truong cat lich OFF',
        status: 'approved',
        approved_by: (window.currentUser && window.currentUser.id) || null
      });

      if (workDateEl) workDateEl.value = date;
      await window.loadDashboardData();
      const rec = window.getOrCreateRoster(staffId, date);
      rec.is_day_off = true;
      if (typeof window.upsertSingleRoster === 'function') {
        await window.upsertSingleRoster(rec);
      }
      renderScheduleTable();
    });
  }

  const btnCutTimeOff = document.getElementById('btnCutTimeOff');
  if (btnCutTimeOff) {
    btnCutTimeOff.addEventListener('click', async function () {
      const client = sb();
      if (!client) return;
      const staffId = document.getElementById('offStaffSelect').value;
      const date = (offDateEl && offDateEl.value) || (workDateEl && workDateEl.value) || todayStr;
      const start = document.getElementById('offStart').value;
      const end = document.getElementById('offEnd').value;

      if (!staffId || !start || !end) {
        alert('Vui long nhap du gio bat dau va ket thuc nghi trong ca.');
        return;
      }

      if (workDateEl) workDateEl.value = date;
      await window.loadDashboardData();
      const rec = window.getOrCreateRoster(staffId, date);
      rec.break_off_slots.push(start + '-' + end);
      if (typeof window.upsertSingleRoster === 'function') {
        await window.upsertSingleRoster(rec);
      }
      renderScheduleTable();
    });
  }

  const btnSaveAll = document.getElementById('btnSaveAllRosters');
  if (btnSaveAll) {
    btnSaveAll.addEventListener('click', async function () {
      try {
        const records = Object.values((window.rosterState && window.rosterState.rostersByStaff) || {});
        for (const rec of records) {
          if (typeof window.upsertSingleRoster === 'function') {
            await window.upsertSingleRoster(rec);
          }
        }
        alert('Da luu toan bo lich vi tri ngay ' + ((workDateEl && workDateEl.value) || todayStr) + ' len Supabase!');
      } catch (err) {
        alert('Loi khi luu lich: ' + err.message);
      }
    });
  }

  if (workDateEl) {
    workDateEl.addEventListener('change', function () {
      window.loadDashboardData();
    });
  }
})();
EOF
