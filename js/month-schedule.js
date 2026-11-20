// =========================================================================
// [FILE: js/month-schedule.js] CẮT LỊCH TRONG THÁNG
// Chọn hướng ca DEP/ARR và bấm từng ngày 01..31 để đổi trạng thái Làm/OFF.
// =========================================================================
(function (global) {
  var Core = global.AppCore;

  function getMonthShiftDir(staff, ym) {
    var map = (global.rosterState && global.rosterState.monthShiftDirs) || {};
    if (map[staff.id]) return map[staff.id];
    return staff.base_shift_type || "DEP";
  }

  function setMonthShiftDir(staff, ym, dir) {
    if (!global.rosterState.monthShiftDirs) global.rosterState.monthShiftDirs = {};
    global.rosterState.monthShiftDirs[staff.id] = dir;
    try {
      localStorage.setItem("monthShiftDirs_" + ym, JSON.stringify(global.rosterState.monthShiftDirs));
    } catch (e) {}

    var client = Core.getClient();
    if (client && Core.isShiftLeader()) {
      client.from("profiles").update({ base_shift_type: dir }).eq("id", staff.id).then(function () {});
    }
  }

  function renderMonthSchedule() {
    var tbody = document.getElementById("monthScheduleBody");
    if (!tbody || !global.rosterState) return;
    tbody.innerHTML = "";

    var leader = Core.isShiftLeader();
    var ym = Core.getSelectedMonth();
    var parts = ym.split("-");
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var totalDays = new Date(y, m, 0).getDate();

    var staffList = Core.getVisibleStaffList();
    var mRosters = global.rosterState.monthRosters || [];
    var mLeaves = global.rosterState.monthLeaves || [];

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
            chip.className = "day-chip " + (isOff ? "day-off" : "day-work") + (leader ? "" : " readonly");
            chip.textContent = dd;
            chip.title = fullDate + (isOff ? " (OFF)" : " (Làm)");

            if (leader) {
              chip.addEventListener("click", function () {
                var client = Core.getClient();
                if (!client) return;
                var nextOff = !isOff;
                client
                  .from("daily_rosters")
                  .upsert({
                    staff_id: staff.id,
                    shift_date: fullDate,
                    duty_type: nextOff ? "OFF" : "NORMAL",
                    is_day_off: nextOff
                  }, { onConflict: "staff_id,shift_date" })
                  .then(function (res) {
                    if (res.error) return alert("Lỗi cập nhật ngày: " + res.error.message);
                    if (global.AppStaff && typeof global.AppStaff.loadMonthTab === "function") {
                      global.AppStaff.loadMonthTab();
                    }
                  });
              });
            }
            box.appendChild(chip);
          })(d);
        }

        var tr = document.createElement("tr");
        tr.appendChild(Core.makeTextCell(staff.full_name || "", true));
        tr.appendChild(Core.makeTextCell(Core.normalizeJobTitle(staff), false));

        var dirTd = document.createElement("td");
        var currentDir = getMonthShiftDir(staff, ym);
        if (leader) {
          var selDir = document.createElement("select");
          selDir.className = "inline-select";
          var optDep = document.createElement("option");
          optDep.value = "DEP";
          optDep.textContent = "DEP";
          var optArr = document.createElement("option");
          optArr.value = "ARR";
          optArr.textContent = "ARR";
          selDir.appendChild(optDep);
          selDir.appendChild(optArr);
          selDir.value = currentDir;
          selDir.addEventListener("change", function () {
            setMonthShiftDir(staff, ym, selDir.value);
          });
          dirTd.appendChild(selDir);
        } else {
          dirTd.textContent = currentDir;
        }
        tr.appendChild(dirTd);

        var workTd = document.createElement("td");
        workTd.innerHTML = "<strong>" + workDays.length + " ngày</strong><br><span class='small-muted'>" +
          (workDays.length ? workDays.join(", ") : "-") + "</span>";
        tr.appendChild(workTd);

        var offTd = document.createElement("td");
        offTd.innerHTML = "<strong>" + offDays.length + " ngày</strong><br><span class='small-muted'>" +
          (offDays.length ? offDays.join(", ") : "-") + "</span><br>";
        offTd.appendChild(box);
        tr.appendChild(offTd);

        tbody.appendChild(tr);
      })(staffList[i]);
    }
  }

  var btnReloadMonth = document.getElementById("btnReloadMonth");
  if (btnReloadMonth) {
    btnReloadMonth.addEventListener("click", function () {
      if (global.AppStaff && typeof global.AppStaff.loadMonthTab === "function") {
        global.AppStaff.loadMonthTab();
      }
    });
  }

  if (Core.workMonthEl) {
    Core.workMonthEl.addEventListener("change", function () {
      if (global.AppStaff && typeof global.AppStaff.loadMonthTab === "function") {
        global.AppStaff.loadMonthTab();
      }
    });
  }

  global.AppMonthSchedule = {
    renderMonthSchedule: renderMonthSchedule
  };
})(window);
