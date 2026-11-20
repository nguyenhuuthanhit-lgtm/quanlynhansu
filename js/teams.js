// =========================================================================
// [FILE: js/teams.js] QUẢN LÝ TỔ / NHÓM CA (HỖ TRỢ UUID & SỐ)
// =========================================================================
(function (global) {
  var Core = global.AppCore;
  var teamsList = [];

  function saveTeamsLocal(list) {
    try {
      localStorage.setItem("airport_teams_v4", JSON.stringify(list));
    } catch (e) {}
  }

  function readTeamsLocal() {
    try {
      var raw = JSON.parse(localStorage.getItem("airport_teams_v4") || "null");
      if (Array.isArray(raw)) return raw;
    } catch (e) {}
    return [];
  }

  function loadTeams() {
    var client = Core.getClient();
    var localList = readTeamsLocal();

    if (!client) {
      teamsList = localList;
      renderTeamSelectors();
      renderTeamManageList();
      return Promise.resolve(teamsList);
    }

    return client
      .from("teams")
      .select("*")
      .order("id", { ascending: true })
      .then(function (res) {
        if (!res.error && Array.isArray(res.data)) {
          teamsList = res.data.length > 0 ? res.data : localList;
          if (res.data.length > 0) saveTeamsLocal(teamsList);
        } else {
          teamsList = localList;
        }
        renderTeamSelectors();
        renderTeamManageList();
        return teamsList;
      })
      .catch(function () {
        teamsList = localList;
        renderTeamSelectors();
        renderTeamManageList();
        return teamsList;
      });
  }

  function getTeamNameById(groupId) {
    if (groupId === null || groupId === undefined || String(groupId).trim() === "") {
      return "Chưa phân tổ";
    }
    var target = String(groupId).trim();

    // 1. Khớp trực tiếp theo id (UUID hoặc số)
    for (var i = 0; i < teamsList.length; i++) {
      if (String(teamsList[i].id) === target) {
        return teamsList[i].name || "Chưa đặt tên tổ";
      }
    }

    // 2. Dự phòng nếu DB lưu số thứ tự 1, 2, 3... trong khi teams.id là UUID
    var num = Number(target);
    if (Number.isInteger(num) && num >= 1 && num <= teamsList.length) {
      return teamsList[num - 1].name || "Chưa đặt tên tổ";
    }

    return "Chưa phân tổ";
  }

  function renderTeamSelectors() {
    var ids = ["shiftGroupInput", "editShiftGroup"];
    for (var sIdx = 0; sIdx < ids.length; sIdx++) {
      var sel = document.getElementById(ids[sIdx]);
      if (!sel) continue;
      var currentVal = sel.value;
      sel.innerHTML = "";

      for (var i = 0; i < teamsList.length; i++) {
        var opt = document.createElement("option");
        opt.value = String(teamsList[i].id);
        opt.textContent = teamsList[i].name + (teamsList[i].note ? " (" + teamsList[i].note + ")" : "");
        sel.appendChild(opt);
      }

      if (currentVal) {
        for (var k = 0; k < sel.options.length; k++) {
          if (sel.options[k].value === String(currentVal)) {
            sel.value = String(currentVal);
            break;
          }
        }
      }
      if (!sel.value && sel.options.length > 0) {
        sel.value = sel.options[0].value;
      }
    }
  }

  function renderTeamManageList() {
    var container = document.getElementById("teamListContainer");
    if (!container) return;
    container.innerHTML = "";

    if (!teamsList.length) {
      container.innerHTML = "<div class='small-muted'>Chưa có tổ / nhóm nào. Hãy thêm tổ mới ở trên.</div>";
      return;
    }

    for (var i = 0; i < teamsList.length; i++) {
      (function (t) {
        var row = document.createElement("div");
        row.className = "team-item";

        var info = document.createElement("div");
        info.innerHTML = "<strong>" + (t.name || "Chưa đặt tên tổ") + "</strong>" +
          (t.note ? " <span class='small-muted'>- " + t.note + "</span>" : "");

        var btns = document.createElement("div");
        btns.className = "action-btns";

        var btnEdit = document.createElement("button");
        btnEdit.type = "button";
        btnEdit.className = "btn-primary btn-sm";
        btnEdit.textContent = "Sửa";
        btnEdit.addEventListener("click", function () {
          openEditTeamModal(t);
        });

        var btnDel = document.createElement("button");
        btnDel.type = "button";
        btnDel.className = "btn-danger btn-sm";
        btnDel.textContent = "Xóa";
        btnDel.addEventListener("click", function () {
          if (!confirm("Xóa " + (t.name || "tổ này") + "?")) return;

          var applyRemove = function () {
            teamsList = teamsList.filter(function (item) {
              return String(item.id) !== String(t.id);
            });
            saveTeamsLocal(teamsList);
            renderTeamSelectors();
            renderTeamManageList();
            if (global.AppStaffCrud && typeof global.AppStaffCrud.renderStaffList === "function") {
              global.AppStaffCrud.renderStaffList();
            }
          };

          var client = Core.getClient();
          if (client) {
            client.from("teams").delete().eq("id", t.id).then(function (res) {
              if (res.error) {
                alert("Lỗi xóa tổ trên DB: " + res.error.message);
                return;
              }
              applyRemove();
            });
          } else {
            applyRemove();
          }
        });

        btns.appendChild(btnEdit);
        btns.appendChild(btnDel);
        row.appendChild(info);
        row.appendChild(btns);
        container.appendChild(row);
      })(teamsList[i]);
    }
  }

  var addTeamForm = document.getElementById("addTeamForm");
  if (addTeamForm) {
    addTeamForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!Core.isShiftLeader()) return alert("Chỉ Ca trưởng mới được thêm tổ / nhóm.");
      var nameEl = document.getElementById("newTeamName");
      var noteEl = document.getElementById("newTeamNote");
      var name = nameEl ? nameEl.value.trim() : "";
      var note = noteEl ? noteEl.value.trim() : "";
      if (!name) return;

      var client = Core.getClient();
      if (client) {
        client
          .from("teams")
          .insert({ name: name, note: note })
          .select()
          .single()
          .then(function (res) {
            if (res.error) {
              alert("Lỗi thêm tổ: " + res.error.message);
              return;
            }
            if (res.data) {
              teamsList.push(res.data);
              saveTeamsLocal(teamsList);
              addTeamForm.reset();
              renderTeamSelectors();
              renderTeamManageList();
            }
          });
      } else {
        teamsList.push({ id: "team_" + Date.now(), name: name, note: note });
        saveTeamsLocal(teamsList);
        addTeamForm.reset();
        renderTeamSelectors();
        renderTeamManageList();
      }
    });
  }

  var editTeamModal = document.getElementById("editTeamModal");
  var btnCloseTeamModal = document.getElementById("btnCloseTeamModal");
  if (btnCloseTeamModal) {
    btnCloseTeamModal.addEventListener("click", function () {
      if (editTeamModal) editTeamModal.classList.remove("open");
    });
  }

  function openEditTeamModal(team) {
    document.getElementById("editTeamId").value = String(team.id || "");
    document.getElementById("editTeamName").value = team.name || "";
    document.getElementById("editTeamNote").value = team.note || "";
    if (editTeamModal) editTeamModal.classList.add("open");
  }

  var editTeamForm = document.getElementById("editTeamForm");
  if (editTeamForm) {
    editTeamForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = String(document.getElementById("editTeamId").value || "").trim();
      var name = document.getElementById("editTeamName").value.trim();
      var note = document.getElementById("editTeamNote").value.trim();
      if (!id || !name) return;

      var applyLocalUpdate = function () {
        for (var i = 0; i < teamsList.length; i++) {
          if (String(teamsList[i].id) === id) {
            teamsList[i].name = name;
            teamsList[i].note = note;
          }
        }
        saveTeamsLocal(teamsList);
        if (editTeamModal) editTeamModal.classList.remove("open");
        renderTeamSelectors();
        renderTeamManageList();
        if (global.AppStaffCrud && typeof global.AppStaffCrud.renderStaffList === "function") {
          global.AppStaffCrud.renderStaffList();
        }
      };

      var client = Core.getClient();
      if (client) {
        client.from("teams").update({ name: name, note: note }).eq("id", id).then(function (res) {
          if (res.error) {
            alert("Lỗi cập nhật tổ: " + res.error.message);
            return;
          }
          applyLocalUpdate();
        });
      } else {
        applyLocalUpdate();
      }
    });
  }

  global.AppTeams = {
    loadTeams: loadTeams,
    getTeamNameById: getTeamNameById,
    renderTeamSelectors: renderTeamSelectors
  };
})(window);