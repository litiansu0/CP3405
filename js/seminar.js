// js/seminar.js – student seminar page (seminar.html).

(function () {
  var session = Store.getSession();
  var seminar = session ? Store.findSeminar(session.seminarCode) : null;

  // No session in this tab (or bad data) -> go back to the join page.
  if (!session || !seminar) {
    window.location.replace("index.html");
    return;
  }

  Store.ensureDemoData();

  var title = document.getElementById("seminar-title");
  var badge = document.getElementById("identity-badge");
  var form = document.getElementById("ask-form");
  var textarea = document.getElementById("question-text");
  var charCount = document.getElementById("char-count");
  var errorEl = document.getElementById("question-error");
  var confirmation = document.getElementById("confirmation");
  var feedList = document.getElementById("feed-list");
  var feedEmpty = document.getElementById("feed-empty");
  var feedCount = document.getElementById("feed-count");
  var sortSelect = document.getElementById("sort-select");
  var leaveLink = document.getElementById("leave-link");
  var notice = document.getElementById("notice");

  // PBI-01: show which seminar the student joined.
  title.textContent = seminar.title;
  document.title = seminar.code + " – JCU Seminar Q&A";

  // PBI-02: clearly show the current identity.
  badge.textContent = session.mode === "named" ? session.name : "Anonymous";
  badge.classList.add(session.mode === "named" ? "badge-named" : "badge-anon");

  // PBI-06: legend for the three statuses.
  document.getElementById("legend").appendChild(UI.createStatusLegend());

  // PBI-04: questions already here when the page loaded are "known".
  // Anything else that appears later gets a "New" tag.
  var knownIds = {};
  // Sprint 3: last known state of every question, to notice lecturer changes.
  var lastState = {};
  // Sprint 3: id -> time until which the card stays highlighted.
  var highlightUntil = {};
  var HIGHLIGHT_MS = 8000;

  function stateOf(q) {
    return { status: q.status, hidden: q.hidden, mergedInto: q.mergedInto };
  }

  Store.getQuestions(seminar.code).forEach(function (q) {
    knownIds[q.id] = true;
    lastState[q.id] = stateOf(q);
  });

  // Sprint 2 retrospective: make status changes clearer for students.
  // Message for the student whose own question was changed by the lecturer.
  function describeChange(before, q) {
    var start = "Your question \"" + UI.shortText(q) + "\" ";
    if (!before.mergedInto && q.mergedInto) {
      return start + "was merged into a similar question by the lecturer.";
    }
    if (!before.hidden && q.hidden) {
      return start + "was hidden by the lecturer.";
    }
    if (before.hidden && !q.hidden) {
      return start + "is visible again.";
    }
    var info = UI.STATUS_INFO[q.status];
    return start + "is now " + info.label + " – " + info.description.toLowerCase() + ".";
  }

  function showNotice(text) {
    UI.clear(notice);
    var box = UI.el("div", "notice-box");
    box.appendChild(UI.el("span", "", text));
    var close = UI.el("button", "notice-close", "Dismiss");
    close.setAttribute("aria-label", "Dismiss notice");
    close.type = "button";
    close.addEventListener("click", function () {
      UI.clear(notice);
    });
    box.appendChild(close);
    notice.appendChild(box);
    // Sprint 4: the notice stays until dismissed (no time limit), Esc also closes it.
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      UI.clear(notice);
    }
  });

  // Compare with the last known state: highlight changed cards and
  // tell the student when one of THEIR questions changed.
  function checkForChanges(questions) {
    var messages = [];
    var now = Date.now();
    questions.forEach(function (q) {
      var before = lastState[q.id];
      lastState[q.id] = stateOf(q);
      if (!before || (before.status === q.status && before.hidden === q.hidden &&
          before.mergedInto === q.mergedInto)) {
        return;
      }
      highlightUntil[q.id] = now + HIGHLIGHT_MS;
      if (q.studentId === session.studentId) {
        messages.push(describeChange(before, q));
      }
    });
    if (messages.length > 0) {
      showNotice(messages.join(" "));
    }
  }

  // PBI-08: explanation shown only to the author of a hidden / merged question.
  function noteFor(q, questions) {
    if (q.mergedInto) {
      var kept = null;
      questions.forEach(function (other) {
        if (other.id === q.mergedInto) {
          kept = other;
        }
      });
      return "Merged by the lecturer because a similar question was already asked: \"" +
        (kept ? kept.text : "another question") + "\". Your support was added to that question. Only you can see this card.";
    }
    if (q.hidden) {
      return "Hidden by the lecturer. Other students cannot see it. Only you can see this card.";
    }
    return "";
  }

  function updateCharCount() {
    charCount.textContent = textarea.value.length + " / " + Store.MAX_QUESTION_LENGTH + " characters";
  }

  // PBI-05: upvote / undo, then re-render.
  function handleVote(question) {
    Store.toggleVote(session, question.id);
    renderFeed();
  }

  // PBI-04: render the shared class feed with the shared card from ui.js.
  function renderFeed() {
    // Remember which vote button had focus so keyboard users don't lose their place.
    var active = document.activeElement;
    var focusedCard = active && active.classList.contains("vote-btn") ? active.closest(".question-card") : null;
    var focusedId = focusedCard ? focusedCard.getAttribute("data-id") : null;

    var all = Store.getQuestions(seminar.code);
    checkForChanges(all);

    // PBI-08: hidden / merged questions disappear for everyone except their author.
    var questions = all.filter(function (q) {
      return Store.isVisible(q) || q.studentId === session.studentId;
    });
    questions.sort(sortSelect.value === "newest" ? UI.sortByNewest : UI.sortByVotes);

    UI.clear(feedList);
    feedEmpty.hidden = questions.length > 0;
    feedCount.textContent = String(questions.length);

    var now = Date.now();
    questions.forEach(function (q) {
      feedList.appendChild(UI.createQuestionCard(q, {
        viewerId: session.studentId,
        isNew: !knownIds[q.id],
        onVote: handleVote,
        updated: highlightUntil[q.id] > now,
        note: noteFor(q, all)
      }));
    });

    // Remove the highlight again after a few seconds.
    if (Object.keys(highlightUntil).some(function (id) { return highlightUntil[id] > now; })) {
      clearTimeout(renderFeed.timer);
      renderFeed.timer = setTimeout(renderFeed, HIGHLIGHT_MS + 100);
    }

    if (focusedId) {
      var button = feedList.querySelector('.question-card[data-id="' + focusedId + '"] .vote-btn');
      if (button) {
        button.focus();
      }
    }
  }

  textarea.addEventListener("input", function () {
    updateCharCount();
    errorEl.textContent = "";
    textarea.removeAttribute("aria-invalid");
  });

  // PBI-03: submit a question.
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    confirmation.hidden = true;

    var result = Store.addQuestion(session, textarea.value);
    if (!result.ok) {
      // PBI-03: empty questions cannot be submitted.
      errorEl.textContent = result.error;
      textarea.setAttribute("aria-invalid", "true");
      textarea.focus();
      return;
    }

    // PBI-03: confirmation after a successful submit.
    confirmation.textContent = "✓ Your question was submitted " +
      (result.question.anonymous ? "anonymously." : "as " + result.question.authorName + ".") +
      " It is now in the class questions below.";
    confirmation.hidden = false;

    knownIds[result.question.id] = true; // own question gets "Yours", not "New"
    lastState[result.question.id] = stateOf(result.question);
    textarea.value = "";
    updateCharCount();
    renderFeed();
    textarea.focus();
  });

  sortSelect.addEventListener("change", renderFeed);

  // Sprint 2: live update when another tab adds a question or votes.
  Store.onQuestionsChange(renderFeed);

  // Leaving clears this tab's session.
  leaveLink.addEventListener("click", function () {
    Store.endSession();
  });

  updateCharCount();
  renderFeed();
})();
