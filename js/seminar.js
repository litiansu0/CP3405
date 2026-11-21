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
  Store.getQuestions(seminar.code).forEach(function (q) {
    knownIds[q.id] = true;
  });

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

    var questions = Store.getQuestions(seminar.code);
    questions.sort(sortSelect.value === "newest" ? UI.sortByNewest : UI.sortByVotes);

    UI.clear(feedList);
    feedEmpty.hidden = questions.length > 0;
    feedCount.textContent = String(questions.length);

    questions.forEach(function (q) {
      feedList.appendChild(UI.createQuestionCard(q, {
        viewerId: session.studentId,
        isNew: !knownIds[q.id],
        onVote: handleVote
      }));
    });

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
