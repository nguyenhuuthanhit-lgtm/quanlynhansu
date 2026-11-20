// =========================================================================
// [COMPONENT: js/stats-role.js] THỐNG KÊ TỔNG QUAN & PHÂN QUYỀN VAI TRÒ
// Tính: Tổng số NV, NV học viện, NV chính thức, Đi làm trong ngày, OFF trong ngày.
// =========================================================================
(function (global) {
  var Core = global.AppCore;

  function getStaffArray() {
    var rs = global.rosterState;
    if (rs && Array.isArray(rs.staffList) && rs.staffList.length > 0) return rs.staffList;
    if (rs && Array.isArray(rs.staffs) && rs.staffs.length > 0) return rs.staffs;
    if (Array.isArray(global.staffList) && global.staffList.length > 0) return global.staffList;
    return (rs && Array.isArray(rs.staffList)) ? rs.staffList : [];
  }

  function isOffDay(staffId, rec, dateStr) {
    var rs = global.rosterState || {};
    var leaves = rs.leavesByStaff || {};

    if (leaves[staffId] || (dateStr && leaves[staffId + "_" + dateStr])) {
      return true;
    }

    if (Array.isArray(rs.leaves)) {
      for (var i = 0; i < rs.leaves.length; i++) {
        var lv = rs.leaves[i];
        if (lv && lv.staff_id === staffId && lv.status !== "rejected") {
          if (!dateStr || !lv.leave_date || lv.leave_date === dateStr) {
            return true;
          }
        }
      }
    }

    if (rec && (rec.is_day_off === true || rec.duty_type === "OFF")) {
      return true;
    }

    return false;
  }

  function getRosterForStaffDate(staffId, dateStr) {
    var rs = global.rosterState || {};
    var map = rs.rostersByStaff || {};

    if (map[staffId]) return map[staffId];
    if (dateStr && map[staffId + "_" + dateStr]) return map[staffId + "_" + dateStr];

    if (Array.isArray(rs.dailyRosters)) {
      for (var i = 0; i < rs.dailyRosters.length; i++) {
        var r = rs.dailyRosters[i];
        if (r && r.staff_id === staffId && (!dateStr || !r.shift_date || r.shift_date === dateStr)) {
          return r;
        }
      }
    }

    if (typeof global.getOrCreateRoster === "function") {
      return global.getOrCreateRoster(staffId, dateStr);
    }
    return null;
  }

  function renderPanelStats() {
    var allStaff = getStaffArray();
    var total = allStaff.length;
    var officialCount = 0; // Nhân viên chính thức
    var traineeCount = 0;  // Nhân viên học viện
    var offTodayCount = 0;
    var date = Core && typeof Core.getSelectedDate === "function" ? Core.getSelectedDate() : "";

    for (var i = 0; i < allStaff.length; i++) {
      var s = allStaff[i];
      var title = Core && typeof Core.normalizeJobTitle === "function"
        ? Core.normalizeJobTitle(s)
        : (s.job_title || "Học việc");

      if (title === "Chính thức") {
        officialCount++;
      } else {
        traineeCount++;
      }

      var rec = getRosterForStaffDate(s.id, date);
      if (isOffDay(s.id, rec, date)) {
        offTodayCount++;
      }
    }

    var workTodayCount = Math.max(0, total - offTodayCount);

    var elTotal = document.getElementById("statTotalStaff");
    var elNew = document.getElementById("statNewStaff");
    var elOld = document.getElementById("statOldStaff");
    var elWork = document.getElementById("statWorkToday");
    var elOff = document.getElementById("statOffToday");

    if (elTotal) elTotal.textContent = String(total);
    if (elNew) elNew.textContent = String(traineeCount);
    if (elOld) elOld.textContent = String(officialCount);
    if (elWork) elWork.textContent = String(workTodayCount);
    if (elOff) elOff.textContent = String(offTodayCount);
  }

  // Tải trực tiếp từ Supabase nếu rosterState.staffList đang rỗng để đảm bảo thống kê không bị 0
  function refreshStatsWithFallback() {
    renderPanelStats();
    var currentList = getStaffArray();
    if (currentList.length > 0 || !Core || typeof Core.getClient !== "function") {
      return Promise.resolve();
    }

    var client = Core.getClient();
    if (!client) return Promise.resolve();

    var date = Core.getSelectedDate();
    if (!global.rosterState) {
      global.rosterState = {
        staffList: [],
        rostersByStaff: {},
        leavesByStaff: {},
        monthRosters: [],
        monthLeaves: [],
        monthShiftDirs: {}
      };
    }

    return Promise.all([
      client.from("profiles").select("*").eq("is_active", true).order("employee_code", { ascending: true }),
      client.from("daily_rosters").select("*").eq("shift_date", date),
      client.from("leave_requests").select("*").eq("leave_date", date).neq("status", "rejected")
    ]).then(function (results) {
      var profRes = results[0];
      var rostRes = results[1];
      var leaveRes = results[2];

      if (!profRes.error && Array.isArray(profRes.data) && profRes.data.length > 0) {
        global.rosterState.staffList = profRes.data;
      }

      if (!rostRes.error && Array.isArray(rostRes.data)) {
        global.rosterState.rostersByStaff = global.rosterState.rostersByStaff || {};
        for (var i = 0; i < rostRes.data.length; i++) {
          var r = rostRes.data[i];
          global.rosterState.rostersByStaff[r.staff_id] = r;
        }
      }

      if (!leaveRes.error && Array.isArray(leaveRes.data)) {
        global.rosterState.leavesByStaff = global.rosterState.leavesByStaff || {};
        for (var j = 0; j < leaveRes.data.length; j++) {
          var lv = leaveRes.data[j];
          global.rosterState.leavesByStaff[lv.staff_id] = lv;
        }
      }

      renderPanelStats();
    }).catch(function () {
      renderPanelStats();
    });
  }

  function applyRoleLabelsAndVisibility() {
    var leader = Core && typeof Core.isShiftLeader === "function" ? Core.isShiftLeader() : false;

    var tabBtn1 = document.getElementById("tabBtn1");
    var tabBtn2 = document.getElementById("tabBtn2");
    var tabBtn3 = document.getElementById("tabBtn3");
    if (tabBtn1) tabBtn1.textContent = leader ? "1. Thông tin nhân sự" : "1. Thông tin cá nhân";
    if (tabBtn2) tabBtn2.textContent = leader ? "2. Cắt lịch trong ngày" : "2. Vị trí trong ngày";
    if (tabBtn3) tabBtn3.textContent = leader ? "3. Cắt lịch trong tháng" : "3. Lịch làm / OFF trong tháng";

    var teamCard = document.getElementById("teamManageCard");
    var formCard = document.getElementById("staffFormCard");
    var myCard = document.getElementById("myPersonalCard");
    var staffTableCard = document.getElementById("staffTableCard");
    if (teamCard) teamCard.style.display = leader ? "block" : "none";
    if (formCard) formCard.style.display = leader ? "block" : "none";
    if (myCard) myCard.style.display = leader ? "none" : "block";
    if (staffTableCard) staffTableCard.style.display = leader ? "block" : "none";

    var dayTitle = document.getElementById("daySectionTitle");
    var dayControls = document.getElementById("dayCutControls");
    var btnSaveAll = document.getElementById("btnSaveAllRosters");
    if (dayTitle) dayTitle.textContent = leader ? "Cắt Lịch Trong Ngày" : "Vị Trí Trong Ngày";
    if (dayControls) dayControls.style.display = leader ? "block" : "none";
    if (btnSaveAll) btnSaveAll.style.display = leader ? "inline-block" : "none";

    var monthTitle = document.getElementById("monthSectionTitle");
    var monthHint = document.getElementById("monthHintText");
    if (monthTitle) monthTitle.textContent = leader ? "Cắt Lịch Trong Tháng" : "Lịch Làm / OFF Trong Tháng";
    if (monthHint) {
      monthHint.textContent = leader
        ? "Chọn Hướng ca (DEP / ARR) cho từng nhân sự trong tháng và bấm vào từng ngày (01..31) để chuyển giữa Ngày làm (xanh) và Ngày OFF (đỏ)."
        : "Xem hướng ca (DEP / ARR), danh sách ngày làm và ngày OFF của bạn trong tháng.";
    }
  }

  global.AppStatsRole = {
    renderPanelStats: renderPanelStats,
    refreshStatsWithFallback: refreshStatsWithFallback,
    applyRoleLabelsAndVisibility: applyRoleLabelsAndVisibility
  };
})(window);
