// =========================================================================
// [COMPONENT: js/day-rest.js] TÍNH THỜI GIAN NGHỈ NGƠI & LƯU LỊCH NGÀY
// Hỗ trợ khung sáng/tối, ca 12h/24h xuyên ngày và lưu an toàn lên Supabase.
// =========================================================================
(function (global) {
  var Core = global.AppCore;

  function minutesToClockLabel(mins) {
    var dayOffset = Math.floor(mins / 1440);
    var rem = ((mins % 1440) + 1440) % 1440;
    var h = Math.floor(rem / 60);
    var m = rem % 60;
    var hhmm = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
    return dayOffset > 0 ? (hhmm + " (+" + dayOffset + "d)") : hhmm;
  }

  function getRange(slot) {
    if (global.AppDaySlots && typeof global.AppDaySlots.getSlotRangeMinutes === "function") {
      return global.AppDaySlots.getSlotRangeMinutes(slot);
    }
    return null;
  }

  function formatLabel(slot) {
    if (global.AppDaySlots && typeof global.AppDaySlots.formatSlotRangeLabel === "function") {
      return global.AppDaySlots.formatSlotRangeLabel(slot);
    }
    return (slot.start || "") + " - " + (slot.end || "");
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
      var ra = getRange(a);
      var rb = getRange(b);
      if (!ra) return 1;
      if (!rb) return -1;
      if (ra.startMin !== rb.startMin) return ra.startMin - rb.startMin;
      return ra.endMin - rb.endMin;
    });
    return matched;
  }

  // Tính khoảng nghỉ tại chỗ xen giữa các khung làm việc (sáng, chiều, tối, xuyên ngày)
  function computeRestPeriods(workSlots) {
    if (!workSlots || workSlots.length <= 1) return [];
    var rests = [];

    // Gộp các khung bị chồng lấn để tính khoảng nghỉ trống chính xác
    var intervals = [];
    for (var i = 0; i < workSlots.length; i++) {
      var r = getRange(workSlots[i]);
      if (r) intervals.push({ start: r.startMin, end: r.endMin });
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

    for (var k = 0; k < merged.length - 1; k++) {
      var restStart = merged[k].end;
      var restEnd = merged[k + 1].start;
      if (restEnd > restStart) {
        var durationMins = restEnd - restStart;
        var hrs = Math.floor(durationMins / 60);
        var mins = durationMins % 60;
        var durText = (hrs > 0 ? hrs + "g" : "") + (mins > 0 ? mins + "p" : "");
        rests.push(minutesToClockLabel(restStart) + " - " + minutesToClockLabel(restEnd) + (durText ? " (" + durText + ")" : ""));
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

      rec.shift_1 = mySlots[0] ? (mySlots[0].position + " (" + formatLabel(mySlots[0]) + ")") : "";
      rec.shift_2 = mySlots[1] ? (mySlots[1].position + " (" + formatLabel(mySlots[1]) + ")") : "";
      rec.extra_shifts = [];
      for (var j = 2; j < mySlots.length; j++) {
        rec.extra_shifts.push(mySlots[j].position + " (" + formatLabel(mySlots[j]) + ")");
      }
      rec.break_off_slots = rests;
      if (mySlots.length > 0) {
        var firstRange = getRange(mySlots[0]);
        var lastRange = getRange(mySlots[mySlots.length - 1]);
        if (firstRange && lastRange) {
          rec.work_hours = minutesToClockLabel(firstRange.startMin) + " - " + minutesToClockLabel(lastRange.endMin);
        }
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
            lines.push("<strong>" + sl.position + "</strong>: " + formatLabel(sl));
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
          restTd.innerHTML = "<strong>" + rests.join("<br>") + "</strong>";
        } else if (mySlots.length > 0) {
          restTd.textContent = "Làm liên tục / Không có khoảng nghỉ xen giữa";
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
          rec.duty_type = "OFF";
          if (typeof global.upsertSingleRoster === "function") return global.upsertSingleRoster(rec);
        })
        .then(function () {
          if (global.AppTabs && global.AppTabs.loadDashboardData) global.AppTabs.loadDashboardData();
        });
    });
  }

  // Lưu lịch ngày trực tiếp lên daily_rosters với payload an toàn
  function saveRosterDirect(client, rec, date) {
    var payload = {
      staff_id: rec.staff_id,
      shift_date: rec.shift_date || date,
      duty_type: rec.duty_type || (rec.is_day_off ? "OFF" : "NORMAL"),
      is_day_off: Boolean(rec.is_day_off),
      shift_1: rec.shift_1 || "",
      shift_2: rec.shift_2 || ""
    };
    if (rec.id) payload.id = rec.id;

    return client
      .from("daily_rosters")
      .upsert(payload, { onConflict: "staff_id,shift_date" })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return res.data;
      });
  }

  var btnSaveAll = document.getElementById("btnSaveAllRosters");
  if (btnSaveAll) {
    btnSaveAll.addEventListener("click", function () {
      if (!Core.isShiftLeader()) return;
      var date = Core.getSelectedDate();
      syncSlotsToRosters(date);
      if (global.AppDaySlots && global.AppDaySlots.saveDaySlots) {
        global.AppDaySlots.saveDaySlots(date);
      }

      var client = Core.getClient();
      var mapObj = (global.rosterState && global.rosterState.rostersByStaff) || {};
      var keys = Object.keys(mapObj);
      var chain = Promise.resolve();

      for (var i = 0; i < keys.length; i++) {
        (function (rec) {
          chain = chain.then(function () {
            if (!rec || !rec.staff_id) return;
            if (client) {
              return saveRosterDirect(client, rec, date);
            }
            if (typeof global.upsertSingleRoster === "function") {
              return global.upsertSingleRoster(rec);
            }
          });
        })(mapObj[keys[i]]);
      }

      chain.then(function () {
        if (global.AppStatsRole && global.AppStatsRole.renderPanelStats) {
          global.AppStatsRole.renderPanelStats();
        }
        alert("Đã lưu lịch ngày " + date);
      }).catch(function (err) {
        alert("Lỗi lưu lịch: " + (err && err.message ? err.message : err));
      });
    });
  }

  global.AppDayRest = {
    syncSlotsToRosters: syncSlotsToRosters,
    renderDaySchedule: renderDaySchedule
  };
})(window);