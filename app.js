(function () {
  var now = new Date();
  var todayStr = now.toISOString().slice(0, 10);
  var monthStr = todayStr.slice(0, 7);

  var workDateEl = document.getElementById("workDate");
  var workMonthEl = document.getElementById("workMonth");

  if (workDateEl && !workDateEl.value) workDateEl.value = todayStr;
  if (workMonthEl && !workMonthEl.value) workMonthEl.value = monthStr;

  function getClient() {
    return window.supabaseClient || null;
  }

  function getSelectedDate() {
    return (workDateEl && workDateEl.value) ? workDateEl.value : todayStr;
  }

  function getSelectedMonth() {
    return (workMonthEl && workMonthEl.value) ? workMonthEl.value : monthStr;
  }

  function getTitleLabel(staff) {
    var exp = Number(staff.experience_years || 0);
    if (staff.role === "shift_leader") return "Ca truong";
    return exp >= 3 ? "Nhan vien chinh (3-5 nam)" : "Hoc viec";
  }

  function isOffDay(staffId, rec) {
    var leaves = (window.rosterState && window.rosterState.leavesByStaff) || {};
    return Boolean((rec && rec.is_day_off) || leaves[staffId]);
  }

  // Chuyển đổi 3 tab
  var tabButtons = document.querySelectorAll(".tab-btn");
  var tabPanels = document.querySelectorAll(".tab-panel");
  for (var t = 0; t < tabButtons.length; t++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        var targetId = btn.getAttribute("data-tab");
        for (var i = 0; i < tabButtons.length; i++) {
          tabButtons[i].classList.toggle("active", tabButtons[i] === btn);
        }
        for (var j = 0; j < tabPanels.length; j++) {
          tabPanels[j].classList.toggle("active", tabPanels[j].id === targetId);
        }
        if (targetId === "tabMonth") {
          loadMonthTab();
        } else {
          window.loadDashboardData();
        }
      });
    })(tabButtons[t]);
  }

  window.loadDashboardData = function () {
    if (!getClient()) return Promise.resolve();
    var date = getSelectedDate();
    var task = (typeof window.fetchDailySchedule === "function")
      ? window.fetchDailySchedule(date)
      : Promise.resolve();

    return task.then(function () {
      renderStaffList();
      renderStaffDropdown();
      renderDaySchedule();
    });
  };

  function loadMonthTab() {
    if (!getClient()) return Promise.resolve();
    var ym = getSelectedMonth();
    var task = (typeof window.fetchMonthlySchedule === "function")
      ? window.fetchMonthlySchedule(ym)
      : Promise.resolve();

    return task.then(function () {
      renderMonthSchedule();
    });
  }

  // TAB 1: Danh sach nhan su
  function renderStaffList() {
    var tbody = document.getElementById("staffListBody");
    if (!tbody || !window.rosterState) return;
    tbody.innerHTML = "";
    var list = window.rosterState.staffList || [];

    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td><strong>" + (s.employee_code || "") + "</strong></td>" +
        "<td>" + (s.full_name || "") + "</td>" +
        "<td>" + getTitleLabel(s) + "</td>" +
        "<td>To " + (s.shift_group || 1) + "</td>" +
        "<td>" + (s.base_shift_type || "DEP") + "</td>";
      tbody.appendChild(tr);
    }
  }

  var staffForm = document.getElementById("staffForm");
  if (staffForm) {
    staffForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var client = getClient();
      if (!client) return alert("Chua ket noi Supabase");

      var code = document.getElementById("empCode").value.trim().toUpperCase();
      var name = document.getElementById("fullName").value.trim();
      var exp = Number(document.getElementById("empLevel").value);
      var group = Number(document.getElementById("shiftGroupInput").value || 1);
      var baseShift = document.getElementById("baseShiftInput").value || "DEP";
      var role = document.getElementById("roleInput").value || "staff";

      if (!code || !name) return alert("Nhap du Ma NV va Ten nhan su");

      client.from("profiles").insert({
        employee_code: code,
        full_name: name,
        role: role,
        shift_group: group,
        base_shift_type: baseShift,
        experience_years: exp,
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

  // TAB 2: Cat lich trong ngay
  function renderStaffDropdown() {
    var sel = document.getElementById("offStaffSelect");
    if (!sel || !window.rosterState) return;
    sel.innerHTML = "";
    var list = window.rosterState.staffList || [];

    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = (s.full_name || "") + " (" + getTitleLabel(s) + ")";
      sel.appendChild(opt);
    }
  }

  function makeTextCell(txt, bold) {
    var td = document.createElement("td");
    if (bold) {
      var st = document.createElement("strong");
      st.textContent = txt;
      td.appendChild(st);
    } else {
      td.textContent = txt;
    }
    return td;
  }

  function renderDaySchedule() {
    var tbody = document.getElementById("scheduleBody");
    if (!tbody || !window.rosterState) return;
    tbody.innerHTML = "";

    var date = getSelectedDate();
    var list = window.rosterState.staffList || [];

    for (var i = 0; i < list.length; i++) {
      (function (staff) {
        var rec = window.getOrCreateRoster(staff.id, date);
        var off = isOffDay(staff.id, rec);
        var tr = document.createElement("tr");

        // 1. Ten nhan su
        tr.appendChild(makeTextCell(staff.full_name || "", true));

        // 2. Chuc danh
        tr.appendChild(makeTextCell(getTitleLabel(staff), false));

        // 3. Thoi gian lam
        var timeTd = document.createElement("td");
        var timeInput = document.createElement("input");
        timeInput.type = "text";
        timeInput.value = off ? "OFF" : (rec.work_hours || "06:00-18:00");
        timeInput.disabled = off;
        timeInput.style.width = "120px";
        timeInput.addEventListener("change", function () {
          rec.work_hours = timeInput.value;
        });
        timeTd.appendChild(timeInput);
        tr.appendChild(timeTd);

        // 4. Vi tri (Ca 1, Ca 2, ca sau)
        var posTd = document.createElement("td");
        var s1 = document.createElement("input");
        s1.type = "text";
        s1.placeholder = "Ca 1";
        s1.value = rec.shift_1 || "";
        s1.disabled = off;
        s1.style.width = "95px";
        s1.style.marginRight = "4px";
        s1.addEventListener("change", function () { rec.shift_1 = s1.value; });

        var s2 = document.createElement("input");
        s2.type = "text";
        s2.placeholder = "Ca 2";
        s2.value = rec.shift_2 || "";
        s2.disabled = off;
        s2.style.width = "95px";
        s2.style.marginRight = "4px";
        s2.addEventListener("change", function () { rec.shift_2 = s2.value; });

        posTd.appendChild(s1);
        posTd.appendChild(s2);

        var extraArr = rec.extra_shifts || [];
        for (var j = 0; j < extraArr.length; j++) {
          (function (idx) {
            var ex = document.createElement("input");
            ex.type = "text";
            ex.placeholder = "Ca " + (idx + 3);
            ex.value = extraArr[idx] || "";
            ex.disabled = off;
            ex.style.width = "85px";
            ex.style.marginLeft = "4px";
            ex.addEventListener("change", function () { rec.extra_shifts[idx] = ex.value; });
            posTd.appendChild(ex);
          })(j);
        }

        var addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "btn-primary btn-sm";
        addBtn.textContent = "+ Ca";
        addBtn.disabled = off;
        addBtn.style.marginLeft = "4px";
        addBtn.addEventListener("click", function () {
          if (!Array.isArray(rec.extra_shifts)) rec.extra_shifts = [];
          rec.extra_shifts.push("");
          renderDaySchedule();
        });
        posTd.appendChild(addBtn);
        tr.appendChild(posTd);

        // 5. Thoi gian nghi
        var restTd = document.createElement("td");
        if (off) {
          var badge = document.createElement("span");
          badge.className = "badge-off";
          badge.textContent = "OFF CA NGAY";
          restTd.appendChild(badge);
        } else {
          var slots = rec.break_off_slots || [];
          restTd.textContent = slots.length ? slots.join(", ") : "Khong nghi";
        }
        tr.appendChild(restTd);

        // 6. Thao tac
        var actTd = document.createElement("td");
        var btnOff = document.createElement("button");
        btnOff.type = "button";
        btnOff.className = "btn-warning btn-sm";
        btnOff.textContent = off ? "Mo lam lai" : "Cat OFF";
        btnOff.addEventListener("click", function () {
          rec.is_day_off = !rec.is_day_off;
          var p = (typeof window.upsertSingleRoster === "function")
            ? window.upsertSingleRoster(rec)
            : Promise.resolve();
          p.then(renderDaySchedule);
        });
        actTd.appendChild(btnOff);
        tr.appendChild(actTd);

        tbody.appendChild(tr);
      })(list[i]);
    }
  }

  var btnCutTimeOff = document.getElementById("btnCutTimeOff");
  if (btnCutTimeOff) {
    btnCutTimeOff.addEventListener("click", function () {
      var client = getClient();
      if (!client) return;
      var staffId = document.getElementById("offStaffSelect").value;
      var start = document.getElementById("offStart").value;
      var end = document.getElementById("offEnd").value;
      var date = getSelectedDate();

      if (!staffId || !start || !end) return alert("Chon nhan su va nhap du gio bat dau, ket thuc");

      var rec = window.getOrCreateRoster(staffId, date);
      if (!Array.isArray(rec.break_off_slots)) rec.break_off_slots = [];
      rec.break_off_slots.push(start + "-" + end);

      var p = (typeof window.upsertSingleRoster === "function")
        ? window.upsertSingleRoster(rec)
        : Promise.resolve();
      p.then(renderDaySchedule);
    });
  }

  var btnCutDayOff = document.getElementById("btnCutDayOff");
  if (btnCutDayOff) {
    btnCutDayOff.addEventListener("click", function () {
      var client = getClient();
      if (!client) return;
      var staffId = document.getElementById("offStaffSelect").value;
      var date = getSelectedDate();
      if (!staffId) return;

      client.from("leave_requests").insert({
        staff_id: staffId,
        leave_date: date,
        reason: "Ca truong cat OFF ca ngay",
        status: "approved",
        approved_by: (window.currentUser && window.currentUser.id) ? window.currentUser.id : null
      }).then(function () {
        var rec = window.getOrCreateRoster(staffId, date);
        rec.is_day_off = true;
        if (typeof window.upsertSingleRoster === "function") {
          return window.upsertSingleRoster(rec);
        }
      }).then(function () {
        window.loadDashboardData();
      });
    });
  }

  var btnSaveAll = document.getElementById("btnSaveAllRosters");
  if (btnSaveAll) {
    btnSaveAll.addEventListener("click", function () {
      var mapObj = (window.rosterState && window.rosterState.rostersByStaff) || {};
      var keys = Object.keys(mapObj);
      var chain = Promise.resolve();
      for (var i = 0; i < keys.length; i++) {
        (function (rec) {
          chain = chain.then(function () {
            if (typeof window.upsertSingleRoster === "function") {
              return window.upsertSingleRoster(rec);
            }
          });
        })(mapObj[keys[i]]);
      }
      chain.then(function () {
        alert("Da luu lich ngay " + getSelectedDate());
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

  // TAB 3: Cat lich trong thang
  function renderMonthSchedule() {
    var tbody = document.getElementById("monthScheduleBody");
    if (!tbody || !window.rosterState) return;
    tbody.innerHTML = "";

    var ym = getSelectedMonth();
    var parts = ym.split("-");
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var totalDays = new Date(y, m, 0).getDate();

    var staffList = window.rosterState.staffList || [];
    var mRosters = window.rosterState.monthRosters || [];
    var mLeaves = window.rosterState.monthLeaves || [];

    for (var i = 0; i < staffList.length; i++) {
      (function (staff) {
        var offSet = {};
        for (var rIdx = 0; rIdx < mRosters.length; rIdx++) {
          var r = mRosters[rIdx];
          if (r.staff_id === staff.id && r.is_day_off) {
            offSet[r.shift_date] = true;
          }
        }
        for (var lIdx = 0; lIdx < mLeaves.length; lIdx++) {
          var l = mLeaves[lIdx];
          if (l.staff_id === staff.id && l.status !== "rejected") {
            offSet[l.leave_date] = true;
          }
        }

        var workDays = [];
        var offDays = [];
        var box = document.createElement("div");
        box.className = "month-days-box";

        for (var d = 1; d <= totalDays; d++) {
          (function (dayNum) {
            var dd = String(dayNum).padStart(2, "0");
            var fullDate = ym + "-" + dd;
            var isOff = !!offSet[fullDate];

            if (isOff) {
              offDays.push(dd);
            } else {
              workDays.push(dd);
            }

            var chip = document.createElement("button");
            chip.type = "button";
            chip.className = "day-chip " + (isOff ? "day-off" : "day-work");
            chip.textContent = dd;
            chip.title = fullDate + (isOff ? " (OFF)" : " (Lam)");
            chip.addEventListener("click", function () {
              var client = getClient();
              if (!client) return;
              var nextOff = !isOff;
              client.from("daily_rosters").upsert({
                staff_id: staff.id,
                shift_date: fullDate,
                duty_type: nextOff ? "OFF" : "NORMAL",
                is_day_off: nextOff
              }, { onConflict: "staff_id,shift_date" }).then(function (res) {
                if (res.error) return alert("Loi cap nhat ngay: " + res.error.message);
                loadMonthTab();
              });
            });
            box.appendChild(chip);
          })(d);
        }

        var tr = document.createElement("tr");
        tr.appendChild(makeTextCell(staff.full_name || "", true));
        tr.appendChild(makeTextCell(getTitleLabel(staff), false));

        var workTd = document.createElement("td");
        workTd.innerHTML = "<strong>" + workDays.length + " ngay</strong><br><span class='small-muted'>" +
          (workDays.length ? workDays.join(", ") : "-") + "</span>";
        tr.appendChild(workTd);

        var offTd = document.createElement("td");
        offTd.innerHTML = "<strong>" + offDays.length + " ngay</strong><br><span class='small-muted'>" +
          (offDays.length ? offDays.join(", ") : "-") + "</span><br>";
        offTd.appendChild(box);
        tr.appendChild(offTd);

        tbody.appendChild(tr);
      })(staffList[i]);
    }
  }

  var btnReloadMonth = document.getElementById("btnReloadMonth");
  if (btnReloadMonth) {
    btnReloadMonth.addEventListener("click", loadMonthTab);
  }
  if (workMonthEl) {
    workMonthEl.addEventListener("change", loadMonthTab);
  }
})();