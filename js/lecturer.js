// js/lecturer.js – lecturer dashboard (lecturer.html).
// Sprint 2: overview (PBI-07).
// Sprint 3: moderation – mark Seen / Answered, hide / restore, merge duplicates (PBI-06 – PBI-08).

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
  var actionStatus = document.getElementById("action-status");
  var filterSelect = document.getElementById("filter-select");
  var list = document.getElementById("question-list");
  var listEmpty = document.getElementById("list-empty");
  var listCount = document.getElementById("list-count");
  var listHeading = document.getElementById("questions-heading");
  var dupList = document.getElementById("dup-list");
  var dupEmpty = document.getElementById("dup-empty");
  var dupCount = document.getElementById("dup-count");
  var dupHeading = document.getElementById("dup-heading");
  var resetButton = document.getElementById("reset-demo");

  var seminar = null;
  var knownIds = {};

  // ---------- Small helpers ----------

  // A button that remembers what it does (data-action), so focus can be
  // put back on it after the list is re-rendered.
  function actionButton(label, className, action, describedBy, onClick) {
    var button = UI.el("button", "btn btn-small " + className, label);
    button.type = "button";
    button.setAttribute("data-action", action);
    if (describedBy) {
      button.setAttribute("aria-describedby", describedBy);
    }
    button.addEventListener("click", onClick);
    return button;
  }

  // Sprint 3: show (and announce) what the last action did.
  function announce(text) {
    actionStatus.textContent = "✓ " + text;
  }

  function focusElement(node) {
    if (node) {
      if (!node.hasAttribute("tabindex") && node.tagName !== "BUTTON") {
        node.setAttribute("tabindex", "-1");
      }
      node.focus();
    }
  }

  // ---------- PBI-07: counts ----------

  function createStat(labelNode, count) {
    var item = UI.el("li", "stat");
    item.appendChild(UI.el("span", "stat-number", String(count)));
    item.appendChild(labelNode);
    return item;
  }

  function renderStats(open, removedCount) {
    UI.clear(stats);
    stats.appendChild(createStat(UI.el("span", "stat-label", "Open questions"), open.length));
    Store.STATUSES.forEach(function (status) {
      var count = open.filter(function (q) {
        return q.status === status;
      }).length;
      stats.appendChild(createStat(UI.createStatusLabel(status), count));
    });
    stats.appendChild(createStat(UI.el("span", "stat-label", "Hidden / merged"), removedCount));
  }

  // ---------- PBI-06 + PBI-08: actions on one question ----------

  function changeStatus(question, status) {
    var result = Store.setStatus(question.id, status);
    if (!result.ok) {
      announce(result.error);
      return;
    }
    announce("\"" + UI.shortText(question) + "\" is now " + UI.STATUS_INFO[status].label + ". Students see the change.");
    render();
    // Keep the keyboard on the same card.
    focusElement(list.querySelector('.question-card[data-id="' + question.id + '"]') || listHeading);
  }

  // PBI-08: hide only after confirmation.
  function hideQuestion(question) {
    var ok = window.confirm("Hide this question from students?\n\n\"" + question.text +
      "\"\n\nYou can restore it later (Show: Hidden / merged).");
    if (!ok) {
      return;
    }
    Store.setHidden(question.id, true);
    announce("\"" + UI.shortText(question) + "\" is hidden from students. Choose Show: Hidden / merged to restore it.");
    render();
    focusElement(listHeading);
  }

  // PBI-08: hidden questions can be restored.
  function restoreQuestion(question) {
    Store.setHidden(question.id, false);
    announce("\"" + UI.shortText(question) + "\" is restored and visible to students again.");
    render();
    focusElement(listHeading);
  }

  // Buttons under each card. Kept short on purpose (Sprint 2 retrospective).
  function createActions(question) {
    var bar = UI.el("div", "card-actions");
    var describedBy = "qtext-" + question.id;

    if (question.mergedInto) {
      return null; // merged questions are final; the note on the card explains why
    }
    if (question.hidden) {
      bar.appendChild(actionButton("Restore", "btn-secondary", "restore", describedBy, function () {
        restoreQuestion(question);
      }));
      return bar;
    }
    if (question.status === "submitted") {
      bar.appendChild(actionButton("Mark as Seen", "btn-secondary", "seen", describedBy, function () {
        changeStatus(question, "seen");
      }));
    }
    if (question.status !== "answered") {
      bar.appendChild(actionButton("Mark as Answered", "btn-primary", "answered", describedBy, function () {
        changeStatus(question, "answered");
      }));
    } else {
      bar.appendChild(actionButton("Reopen", "btn-secondary", "reopen", describedBy, function () {
        changeStatus(question, "seen");
      }));
    }
    bar.appendChild(actionButton("Hide", "btn-danger", "hide", describedBy, function () {
      hideQuestion(question);
    }));
    return bar;
  }

  // ---------- PBI-08: possible duplicates ----------

  function mergeQuestions(keep, duplicate) {
    var ok = window.confirm("Merge these questions?\n\nKeep: \"" + keep.text + "\"\nMerge into it: \"" +
      duplicate.text + "\"\n\nVotes are combined. The student who asked the merged question will see why.");
    if (!ok) {
      return;
    }
    var result = Store.mergeQuestions(keep.id, duplicate.id);
    if (!result.ok) {
      announce(result.error);
      return;
    }
    announce("Merged. \"" + UI.shortText(keep) + "\" now has " + Store.voteCount(result.question) + " votes.");
    render();
    focusElement(dupHeading);
  }

  function keepBoth(pair) {
    Store.keepBoth(pair.a.id, pair.b.id);
    announce("Both questions kept. This pair will not be suggested again.");
    render();
    focusElement(dupHeading);
  }

  function createPairQuestion(letter, question) {
    var box = UI.el("div", "dup-question");
    var top = UI.el("div", "card-top");
    top.appendChild(UI.el("span", "dup-letter", "Question " + letter));
    top.appendChild(UI.createStatusLabel(question.status));
    box.appendChild(top);
    var text = UI.el("p", "question-text", question.text);
    text.id = "dup-" + letter + "-" + question.id;
    box.appendChild(text);
    var votes = Store.voteCount(question);
    box.appendChild(UI.el("p", "question-meta",
      (votes === 1 ? "1 vote" : votes + " votes") + " · asked by " + UI.authorText(question)));
    return box;
  }

  function createPairItem(pair) {
    var item = UI.el("li", "dup-pair");
    item.setAttribute("data-id", Store.pairKey(pair.a.id, pair.b.id));
    item.appendChild(UI.el("p", "dup-match",
      Math.round(pair.score * 100) + "% word match · shared words: " + pair.shared.join(", ")));
    item.appendChild(createPairQuestion("A", pair.a));
    item.appendChild(createPairQuestion("B", pair.b));

    var bar = UI.el("div", "card-actions");
    bar.appendChild(actionButton("Keep A, merge B into it", "btn-primary", "merge-b", null, function () {
      mergeQuestions(pair.a, pair.b);
    }));
    bar.appendChild(actionButton("Keep B, merge A into it", "btn-secondary", "merge-a", null, function () {
      mergeQuestions(pair.b, pair.a);
    }));
    bar.appendChild(actionButton("Not duplicates – keep both", "btn-secondary", "keep-both", null, function () {
      keepBoth(pair);
    }));
    item.appendChild(bar);
    return item;
  }

  function renderDuplicates(open) {
    var pairs = Duplicates.findPairs(open, Store.isKeptPair);
    UI.clear(dupList);
    dupEmpty.hidden = pairs.length > 0;
    dupCount.textContent = String(pairs.length);
    pairs.forEach(function (pair) {
      dupList.appendChild(createPairItem(pair));
    });
  }

  // ---------- Render the whole dashboard ----------

  function findText(questions, id) {
    for (var i = 0; i < questions.length; i++) {
      if (questions[i].id === id) {
        return questions[i].text;
      }
    }
    return "another question";
  }

  function render() {
    if (!seminar) {
      return;
    }
    // Remember which action button had focus (live updates re-render everything).
    var active = document.activeElement;
    var activeAction = active && active.getAttribute ? active.getAttribute("data-action") : null;
    var activeOwner = activeAction ? active.closest("[data-id]") : null;
    var activeId = activeOwner ? activeOwner.getAttribute("data-id") : null;

    var all = Store.getQuestions(seminar.code);
    var open = all.filter(Store.isVisible);
    var removed = all.filter(function (q) {
      return !Store.isVisible(q);
    });
    renderStats(open, removed.length);
    renderDuplicates(open);

    var filter = filterSelect.value;
    var shown;
    if (filter === "hidden") {
      shown = removed.sort(UI.sortByNewest);
    } else {
      shown = open.filter(function (q) {
        return filter === "all" || q.status === filter;
      });
      shown.sort(UI.sortByPriority); // PBI-07: answered questions sink to the bottom
    }

    UI.clear(list);
    listEmpty.hidden = shown.length > 0;
    listCount.textContent = String(shown.length);
    shown.forEach(function (q) {
      var note = q.mergedInto ? "Merged into: \"" + findText(all, q.mergedInto) + "\"" : "";
      var card = UI.createQuestionCard(q, { viewerId: null, isNew: !knownIds[q.id], note: note });
      var actions = createActions(q);
      if (actions) {
        card.appendChild(actions);
      }
      list.appendChild(card);
    });

    if (activeId) {
      focusElement(document.querySelector('[data-id="' + activeId + '"] [data-action="' + activeAction + '"]'));
    }
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
    actionStatus.textContent = "";
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
      codeError.textContent = "Class code \"" + code + "\" was not found. Check the code and try again.";
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

  // Sprint 4: demo support only – put the example questions back before a demo.
  resetButton.addEventListener("click", function () {
    if (!window.confirm("Reset ALL demo data?\n\nEvery question, vote and moderation action is removed " +
        "and the 6 example questions are added again.")) {
      return;
    }
    Store.resetDemoData();
    knownIds = {};
    Store.getQuestions(seminar.code).forEach(function (q) {
      knownIds[q.id] = true;
    });
    filterSelect.value = "all";
    announce("Demo data reset. Open student tabs update automatically.");
    render();
    focusElement(dashboardTitle);
  });

  // Live update when students ask or vote in other tabs.
  Store.onQuestionsChange(render);

  // Re-open the seminar this tab was showing before a reload.
  var remembered = Store.getLecturerSeminar();
  if (remembered) {
    openSeminar(remembered);
  }
})();
