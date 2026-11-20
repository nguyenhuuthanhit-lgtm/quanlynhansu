// =========================================================================
// [COMPONENT: js/stats-role.js] THỐNG KÊ TỔNG QUAN & PHÂN QUYỀN VAI TRÒ
// =========================================================================
(function (global) {
  var Core = global.AppCore;

  function isOffDay(staffId, rec) {
    var leaves = (global.rosterState && global.rosterState.leavesByStaff) || {};
    return Boolean((rec && rec.is_day_off) || leaves[staffId]);
  }

  function renderPanelStats() {
    var allStaff = (global.rosterState && global.rosterState.staffList) || [];
    var total = allStaff.length;
    var oldCount = 0;
    var newCount = 0;
    var offTodayCount = 0;
    var date = Core.getSelectedDate();

    for (var i = 0; i < allStaff.length; i++) {
      var s = allStaff[i];
      if (Core.normalizeJobTitle(s) === "Chính thức") oldCount++;
      else newCount++;

      var rec = (global.rosterState && global.rosterState.rostersByStaff)
        ? global.rosterState.rostersByStaff[s.id]
        : null;
      if (!rec && typeof global.getOrCreateRoster === "function") {
        rec = global.getOrCreateRoster(s.id, date);
      }
      if (isOffDay(s.id, rec)) offTodayCount++;
    }

    var workTodayCount = Math.max(0, total - offTodayCount);

    var elTotal = document.getElementById("statTotalStaff");
    var elNew = document.getElementById("statNewStaff");
    var elOld = document.getElementById("statOldStaff");
    var elWork = document.getElementById("statWorkToday");
    var elOff = document.getElementById("statOffToday");

    if (elTotal) elTotal.textContent = String(total);
    if (elNew) elNew.textContent = String(newCount);
    if (elOld) elOld.textContent = String(oldCount);
    if (elWork) elWork.textContent = String(workTodayCount);
    if (elOff) elOff.textContent = String(offTodayCount);
  }

  function applyRoleLabelsAndVisibility() {
    var leader = Core.isShiftLeader();

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
    applyRoleLabelsAndVisibility: applyRoleLabelsAndVisibility
  };
})(window);
