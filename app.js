// app.js
document.addEventListener('DOMContentLoaded', async () => {
    const loginSection = document.getElementById('login-section');
    const appSection = document.getElementById('app-section');
    const dateInput = document.getElementById('roster-date');
    
    // Mặc định chọn ngày hiện tại
    dateInput.value = DateUtils.toLocalDateStr(new Date());

    // 1. Kiểm tra phiên đăng nhập
    try {
        const isLoggedIn = await AuthManager.init();
        if (isLoggedIn) {
            showDashboard();
        } else {
            loginSection.classList.remove('hidden');
        }
    } catch (err) {
        alert('Lỗi khởi tạo hệ thống: ' + err.message);
    }

    // 2. Xử lý Đăng nhập
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        try {
            await AuthManager.login(email, password);
            loginSection.classList.add('hidden');
            showDashboard();
        } catch (err) {
            alert('Đăng nhập thất bại: ' + err.message);
        }
    });

    document.getElementById('btn-logout').addEventListener('click', () => AuthManager.logout());

    // 3. Hiển thị Dashboard theo phân quyền
    async function showDashboard() {
        appSection.classList.remove('hidden');
        const profile = AuthManager.currentProfile;
        document.getElementById('user-badge').textContent = 
            `${profile.full_name} (${profile.employee_code}) - ${profile.role === 'shift_leader' ? 'CA TRƯỞNG' : 'NHÂN VIÊN'}`;

        // Ẩn/hiện các khu vực quản trị của Ca trưởng hoặc nhân viên được ủy quyền
        if (AuthManager.hasPermission('can_manage_flights')) {
            document.getElementById('flight-admin-panel').classList.remove('hidden');
        }
        if (AuthManager.hasPermission('can_manage_staff')) {
            document.getElementById('staff-admin-panel').classList.remove('hidden');
        }
        if (profile.role === 'shift_leader') {
            document.getElementById('btn-auto-schedule').classList.remove('hidden');
        }

        await loadDashboardData(dateInput.value);
    }

    dateInput.addEventListener('change', (e) => loadDashboardData(e.target.value));

    // 4. Tải dữ liệu Lịch trực, Chuyến bay & Nhân sự
    async function loadDashboardData(selectedDate) {
        try {
            const [staffRes, flightsRes, leavesRes, rosterRes] = await Promise.all([
                supabaseClient.from('profiles').select('*, teams(name)').order('employee_code'),
                supabaseClient.from('flights').select('*').eq('shift_date', selectedDate).order('scheduled_time'),
                supabaseClient.from('leave_requests').select('*, profiles(full_name, employee_code)').order('created_at', { ascending: false }),
                supabaseClient.from('daily_rosters').select('*, profiles(full_name, employee_code, experience_years, team_id)').eq('shift_date', selectedDate)
            ]);

            if (staffRes.error) throw staffRes.error;
            if (flightsRes.error) throw flightsRes.error;

            renderFlights(flightsRes.data || []);
            renderRosters(rosterRes.data || [], staffRes.data || [], selectedDate);
            renderLeaves(leavesRes.data || []);
            if (AuthManager.hasPermission('can_manage_staff')) {
                renderStaffManagement(staffRes.data || []);
            }
        } catch (err) {
            console.error(err);
            alert('Không thể tải dữ liệu: ' + err.message);
        }
    }

    // 5. Thêm Chuyến bay mới (Tự động tính giờ mở quầy -2h nội địa / -3h quốc tế)
    document.getElementById('flight-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const flightNumber = document.getElementById('f-number').value.trim().toUpperCase();
        const flightType = document.getElementById('f-type').value;
        const scope = document.getElementById('f-scope').value;
        const scheduledLocal = document.getElementById('f-time').value;
        const gate = document.getElementById('f-gate').value.trim();

        const scheduledIso = new Date(scheduledLocal).toISOString();
        const windowTimes = ShiftScheduler.calculateCounterWindow(scheduledIso, scope);
        const shiftDate = DateUtils.getShiftDateFromTimestamp(scheduledIso);

        const { error } = await supabaseClient.from('flights').insert([{
            flight_number: flightNumber,
            flight_type: flightType,
            scope: scope,
            scheduled_time: scheduledIso,
            counter_open_time: windowTimes.open,
            counter_close_time: windowTimes.close,
            gate_or_counter: gate,
            shift_date: shiftDate,
            created_by: AuthManager.currentUser.id
        }]);

        if (error) return alert('Lỗi thêm chuyến bay: ' + error.message);
        e.target.reset();
        await loadDashboardData(dateInput.value);
    });

    // 6. Ca trưởng bấm "Chạy Xếp Ca & Cuốn Chiếu Tự Động"
    document.getElementById('btn-auto-schedule').addEventListener('click', async () => {
        const selectedDate = dateInput.value;
        if (!confirm(`Xác nhận tính toán và lưu lịch trực cuốn chiếu cho ngày ${selectedDate}?`)) return;

        try {
            const [{ data: allStaff }, { data: flights }, { data: leaves }] = await Promise.all([
                supabaseClient.from('profiles').select('*').eq('is_active', true),
                supabaseClient.from('flights').select('*').eq('shift_date', selectedDate),
                supabaseClient.from('leave_requests').select('*').eq('status', 'APPROVED')
            ]);

            const result = ShiftScheduler.generateDailyRoster(selectedDate, allStaff, flights, leaves);

            if (result.warnings.length > 0) {
                alert('Cảnh báo định biên:\n- ' + result.warnings.join('\n- '));
            }

            // Lưu bảng phân ca vào Supabase (Upsert)
            const rosterPayload = result.rosters.map(r => ({
                shift_date: r.shift_date,
                staff_id: r.staff_id,
                duty_type: r.duty_type,
                is_equipment_checker: r.is_equipment_checker,
                day_rest_slot: r.day_rest_slot,
                night_rest_slot: r.night_rest_slot,
                rest_tier: r.rest_tier
            }));

            const { error: rosterErr } = await supabaseClient
                .from('daily_rosters')
                .upsert(rosterPayload, { onConflict: 'shift_date,staff_id' });
            if (rosterErr) throw rosterErr;

            // Cập nhật chỉ số cuốn chiếu cho những người đi làm hôm nay
            for (const r of result.rosters) {
                if (r.duty_type === 'DEP' || r.duty_type === 'ARR') {
                    await supabaseClient.from('profiles').update({
                        rest_rotation_index: (r.staff_info.rest_rotation_index || 0) + 1,
                        equipment_check_count: (r.staff_info.equipment_check_count || 0) + (r.is_equipment_checker ? 1 : 0)
                    }).eq('id', r.staff_id);
                }
            }

            // Lưu phân bổ chuyến bay
            if (flights.length > 0) {
                const flightIds = flights.map(f => f.id);
                await supabaseClient.from('flight_assignments').delete().in('flight_id', flightIds);
                if (result.flightAssignments.length > 0) {
                    const { error: assignErr } = await supabaseClient.from('flight_assignments').insert(result.flightAssignments);
                    if (assignErr) throw assignErr;
                }
            }

            alert('Đã xếp ca, chia giờ nghỉ cuốn chiếu và phân bổ chuyến bay thành công!');
            await loadDashboardData(selectedDate);
        } catch (err) {
            alert('Lỗi xếp lịch: ' + err.message);
        }
    });

    // 7. Nhân viên đăng ký Ngày Off Tháng (1-3 ngày/tháng -> thành 3 ngày ở nhà)
    document.getElementById('leave-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const leaveDate = document.getElementById('leave-date').value;
        const reason = document.getElementById('leave-reason').value.trim();

        // Kiểm tra giới hạn tối đa 3 ngày nghỉ phép trong tháng
        const monthPrefix = leaveDate.slice(0, 7);
        const { data: existingLeaves } = await supabaseClient
            .from('leave_requests')
            .select('id')
            .eq('staff_id', AuthManager.currentUser.id)
            .gte('leave_date', `${monthPrefix}-01`)
            .lte('leave_date', `${monthPrefix}-31`)
            .neq('status', 'REJECTED');

        if (existingLeaves && existingLeaves.length >= 3) {
            return alert('Bạn đã đăng ký đủ tối đa 3 ngày nghỉ trong tháng này!');
        }

        const { error } = await supabaseClient.from('leave_requests').insert([{
            staff_id: AuthManager.currentUser.id,
            leave_date: leaveDate,
            reason: reason
        }]);

        if (error) return alert('Lỗi gửi đơn: ' + error.message);
        alert('Đã gửi đăng ký ngày off tháng (nếu duyệt sẽ nghỉ liên tục 3 ngày ở nhà).');
        e.target.reset();
        await loadDashboardData(dateInput.value);
    });

    // Các hàm Render giao diện
    function renderFlights(flights) {
        const tbody = document.getElementById('flights-tbody');
        tbody.innerHTML = flights.map(f => `
            <tr>
                <td><strong>${f.flight_number}</strong></td>
                <td><span class="badge ${f.flight_type === 'DEP' ? 'bg-blue' : 'bg-green'}">
                    ${f.flight_type === 'DEP' ? 'Chuyến Đi' : 'Chuyến Đến'}
                </span></td>
                <td>${f.scope === 'INT' ? 'Quốc tế (Mở trước 3h)' : 'Quốc nội (Mở trước 2h)'}</td>
                <td>${DateUtils.formatTime(f.counter_open_time)} - ${DateUtils.formatTime(f.counter_close_time)}</td>
                <td><strong>${DateUtils.formatTime(f.scheduled_time)}</strong></td>
                <td>${f.gate_or_counter || '-'}</td>
            </tr>
        `).join('') || '<tr><td colspan="6">Chưa có chuyến bay trong ca này.</td></tr>';
    }

    function renderRosters(rosters, allStaff, selectedDate) {
        const tbody = document.getElementById('roster-tbody');
        if (rosters.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">Chưa chốt bảng phân ca ngày này. Ca trưởng vui lòng bấm "Chạy Xếp Ca".</td></tr>';
            return;
        }
        const dutyLabels = {
            'DEP': '<span class="badge bg-blue">Trực Chuyến Đi (24h)</span>',
            'ARR': '<span class="badge bg-green">Trực Chuyến Đến (24h)</span>',
            'OFF_CYCLE': '<span class="badge bg-gray">Nghỉ chu kỳ (24h)</span>',
            'MONTHLY_LEAVE': '<span class="badge bg-orange">Nghỉ phép tháng (3 ngày ở nhà)</span>'
        };

        tbody.innerHTML = rosters.map(r => `
            <tr>
                <td>${r.profiles?.employee_code || ''} - <strong>${r.profiles?.full_name || ''}</strong></td>
                <td>${r.profiles?.experience_years || 0} năm</td>
                <td>${dutyLabels[r.duty_type] || r.duty_type}</td>
                <td>${r.is_equipment_checker ? '<strong>Kiểm tra Trang Thiết Bị</strong>' : '-'}</td>
                <td>${r.day_rest_slot ? `Kíp ${r.rest_tier}: ${r.day_rest_slot}` : '-'}</td>
                <td>${r.night_rest_slot ? `Kíp ${r.rest_tier}: ${r.night_rest_slot}` : '-'}</td>
            </tr>
        `).join('');
    }

    function renderLeaves(leaves) {
        const tbody = document.getElementById('leaves-tbody');
        const canApprove = AuthManager.hasPermission('can_approve_leave');
        tbody.innerHTML = leaves.map(l => `
            <tr>
                <td>${l.profiles?.employee_code} - ${l.profiles?.full_name}</td>
                <td>${l.leave_date}</td>
                <td>${l.reason || '-'}</td>
                <td><strong>${l.status}</strong></td>
                <td>
                    ${(canApprove && l.status === 'PENDING') ? `
                        <button onclick="updateLeaveStatus('${l.id}', 'APPROVED')" class="btn-sm btn-green">Duyệt</button>
                        <button onclick="updateLeaveStatus('${l.id}', 'REJECTED')" class="btn-sm btn-red">Từ chối</button>
                    ` : '-'}
                </td>
            </tr>
        `).join('');
    }

    function renderStaffManagement(staffList) {
        const tbody = document.getElementById('staff-tbody');
        tbody.innerHTML = staffList.map(s => `
            <tr>
                <td>${s.employee_code}</td>
                <td>${s.full_name}</td>
                <td>${s.experience_years} năm</td>
                <td>Kíp ${s.shift_group} (${s.base_shift_type})</td>
                <td>${s.role === 'shift_leader' ? 'Ca trưởng' : 'Nhân viên'}</td>
                <td>
                    ${s.role !== 'shift_leader' ? `
                        <label><input type="checkbox" onchange="togglePerm('${s.id}', 'can_manage_flights', this.checked)" ${s.permissions?.can_manage_flights ? 'checked' : ''}> Nhập bay</label>
                        <label><input type="checkbox" onchange="togglePerm('${s.id}', 'can_approve_leave', this.checked)" ${s.permissions?.can_approve_leave ? 'checked' : ''}> Duyệt phép</label>
                    ` : 'Toàn quyền'}
                </td>
            </tr>
        `).join('');
    }

    // Hàm toàn cục hỗ trợ nút bấm nhanh trên bảng
    window.updateLeaveStatus = async (id, status) => {
        const { error } = await supabaseClient
            .from('leave_requests')
            .update({ status, approved_by: AuthManager.currentUser.id })
            .eq('id', id);
        if (error) return alert(error.message);
        await loadDashboardData(dateInput.value);
    };

    window.togglePerm = async (staffId, permKey, value) => {
        const { data: user } = await supabaseClient.from('profiles').select('permissions').eq('id', staffId).single();
        const newPerms = { ...(user.permissions || {}), [permKey]: value };
        await supabaseClient.from('profiles').update({ permissions: newPerms }).eq('id', staffId);
    };
});
