(function () {
  var todayStr = new Date().toISOString().slice(0, 10);
  var workDateEl = document.getElementById("workDate");
  var offDateEl = document.getElementById("offDate");

  if (workDateEl && !workDateEl.value) {
    workDateEl.value = todayStr;
  }
  if (offDateEl && !offDateEl.value) {
    offDateEl.value = todayStr;
  }

  function getClient() {
    return window.supabaseClient || null;
  }

  function getSelectedDate() {
    if (workDateEl && workDateEl.value) {
      return workDateEl.value;
    }
    return todayStr;
  }

  function getOffDate() {
    if (offDateEl && offDateEl.value) {
      return offDateEl.value;
    }
    return getSelectedDate();
  }

  function isCoreStaff(staff) {
    return Number(staff.experience_years) >= 3;
  }

  function isStaffOff(staffId, rec) {
    var leaves = (window.rosterState && window.rosterState.leavesByStaff) || {};
    return Boolean((rec && rec.is_day_off) || leaves[staffId]);
  }

  window.loadDashboardData = function () {
    var client = getClient();
    if (!client) {
      return Promise.resolve();
    }
    var date = getSelectedDate();
    var fetchTask = (typeof window.fetchDailySchedule === "function")
      ? window.fetchDailySchedule(date)
      : Promise.resolve();

    return fetchTask.then(function () {
      renderStaffDropdown();
      renderScheduleTable();
    });
  };

  function renderStaffDropdown() {
    var selectEl = document.getElementById("offStaffSelect");
    if (!selectEl || !window.rosterState) {
      return;
    }
    selectEl.innerHTML = "";
    var list = window.rosterState.staffList || [];

    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var opt = document.createElement("option");
      var roleLabel = isCoreStaff(s) ? "Lam chinh 3-5 nam" : "Hoc viec";
      opt.value = s.id;
      opt.textContent = (s.employee_code || "") + " - " + (s.full_name || "") + " (" + roleLabel + ")";
      selectEl.appendChild(opt);
    }
  }

  function makeCell(text, isBold) {
    var td = document.createElement("td");
    if (isBold) {
      var strong = document.createElement("strong");
      strong.textContent = text;
      td.appendChild(strong);
    } else {
      td.textContent = text;
    }
    return td;
  }

  function makeShiftInput(value, placeholder, disabled, onChangeFn) {
    var input = document.createElement("input");
    input.type = "text";
    input.value = value || "";
    input.placeholder = placeholder;
    input.disabled = Boolean(disabled);
    input.addEventListener("change", function () {
      onChangeFn(input.value);
    });
    return input;
  }

  function renderScheduleTable() {
    var tbody = document.getElementById("scheduleBody");
    if (!tbody || !window.rosterState) {
      return;
    }
    tbody.innerHTML = "";
    var date = getSelectedDate();
    var list = window.rosterState.staffList || [];

    for (var i = 0; i < list.length; i++) {
      (function (staff) {
        var rec = window.getOrCreateRoster(staff.id, date);
        var offToday = isStaffOff(staff.id, rec);
        var core = isCoreStaff(staff);
        var tr = document.createElement("tr");

        tr.appendChild(makeCell(staff.employee_code || "", true));
        tr.appendChild(makeCell(staff.full_name || "", false));

        var typeTd = document.createElement("td");
        var badge = document.createElement("span");
        badge.className = core ? "badge-core" : "badge-intern";
        badge.textContent = core ? "Lam chinh (3-5 nam)" : "Hoc viec";
        typeTd.appendChild(badge);
        tr.appendChild(typeTd);

        var s1Td = document.createElement("td");
        s1Td.appendChild(makeShiftInput(rec.shift_1, "Vi tri Ca 1", offToday, function (val) {
          rec.shift_1 = val;
        }));
        tr.appendChild(s1Td);

        var s2Td = document.createElement("td");
        s2Td.appendChild(makeShiftInput(rec.shift_2, "Vi tri Ca 2", offToday, function (val) {
          rec.shift_2 = val;
        }));
        tr.appendChild(s2Td);

        var extraTd = document.createElement("td");
        var extraListDiv = document.createElement("div");
        extraListDiv.className = "pill-list";
        var extraArr = rec.extra_shifts || [];

        for (var j = 0; j < extraArr.length; j++) {
          (function (idx) {
            var pill = document.createElement("div");
            pill.className = "pill";

            var exInput = document.createElement("input");
            exInput.type = "text";
            exInput.value = extraArr[idx] || "";
            exInput.placeholder = "Ca " + (idx + 3) + "...";
            exInput.addEventListener("change", function () {
              rec.extra_shifts[idx] = exInput.value;
            });

            var delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.textContent = "x";
            delBtn.addEventListener("click", function () {
              rec.extra_shifts.splice(idx, 1);
              renderScheduleTable();
            });

            pill.appendChild(exInput);
            pill.appendChild(delBtn);
            extraListDiv.appendChild(pill);
          })(j);
        }

        var addExtraBtn = document.createElement("button");
        addExtraBtn.type = "button";
        addExtraBtn.className = "btn-primary btn-sm";
        addExtraBtn.textContent = "+ Them ca sau";
        addExtraBtn.disabled = offToday;
        addExtraBtn.addEventListener("click", function () {
          if (!Array.isArray(rec.extra_shifts)) {
            rec.extra_shifts = [];
          }
          rec.extra_shifts.push("");
          renderScheduleTable();
        });

        extraTd.appendChild(extraListDiv);
        extraTd.appendChild(addExtraBtn);
        tr.appendChild(extraTd);

        var offInfoTd = document.createElement("td");
        if (offToday) {
          var offBadge = document.createElement("span");
          offBadge.className = "badge-off";
          offBadge.textContent = "OFF CA NGAY";
          offInfoTd.appendChild(offBadge);
          offInfoTd.appendChild(document.createElement("br"));
        }

        var breakListDiv = document.createElement("div");
        breakListDiv.className = "pill-list";
        var breakArr = rec.break_off_slots || [];

        for (var k = 0; k < breakArr.length; k++) {
          (function (slotIdx) {
            var bPill = document.createElement("div");
            bPill.className = "pill";

            var bSpan = document.createElement("span");
            bSpan.textContent = "OFF " + breakArr[slotIdx];

            var bDel = document.createElement("button");
            bDel.type = "button";
            bDel.textContent = "x";
            bDel.addEventListener("click", function () {
              rec.break_off_slots.splice(slotIdx, 1);
              var p = (typeof window.upsertSingleRoster === "function")
                ? window.upsertSingleRoster(rec)
                : Promise.resolve();
              p.then(renderScheduleTable);
            });

            bPill.appendChild(bSpan);
            bPill.appendChild(bDel);
            breakListDiv.appendChild(bPill);
          })(k);
        }
        offInfoTd.appendChild(breakListDiv);
        tr.appendChild(offInfoTd);

        var actionTd = document.createElement("td");
        var toggleOffBtn = document.createElement("button");
        toggleOffBtn.type = "button";
        toggleOffBtn.className = "btn-warning btn-sm";
        toggleOffBtn.textContent = offToday ? "Mo lam lai" : "Cat ngay OFF";
        toggleOffBtn.addEventListener("click", function () {
          rec.is_day_off = !rec.is_day_off;
          var p = (typeof window.upsertSingleRoster === "function")
            ? window.upsertSingleRoster(rec)
            : Promise.resolve();
          p.then(renderScheduleTable);
        });
        actionTd.appendChild(toggleOffBtn);
        tr.appendChild(actionTd);

        tbody.appendChild(tr);
      })(list[i]);
    }
  }

  var staffForm = document.getElementById("staffForm");
  if (staffForm) {
    staffForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var client = getClient();
      if (!client) {
        alert("Chua ket noi Supabase");
        return;
      }

      var empCodeEl = document.getElementById("empCode");
      var fullNameEl = document.getElementById("fullName");
      var empLevelEl = document.getElementById("empLevel");

      var employeeCode = empCodeEl ? empCodeEl.value.trim().toUpperCase() : "";
      var fullName = fullNameEl ? fullNameEl.value.trim() : "";
      var expYears = empLevelEl ? Number(empLevelEl.value) : 0.5;

      if (!employeeCode || !fullName) {
        alert("Vui long nhap Ma NV va Ho ten");
        return;
      }

      client.from("profiles").insert({
        employee_code: employeeCode,
        full_name: fullName,
        role: "staff",
        shift_group: 1,
        base_shift_type: "DAY",
        experience_years: expYears,
        is_active: true
      }).then(function (res) {

        if (res.error) {
          alert("Loi them nhan vien: " + res.error.message);
          return;
        }
        staffForm.reset();
        window.loadDashboardData();
      });
    });
  }

  var btnCutDayOff = document.getElementById("btnCutDayOff");
  if (btnCutDayOff) {
    btnCutDayOff.addEventListener("click", function () {
      var client = getClient();
      if (!client) {
        return;
      }
      var selEl = document.getElementById("offStaffSelect");
      var staffId = selEl ? selEl.value : "";
      var date = getOffDate();
      if (!staffId) {
        return;
      }

      client.from("leave_requests").insert({
        staff_id: staffId,
        leave_date: date,
        reason: "Ca truong cat lich OFF",
        status: "approved",
        approved_by: (window.currentUser && window.currentUser.id) ? window.currentUser.id : null
      }).then(function () {
        if (workDateEl) {
          workDateEl.value = date;
        }
        return window.loadDashboardData();
      }).then(function () {
        var rec = window.getOrCreateRoster(staffId, date);
        rec.is_day_off = true;
        if (typeof window.upsertSingleRoster === "function") {
          return window.upsertSingleRoster(rec);
        }
      }).then(renderScheduleTable);
    });
  }

  var btnCutTimeOff = document.getElementById("btnCutTimeOff");
  if (btnCutTimeOff) {
    btnCutTimeOff.addEventListener("click", function () {
      var client = getClient();
      if (!client) {
        return;
      }
      var selEl = document.getElementById("offStaffSelect");
      var startEl = document.getElementById("offStart");
      var endEl = document.getElementById("offEnd");

      var staffId = selEl ? selEl.value : "";
      var date = getOffDate();
      var start = startEl ? startEl.value : "";
      var end = endEl ? endEl.value : "";

      if (!staffId || !start || !end) {
        alert("Nhap du gio bat dau va ket thuc nghi trong ca");
        return;
      }

      if (workDateEl) {
        workDateEl.value = date;
      }
      window.loadDashboardData().then(function () {
        var rec = window.getOrCreateRoster(staffId, date);
        if (!Array.isArray(rec.break_off_slots)) {
          rec.break_off_slots = [];
        }
        rec.break_off_slots.push(start + "-" + end);
        if (typeof window.upsertSingleRoster === "function") {
          return window.upsertSingleRoster(rec);
        }
      }).then(renderScheduleTable);
    });
  }

  var btnSaveAll = document.getElementById("btnSaveAllRosters");
  if (btnSaveAll) {
    btnSaveAll.addEventListener("click", function () {
      var mapObj = (window.rosterState && window.rosterState.rostersByStaff) || {};
      var records = Object.keys(mapObj).map(function (key) {
        return mapObj[key];
      });
      var chain = Promise.resolve();

      for (var i = 0; i < records.length; i++) {
        (function (recItem) {
          chain = chain.then(function () {
            if (typeof window.upsertSingleRoster === "function") {
              return window.upsertSingleRoster(recItem);
            }
          });
        })(records[i]);
      }

      chain.then(function () {
        alert("Da luu toan bo lich ngay " + getSelectedDate());
      }).catch(function (err) {
        alert("Loi luu lich: " + err.message);
      });
    });
  }

  if (workDateEl) {
    workDateEl.addEventListener("change", function () {
      window.loadDashboardData();
    });
  }
})();
