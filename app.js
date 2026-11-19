let staffList = [];
let rosterMap = {};
let leaveSet = new Set();

const todayISO = new Date().toISOString().slice(0, 10);

async function loadDashboardData() {
  const workDate = document.getElementById('workDate').value || todayISO;

  // 1. Lấy danh sách nhân sự từ bảng profiles
  const { data: profiles, error: pErr } = await supabaseClient
    .from('profiles')
    .select('*')
    .order('employee_code', { ascending: true });

  if (pErr) {
    alert('Lỗi tải danh sách nhân sự: ' + pErr.message);
    return;
  }
  staffList = profiles || [];

  // 2. Lấy phân ca trong ngày từ bảng daily_rosters
  const { data: rosters } = await supabaseClient
    .from('daily_rosters')
    .select('*')
    .eq('shift_date', workDate);

  rosterMap = {};
  (rosters || []).forEach(r => { rosterMap[r.staff_id] = r; });

  // 3. Lấy danh sách ngày OFF từ bảng leave_requests
  const { data: leaves } = await supabaseClient
    .from('leave_requests')
    .select('staff_id')
    .eq('leave_date', workDate)
    .eq('status', 'approved');

  leaveSet = new Set((leaves || []).map(l => l.staff_id));

  renderStaffDropdown();
  renderRosterTable(workDate);
}

function renderStaffDropdown() {
  const select = document.getElementById('offStaffSelect');
  const currentVal = select.value;
  select.innerHTML = staffList.map(s => {
    const exp = Number(s.experience_years || 0);
    const label = exp >= 3 ? `Làm chính (${exp} năm)` : 'Học việc';
    return `<option value="${s.id}">${s.employee_code || ''} - ${s.full_name} [${label}]</option>`;
  }).join('');
  if (currentVal) select.value = currentVal;
}

function renderRosterTable(workDate) {
  const tbody = document.getElementById('rosterBody');
  const isLeader = currentProfile?.role === 'shift_leader';
  const disabledAttr = isLeader ? '' : 'disabled';

  tbody.innerHTML = staffList.map(s => {
    const exp = Number(s.experience_years || 0);
    const isCore = exp >= 3;
    const isOff = leaveSet.has(s.id);
    const r = rosterMap[s.id];
    const shifts = SchedulerService.parseShifts(r);

    const extraHtml = shifts.extra.map((val, idx) => `
      <div class="extra-item">
        <input type="text" value="${escapeHtml(val)}" placeholder="Ca ${idx + 3}..."
          ${isOff || !isLeader ? 'disabled' : ''}
          onchange="handleExtraChange('${workDate}', '${s.id}', ${idx}, this.value)" />
        ${isLeader && !isOff ? `<button type="button" class="btn-danger btn-sm" onclick="handleRemoveExtra('${workDate}', '${s.id}', ${idx})">×</button>` : ''}
      </div>
    `).join('');

    return `
      <tr>
        <td><strong>${escapeHtml(s.employee_code || '---')}</strong></td>
        <td><strong>${escapeHtml(s.full_name)}</strong></td>
        <td>
          ${isCore
            ? `<span class="tag tag-core">Làm chính (${exp} năm KN)</span>`
            : `<span class="tag tag-intern">Học việc (${exp} năm)</span>`}
        </td>
        <td>
          <input type="text" value="${escapeHtml(shifts.s1)}" placeholder="Nhập vị trí Ca 1"
            ${isOff || !isLeader ? 'disabled' : ''}
            onchange="handleMainShift('${workDate}', '${s.id}', 's1', this.value)" />
        </td>
        <td>
          <input type="text" value="${escapeHtml(shifts.s2)}" placeholder="Nhập vị trí Ca 2"
            ${isOff || !isLeader ? 'disabled' : ''}
            onchange="handleMainShift('${workDate}', '${s.id}', 's2', this.value)" />
        </td>
        <td>
          <div class="extra-list">${extraHtml}</div>
          ${isLeader && !isOff ? `<button type="button" class="btn-primary btn-sm" onclick="handleAddExtra('${workDate}', '${s.id}')">+ Thêm ca sau</button>` : ''}
        </td>
        <td>
          ${isOff ? '<div style="margin-bottom:4px;"><span class="tag tag-off">NGHỈ OFF CẢ NGÀY</span></div>' : ''}
          ${r?.day_rest_slot ? `<div class="tag tag-intern">OFF Ca ngày: ${escapeHtml(r.day_rest_slot)}</div>` : ''}
          ${r?.night_rest_slot ? `<div class="tag tag-intern" style="margin-top:3px;">OFF Ca đêm: ${escapeHtml(r.night_rest_slot)}</div>` : ''}
        </td>
        <td>
          ${isLeader ? `
            <button type="button" class="btn-warning btn-sm" onclick="handleToggleDayOff('${workDate}', '${s.id}', ${!isOff})">
              ${isOff ? 'Hủy OFF ngày' : 'Cắt OFF ngày'}
            </button>
          ` : '---'}
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&', '<': '<', '>': '>', '"': '"', "'": '''
  }[m]));
}

// --- CÁC HÀM XỬ LÝ SỰ KIỆN CỦA CA TRƯỞNG ---
async function handleMainShift(date, staffId, field, value) {
  await SchedulerService.saveRoster(date, staffId, { [field]: value });
  await loadDashboardData();
}

async function handleAddExtra(date, staffId) {
  const shifts = SchedulerService.parseShifts(rosterMap[staffId]);
  shifts.extra.push('');
  await SchedulerService.saveRoster(date, staffId, { extra: shifts.extra });
  await loadDashboardData();
}

async function handleExtraChange(date, staffId, idx, value) {
  const shifts = SchedulerService.parseShifts(rosterMap[staffId]);
  shifts.extra[idx] = value;
  await SchedulerService.saveRoster(date, staffId, { extra: shifts.extra });
  await loadDashboardData();
}

async function handleRemoveExtra(date, staffId, idx) {
  const shifts = SchedulerService.parseShifts(rosterMap[staffId]);
  shifts.extra.splice(idx, 1);
  await SchedulerService.saveRoster(date, staffId, { extra: shifts.extra });
  await loadDashboardData();
}

async function handleToggleDayOff(date, staffId, targetState) {
  await SchedulerService.setDayOff(date, staffId, targetState);
  await loadDashboardData();
}

// Khởi tạo sự kiện DOM
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('workDate').value = todayISO;
  document.getElementById('offDate').value = todayISO;

  // Tự động gợi ý số năm kinh nghiệm khi chọn Học việc / Làm chính
  document.getElementById('empType').addEventListener('change', (e) => {
    document.getElementById('expYears').value = e.target.value === 'lam_chinh' ? 3 : 0;
  });

  // Form thêm nhân viên ban đầu
  document.getElementById('staffForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const employee_code = document.getElementById('empCode').value.trim();
    const full_name = document.getElementById('fullName').value.trim();
    const experience_years = parseFloat(document.getElementById('expYears').value || 0);

    const { error } = await supabaseClient.from('profiles').insert({
      employee_code,
      full_name,
      role: 'staff',
      experience_years,
      is_active: true
    });

    if (error) {
      alert('Lỗi thêm nhân viên: ' + error.message);
      return;
    }
    e.target.reset();
    await loadDashboardData();
  });

  // Nút cắt ngày OFF
  document.getElementById('btnCutDayOff').addEventListener('click', async () => {
    const staffId = document.getElementById('offStaffSelect').value;
    const date = document.getElementById('offDate').value || todayISO;
    if (!staffId) return;
    await SchedulerService.setDayOff(date, staffId, true);
    document.getElementById('workDate').value = date;
    await loadDashboardData();
  });

  // Nút cắt thời gian OFF trong ca làm
  document.getElementById('btnCutTimeOff').addEventListener('click', async () => {
    const staffId = document.getElementById('offStaffSelect').value;
    const date = document.getElementById('offDate').value || todayISO;
    const day_rest_slot = document.getElementById('dayRestSlot').value.trim() || null;
    const night_rest_slot = document.getElementById('nightRestSlot').value.trim() || null;
    if (!staffId) return;

    await SchedulerService.saveRoster(date, staffId, { day_rest_slot, night_rest_slot });
    document.getElementById('workDate').value = date;
    await loadDashboardData();
  });

  document.getElementById('workDate').addEventListener('change', loadDashboardData);

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await loginWithEmail(
        document.getElementById('loginEmail').value,
        document.getElementById('loginPassword').value
      );
      await loadDashboardData();
    } catch (err) {
      alert('Đăng nhập thất bại: ' + err.message);
    }
  });

  document.getElementById('btnLogout').addEventListener('click', logoutUser);

  const profile = await checkSession();
  if (profile) await loadDashboardData();
});
