// =========================================================================
// [COMPONENT: js/day-rest.js] TÍNH KHOẢNG NGHỈ TRONG KHUNG CA
// Với mỗi khung ca [frameStart, frameEnd] mà nhân viên có tham gia ca con:
// - Khoảng trống từ đầu khung ca đến ca làm đầu tiên
// - Khoảng trống giữa các ca làm liên tiếp trong khung
// - Khoảng trống từ ca làm cuối cùng đến hết khung ca (frameEnd)
// =========================================================================
(function (global) {
  var Core = global.AppCore;

  function formatTs(ms) {
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

  function toMs(dateStr, timeStr) {
    if (global.AppDaySlots && typeof global.AppDaySlots.parseDateTimeToMs === "function") {
      return global.AppDaySlots.parseDateTimeToMs(dateStr, timeStr);
    }
    return null;
  }

  function getStaffWorkByFrame(staffId) {
    var st = (global.AppDaySlots && typeof global.AppDaySlots.getStore === "function")
      ? global.AppDaySlots.getStore()
      : { frames: [], slots: [] };

    var mySlots = st.slots.filter(function (sl) {
      return (sl.staffIds || []).indexOf(staffId) !== -1;
    });

    // Nhóm các ca con theo khung ca
    var byFrame = {};
    for (var i = 0; i < mySlots.length; i++) {
      var sl = mySlots[i];
      var fId = sl.frameId || "_default";
      if (!byFrame[fId]) byFrame[fId] = [];
      byFrame[fId].push(sl);
    }

    var results = [];
    var frameIds = Object.keys(byFrame);

    for (var f = 0; f < frameIds.length; f++) {
      var fid = frameIds[f];
      var frameObj = (global.AppDaySlots && typeof global.AppDaySlots.getFrameById === "function")
        ? global.AppDaySlots.getFrameById(fid)
        : null;
      var fSlots = byFrame[fid].slice().sort(function (a, b) {
        return (toMs(a.startDate, a.startTime) || 0) - (toMs(b.startDate, b.startTime) || 0);
      });

      var fStart = frameObj ? toMs(frameObj.startDate, frameObj.startTime) : toMs(fSlots[0].startDate, fSlots[0].startTime);
      var fEnd = frameObj ? toMs(frameObj.endDate, frameObj.endTime) : toMs(fSlots[fSlots.length - 1].endDate, fSlots[fSlots.length - 1].endTime);

      // Gộp các khoảng làm việc con trong khung
      var intervals = [];
      for (var j = 0; j < fSlots.length; j++) {
        var sMs = toMs(fSlots[j].startDate, fSlots[j].startTime);
        var eMs = toMs(fSlots[j].endDate, fSlots[j].endTime);
        if (sMs !== null && eMs !== null && eMs > sMs) {
          intervals.push({ start: sMs, end: eMs });
        }
      }
      intervals.sort(function (a, b) { return a.start - b.start; });

      var merged = [];
      for (var m = 0; m < intervals.length; m++) {
        if (!merged.length) {
          merged.push({ start: intervals[m].start, end: intervals[m].end });
        } else {
          var prev = merged[merged.length - 1];
          if (intervals[m].start <= prev.end) {
            if (intervals[m].end > prev.end) prev.end = intervals[m].end;
          } else {
            merged.push({ start: intervals[m].start, end: intervals[m].end });
          }
        }
      }

      // Tính khoảng nghỉ: đầu khung -> ca đầu, giữa các ca, ca cuối -> hết khung
      var restLines = [];
      if (merged.length > 0 && fStart !== null && fEnd !== null && fEnd > fStart) {
        if (merged[0].start > fStart) {
          var r0 = formatDuration(merged[0].start - fStart);
          restLines.push(formatTs(fStart) + " → " + formatTs(merged[0].start) + (r0 ? " (" + r0 + ")" : ""));
        }
        for (var g = 0; g < merged.length - 1; g++) {
          if (merged[g + 1].start > merged[g].end) {
            var rMid = formatDuration(merged[g + 1].start - merged[g].end);
            restLines.push(formatTs(merged[g].end) + " → " + formatTs(merged[g + 1].start) + (rMid ? " (" + rMid + ")" : ""));
          }
        }
        if (fEnd > merged[merged.length - 1].end) {
          var rLast = formatDuration(fEnd - merged[merged.length - 1].end);
          restLines.push(formatTs(merged[merged.length - 1].end) + " → " + formatTs(fEnd) + (rLast ? " (" + rLast + ")" : ""));
        }
      }

      results.push({
        frame: frameObj,
        slots: fSlots,
        rests: restLines
      });
    }

    return results;
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
        var groups = getStaffWorkByFrame(staff.id);

        var tr = document.createElement("tr");
        tr.appendChild(Core.makeTextCell(staff.full_name || "", true));
        tr.appendChild(Core.makeTextCell(Core.normalizeJobTitle(staff), false));

        var workTd = document.createElement("td");
        var restTd = document.createElement("td");

        if (isOff) {
          workTd.innerHTML = "<span class='badge-off'>OFF</span>";
          restTd.textContent = "Đang OFF";
        } else if (groups.length > 0) {
          var wHtml = [];
          var rHtml = [];
          for (var g = 0; g < groups.length; g++) {
            var grp = groups[g];
            var fText = grp.frame
              ? ("<strong>Khung " + grp.frame.name + "</strong> [" + (grp.frame.direction || "DEP") + "]")
              : "<strong>Khung ca</strong>";
            var slotDescs = grp.slots.map(function (s) {
              return "• " + s.position + ": " +
                (global.AppDaySlots && global.AppDaySlots.formatSlotLabel ? global.AppDaySlots.formatSlotLabel(s) : (s.startTime + "-" + s.endTime));
            });
            wHtml.push(fText + "<br>" + slotDescs.join("<br>"));

            if (grp.rests.length > 0) {
              rHtml.push("<strong>" + grp.rests.join("<br>") + "</strong>");
            }
          }
          workTd.innerHTML = wHtml.join("<br><br>");
          restTd.innerHTML = rHtml.length > 0 ? rHtml.join("<br>") : "Không có khoảng nghỉ trong khung";
        } else {
          workTd.textContent = "Chưa gán ca";
          restTd.textContent = "-";
        }

        tr.appendChild(workTd);
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

      if (global.manualOffStaff[staffId] && global.AppDaySlots && typeof global.AppDaySlots.getStore === "function") {
        var st = global.AppDaySlots.getStore();
        for (var i = 0; i < st.slots.length; i++) {
          st.slots[i].staffIds = (st.slots[i].staffIds || []).filter(function (id) { return id !== staffId; });
        }
        if (typeof global.AppDaySlots.saveStore === "function") {
          global.AppDaySlots.saveStore();
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
    syncState: function () {},
    syncShiftsToState: function () {},
    syncSlotsToRosters: function () {},
    renderDaySchedule: renderDaySchedule
  };
})(window);