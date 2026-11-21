// js/seminar.js – student seminar page (seminar.html).

(function () {
  var session = Store.getSession();
  var seminar = session ? Store.findSeminar(session.seminarCode) : null;

  // No session in this tab (or bad data) -> go back to the join page.
  if (!session || !seminar) {
    window.location.replace("index.html");
    return;
  }

  var title = document.getElementById("seminar-title");
  var badge = document.getElementById("identity-badge");
  var form = document.getElementById("ask-form");
  var textarea = document.getElementById("question-text");
  var charCount = document.getElementById("char-count");
  var errorEl = document.getElementById("question-error");
  var confirmation = document.getElementById("confirmation");
  var mineList = document.getElementById("mine-list");
  var mineEmpty = document.getElementById("mine-empty");
  var leaveLink = document.getElementById("leave-link");

  // PBI-01: show which seminar the student joined.
  title.textContent = seminar.title;
  document.title = seminar.code + " – JCU Seminar Q&A";

  // PBI-02: clearly show the current identity.
  function identityText(isAnonymous, name) {
    return isAnonymous ? "Anonymous" : name;
  }
  badge.textContent = identityText(session.mode !== "named", session.name);
  badge.classList.add(session.mode === "named" ? "badge-named" : "badge-anon");

  function updateCharCount() {
    charCount.textContent = textarea.value.length + " / " + Store.MAX_QUESTION_LENGTH + " characters";
  }

  function formatTime(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // PBI-03: render "My questions" with createElement/textContent only (no innerHTML).
  function renderMyQuestions() {
    var questions = Store.getMyQuestions(session);
    while (mineList.firstChild) {
      mineList.removeChild(mineList.firstChild);
    }
    mineEmpty.hidden = questions.length > 0;

    questions.forEach(function (q) {
      var item = document.createElement("li");
      item.className = "question-item";

      var text = document.createElement("p");
      text.className = "question-text";
      text.textContent = q.text;

      var meta = document.createElement("p");
      meta.className = "question-meta";
      // PBI-02: show how the question was posted.
      meta.textContent = "Posted as " + identityText(q.anonymous, q.authorName) + " · " + formatTime(q.createdAt);

      item.appendChild(text);
      item.appendChild(meta);
      mineList.appendChild(item);
    });
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
      (result.question.anonymous ? "anonymously." : "as " + result.question.authorName + ".");
    confirmation.hidden = false;

    textarea.value = "";
    updateCharCount();
    renderMyQuestions();
    textarea.focus();
  });

  // Leaving clears this tab's session.
  leaveLink.addEventListener("click", function () {
    Store.endSession();
  });

  updateCharCount();
  renderMyQuestions();
})();
