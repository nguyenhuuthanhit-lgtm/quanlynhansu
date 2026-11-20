(function () {
  window.rosterState = {
    staffList: [],
    rostersByStaff: {},
    leavesByStaff: {},
    monthRosters: [],
    monthLeaves: [],
    monthShiftDirs: {}
  };

  window.getOrCreateRoster = function (staffId, shiftDate) {
    if (!window.rosterState.rostersByStaff[staffId]) {
      window.rosterState.rostersByStaff[staffId] = {
        staff_id: staffId,
        shift_date: shiftDate,
        duty_type: "NORMAL",
        work_hours: "06:00-18:00",
        shift_1: "",
        shift_2: "",
        extra_shifts: [],
        break_off_slots: [],
        is_day_off: false
      };
    }
    return window.rosterState.rostersByStaff[staffId];
  };

  window.fetchDailySchedule = function (shiftDate) {
    var client = window.supabaseClient;
    if (!client) return Promise.resolve();

    return Promise.all([
      client.from("profiles").select("*").eq("is_active", true).order("employee_code"),
      client.from("daily_rosters").select("*").eq("shift_date", shiftDate),
      client.from("leave_requests").select("*").eq("leave_date", shiftDate)
    ]).then(function (results) {
      window.rosterState.staffList = (results[0] && results[0].data) ? results[0].data : [];
      window.rosterState.rostersByStaff = {};
      window.rosterState.leavesByStaff = {};

      var rosters = (results[1] && results[1].data) ? results[1].data : [];
      for (var i = 0; i < rosters.length; i++) {
        var r = rosters[i];
        window.rosterState.rostersByStaff[r.staff_id] = Object.assign({}, r, {
          work_hours: r.work_hours || "06:00-18:00",
          extra_shifts: Array.isArray(r.extra_shifts) ? r.extra_shifts : [],
          break_off_slots: Array.isArray(r.break_off_slots) ? r.break_off_slots : []
        });
      }

      var leaves = (results[2] && results[2].data) ? results[2].data : [];
      for (var j = 0; j < leaves.length; j++) {
        var l = leaves[j];
        if (l.status !== "rejected") {
          window.rosterState.leavesByStaff[l.staff_id] = l;
        }
      }
    });
  };

  window.fetchMonthlySchedule = function (yearMonth) {
    var client = window.supabaseClient;
    if (!client) return Promise.resolve();

    var parts = yearMonth.split("-");
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var startDate = yearMonth + "-01";
    var lastDay = new Date(y, m, 0).getDate();
    var endDate = yearMonth + "-" + String(lastDay).padStart(2, "0");

    try {
      var savedMap = JSON.parse(localStorage.getItem("monthShiftDirs_" + yearMonth) || "{}");
      window.rosterState.monthShiftDirs = savedMap || {};
    } catch (e) {
      window.rosterState.monthShiftDirs = {};
    }

    return Promise.all([
      client.from("profiles").select("*").eq("is_active", true).order("employee_code"),
      client.from("daily_rosters").select("*").gte("shift_date", startDate).lte("shift_date", endDate),
      client.from("leave_requests").select("*").gte("leave_date", startDate).lte("leave_date", endDate)
    ]).then(function (results) {
      window.rosterState.staffList = (results[0] && results[0].data) ? results[0].data : [];
      window.rosterState.monthRosters = (results[1] && results[1].data) ? results[1].data : [];
      window.rosterState.monthLeaves = (results[2] && results[2].data) ? results[2].data : [];
    });
  };

  window.upsertSingleRoster = function (rec) {
    var client = window.supabaseClient;
    if (!client) return Promise.resolve();

    var payload = {
      staff_id: rec.staff_id,
      shift_date: rec.shift_date,
      duty_type: rec.is_day_off ? "OFF" : "NORMAL",
      shift_1: rec.shift_1 || "",
      shift_2: rec.shift_2 || "",
      extra_shifts: rec.extra_shifts || [],
      break_off_slots: rec.break_off_slots || [],
      is_day_off: !!rec.is_day_off
    };

    if (rec.id) {
      return client.from("daily_rosters").update(payload).eq("id", rec.id).select().single()
        .then(function (upd) {
          if (upd.error) throw upd.error;
          Object.assign(rec, upd.data);
          return rec;
        });
    }

    return client.from("daily_rosters").insert(payload).select().single()
      .then(function (ins) {
        if (ins.error) throw ins.error;
        Object.assign(rec, ins.data);
        return rec;
      });
  };
})();