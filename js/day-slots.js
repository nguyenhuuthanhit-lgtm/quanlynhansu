// =========================================================================
// [COMPONENT: js/day-slots.js] TẠO CA LÀM VIỆC TỪ NGÀY/GIỜ ĐẾN NGÀY/GIỜ
// Hỗ trợ chọn hướng ca DEP / ARR, ca 24h hôm nay sang ngày mai,
// ca tối sang sáng và tự lưu ngay khi thao tác.
// =========================================================================
(function (global) {
  var Core = global.AppCore;
  var STORAGE_KEY = "airport_custom_shifts_v1";
  var shiftsList = [];

  function initDefaultDateInputs() {
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, "0");
    var dd = String(today.getDate()).padStart(2, "0");
    var todayStr = yyyy + "-" + mm + "-" + dd;

    var tomorrow = new Date(today.getTime() + 86400000);
    var tStr = tomorrow.getFullYear() + "-" +
      String(tomorrow.getMonth() + 1).padStart(2, "0") + "-" +
      String(tomorrow.getDate()).padStart(2, "0");

    var startDateEl = document.getElementById("slotStartDateInput");
    var endDateEl = document.getElementById("slotEndDateInput");
    if (startDateEl && !startDateEl.value) startDateEl.value = todayStr;
    if (endDateEl && !endDateEl.value) endDateEl.value = tStr;
  }

  function loadShiftsFromStorage() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      shiftsList = Array.isArray(raw) ? raw : [];
    } catch (e) {
      shiftsList = [];
    }
    return shiftsList;
  }

  function getShifts() {
    if (!shiftsList.length) {
      loadShiftsFromStorage();
    }
    return shiftsList;
  }

  function saveShifts() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shiftsList));
    } catch (e) {}
    if (global.AppDayRest && typeof global.AppDayRest.syncShiftsToState === "function") {
      global.AppDayRest.syncShiftsToState(shiftsList);
    }
  }

  function parseDateTimeToMs(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    var dParts = dateStr.split("-");
    var tParts = timeStr.split(":");
    if (dParts.length !== 3 || tParts.length < 2) return null;
    var y = Number(dParts[0]);
    var m = Number(dParts[1]) - 1;
    var d = Number(dParts[2]);
    var hh = Number(tParts[0]);
    var mm = Number(tParts[1]);
    if ([y, m, d, hh, mm].some(function (n) { return Number.isNaN(n); })) return null;
    return new Date(y, m, d, hh, mm, 0, 0).getTime();
  }

  function getShiftRangeMs(shift) {
    var s = parseDateTimeToMs(shift.startDate, shift.startTime);
    var e = parseDateTimeToMs(shift.endDate, shift.endTime);
    if (s === null || e === null) return null;
    return { startMs: s, endMs: e };
  }

  function formatShortDate(dateStr) {
    if (!dateStr || dateStr.indexOf("-") === -1) return dateStr || "";
    var p = dateStr.split("-");
    return p[2] + "/" + p[1];
  }

  function formatShiftRangeLabel(shift) {
    var dir = shift.direction === "ARR" ? "ARR" : "DEP";
    return "[" + dir + "] " +
      formatShortDate(shift.startDate) + " " + shift.startTime +
      " → " +
      formatShortDate(shift.endDate) + " " + shift.endTime;
  }

  function getStaffNameById(staffId) {
    var list = (global.rosterState && global.rosterState.staffList) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === staffId) return list[i].full_name || list[i].employee_code || "";
    }
    return "";
  }

  function refreshShiftViews() {
    renderShiftSelectorsAndCards();
    if (global.AppDayRest && typeof global.AppDayRest.renderDaySchedule === "function") {
      global.AppDayRest.renderDaySchedule();
    }
  }

  function renderShiftSelectorsAndCards() {
    initDefaultDateInputs();
    var shifts = getShifts();
    var staffList = (global.rosterState && global.rosterState.staffList) || [];

    var slotSel = document.getElementById("assignSlotSelect");
    var staffSel = document.getElementById("assignStaffSelect");
    var container = document.getElementById("positionSlotsContainer");

    if (slotSel) {
      var prevVal = slotSel.value;
      slotSel.innerHTML = "";
      for (var i = 0; i < shifts.length; i++) {
        var opt = document.createElement("option");
        opt.value = shifts[i].id;
        opt.textContent = (shifts[i].position || "Ca làm việc") + " — " + formatShiftRangeLabel(shifts[i]);
        slotSel.appendChild(opt);
      }
      if (prevVal) slotSel.value = prevVal;
    }

    if (staffSel) {
      var prevStaff = staffSel.value;
      staffSel.innerHTML = "";
      for (var j = 0; j < staffList.length; j++) {
        var sOpt = document.createElement("option");
        sOpt.value = staffList[j].id;
        sOpt.textContent = (staffList[j].full_name || "") + " - " + Core.normalizeJobTitle(staffList[j]);
        staffSel.appendChild(sOpt);
      }
      if (prevStaff) staffSel.value = prevStaff;
    }

    if (!container) return;
    container.innerHTML = "";

    if (!shifts.length) {
      container.innerHTML = "<div class='small-muted'>Chưa có ca làm việc nào được tạo. Hãy nhập vị trí, hướng DEP/ARR và khoảng ngày/giờ ở trên.</div>";
      return;
    }

    for (var k = 0; k < shifts.length; k++) {
      (function (sh) {
        var card = document.createElement("div");
        card.className = "slot-card";

        var head = document.createElement("div");
        head.className = "slot-header";

        var titleEl = document.createElement("div");
        titleEl.innerHTML = "<strong>" + sh.position + "</strong> <span class='small-muted'>(" +
          formatShiftRangeLabel(sh) + ")</span>";

        var btnDel = document.createElement("button");
        btnDel.type = "button";
        btnDel.className = "btn-danger btn-sm";
        btnDel.textContent = "Xóa ca";
        btnDel.addEventListener("click", function () {
          shiftsList = shiftsList.filter(function (item) { return item.id !== sh.id; });
          saveShifts();
          refreshShiftViews();
        });

        head.appendChild(titleEl);
        head.appendChild(btnDel);
        card.appendChild(head);

        var chipsWrap = document.createElement("div");
        var assigned = sh.staffIds || [];
        if (!assigned.length) {
          chipsWrap.innerHTML = "<span class='small-muted'>Chưa có nhân viên nào trong ca này.</span>";
        } else {
          for (var a = 0; a < assigned.length; a++) {
            (function (stId) {
              var chip = document.createElement("span");
              chip.className = "assigned-chip";
              var txt = document.createElement("span");
              txt.textContent = getStaffNameById(stId);
              var xBtn = document.createElement("button");
              xBtn.type = "button";
              xBtn.textContent = "×";
              xBtn.addEventListener("click", function () {
                sh.staffIds = (sh.staffIds || []).filter(function (id) { return id !== stId; });
                saveShifts();
                refreshShiftViews();
              });
              chip.appendChild(txt);
              chip.appendChild(xBtn);
              chipsWrap.appendChild(chip);
            })(assigned[a]);
          }
        }
        card.appendChild(chipsWrap);
        container.appendChild(card);
      })(shifts[k]);
    }
  }

  var addForm = document.getElementById("addPositionSlotForm");
  if (addForm) {
    addForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!Core.isShiftLeader()) return alert("Chỉ Ca trưởng mới được tạo ca làm việc.");

      var pos = document.getElementById("slotPositionInput").value.trim();
      var direction = document.getElementById("slotDirectionInput").value || "DEP";
      var startDate = document.getElementById("slotStartDateInput").value;
      var startTime = document.getElementById("slotStartTimeInput").value;
      var endDate = document.getElementById("slotEndDateInput").value;
      var endTime = document.getElementById("slotEndTimeInput").value;

      if (!pos || !startDate || !startTime || !endDate || !endTime) {
        return alert("Vui lòng nhập đủ vị trí, hướng ca và thời gian bắt đầu/kết thúc.");
      }

      var sMs = parseDateTimeToMs(startDate, startTime);
      var eMs = parseDateTimeToMs(endDate, endTime);
      if (sMs === null || eMs === null || eMs <= sMs) {
        return alert("Thời gian kết thúc phải lớn hơn thời gian bắt đầu.");
      }

      shiftsList.push({
        id: "shift_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        position: pos,
        direction: direction,
        startDate: startDate,
        startTime: startTime,
        endDate: endDate,
        endTime: endTime,
        staffIds: []
      });

      saveShifts();
      document.getElementById("slotPositionInput").value = "";
      refreshShiftViews();
    });
  }

  var btnAddStaff = document.getElementById("btnAddStaffToSlot");
  if (btnAddStaff) {
    btnAddStaff.addEventListener("click", function () {
      if (!Core.isShiftLeader()) return;
      var shiftId = document.getElementById("assignSlotSelect").value;
      var staffId = document.getElementById("assignStaffSelect").value;
      if (!shiftId || !staffId) return alert("Vui lòng tạo ca làm việc trước và chọn nhân viên.");

      var target = null;
      for (var i = 0; i < shiftsList.length; i++) {
        if (shiftsList[i].id === shiftId) {
          target = shiftsList[i];
          break;
        }
      }
      if (!target) return;
      if (!Array.isArray(target.staffIds)) target.staffIds = [];
      if (target.staffIds.indexOf(staffId) === -1) {
        target.staffIds.push(staffId);
      }

      saveShifts();
      refreshShiftViews();
    });
  }

  loadShiftsFromStorage();
  initDefaultDateInputs();

  global.AppDaySlots = {
    getShifts: getShifts,
    getDaySlots: getShifts,
    saveShifts: saveShifts,
    saveDaySlots: saveShifts,
    getShiftRangeMs: getShiftRangeMs,
    formatShiftRangeLabel: formatShiftRangeLabel,
    renderPositionSlotSelectorsAndCards: renderShiftSelectorsAndCards
  };
})(window);