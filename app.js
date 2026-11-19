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

  function sb() {
    return window.supabaseClient;
  }

  function esc(str) {
    var apos = String.fromCharCode(39);
    var s = String(str === undefined || str === null ? "" : str);
    return s
      .split("&").join("&")
      .split("<").join("<")
      .split(">").join(">")
      .split('"').join(""")
      .split(apos).join("'");
  }

  window.loadDashboardData = function () {
    if (!sb()) {
      return Promise.resolve();
    }
    var date = (workDateEl && workDateEl.value) ? workDateEl.value : todayStr;
    var loader = (typeof window.fetchDailySchedule === "function")
      ? window.fetchDailySchedule(date)
      : Promise.resolve();

    return loader.then(function () {
      renderStaffDropdown();
      renderScheduleTable();
    });
  };

  function renderStaffDropdown() {
    var sel = document.getElementById("offStaffSelect");
    if (!sel || !window.rosterState) {
      return;
    }
    var list = window.rosterState.staffList || [];
    var html = "";
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var lvl = Number(s.experience_years) >= 3 ? "Lam chinh 3-5 nam" : "Hoc viec";
      html += '<option value="' + esc(s.id) + '">' +
        esc(s.employee_code) + " - " + esc(s.full_name) + " (" + lvl + ")</option>";
    }
    sel.innerHTML = html;
  }

  function renderScheduleTable() {
    var tbody = document.getElementById("scheduleBody");
    if (!tbody || !window.rosterState) {
      return;
    }
    var apos = String.fromCharCode(39);
    var date = (workDateEl && workDateEl.value) ? workDateEl.value : todayStr;
    var list = window.rosterState.staffList || [];
    var rows = "";

    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      var sid = esc(s.id);
      var rec = window.getOrCreateRoster(s.id, date);
      var hasLeave = !!(window.rosterState.leavesByStaff && window.rosterState.leavesByStaff[s.id]);
      var isOff = !!(rec.is_day_off || hasLeave);
      var isCore = Number(s.experience_years) >= 3;

      var extraArr = rec.extra_shifts || [];
      var extraHtml = "";
      for (var j = 0; j < extraArr.length; j++) {
        extraHtml += '<div class="pill">' +
          '<input type="text" value="' + esc(extraArr[j]) + '" placeholder="Ca ' + (j + 3) + '..." ' +
          'onchange="window.onEditExtraShift(' + apos + sid + apos + ", " + j + ', this.value)" />' +
          '<button type="button" onclick="window.onRemoveExtraShift(' + apos + sid + apos + ", " + j + ')">x</button>' +
          "</div>";
      }

      var breakArr = rec.break_off_slots || [];
      var breakHtml = "";
      for (var k = 0; k < breakArr.length; k++) {
        breakHtml += '<div class="pill">' +
          "<span>OFF " + esc(breakArr[k]) + "</span>" +
          '<button type="button" onclick="window.onRemoveBreakSlot(' + apos + sid + apos + ", " + k + ')">x</button>' +
          "</div>";
      }

      rows += "<tr>" +
        "<td><strong>" + esc(s.employee_code) + "</strong></td>" +
        "<td>" + esc(s.full_name) + "</td>" +
        "<td>" + (isCore ? '<span class="badge-core">Lam chinh (3-5 nam)</span>' : '<span class="badge-intern">Hoc viec</span>') + "</td>" +
        '<td><input type="text" value="' + esc(rec.shift_1) + '" ' + (isOff ? "disabled" : "") +
          ' placeholder="Vi tri Ca 1" onchange="window.onEditMainShift(' + apos + sid + apos + ", " + apos + "shift_1" + apos + ', this.value)" /></td>' +
        '<td><input type="text" value="' + esc(rec.shift_2) + '" ' + (isOff ? "disabled" : "") +
          ' placeholder="Vi tri Ca 2" onchange="window.onEditMainShift(' + apos + sid + apos + ", " + apos + "shift_2" + apos + ', this.value)" /></td>' +
        '<td><div class="pill-list">' + extraHtml + '</div>' +
          '<button type="button" class="btn-primary btn-sm" ' + (isOff ? "disabled" : "") +
          ' onclick="window.onAddExtraShift(' + apos + sid + apos + ')">+ Them ca sau</button></td>' +
        "<td>" + (isOff ? '<span class="badge-off">OFF CA NGAY</span><br>' : "") +
          '<div class="pill-list">' + breakHtml + "</div></td>" +
        '<td><button type="button" class="btn-warning btn-sm" onclick="window.onToggleDayOff(' + apos + sid + apos + ')">' +
          (isOff ? "Mo lam lai" : "Cat ngay OFF") + "</button></td>" +
        "</tr>";
    }

    tbody.innerHTML = rows;
  }

  var staffForm = document.getElementById("staffForm");
  if (staffForm) {
    staffForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var client = sb();
      if (!client) {
        alert("Chua ket noi Supabase");
        return;
      }

      var employeeCode = document.getElementById("empCode").value.trim().toUpperCase();
      var fullName = document.getElementById("fullName").value.trim();
      var expYears = Number(document.getElementById("empLevel").value);

      client.from("profiles").insert({
        employee_code: employeeCode,
        full_name: fullName,
        role: "staff",
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

  window.onEditMainShift = function (staffId, field, value) {
    var date = (workDateEl && workDateEl.value) ? workDateEl.value : todayStr;
    var rec = window.getOrCreateRoster(staffId, date);
    rec[field] = value;
  };

  window.onAddExtraShift = function (staffId) {
    var date = (workDateEl && workDateEl.value) ? workDateEl.value : todayStr;
    var rec = window.getOrCreateRoster(staffId, date);
    rec.extra_shifts.push("");
    renderScheduleTable();
  };

  window.onEditExtraShift = function (staffId, idx, value) {
    var date = (workDateEl && workDateEl.value) ? workDateEl.value : todayStr;
    var rec = window.getOrCreateRoster(staffId, date);
    rec.extra_shifts[idx] = value;
  };

  window.onRemoveExtraShift = function (staffId, idx) {
    var date = (workDateEl && workDateEl.value) ? workDateEl.value : todayStr;
    var rec = window.getOrCreateRoster(staffId, date);
    rec.extra_shifts.splice(idx, 1);
    renderScheduleTable();
  };

  window.onRemoveBreakSlot = function (staffId, idx) {
    var date = (workDateEl && workDateEl.value) ? workDateEl.value : todayStr;
    var rec = window.getOrCreateRoster(staffId, date);
    rec.break_off_slots.splice(idx, 1);
    var p = (typeof window.upsertSingleRoster === "function")
      ? window.upsertSingleRoster(rec)
      : Promise.resolve();
    p.then(renderScheduleTable);
  };

  window.onToggleDayOff = function (staffId) {
    var date = (workDateEl && workDateEl.value) ? workDateEl.value : todayStr;
    var rec = window.getOrCreateRoster(staffId, date);
    rec.is_day_off = !rec.is_day_off;
    var p = (typeof window.upsertSingleRoster === "function")
      ? window.upsertSingleRoster(rec)
      : Promise.resolve();
    p.then(renderScheduleTable);
  };

  var btnCutDayOff = document.getElementById("btnCutDayOff");
  if (btnCutDayOff) {
    btnCutDayOff.addEventListener("click", function () {
      var client = sb();
      if (!client) {
        return;
      }
      var staffId = document.getElementById("offStaffSelect").value;
      var date = (offDateEl && offDateEl.value) || (workDateEl && workDateEl.value) || todayStr;
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
      var client = sb();
      if (!client) {
        return;
      }
      var staffId = document.getElementById("offStaffSelect").value;
      var date = (offDateEl && offDateEl.value) || (workDateEl && workDateEl.value) || todayStr;
      var start = document.getElementById("offStart").value;
      var end = document.getElementById("offEnd").value;
      if (!staffId || !start || !end) {
        alert("Nhap du gio bat dau va ket thuc nghi trong ca");
        return;
      }

      if (workDateEl) {
        workDateEl.value = date;
      }
      window.loadDashboardData().then(function () {
        var rec = window.getOrCreateRoster(staffId, date);
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
      var records = Object.values((window.rosterState && window.rosterState.rostersByStaff) || {});
      var chain = Promise.resolve();
      for (var i = 0; i < records.length; i++) {
        (function (r) {
          chain = chain.then(function () {
            if (typeof window.upsertSingleRoster === "function") {
              return window.upsertSingleRoster(r);
            }
          });
        })(records[i]);
      }
      chain.then(function () {
        alert("Da luu toan bo lich ngay " + ((workDateEl && workDateEl.value) || todayStr));
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
