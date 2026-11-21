// js/lecturer.js – lecturer dashboard (lecturer.html).
// Sprint 2: overview only (PBI-07). Lecturer actions come in Sprint 3.

(function () {
  Store.ensureDemoData();

  var openSection = document.getElementById("open-section");
  var openForm = document.getElementById("open-form");
  var codeInput = document.getElementById("lecturer-code");
  var codeError = document.getElementById("lecturer-code-error");
  var dashboard = document.getElementById("dashboard");
  var dashboardTitle = document.getElementById("dashboard-title");
  var changeButton = document.getElementById("change-seminar");
  var stats = document.getElementById("stats");
  var filterSelect = document.getElementById("filter-select");
  var sortSelect = document.getElementById("lecturer-sort");
  var list = document.getElementById("question-list");
  var listEmpty = document.getElementById("list-empty");
  var listCount = document.getElementById("list-count");

  var seminar = null;
  var knownIds = {};

  document.getElementById("legend").appendChild(UI.createStatusLegend());

  // PBI-07: one stat tile (status label + number).
  function createStat(labelNode, count) {
    var item = document.createElement("li");
    item.className = "stat";
    var number = document.createElement("span");
    number.className = "stat-number";
    number.textContent = String(count);
    item.appendChild(number);
    item.appendChild(labelNode);
    return item;
  }

  // PBI-07: counts per status.
  function renderStats(questions) {
    UI.clear(stats);
    var totalLabel = document.createElement("span");
    totalLabel.className = "stat-label";
    totalLabel.textContent = "Total";
    stats.appendChild(createStat(totalLabel, questions.length));

    Store.STATUSES.forEach(function (status) {
      var count = questions.filter(function (q) {
        return q.status === status;
      }).length;
      stats.appendChild(createStat(UI.createStatusLabel(status), count));
    });
  }

  // PBI-07: all questions on one page, filter by status, sort by votes / newest.
  function render() {
    if (!seminar) {
      return;
    }
    var all = Store.getQuestions(seminar.code);
    renderStats(all);

    var filter = filterSelect.value;
    var shown = all.filter(function (q) {
      return filter === "all" || q.status === filter;
    });
    shown.sort(sortSelect.value === "newest" ? UI.sortByNewest : UI.sortByVotes);

    UI.clear(list);
    listEmpty.hidden = shown.length > 0;
    listCount.textContent = String(shown.length);
    shown.forEach(function (q) {
      // Same shared card as the student page; no vote button for lecturers.
      list.appendChild(UI.createQuestionCard(q, { viewerId: null, isNew: !knownIds[q.id] }));
    });
  }

  function openSeminar(code) {
    seminar = Store.findSeminar(code);
    if (!seminar) {
      return false;
    }
    Store.setLecturerSeminar(seminar.code);
    knownIds = {};
    Store.getQuestions(seminar.code).forEach(function (q) {
      knownIds[q.id] = true;
    });
    dashboardTitle.textContent = seminar.title;
    document.title = seminar.code + " dashboard – JCU Seminar Q&A";
    openSection.hidden = true;
    dashboard.hidden = false;
    render();
    return true;
  }

  openForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var code = Store.normaliseCode(codeInput.value);
    if (code === "") {
      codeError.textContent = "Please enter a class code.";
    } else if (!openSeminar(code)) {
      codeError.textContent = "Class code \"" + code + "\" was not found.";
    } else {
      codeError.textContent = "";
      dashboardTitle.setAttribute("tabindex", "-1");
      dashboardTitle.focus();
      return;
    }
    codeInput.setAttribute("aria-invalid", "true");
    codeInput.focus();
  });

  codeInput.addEventListener("input", function () {
    codeError.textContent = "";
    codeInput.removeAttribute("aria-invalid");
  });

  changeButton.addEventListener("click", function () {
    Store.clearLecturerSeminar();
    seminar = null;
    dashboard.hidden = true;
    openSection.hidden = false;
    codeInput.value = "";
    codeInput.focus();
  });

  filterSelect.addEventListener("change", render);
  sortSelect.addEventListener("change", render);

  // Sprint 2: live update when students ask or vote in other tabs.
  Store.onQuestionsChange(render);

  // Re-open the seminar this tab was showing before a reload.
  var remembered = Store.getLecturerSeminar();
  if (remembered) {
    openSeminar(remembered);
  }
})();
