// =========================================================================
// [COMPONENT: js/day-rest.js] TÍNH THỜI GIAN NGHỈ NGƠI & BẢNG LỊCH NGÀY
// =========================================================================
(function (global) {
  var Core = global.AppCore;

  function timeToMinutes(hhmm) {
    if (!hhmm || hhmm.indexOf(":") === -1) return null;
    var parts = hhmm.split(":");
    var h = Number(parts[0]);
    var m = Number(parts[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  function minutesToTime(mins) {
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function getStaffWorkSlots(staffId, dateStr) {
    var slots = (global.AppDaySlots && global.AppDaySlots.getDaySlots)
      ? global.AppDaySlots.getDaySlots(dateStr)
      : [];
    var matched = [];
    for (var i = 0; i < slots.length; i++) {
      if ((slots[i].staffIds || []).indexOf(staffId) !== -1) matched.push(slots[i]);
    }
    matched.sort(function (a, b) {
      var ma = timeToMinutes(a.start);
      var mb = timeToMinutes(b.start);
      if (ma === null) return 1;
      if (mb === null) return -1;
      return ma - mb;
    });
    return matched;
  }

  function computeRestPeriods(workSlots) {
    if (!workSlots || workSlots.length <= 1) return [];
    var rests = [];
    for (var i = 0; i < workSlots.length - 1; i++) {
      var prevEnd = timeToMinutes(workSlots[i].end);
      var nextStart = timeToMinutes(workSlots[i + 1].start);
      if (prevEnd !== null && nextStart !== null && nextStart > prevEnd) {
        rests.push(minutesToTime(prevEnd) + "-" + minutesToTime(nextStart));
      }
    }
    return rests;
  }

  function syncSlotsToRosters(dateStr) {
    if (typeof global.getOrCreateRoster !== "function") return;
    var allStaff = (global.rosterState && global.rosterState.staffList) || [];
    for (var i = 0; i < allStaff.length; i++) {
      var st = allStaff[i];
      var rec = global.getOrCreateRoster(st.id, dateStr);
      var mySlots = getStaffWorkSlots(st.id, dateStr);
      var rests = computeRestPeriods(mySlots);

      rec.shift_1 = mySlots[0] ? (mySlots[0].position + " (" + mySlots[0].start + "-" + mySlots[0].end + ")") : "";
      rec.shift_2 = mySlots[1] ? (mySlots[1].position + " (" + mySlots[1].start + "-" + mySlots[1].end + ")") : "";
      rec.extra_shifts = [];
      for (var j = 2; j < mySlots.length; j++) {
        rec.extra_shifts.push(mySlots[j].position + " (" + mySlots[j].start + "-" + mySlots[j].end + ")");
      }
      rec.break_off_slots = rests;
      if (mySlots.length > 0) {
        rec.work_hours = mySlots[0].start + "-" + mySlots[mySlots.length - 1].end;
      }
    }
  }

  function renderDaySchedule() {
    var tbody = document.getElementById("scheduleBody");
    if (!tbody || !global.rosterState) return;
    tbody.innerHTML = "";

    var date = Core.getSelectedDate();
    var list = Core.getVisibleStaffList();
    var leaves = global.rosterState.leavesByStaff || {};

    for (var i = 0; i < list.length; i++) {
      (function (staff) {
        var rec = typeof global.getOrCreateRoster === "function"
          ? global.getOrCreateRoster(staff.id, date)
          : null;
        var off = Boolean((rec && rec.is_day_off) || leaves[staff.id]);
        var mySlots = getStaffWorkSlots(staff.id, date);
        var rests = computeRestPeriods(mySlots);

        var tr = document.createElement("tr");
        tr.appendChild(Core.makeTextCell(staff.full_name || "", true));
        tr.appendChild(Core.makeTextCell(Core.normalizeJobTitle(staff), false));

        var workTd = document.createElement("td");
        if (off) {
          workTd.innerHTML = "<span class='badge-off'>OFF CẢ NGÀY</span>";
        } else if (mySlots.length > 0) {
          var lines = [];
          for (var sIdx = 0; sIdx < mySlots.length; sIdx++) {
            var sl = mySlots[sIdx];
            lines.push("<strong>" + sl.position + "</strong>: " + sl.start + " - " + sl.end);
          }
          workTd.innerHTML = lines.join("<br>");
        } else {
          workTd.textContent = "Nghỉ ngơi tại chỗ";
        }
        tr.appendChild(workTd);

        var restTd = document.createElement("td");
        if (off) {
          restTd.textContent = "Nghỉ cả ngày";
        } else if (rests.length > 0) {
          restTd.innerHTML = "<strong>" + rests.join(", ") + "</strong>";
        } else if (mySlots.length > 0) {
          restTd.textContent = "Không có khoảng nghỉ giữa ca";
        } else {
          restTd.textContent = "Nghỉ ngơi tại chỗ";
        }
        tr.appendChild(restTd);

        tbody.appendChild(tr);
      })(list[i]);
    }
  }

  var btnCutDayOff = document.getElementById("btnCutDayOff");
  if (btnCutDayOff) {
    btnCutDayOff.addEventListener("click", function () {
      if (!Core.isShiftLeader()) return;
      var client = Core.getClient();
      if (!client) return;
      var staffId = document.getElementById("assignStaffSelect").value;
      var date = Core.getSelectedDate();
      if (!staffId) return;

      client
        .from("leave_requests")
        .insert({
          staff_id: staffId,
          leave_date: date,
          reason: "Ca trưởng cắt OFF cả ngày",
          status: "approved",
          approved_by: (global.currentStaff && global.currentStaff.id) ? global.currentStaff.id : null
        })
        .then(function () {
          var rec = global.getOrCreateRoster(staffId, date);
          rec.is_day_off = true;
          if (typeof global.upsertSingleRoster === "function") return global.upsertSingleRoster(rec);
        })
        .then(function () {
          if (global.AppTabs && global.AppTabs.loadDashboardData) global.AppTabs.loadDashboardData();
        });
    });
  }

  var btnSaveAll = document.getElementById("btnSaveAllRosters");
  if (btnSaveAll) {
    btnSaveAll.addEventListener("click", function () {
      if (!Core.isShiftLeader()) return;
      var date = Core.getSelectedDate();
      syncSlotsToRosters(date);
      if (global.AppDaySlots && global.AppDaySlots.saveDaySlots) global.AppDaySlots.saveDaySlots(date);

      var mapObj = (global.rosterState && global.rosterState.rostersByStaff) || {};
      var keys = Object.keys(mapObj);
      var chain = Promise.resolve();
      for (var i = 0; i < keys.length; i++) {
        (function (rec) {
          chain = chain.then(function () {
            if (typeof global.upsertSingleRoster === "function") return global.upsertSingleRoster(rec);
          });
        })(mapObj[keys[i]]);
      }
      chain.then(function () {
        if (global.AppStatsRole && global.AppStatsRole.renderPanelStats) global.AppStatsRole.renderPanelStats();
        alert("Đã lưu lịch ngày " + date);
      }).catch(function (err) {
        alert("Lỗi lưu lịch: " + err.message);
      });
    });
  }

  global.AppDayRest = {
    syncSlotsToRosters: syncSlotsToRosters,
    renderDaySchedule: renderDaySchedule
  };
})(window);
