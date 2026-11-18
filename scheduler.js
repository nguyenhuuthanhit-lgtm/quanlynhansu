// scheduler.js
const ShiftScheduler = {
    /**
     * 1. Xác định trạng thái trực của 1 nhân viên trong ngày `targetDateStr` (YYYY-MM-DD)
     * Chu kỳ chuẩn 4 ngày: Ngày 0 (DEP) -> Ngày 1 (OFF) -> Ngày 2 (ARR) -> Ngày 3 (OFF)
     */
    calculateBaseDuty(staff, targetDateStr, approvedLeaves = []) {
        // Kiểm tra nếu nhân viên có đơn nghỉ phép tháng được duyệt vào ngày này
        const isOnLeave = approvedLeaves.some(
            l => l.staff_id === staff.id && l.leave_date === targetDateStr && l.status === 'APPROVED'
        );
        if (isOnLeave) return 'MONTHLY_LEAVE';

        // Mốc chuẩn tính chu kỳ: 2026-01-01
        const epoch = new Date('2026-01-01T08:00:00');
        const target = new Date(`${targetDateStr}T08:00:00`);
        const diffDays = Math.floor((target - epoch) / (1000 * 60 * 60 * 24));

        // Kíp 1 làm ngày chẵn (diffDays % 2 === 0), Kíp 2 làm ngày lẻ
        const isWorkingDay = (staff.shift_group === 1) 
            ? (Math.abs(diffDays) % 2 === 0) 
            : (Math.abs(diffDays) % 2 === 1);

        if (!isWorkingDay) return 'OFF_CYCLE';

        // Xác định làm Chuyến Đi (DEP) hay Chuyến Đến (ARR) luân phiên theo mỗi phiên trực
        const workSessionIndex = Math.floor(Math.abs(diffDays) / 2);
        if (staff.base_shift_type === 'DEP') {
            return (workSessionIndex % 2 === 0) ? 'DEP' : 'ARR';
        } else {
            return (workSessionIndex % 2 === 0) ? 'ARR' : 'DEP';
        }
    },

    /**
     * 2. Tính khung giờ mở quầy tự động khi nhập chuyến bay
     * Quốc nội (DOM): trước 2h | Quốc tế (INT): trước 3h
     */
    calculateCounterWindow(scheduledTimeIso, scope) {
        const scheduled = new Date(scheduledTimeIso);
        const leadHours = (scope === 'INT') ? 3 : 2;
        const openTime = new Date(scheduled.getTime() - leadHours * 60 * 60 * 1000);
        // Đóng quầy/kết thúc phục vụ sau giờ bay/hạ cánh 30 phút
        const closeTime = new Date(scheduled.getTime() + 30 * 60 * 1000);
        return {
            open: openTime.toISOString(),
            close: closeTime.toISOString()
        };
    },

    /**
     * 3. Thuật toán tạo bảng phân ca & nghỉ tại chỗ cuốn chiếu cho toàn bộ ca trực
     */
    generateDailyRoster(shiftDateStr, allStaff, flightsOnDay, approvedLeaves) {
        const rosters = [];
        const activeWorkers = [];

        // Bước A: Phân loại trạng thái từng nhân viên
        allStaff.forEach(staff => {
            if (!staff.is_active) return;
            const duty = this.calculateBaseDuty(staff, shiftDateStr, approvedLeaves);
            const record = {
                shift_date: shiftDateStr,
                staff_id: staff.id,
                staff_info: staff,
                duty_type: duty,
                is_equipment_checker: false,
                day_rest_slot: null,
                night_rest_slot: null,
                rest_tier: null
            };
            if (duty === 'DEP' || duty === 'ARR') {
                activeWorkers.push(record);
            }
            rosters.push(record);
        });

        // Bước B: Cắt cuốn chiếu 2 nhân viên kiểm tra trang thiết bị (chỉ áp dụng cho nhóm làm CHUYẾN ĐI)
        const depWorkers = activeWorkers
            .filter(w => w.duty_type === 'DEP')
            .sort((a, b) => (a.staff_info.equipment_check_count || 0) - (b.staff_info.equipment_check_count || 0));

        for (let i = 0; i < Math.min(2, depWorkers.length); i++) {
            depWorkers[i].is_equipment_checker = true;
        }

        // Bước C: Chia kíp nghỉ ngơi tại chỗ cuốn chiếu (3 kíp: Kíp 1, Kíp 2, Kíp 3)
        // Ngày trực trước nghỉ Kíp 1 -> Ngày trực cùng loại tiếp theo tự động đôn lên Kíp 2 -> Kíp 3
        const daySlots = [
            '09:30 - 13:30 (4h)',
            '13:30 - 17:30 (4h)',
            '11:00 - 15:00 (4h)'
        ];
        const nightSlots = [
            '22:00 - 03:00 (5h)',
            '03:00 - 07:30 (4.5h)',
            '00:00 - 05:30 (5.5h)'
        ];

        ['DEP', 'ARR'].forEach(type => {
            const group = activeWorkers.filter(w => w.duty_type === type);
            group.forEach(worker => {
                const currentTier = (worker.staff_info.rest_rotation_index % 3); // 0, 1, 2
                worker.rest_tier = currentTier + 1;
                worker.day_rest_slot = daySlots[currentTier];
                worker.night_rest_slot = nightSlots[currentTier];
            });
        });

        // Bước D: Phân bổ nhân sự vào từng chuyến bay (kiểm tra ràng buộc thâm niên & số lượng)
        const flightAssignments = [];
        const warnings = [];

        flightsOnDay.forEach(flight => {
            const isDep = flight.flight_type === 'DEP';
            const minStaff = isDep ? 4 : 1;
            const maxStaff = isDep ? 5 : 3;
            const reqExp = isDep ? 3.0 : 2.0;

            // Lọc nhân viên cùng loại ca (DEP hoặc ARR) và không bị trùng giờ nghỉ tại chỗ quá nặng
            const candidates = activeWorkers.filter(w => w.duty_type === flight.flight_type);

            // Tìm người đủ điều kiện thâm niên trước
            const seniorStaff = candidates.filter(w => Number(w.staff_info.experience_years) >= reqExp);
            const juniorStaff = candidates.filter(w => Number(w.staff_info.experience_years) < reqExp);

            if (seniorStaff.length === 0) {
                warnings.push(`Chuyến ${flight.flight_number} (${flight.flight_type}): Thiếu nhân sự có thâm niên >= ${reqExp} năm!`);
            }

            const selected = [];
            // Chọn 1 người có thâm niên làm nòng cốt
            if (seniorStaff.length > 0) {
                // Xoay vòng chọn người ít chuyến nhất trong ngày
                seniorStaff.sort((a, b) => (a.assignedCount || 0) - (b.assignedCount || 0));
                const lead = seniorStaff[0];
                lead.assignedCount = (lead.assignedCount || 0) + 1;
                selected.push({
                    flight_id: flight.id,
                    staff_id: lead.staff_id,
                    position_role: `Chính (KN >= ${reqExp} năm)`
                });
            }

            // Chọn thêm nhân viên cho đủ định biên (ưu tiên đạt mức tối ưu)
            const targetCount = Math.min(maxStaff, candidates.length);
            const remainingPool = [...seniorStaff.slice(1), ...juniorStaff]
                .sort((a, b) => (a.assignedCount || 0) - (b.assignedCount || 0));

            for (const cand of remainingPool) {
                if (selected.length >= targetCount) break;
                cand.assignedCount = (cand.assignedCount || 0) + 1;
                selected.push({
                    flight_id: flight.id,
                    staff_id: cand.staff_id,
                    position_role: 'Nhân viên quầy/cửa'
                });
            }

            if (selected.length < minStaff) {
                warnings.push(`Chuyến ${flight.flight_number}: Chỉ bố trí được ${selected.length}/${minStaff} nhân viên tối thiểu.`);
            }

            flightAssignments.push(...selected);
        });

        return { rosters, flightAssignments, warnings };
    }
};
