// =========================================================================
// [COMPONENT: js/day-slots.js] KHUNG VỊ TRÍ & KHOẢNG THỜI GIAN TRONG NGÀY
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
          daySlotsByDate[date] = getDaySlots(date).filter(function (item) { return item.id !== slot.id; });
          saveDaySlots(date);
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
    renderPositionSlotSelectorsAndCards: renderPositionSlotSelectorsAndCards
  };
})(window);
