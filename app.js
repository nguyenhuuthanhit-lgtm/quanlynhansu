rm -f app.js
cat << 'EOF' > app.js
(function () {
  var todayStr = new Date().toISOString().slice(0, 10);
  var workDateEl = document.getElementById('workDate');
  var offDateEl = document.getElementById('offDate');

  if (workDateEl && !workDateEl.value) workDateEl.value = todayStr;
  if (offDateEl && !offDateEl.value) offDateEl.value = todayStr;

  function sb() {
    return window.supabaseClient;
  }

  function esc(str) {
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return { '&': '&', '<': '<', '>': '>', '"': '"', "'": ''' }[m];
    });
  }

  window.loadDashboardData = async function () {
    if (!sb()) return;
    var date = (workDateEl && workDateEl.value) || todayStr;
    if (typeof window.fetchDailySchedule === 'function') {
      await window.fetchDailySchedule(date);
    }
    renderStaffDropdown();
    renderScheduleTable();
  };

  function renderStaffDropdown() {
    var sel = document.getElementById('offStaffSelect');
    if (!sel || !window.rosterState) return;
    var list = window.rosterState.staffList || [];
    sel.innerHTML = list.map(function (s) {
      var lvl = Number(s.experience_years) >= 3 ? 'Lam chinh 3-5 nam' : 'Hoc viec';
      return '<option value="' + esc(s.id) + '">' + esc(s.employee_code) + ' - ' + esc(s.full_name) + ' (' + lvl + ')</option>';
    }).join('');
  }

  function renderScheduleTable() {
    var tbody = document.getElementById('scheduleBody');
    if (!tbody || !window.rosterState) return;
    var date = (workDateEl && workDateEl.value) || todayStr;
    tbody.innerHTML = '';

    (window.rosterState.staffList || []).forEach(function (s) {
      var rec = window.getOrCreateRoster(s.id, date);
      var hasLeave = !!(window.rosterState.leavesByStaff && window.rosterState.leavesByStaff[s.id]);
      var isOff = !!(rec.is_day_off || hasLeave);
      var isCore = Number(s.experience_years) >= 3;

      var extraHtml = (rec.extra_shifts || []).map(function (val, idx) {
        return '<div class="pill">' +
          '<input type="text" value="' + esc(val) + '" placeholder="Ca ' + (idx + 3) + '..." ' +
          'onchange="window.onEditExtraShift(\'' + esc(s.id) + '\',' + idx + ',this.value)" />' +
          '<button type="button" onclick="window.onRemoveExtraShift(\'' + esc(s.id) + '\',' + idx + ')">x</button>' +
          '</div>';
      }).join('');

      var breakHtml = (rec.break_off_slots || []).map(function (slot, idx) {
        return '<div class="pill">' +
          '<span>OFF ' + esc(slot) + '</span>' +
          '<button type="button" onclick="window.onRemoveBreakSlot(\'' + esc(s.id) + '\',' + idx + ')">x</button>' +
          '</div>';
      }).join('');

      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><strong>' + esc(s.employee_code) + '</strong></td>' +
        '<td>' + esc(s.full_name) + '</td>' +
        '<td>' + (isCore ? '<span class="badge-core">Lam chinh (3-5 nam)</span>' : '<span class="badge-intern">Hoc viec</span>') + '</td>' +
        '<td><input type="text" value="' + esc(rec.shift_1) + '" ' + (isOff ? 'disabled' : '') + ' placeholder="Vi tri Ca 1" onchange="window.onEditMainShift(\'' + esc(s.id) + '\',\'shift_1\',this.value)" /></td>' +
        '<td><input type="text" value="' + esc(rec.shift_2) + '" ' + (isOff ? 'disabled' : '') + ' placeholder="Vi tri Ca 2" onchange="window.onEditMainShift(\'' + esc(s.id) + '\',\'shift_2\',this.value)" /></td>' +
        '<td><div class="pill-list">' + extraHtml + '</div><button type="button" class="btn-primary btn-sm" ' + (isOff ? 'disabled' : '') + ' onclick="window.onAddExtraShift(\'' + esc(s.id) + '\')">+ Them ca sau</button></td>' +
        '<td>' + (isOff ? '<span class="badge-off">OFF CA NGAY</span><br>' : '') + '<div class="pill-list">' + breakHtml + '</div></td>' +
        '<td><button type="button" class="btn-warning btn-sm" onclick="window.onToggleDayOff(\'' + esc(s.id) + '\')">' + (isOff ? 'Mo lam lai' : 'Cat ngay OFF') + '</button></td>';
      tbody.appendChild(tr);
    });
  }

  var staffForm = document.getElementById('staffForm');
  if (staffForm) {
    staffForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var client = sb();
      if (!client) return alert('Chua ket noi Supabase');

      var employee_code = document.getElementById('empCode').value.trim().toUpperCase();
      var full_name = document.getElementById('fullName').value.trim();
      var experience_years = Number(document.getElementById('empLevel').value);

      var res = await client.from('profiles').insert({
        employee_code: employee_code,
        full_name: full_name,
        role: 'staff',
        experience_years: experience_years,
        is_active: true
      });

      if (res.error) return alert('Loi them nhan vien: ' + res.error.message);
      staffForm.reset();
      await window.loadDashboardData();
    });
  }

  window.onEditMainShift = function (staffId, field, value) {
    var date = (workDateEl && workDateEl.value) || todayStr;
    var rec = window.getOrCreateRoster(staffId, date);
    rec[field] = value;
  };

  window.onAddExtraShift = function (staffId) {
    var date = (workDateEl && workDateEl.value) || todayStr;
    var rec = window.getOrCreateRoster(staffId, date);
    rec.extra_shifts.push('');
    renderScheduleTable();
  };

  window.onEditExtraShift = function (staffId, idx, value) {
    var date = (workDateEl && workDateEl.value) || todayStr;
    var rec = window.getOrCreateRoster(staffId, date);
    rec.extra_shifts[idx] = value;
  };

  window.onRemoveExtraShift = function (staffId, idx) {
    var date = (workDateEl && workDateEl.value) || todayStr;
    var rec = window.getOrCreateRoster(staffId, date);
    rec.extra_shifts.splice(idx, 1);
    renderScheduleTable();
  };

  window.onRemoveBreakSlot = async function (staffId, idx) {
    var date = (workDateEl && workDateEl.value) || todayStr;
    var rec = window.getOrCreateRoster(staffId, date);
    rec.break_off_slots.splice(idx, 1);
    if (typeof window.upsertSingleRoster === 'function') await window.upsertSingleRoster(rec);
    renderScheduleTable();
  };

  window.onToggleDayOff = async function (staffId) {
    var date = (workDateEl && workDateEl.value) || todayStr;
    var rec = window.getOrCreateRoster(staffId, date);
    rec.is_day_off = !rec.is_day_off;
    if (typeof window.upsertSingleRoster === 'function') await window.upsertSingleRoster(rec);
    renderScheduleTable();
  };

  var btnCutDayOff = document.getElementById('btnCutDayOff');
  if (btnCutDayOff) {
    btnCutDayOff.addEventListener('click', async function () {
      var client = sb();
      if (!client) return;
      var staffId = document.getElementById('offStaffSelect').value;
      var date = (offDateEl && offDateEl.value) || (workDateEl && workDateEl.value) || todayStr;
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
      var rec = window.getOrCreateRoster(staffId, date);
      rec.is_day_off = true;
      if (typeof window.upsertSingleRoster === 'function') await window.upsertSingleRoster(rec);
      renderScheduleTable();
    });
  }

  var btnCutTimeOff = document.getElementById('btnCutTimeOff');
  if (btnCutTimeOff) {
    btnCutTimeOff.addEventListener('click', async function () {
      var client = sb();
      if (!client) return;
      var staffId = document.getElementById('offStaffSelect').value;
      var date = (offDateEl && offDateEl.value) || (workDateEl && workDateEl.value) || todayStr;
      var start = document.getElementById('offStart').value;
      var end = document.getElementById('offEnd').value;
      if (!staffId || !start || !end) return alert('Nhap du gio bat dau va ket thuc nghi trong ca');

      if (workDateEl) workDateEl.value = date;
      await window.loadDashboardData();
      var rec = window.getOrCreateRoster(staffId, date);
      rec.break_off_slots.push(start + '-' + end);
      if (typeof window.upsertSingleRoster === 'function') await window.upsertSingleRoster(rec);
      renderScheduleTable();
    });
  }

  var btnSaveAll = document.getElementById('btnSaveAllRosters');
  if (btnSaveAll) {
    btnSaveAll.addEventListener('click', async function () {
      try {
        var records = Object.values((window.rosterState && window.rosterState.rostersByStaff) || {});
        for (var i = 0; i < records.length; i++) {
          if (typeof window.upsertSingleRoster === 'function') {
            await window.upsertSingleRoster(records[i]);
          }
        }
        alert('Da luu toan bo lich ngay ' + ((workDateEl && workDateEl.value) || todayStr));
      } catch (err) {
        alert('Loi luu lich: ' + err.message);
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
