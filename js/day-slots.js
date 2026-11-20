// =========================================================================
// [COMPONENT: js/day-slots.js] KHUNG VỊ TRÍ & KHUNG GIỜ (HỖ TRỢ XUYÊN NGÀY)
// Hỗ trợ ca 24h (08:00 -> 08:00 hôm sau), ca đêm (18:00 -> 06:00 sáng),
// và nhiều khung sáng / tối trong ngày.
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
    if (global.AppDayRest && global.AppDayRest.syncSlotsToRosters) {
      global.AppDayRest.syncSlotsToRosters(dateStr);
    }
  }

  function setDaySlots(dateStr, slots) {
    daySlotsByDate[dateStr] = Array.isArray(slots) ? slots : [];
    saveDaySlots(dateStr);
  }

  function toMins(hhmm) {
    if (!hhmm || hhmm.indexOf(":") === -1) return null;
    var p = hhmm.split(":");
    var h = Number(p[0]);
    var m = Number(p[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  // Tính khoảng phút [startMin, endMin] tính từ 00:00 của ngày chọn.
  // Nếu endMin <= startMin (ví dụ 18:00 -> 06:00 hoặc ca 24h 08:00 -> 08:00),
  // tự hiểu kết thúc sang ngày hôm sau (+1440 phút).
  function getSlotRangeMinutes(slot) {
    var s = toMins(slot.start);
    var e = toMins(slot.end);
    if (s === null || e === null) return null;
    var crossesMidnight = Boolean(slot.nextDay) || (e <= s);
    var adjEnd = crossesMidnight ? (e + 1440) : e;
    return {
      startMin: s,
      endMin: adjEnd,
      crossesMidnight: crossesMidnight
    };
  }

  function formatSlotRangeLabel(slot) {
    var rng = getSlotRangeMinutes(slot);
    var suffix = (rng && rng.crossesMidnight) ? " (+1 ngày)" : "";
    return slot.start + " - " + slot.end + suffix;
  }

  function getStaffNameById(staffId) {
    var list = (global.rosterState && global.rosterState.staffList) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === staffId) return list[i].full_name || list[i].employee_code || "";
    }
    return "";
  }

  function refreshDayViews() {
    renderPositionSlotSelectorsAndCards();
    if (global.AppDayRest && global.AppDayRest.renderDaySchedule) {
      global.AppDayRest.renderDaySchedule();
    }
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
        opt.textContent = slots[i].position + " (" + formatSlotRangeLabel(slots[i]) + ")";
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
          formatSlotRangeLabel(slot) + ")</span>";

        var btnDelSlot = document.createElement("button");
        btnDelSlot.type = "button";
        btnDelSlot.className = "btn-danger btn-sm";
        btnDelSlot.textContent = "Xóa khung";
        btnDelSlot.addEventListener("click", function () {
          var nextSlots = getDaySlots(date).filter(function (item) { return item.id !== slot.id; });
          setDaySlots(date, nextSlots);
          refreshDayViews();
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
              xBtn.addEventListener("click", function () {
                slot.staffIds = (slot.staffIds || []).filter(function (id) { return id !== stId; });
                saveDaySlots(date);
                refreshDayViews();
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

      var sMin = toMins(start);
      var eMin = toMins(end);
      var nextDay = (sMin !== null && eMin !== null && eMin <= sMin);

      var slots = getDaySlots(date);
      slots.push({
        id: "slot_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        position: pos,
        start: start,
        end: end,
        nextDay: nextDay,
        staffIds: []
      });
      saveDaySlots(date);
      document.getElementById("slotPositionInput").value = "";
      refreshDayViews();
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
        if (slots[i].id === slotId) { targetSlot = slots[i]; break; }
      }
      if (!targetSlot) return;
      if (!Array.isArray(targetSlot.staffIds)) targetSlot.staffIds = [];
      if (targetSlot.staffIds.indexOf(staffId) === -1) targetSlot.staffIds.push(staffId);

      saveDaySlots(date);
      refreshDayViews();
    });
  }

  global.AppDaySlots = {
    getDaySlots: getDaySlots,
    saveDaySlots: saveDaySlots,
    setDaySlots: setDaySlots,
    getSlotRangeMinutes: getSlotRangeMinutes,
    formatSlotRangeLabel: formatSlotRangeLabel,
    renderPositionSlotSelectorsAndCards: renderPositionSlotSelectorsAndCards
  };
})(window);