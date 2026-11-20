// =========================================================================
// [FILE: js/day-schedule.js] CẮT LỊCH TRONG NGÀY THEO VỊ TRÍ & KHUNG GIỜ
// Tạo khung vị trí + khoảng thời gian, gán nhân viên, tự tính giờ nghỉ ngơi.
// =========================================================================
(function (global) {
  var Core = global.AppCore;
  var daySlotsByDate = {};

  function getDaySlots(dateStr) {
    if (!daySlotsByDate[dateStr]) {
      try {
        var raw = JSON.parse(localStorage.getItem("dayPositionSlots_" + dateStr) || "null");
        daySlotsByDate[dateStr] = Array.isArray(raw) ? raw : [];
      } catch (e) {
        daySlotsByDate[dateStr] = [];
      }
    }
    return daySlotsByDate[dateStr];
  }

  function saveDaySlots(dateStr) {
    var slots = getDaySlots(dateStr);
    try {
      localStorage.setItem("dayPositionSlots_" + dateStr, JSON.stringify(slots));
    } catch (e) {}
    syncSlotsToRosters(dateStr);
  }

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
    var slots = getDaySlots(dateStr);
    var matched = [];
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      var list = s.staffIds || [];
      if (list.indexOf(staffId) !== -1) {
        matched.push(s);
      }
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

  function getStaffNameById(staffId) {
    var list = (global.rosterState && global.rosterState.staffList) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === staffId) return list[i].full_name || list[i].employee_code || "";
    }
    return "";
  }

  function renderPositionSlotSelectorsAndCards() {
    var date = Core.getSelectedDate();
    var slots = getDaySlots(date);
    var staffList = (global.rosterState && global.rosterState.staffList) || [];

    var slotSel = document.getElementById("assignSlotSelect");
    var staffSel = document.getElementById("assignStaffSelect");
    var container = document.getElementById("positionSlotsContainer");

    if (slotSel) {
      var prevSlot = slotSel.value;
      slotSel.innerHTML = "";
      for (var i = 0; i < slots.length; i++) {
        var opt = document.createElement("option");
        opt.value = slots[i].id;
        opt.textContent = slots[i].position + " (" + slots[i].start + " - " + slots[i].end + ")";
        slotSel.appendChild(opt);
      }
      if (prevSlot) slotSel.value = prevSlot;
    }

    if (staffSel) {
      staffSel.innerHTML = "";
      for (var j = 0; j < staffList.length; j++) {
        var sOpt = document.createElement("option");
        sOpt.value = staffList[j].id;
        sOpt.textContent = (staffList[j].full_name || "") + " - " + Core.normalizeJobTitle(staffList[j]);
        staffSel.appendChild(sOpt);
      }
    }

    if (!container) return;
    container.innerHTML = "";

    if (!slots.length) {
      container.innerHTML = "<div class='small-muted'>Chưa có vị trí &amp; khung giờ làm việc nào cho ngày " + date + ".</div>";
      return;
    }

    for (var k = 0; k < slots.length; k++) {
      (function (slot) {
        var card = document.createElement("div");
        card.className = "slot-card";

        var head = document.createElement("div");
        head.className = "slot-header";

        var titleEl = document.createElement("div");
        titleEl.innerHTML = "<strong>" + slot.position + "</strong> <span class='small-muted'>(" +
          slot.start + " - " + slot.end + ")</span>";

        var btnDelSlot = document.createElement("button");
        btnDelSlot.type = "button";
        btnDelSlot.className = "btn-danger btn-sm";
        btnDelSlot.textContent = "Xóa khung";
        btnDelSlot.addEventListener("click", function () {
          daySlotsByDate[date] = getDaySlots(date).filter(function (item) {
            return item.id !== slot.id;
          });
          saveDaySlots(date);
          renderPositionSlotSelectorsAndCards();
          renderDaySchedule();
        });

        head.appendChild(titleEl);
        head.appendChild(btnDelSlot);
        card.appendChild(head);

        var chipsWrap = document.createElement("div");
        var assigned = slot.staffIds || [];
        if (!assigned.length) {
          chipsWrap.innerHTML = "<span class='small-muted'>Chưa có nhân viên nào ở vị trí này.</span>";
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
              xBtn.title = "Bỏ nhân viên khỏi vị trí";
              xBtn.addEventListener("click", function () {
                slot.staffIds = (slot.staffIds || []).filter(function (id) { return id !== stId; });
                saveDaySlots(date);
                renderPositionSlotSelectorsAndCards();
                renderDaySchedule();
              });
              chip.appendChild(txt);
              chip.appendChild(xBtn);
              chipsWrap.appendChild(chip);
            })(assigned[a]);
          }
        }
        card.appendChild(chipsWrap);
        container.appendChild(card);
      })(slots[k]);
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

  var addPositionSlotForm = document.getElementById("addPositionSlotForm");
  if (addPositionSlotForm) {
    addPositionSlotForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!Core.isShiftLeader()) return;
      var pos = document.getElementById("slotPositionInput").value.trim();
      var start = document.getElementById("slotStartInput").value;
      var end = document.getElementById("slotEndInput").value;
      var date = Core.getSelectedDate();

      if (!pos || !start || !end) return alert("Nhập đủ vị trí làm việc và khoảng thời gian làm.");

      var slots = getDaySlots(date);
      slots.push({
        id: "slot_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        position: pos,
        start: start,
        end: end,
        staffIds: []
      });
      saveDaySlots(date);
      document.getElementById("slotPositionInput").value = "";
      renderPositionSlotSelectorsAndCards();
      renderDaySchedule();
    });
  }

  var btnAddStaffToSlot = document.getElementById("btnAddStaffToSlot");
  if (btnAddStaffToSlot) {
    btnAddStaffToSlot.addEventListener("click", function () {
      if (!Core.isShiftLeader()) return;
      var date = Core.getSelectedDate();
      var slots = getDaySlots(date);
      var slotId = document.getElementById("assignSlotSelect").value;
      var staffId = document.getElementById("assignStaffSelect").value;

      if (!slotId || !staffId) return alert("Vui lòng tạo vị trí/khung giờ trước và chọn nhân viên.");

      var targetSlot = null;
      for (var i = 0; i < slots.length; i++) {
        if (slots[i].id === slotId) {
          targetSlot = slots[i];
          break;
        }
      }
      if (!targetSlot) return;

      if (!Array.isArray(targetSlot.staffIds)) targetSlot.staffIds = [];
      if (targetSlot.staffIds.indexOf(staffId) === -1) {
        targetSlot.staffIds.push(staffId);
      }

      saveDaySlots(date);
      renderPositionSlotSelectorsAndCards();
      renderDaySchedule();
    });
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
          if (typeof global.upsertSingleRoster === "function") {
            return global.upsertSingleRoster(rec);
          }
        })
        .then(function () {
          if (typeof global.loadDashboardData === "function") global.loadDashboardData();
        });
    });
  }

  var btnSaveAll = document.getElementById("btnSaveAllRosters");
  if (btnSaveAll) {
    btnSaveAll.addEventListener("click", function () {
      if (!Core.isShiftLeader()) return;
      var date = Core.getSelectedDate();
      syncSlotsToRosters(date);
      saveDaySlots(date);

      var mapObj = (global.rosterState && global.rosterState.rostersByStaff) || {};
      var keys = Object.keys(mapObj);
      var chain = Promise.resolve();
      for (var i = 0; i < keys.length; i++) {
        (function (rec) {
          chain = chain.then(function () {
            if (typeof global.upsertSingleRoster === "function") {
              return global.upsertSingleRoster(rec);
            }
          });
        })(mapObj[keys[i]]);
      }
      chain.then(function () {
        if (global.AppStaff && typeof global.AppStaff.renderPanelStats === "function") {
          global.AppStaff.renderPanelStats();
        }
        alert("Đã lưu lịch ngày " + date);
      }).catch(function (err) {
        alert("Lỗi lưu lịch: " + err.message);
      });
    });
  }

  if (Core.workDateEl) {
    Core.workDateEl.addEventListener("change", function () {
      if (typeof global.loadDashboardData === "function") global.loadDashboardData();
    });
  }

  global.AppDaySchedule = {
    syncSlotsToRosters: syncSlotsToRosters,
    renderPositionSlotSelectorsAndCards: renderPositionSlotSelectorsAndCards,
    renderDaySchedule: renderDaySchedule
  };
})(window);
