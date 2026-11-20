// =========================================================================
// [COMPONENT: js/day-slots.js] QUẢN LÝ KHUNG CA TỔNG & CA CON TRONG KHUNG
// Hỗ trợ tạo khung ca tổng (VD: 20/11 08:00 -> 21/11 08:00, DEP/ARR)
// và các ca làm việc con bên trong để tính chính xác giờ nghỉ tới hết khung.
// =========================================================================
(function (global) {
  var Core = global.AppCore;
  var STORAGE_KEY = "airport_shift_frames_v2";
  var store = { frames: [], slots: [] };

  function formatDateInput(d) {
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function initDefaultDates() {
    var now = new Date();
    var tomorrow = new Date(now.getTime() + 86400000);
    var tStr = formatDateInput(now);
    var tmStr = formatDateInput(tomorrow);

    var fStartD = document.getElementById("frameStartDateInput");
    var fEndD = document.getElementById("frameEndDateInput");
    var sStartD = document.getElementById("slotStartDateInput");
    var sEndD = document.getElementById("slotEndDateInput");

    if (fStartD && !fStartD.value) fStartD.value = tStr;
    if (fEndD && !fEndD.value) fEndD.value = tmStr;
    if (sStartD && !sStartD.value) sStartD.value = tStr;
    if (sEndD && !sEndD.value) sEndD.value = tStr;
  }

  function loadStore() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (raw && Array.isArray(raw.frames) && Array.isArray(raw.slots)) {
        store = raw;
      }
    } catch (e) {}
    return store;
  }

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (e) {}
    if (global.AppDayRest && typeof global.AppDayRest.syncState === "function") {
      global.AppDayRest.syncState(store);
    }
  }

  function parseDateTimeToMs(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    var dp = dateStr.split("-");
    var tp = timeStr.split(":");
    if (dp.length !== 3 || tp.length < 2) return null;
    var y = Number(dp[0]);
    var m = Number(dp[1]) - 1;
    var d = Number(dp[2]);
    var hh = Number(tp[0]);
    var mm = Number(tp[1]);
    if ([y, m, d, hh, mm].some(function (n) { return Number.isNaN(n); })) return null;
    return new Date(y, m, d, hh, mm, 0, 0).getTime();
  }

  function formatShortDate(dateStr) {
    if (!dateStr || dateStr.indexOf("-") === -1) return dateStr || "";
    var p = dateStr.split("-");
    return p[2] + "/" + p[1];
  }

  function formatFrameLabel(fr) {
    var dir = fr.direction === "ARR" ? "ARR" : "DEP";
    return "[" + dir + "] " +
      formatShortDate(fr.startDate) + " " + fr.startTime +
      " → " +
      formatShortDate(fr.endDate) + " " + fr.endTime;
  }

  function formatSlotLabel(sl) {
    return formatShortDate(sl.startDate) + " " + sl.startTime +
      " → " +
      formatShortDate(sl.endDate) + " " + sl.endTime;
  }

  function getFrameById(frameId) {
    for (var i = 0; i < store.frames.length; i++) {
      if (store.frames[i].id === frameId) return store.frames[i];
    }
    return null;
  }

  function getStaffNameById(staffId) {
    var list = (global.rosterState && global.rosterState.staffList) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === staffId) return list[i].full_name || list[i].employee_code || "";
    }
    return "";
  }

  function refreshAll() {
    renderSelectorsAndCards();
    if (global.AppDayRest && typeof global.AppDayRest.renderDaySchedule === "function") {
      global.AppDayRest.renderDaySchedule();
    }
  }

  function renderSelectorsAndCards() {
    initDefaultDates();
    var frameSel = document.getElementById("slotFrameSelect");
    var slotSel = document.getElementById("assignSlotSelect");
    var staffSel = document.getElementById("assignStaffSelect");
    var container = document.getElementById("positionSlotsContainer");
    var staffList = (global.rosterState && global.rosterState.staffList) || [];

    if (frameSel) {
      var prevFrame = frameSel.value;
      frameSel.innerHTML = "";
      for (var f = 0; f < store.frames.length; f++) {
        var fr = store.frames[f];
        var fOpt = document.createElement("option");
        fOpt.value = fr.id;
        fOpt.textContent = fr.name + " — " + formatFrameLabel(fr);
        frameSel.appendChild(fOpt);
      }
      if (prevFrame) frameSel.value = prevFrame;
      if (!frameSel.value && frameSel.options.length > 0) frameSel.value = frameSel.options[0].value;
    }

    if (slotSel) {
      var prevSlot = slotSel.value;
      slotSel.innerHTML = "";
      for (var s = 0; s < store.slots.length; s++) {
        var sl = store.slots[s];
        var parentFr = getFrameById(sl.frameId);
        var sOpt = document.createElement("option");
        sOpt.value = sl.id;
        sOpt.textContent = (parentFr ? "[" + (parentFr.direction || "DEP") + "] " + parentFr.name + " | " : "") +
          sl.position + " (" + formatSlotLabel(sl) + ")";
        slotSel.appendChild(sOpt);
      }
      if (prevSlot) slotSel.value = prevSlot;
    }

    if (staffSel) {
      var prevStaff = staffSel.value;
      staffSel.innerHTML = "";
      for (var i = 0; i < staffList.length; i++) {
        var stOpt = document.createElement("option");
        stOpt.value = staffList[i].id;
        stOpt.textContent = (staffList[i].full_name || "") + " - " + Core.normalizeJobTitle(staffList[i]);
        staffSel.appendChild(stOpt);
      }
      if (prevStaff) staffSel.value = prevStaff;
    }

    if (!container) return;
    container.innerHTML = "";

    if (!store.frames.length && !store.slots.length) {
      container.innerHTML = "<div class='small-muted'>Chưa có khung ca nào. Hãy tạo khung ca ở Bước 1 trước.</div>";
      return;
    }

    for (var k = 0; k < store.frames.length; k++) {
      (function (fr) {
        var frameCard = document.createElement("div");
        frameCard.className = "slot-card";

        var fHead = document.createElement("div");
        fHead.className = "slot-header";

        var fTitle = document.createElement("div");
        fTitle.innerHTML = "<strong>Khung ca: " + fr.name + "</strong> <span class='small-muted'>(" +
          formatFrameLabel(fr) + ")</span>";

        var btnDelFrame = document.createElement("button");
        btnDelFrame.type = "button";
        btnDelFrame.className = "btn-danger btn-sm";
        btnDelFrame.textContent = "Xóa khung";
        btnDelFrame.addEventListener("click", function () {
          store.frames = store.frames.filter(function (x) { return x.id !== fr.id; });
          store.slots = store.slots.filter(function (x) { return x.frameId !== fr.id; });
          saveStore();
          refreshAll();
        });

        fHead.appendChild(fTitle);
        fHead.appendChild(btnDelFrame);
        frameCard.appendChild(fHead);

        var childSlots = store.slots.filter(function (x) { return x.frameId === fr.id; });
        if (!childSlots.length) {
          var emptyNote = document.createElement("div");
          emptyNote.className = "small-muted";
          emptyNote.textContent = "Chưa có ca con nào trong khung này.";
          frameCard.appendChild(emptyNote);
        } else {
          for (var c = 0; c < childSlots.length; c++) {
            (function (sl) {
              var subBox = document.createElement("div");
              subBox.style.marginTop = "8px";
              subBox.style.padding = "8px 10px";
              subBox.style.background = "#ffffff";
              subBox.style.border = "1px solid #e2e8f0";
              subBox.style.borderRadius = "6px";

              var subTop = document.createElement("div");
              subTop.className = "slot-header";
              subTop.style.marginBottom = "4px";

              var subLabel = document.createElement("div");
              subLabel.innerHTML = "<strong>" + sl.position + "</strong> <span class='small-muted'>(" +
                formatSlotLabel(sl) + ")</span>";

              var btnDelSlot = document.createElement("button");
              btnDelSlot.type = "button";
              btnDelSlot.className = "btn-danger btn-sm";
              btnDelSlot.textContent = "Xóa ca";
              btnDelSlot.addEventListener("click", function () {
                store.slots = store.slots.filter(function (x) { return x.id !== sl.id; });
                saveStore();
                refreshAll();
              });

              subTop.appendChild(subLabel);
              subTop.appendChild(btnDelSlot);
              subBox.appendChild(subTop);

              var chipsDiv = document.createElement("div");
              var assigned = sl.staffIds || [];
              if (!assigned.length) {
                chipsDiv.innerHTML = "<span class='small-muted'>Chưa gán nhân viên.</span>";
              } else {
                for (var a = 0; a < assigned.length; a++) {
                  (function (stId) {
                    var chip = document.createElement("span");
                    chip.className = "assigned-chip";
                    var spanName = document.createElement("span");
                    spanName.textContent = getStaffNameById(stId);
                    var btnRemove = document.createElement("button");
                    btnRemove.type = "button";
                    btnRemove.textContent = "×";
                    btnRemove.addEventListener("click", function () {
                      sl.staffIds = (sl.staffIds || []).filter(function (id) { return id !== stId; });
                      saveStore();
                      refreshAll();
                    });
                    chip.appendChild(spanName);
                    chip.appendChild(btnRemove);
                    chipsDiv.appendChild(chip);
                  })(assigned[a]);
                }
              }
              subBox.appendChild(chipsDiv);
              frameCard.appendChild(subBox);
            })(childSlots[c]);
          }
        }

        container.appendChild(frameCard);
      })(store.frames[k]);
    }
  }

  var addFrameForm = document.getElementById("addShiftFrameForm");
  if (addFrameForm) {
    addFrameForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!Core.isShiftLeader()) return alert("Chỉ Ca trưởng mới được tạo khung ca.");

      var name = document.getElementById("frameNameInput").value.trim();
      var direction = document.getElementById("frameDirectionInput").value || "DEP";
      var startDate = document.getElementById("frameStartDateInput").value;
      var startTime = document.getElementById("frameStartTimeInput").value;
      var endDate = document.getElementById("frameEndDateInput").value;
      var endTime = document.getElementById("frameEndTimeInput").value;

      var sMs = parseDateTimeToMs(startDate, startTime);
      var eMs = parseDateTimeToMs(endDate, endTime);
      if (!name || sMs === null || eMs === null || eMs <= sMs) {
        return alert("Vui lòng nhập tên khung và khoảng ngày/giờ hợp lệ (kết thúc phải sau bắt đầu).");
      }

      var newFrame = {
        id: "frame_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        name: name,
        direction: direction,
        startDate: startDate,
        startTime: startTime,
        endDate: endDate,
        endTime: endTime
      };
      store.frames.push(newFrame);

      // Đồng bộ mặc định ngày/giờ ca con theo khung vừa tạo
      var sStartD = document.getElementById("slotStartDateInput");
      var sEndD = document.getElementById("slotEndDateInput");
      if (sStartD) sStartD.value = startDate;
      if (sEndD) sEndD.value = endDate;

      saveStore();
      document.getElementById("frameNameInput").value = "";
      refreshAll();
      var frameSel = document.getElementById("slotFrameSelect");
      if (frameSel) frameSel.value = newFrame.id;
    });
  }

  var addSlotForm = document.getElementById("addPositionSlotForm");
  if (addSlotForm) {
    addSlotForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!Core.isShiftLeader()) return alert("Chỉ Ca trưởng mới được tạo ca con.");

      var frameId = document.getElementById("slotFrameSelect").value;
      var pos = document.getElementById("slotPositionInput").value.trim();
      var startDate = document.getElementById("slotStartDateInput").value;
      var startTime = document.getElementById("slotStartTimeInput").value;
      var endDate = document.getElementById("slotEndDateInput").value;
      var endTime = document.getElementById("slotEndTimeInput").value;

      if (!frameId) return alert("Hãy tạo khung ca ở Bước 1 trước.");
      var fr = getFrameById(frameId);
      var frStart = fr ? parseDateTimeToMs(fr.startDate, fr.startTime) : null;
      var frEnd = fr ? parseDateTimeToMs(fr.endDate, fr.endTime) : null;
      var sMs = parseDateTimeToMs(startDate, startTime);
      var eMs = parseDateTimeToMs(endDate, endTime);

      if (!pos || sMs === null || eMs === null || eMs <= sMs) {
        return alert("Vui lòng nhập vị trí/ca con và khoảng ngày/giờ hợp lệ.");
      }
      if (frStart !== null && frEnd !== null && (sMs < frStart || eMs > frEnd)) {
        return alert("Thời gian ca con phải nằm trong khung ca [" + formatFrameLabel(fr) + "].");
      }

      var newSlot = {
        id: "slot_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        frameId: frameId,
        position: pos,
        startDate: startDate,
        startTime: startTime,
        endDate: endDate,
        endTime: endTime,
        staffIds: []
      };
      store.slots.push(newSlot);
      saveStore();
      document.getElementById("slotPositionInput").value = "";
      refreshAll();
      var slotSel = document.getElementById("assignSlotSelect");
      if (slotSel) slotSel.value = newSlot.id;
    });
  }

  var btnAddStaff = document.getElementById("btnAddStaffToSlot");
  if (btnAddStaff) {
    btnAddStaff.addEventListener("click", function () {
      if (!Core.isShiftLeader()) return;
      var slotId = document.getElementById("assignSlotSelect").value;
      var staffId = document.getElementById("assignStaffSelect").value;
      if (!slotId || !staffId) return alert("Hãy chọn ca con và nhân viên.");

      var target = null;
      for (var i = 0; i < store.slots.length; i++) {
        if (store.slots[i].id === slotId) {
          target = store.slots[i];
          break;
        }
      }
      if (!target) return;
      if (!Array.isArray(target.staffIds)) target.staffIds = [];
      if (target.staffIds.indexOf(staffId) === -1) {
        target.staffIds.push(staffId);
      }

      saveStore();
      refreshAll();
    });
  }

  loadStore();
  initDefaultDates();

  global.AppDaySlots = {
    getStore: function () { return store; },
    getFrameById: getFrameById,
    parseDateTimeToMs: parseDateTimeToMs,
    formatFrameLabel: formatFrameLabel,
    formatSlotLabel: formatSlotLabel,
    renderPositionSlotSelectorsAndCards: renderSelectorsAndCards
  };
})(window);