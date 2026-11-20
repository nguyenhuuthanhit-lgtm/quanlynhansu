  var btnSaveAll = document.getElementById("btnSaveAllRosters");
  if (btnSaveAll) {
    btnSaveAll.addEventListener("click", function () {
      if (!Core.isShiftLeader()) return;
      var date = Core.getSelectedDate();
      syncSlotsToRosters(date);
      if (global.AppDaySlots && global.AppDaySlots.saveDaySlots) {
        global.AppDaySlots.saveDaySlots(date);
      }

      var mapObj = (global.rosterState && global.rosterState.rostersByStaff) || {};
      var keys = Object.keys(mapObj);
      var chain = Promise.resolve();

      for (var i = 0; i < keys.length; i++) {
        (function (rec) {
          chain = chain.then(function () {
            if (!rec) return;
            // Tạo bản sao chỉ giữ các trường cơ bản an toàn nếu DB thiếu cột mở rộng
            var cleanRec = {
              id: rec.id,
              staff_id: rec.staff_id,
              shift_date: rec.shift_date || date,
              shift_1: rec.shift_1 || "",
              shift_2: rec.shift_2 || "",
              duty_type: rec.duty_type || (rec.is_day_off ? "OFF" : "NORMAL"),
              is_day_off: Boolean(rec.is_day_off)
            };
            if (!cleanRec.id) delete cleanRec.id;

            if (typeof global.upsertSingleRoster === "function") {
              return global.upsertSingleRoster(cleanRec);
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