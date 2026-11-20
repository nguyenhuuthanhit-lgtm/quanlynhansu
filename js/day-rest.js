// =========================================================================
// [COMPONENT: js/day-rest.js] TÍNH KHOẢNG NGHỈ TẠI CHỖ & HIỂN THỊ CA
// Tính chính xác thời gian nghỉ giữa các ca theo mốc ngày + giờ thực tế
// (hỗ trợ nhiều ca sáng/tối, ca 12h/24h xuyên ngày) và hướng DEP/ARR.
// =========================================================================
(function (global) {
  var Core = global.AppCore;

  function formatTimestamp(ms) {
    var d = new Date(ms);
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var hh = String(d.getHours()).padStart(2, "0");
    var mi = String(d.getMinutes()).padStart(2, "0");
    return dd + "/" + mm + " " + hh + ":" + mi;
  }

  function formatDuration(diffMs) {
    var totalMins = Math.floor(diffMs / 60000);
    if (totalMins <= 0) return "";
    var hrs = Math.floor(totalMins / 60);
    var mins = totalMins % 60;
    return (hrs > 0 ? hrs + "g" : "") + (mins > 0 ? mins + "p" : "");
  }

  function getRangeMs(shift) {
    if (global.AppDaySlots && typeof global.AppDaySlots.getShiftRangeMs === "function") {
      return global.AppDaySlots.getShiftRangeMs(shift);
    }
    return null;
  }

  function formatShiftLabel(shift) {
    if (global.AppDaySlots && typeof global.AppDaySlots.formatShiftRangeLabel === "function") {
      return global.AppDaySlots.formatShiftRangeLabel(shift);
    }
    return (shift.direction || "DEP") + " " + (shift.startTime || "") + " - " + (shift.endTime || "");
  }

  function getStaffShifts(staffId) {
    var all = (global.AppDaySlots && typeof global.AppDaySlots.getShifts === "function")
      ? global.AppDaySlots.getShifts()
      : [];
    var matched = [];
    for (var i = 0; i < all.length; i++) {
      if ((all[i].staffIds || []).indexOf(staffId) !== -1) {
        matched.push(all[i]);
      }
    }
    matched.sort(function (a, b) {
      var ra = getRangeMs(a);
      var rb = getRangeMs(b);
      if (!ra) return 1;
      if (!rb) return -1;
      if (ra.startMs !== rb.startMs) return ra.startMs - rb.startMs;
      return ra.endMs - rb.endMs;
    });
    return matched;
  }

  // Tính các khoảng nghỉ tại chỗ giữa các ca làm việc của nhân viên
  function computeRestPeriods(staffShifts) {
    if (!staffShifts || staffShifts.length <= 1) return [];
    var intervals = [];
    for (var i = 0; i < staffShifts.length; i++) {
      var rng = getRangeMs(staffShifts[i]);
      if (rng) intervals.push({ start: rng.startMs, end: rng.endMs });
    }
    if (intervals.length <= 1) return [];

    intervals.sort(function (a, b) {
      return a.start !== b.start ? a.start - b.start : a.end - b.end;
    });

    var merged = [intervals[0]];
    for (var j = 1; j < intervals.length; j++) {
      var last = merged[merged.length - 1];
      var cur = intervals[j];
      if (cur.start <= last.end) {
        if (cur.end > last.end) last.end = cur.end;
      } else {
        merged.push({ start: cur.start, end: cur.end });
      }
    }

    var rests = [];
    for (var k = 0; k < merged.length - 1; k++) {
      var restStart = merged[k].end;
      var restEnd = merged[k + 1].start;
      if (restEnd > restStart) {
        var dur = formatDuration(restEnd - restStart);
        rests.push(formatTimestamp(restStart) + " → " + formatTimestamp(restEnd) + (dur ? " (" + dur + ")" : ""));
      }
    }
    return rests;
  }

  function syncShiftsToState(shifts) {
    if (!global.rosterState) return;
    var allStaff = global.rosterState.staffList || [];
    for (var i = 0; i < allStaff.length; i++) {
      var st = allStaff[i];
      var myShifts = getStaffShifts(st.id);
      if (typeof global.getOrCreateRoster === "function") {
        var dateKey = (myShifts[0] && myShifts[0].startDate) || Core.getSelectedDate();
        var rec = global.getOrCreateRoster(st.id, dateKey);
        rec.shift_direction = myShifts[0] ? (myShifts[0].direction || "DEP") : (st.base_shift_type || "DEP");
        rec.shift_1 = myShifts[0] ? (myShifts[0].position + " " + formatShiftLabel(myShifts[0])) : "";
        rec.shift_2 = myShifts[1] ? (myShifts[1].position + " " + formatShiftLabel(myShifts[1])) : "";
        rec.work_shifts = myShifts.map(function (s) {
          return {
            position: s.position,
            direction: s.direction || "DEP",
            startDate: s.startDate,
            startTime: s.startTime,
            endDate: s.endDate,
            endTime: s.endTime
          };
        });
      }
    }
  }

  function renderDaySchedule() {
    var tbody = document.getElementById("scheduleBody");
    if (!tbody || !global.rosterState) return;
    tbody.innerHTML = "";

    var list = Core.getVisibleStaffList();
    var offMap = global.manualOffStaff || {};

    for (var i = 0; i < list.length; i++) {
      (function (staff) {
        var isOff = Boolean(offMap[staff.id]);
        var myShifts = getStaffShifts(staff.id);
        var rests = computeRestPeriods(myShifts);

        var tr = document.createElement("tr");
        tr.appendChild(Core.makeTextCell(staff.full_name || "", true));
        tr.appendChild(Core.makeTextCell(Core.normalizeJobTitle(staff), false));

        var workTd = document.createElement("td");
        if (isOff) {
          workTd.innerHTML = "<span class='badge-off'>OFF</span>";
        } else if (myShifts.length > 0) {
          var lines = [];
          for (var sIdx = 0; sIdx < myShifts.length; sIdx++) {
            var sh = myShifts[sIdx];
            lines.push("<strong>" + sh.position + "</strong>: " + formatShiftLabel(sh));
          }
          workTd.innerHTML = lines.join("<br>");
        } else {
          workTd.textContent = "Nghỉ tại chỗ";
        }
        tr.appendChild(workTd);

        var restTd = document.createElement("td");
        if (isOff) {
          restTd.textContent = "Đang OFF";
        } else if (rests.length > 0) {
          restTd.innerHTML = "<strong>" + rests.join("<br>") + "</strong>";
        } else if (myShifts.length > 0) {
          restTd.textContent = "Không có khoảng nghỉ xen giữa các ca";
        } else {
          restTd.textContent = "Nghỉ tại chỗ";
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
      var staffSel = document.getElementById("assignStaffSelect");
      var staffId = staffSel ? staffSel.value : "";
      if (!staffId) return;

      global.manualOffStaff = global.manualOffStaff || {};
      global.manualOffStaff[staffId] = !global.manualOffStaff[staffId];

      // Nếu đánh dấu OFF thì gỡ nhân viên khỏi các ca đang gán
      if (global.manualOffStaff[staffId] && global.AppDaySlots && typeof global.AppDaySlots.getShifts === "function") {
        var allShifts = global.AppDaySlots.getShifts();
        for (var i = 0; i < allShifts.length; i++) {
          allShifts[i].staffIds = (allShifts[i].staffIds || []).filter(function (id) { return id !== staffId; });
        }
        if (typeof global.AppDaySlots.saveShifts === "function") {
          global.AppDaySlots.saveShifts();
        }
      }

      if (global.AppDaySlots && typeof global.AppDaySlots.renderPositionSlotSelectorsAndCards === "function") {
        global.AppDaySlots.renderPositionSlotSelectorsAndCards();
      }
      renderDaySchedule();
      if (global.AppStatsRole && typeof global.AppStatsRole.renderPanelStats === "function") {
        global.AppStatsRole.renderPanelStats();
      }
    });
  }

  global.AppDayRest = {
    syncShiftsToState: syncShiftsToState,
    syncSlotsToRosters: syncShiftsToState,
    renderDaySchedule: renderDaySchedule
  };
})(window);