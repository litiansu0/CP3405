// js/store.js – data layer.
// All localStorage / sessionStorage access lives in this file.
// localStorage  = shared "database" for every tab (questions).
// sessionStorage = this tab's session (so two tabs = two students).

var Store = (function () {
  var QUESTIONS_KEY = "jcuqa.questions";
  var SESSION_KEY = "jcuqa.session";
  var LECTURER_KEY = "jcuqa.lecturerSeminar";
  var DEMO_FLAG_KEY = "jcuqa.demoSeeded";
  var KEPT_PAIRS_KEY = "jcuqa.keptPairs";
  var MAX_QUESTION_LENGTH = 300;

  // PBI-06: the three question statuses, in workflow order.
  var STATUSES = ["submitted", "seen", "answered"];

  // PBI-01: the seminars a student can join (demo data, no server).
  var SEMINARS = {
    CP3405: { code: "CP3405", title: "CP3405 Seminar – Scrum in Practice" },
    CP2408: { code: "CP2408", title: "CP2408 Seminar – Lean UX" }
  };

  // PBI-01: tidy up what the user typed ("  cp3405 " -> "CP3405").
  function normaliseCode(code) {
    return String(code || "").trim().toUpperCase();
  }

  // PBI-01: returns the seminar object, or null if the code is not valid.
  function findSeminar(code) {
    var key = normaliseCode(code);
    return Object.prototype.hasOwnProperty.call(SEMINARS, key) ? SEMINARS[key] : null;
  }

  // Simple unique id, good enough for a prototype.
  function makeId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Student session (this tab only) ----------

  // PBI-01 + PBI-02: start a session after a successful join.
  // For anonymous students the name is NOT saved anywhere.
  function startSession(code, mode, name) {
    var session = {
      seminarCode: normaliseCode(code),
      mode: mode === "named" ? "named" : "anonymous",
      name: mode === "named" ? String(name).trim() : null,
      // Random id so the tab can recognise "my questions" and "my votes"
      // without knowing who the student is.
      studentId: makeId("s")
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch (e) {
      return null;
    }
  }

  function endSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  // ---------- Lecturer session (this tab only) ----------

  // PBI-07: remember which seminar this tab's dashboard is showing.
  function setLecturerSeminar(code) {
    sessionStorage.setItem(LECTURER_KEY, normaliseCode(code));
  }

  function getLecturerSeminar() {
    return sessionStorage.getItem(LECTURER_KEY);
  }

  function clearLecturerSeminar() {
    sessionStorage.removeItem(LECTURER_KEY);
  }

  // ---------- Questions (shared by all tabs) ----------

  // Sprint 2: questions saved in Sprint 1 have no status or votes yet,
  // so fill in the missing fields when loading.
  function fillMissingFields(q) {
    if (STATUSES.indexOf(q.status) === -1) {
      q.status = "submitted";
    }
    if (!Array.isArray(q.voters)) {
      q.voters = [];
    }
    // Sprint 3: moderation fields.
    if (typeof q.hidden !== "boolean") {
      q.hidden = false;
    }
    if (!q.mergedInto) {
      q.mergedInto = null;
    }
    if (!Array.isArray(q.mergedFrom)) {
      q.mergedFrom = [];
    }
    if (!q.statusChangedAt) {
      q.statusChangedAt = q.createdAt;
    }
    return q;
  }

  function loadQuestions() {
    try {
      var list = JSON.parse(localStorage.getItem(QUESTIONS_KEY));
      return Array.isArray(list) ? list.map(fillMissingFields) : [];
    } catch (e) {
      return [];
    }
  }

  function saveQuestions(list) {
    localStorage.setItem(QUESTIONS_KEY, JSON.stringify(list));
  }

  // PBI-03: add a question. Returns { ok: true, question } or { ok: false, error }.
  // PBI-02: the participation choice from the session is applied here.
  function addQuestion(session, text) {
    var clean = String(text || "").trim();
    if (clean === "") {
      return { ok: false, error: "Please type a question before submitting." };
    }
    if (clean.length > MAX_QUESTION_LENGTH) {
      return { ok: false, error: "Your question is too long (max " + MAX_QUESTION_LENGTH + " characters)." };
    }

    var anonymous = session.mode !== "named";
    var question = {
      id: makeId("q"),
      seminarCode: session.seminarCode,
      text: clean,
      anonymous: anonymous,
      authorName: anonymous ? null : session.name, // PBI-02: no name stored when anonymous
      studentId: session.studentId,
      createdAt: Date.now(),
      status: "submitted", // PBI-06: every new question starts as Submitted
      statusChangedAt: Date.now(),
      voters: [],          // PBI-05: student ids that upvoted this question
      hidden: false,       // PBI-08: hidden by the lecturer
      mergedInto: null,    // PBI-08: id of the question this one was merged into
      mergedFrom: []       // PBI-08: ids of duplicates merged into this one
    };

    var list = loadQuestions();
    list.push(question);
    saveQuestions(list);
    return { ok: true, question: question };
  }

  // PBI-04 + PBI-07: all questions of one seminar.
  function getQuestions(seminarCode) {
    var code = normaliseCode(seminarCode);
    return loadQuestions().filter(function (q) {
      return q.seminarCode === code;
    });
  }

  // PBI-05: number of upvotes.
  function voteCount(question) {
    return question.voters.length;
  }

  // PBI-05: has this student already upvoted the question?
  function hasVoted(question, studentId) {
    return question.voters.indexOf(studentId) !== -1;
  }

  function findIn(list, questionId) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === questionId) {
        return list[i];
      }
    }
    return null;
  }

  // PBI-08: a question students can see = not hidden and not merged away.
  function isVisible(question) {
    return !question.hidden && !question.mergedInto;
  }

  // PBI-05: upvote, or undo the upvote if the student already voted.
  // One vote per student; students cannot upvote their own question.
  function toggleVote(session, questionId) {
    var list = loadQuestions();
    var question = findIn(list, questionId);
    if (!question) {
      return { ok: false, error: "This question no longer exists." };
    }
    if (!isVisible(question)) {
      return { ok: false, error: "This question is no longer open for votes." };
    }
    if (question.studentId === session.studentId) {
      return { ok: false, error: "You cannot upvote your own question." };
    }

    var index = question.voters.indexOf(session.studentId);
    if (index === -1) {
      question.voters.push(session.studentId);
    } else {
      question.voters.splice(index, 1);
    }
    saveQuestions(list);
    return { ok: true, voted: index === -1 };
  }

  // ---------- Sprint 3: lecturer moderation ----------

  // Load, change one question, save. Used by all lecturer actions.
  function updateQuestion(questionId, change) {
    var list = loadQuestions();
    var question = findIn(list, questionId);
    if (!question) {
      return { ok: false, error: "This question no longer exists." };
    }
    change(question);
    saveQuestions(list);
    return { ok: true, question: question };
  }

  // PBI-06: lecturer marks a question Seen / Answered (or reopens it).
  function setStatus(questionId, status) {
    if (STATUSES.indexOf(status) === -1) {
      return { ok: false, error: "Unknown status." };
    }
    return updateQuestion(questionId, function (q) {
      q.status = status;
      q.statusChangedAt = Date.now();
    });
  }

  // PBI-08: hide an inappropriate / irrelevant question, or restore it.
  function setHidden(questionId, hidden) {
    return updateQuestion(questionId, function (q) {
      q.hidden = !!hidden;
    });
  }

  // PBI-08: merge a duplicate into the question the lecturer keeps.
  // Votes are combined (each student counted once). The student who asked
  // the duplicate counts as a supporter of the kept question.
  function mergeQuestions(keepId, duplicateId) {
    var list = loadQuestions();
    var keep = findIn(list, keepId);
    var duplicate = findIn(list, duplicateId);
    if (!keep || !duplicate || keepId === duplicateId) {
      return { ok: false, error: "These questions cannot be merged." };
    }
    if (!isVisible(keep) || !isVisible(duplicate)) {
      return { ok: false, error: "Only visible questions can be merged." };
    }

    duplicate.voters.concat([duplicate.studentId]).forEach(function (id) {
      if (id !== keep.studentId && keep.voters.indexOf(id) === -1) {
        keep.voters.push(id);
      }
    });
    keep.mergedFrom.push(duplicate.id);
    duplicate.mergedInto = keep.id;
    saveQuestions(list);
    return { ok: true, question: keep };
  }

  // PBI-08: pairs the lecturer decided are NOT duplicates ("keep both").
  function pairKey(idA, idB) {
    return [idA, idB].sort().join("|");
  }

  function loadKeptPairs() {
    try {
      var list = JSON.parse(localStorage.getItem(KEPT_PAIRS_KEY));
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function keepBoth(idA, idB) {
    var list = loadKeptPairs();
    var key = pairKey(idA, idB);
    if (list.indexOf(key) === -1) {
      list.push(key);
      localStorage.setItem(KEPT_PAIRS_KEY, JSON.stringify(list));
    }
  }

  function isKeptPair(idA, idB) {
    return loadKeptPairs().indexOf(pairKey(idA, idB)) !== -1;
  }

  // Sprint 2: live update. The browser fires "storage" in OTHER tabs
  // whenever localStorage changes, so every open page can re-render.
  function onQuestionsChange(callback) {
    window.addEventListener("storage", function (event) {
      if (event.key === QUESTIONS_KEY || event.key === KEPT_PAIRS_KEY || event.key === null) {
        callback();
      }
    });
  }

  // Sprint 2: demo questions for CP3405 covering all three statuses,
  // including two near-duplicates (used in Sprint 3). Added only once.
  function ensureDemoData() {
    if (localStorage.getItem(DEMO_FLAG_KEY)) {
      return;
    }
    var minute = 60 * 1000;
    var now = Date.now();
    var demo = [
      { text: "What is the difference between a Sprint Review and a Sprint Retrospective?", name: "Mia Chen", status: "answered", votes: 7, minutesAgo: 25 },
      { text: "How many story points should one sprint have?", name: null, status: "seen", votes: 5, minutesAgo: 18 },
      { text: "Who decides the order of the Product Backlog?", name: "Jack Wilson", status: "answered", votes: 4, minutesAgo: 15 },
      { text: "Can the Scrum Master also be a developer in a small team?", name: null, status: "submitted", votes: 3, minutesAgo: 9 },
      { text: "How many story points should we put in one sprint?", name: "Priya Singh", status: "submitted", votes: 2, minutesAgo: 6 },
      { text: "Do we still need a Daily Scrum if the team only meets twice a week?", name: null, status: "seen", votes: 1, minutesAgo: 3 }
    ];

    var list = loadQuestions();
    demo.forEach(function (d, i) {
      var voters = [];
      for (var v = 0; v < d.votes; v++) {
        voters.push("demo-voter-" + v);
      }
      list.push({
        id: "demo-q" + (i + 1),
        seminarCode: "CP3405",
        text: d.text,
        anonymous: d.name === null,
        authorName: d.name,
        studentId: "demo-student-" + (i + 1),
        createdAt: now - d.minutesAgo * minute,
        status: d.status,
        voters: voters
      });
    });
    saveQuestions(list);
    localStorage.setItem(DEMO_FLAG_KEY, "yes");
  }

  // Sprint 4: demo support – remove everything and add the example questions again.
  // Student sessions (sessionStorage) are kept, so open tabs keep working.
  function resetDemoData() {
    localStorage.removeItem(QUESTIONS_KEY);
    localStorage.removeItem(KEPT_PAIRS_KEY);
    localStorage.removeItem(DEMO_FLAG_KEY);
    ensureDemoData();
  }

  return {
    MAX_QUESTION_LENGTH: MAX_QUESTION_LENGTH,
    STATUSES: STATUSES,
    normaliseCode: normaliseCode,
    findSeminar: findSeminar,
    startSession: startSession,
    getSession: getSession,
    endSession: endSession,
    setLecturerSeminar: setLecturerSeminar,
    getLecturerSeminar: getLecturerSeminar,
    clearLecturerSeminar: clearLecturerSeminar,
    addQuestion: addQuestion,
    getQuestions: getQuestions,
    voteCount: voteCount,
    hasVoted: hasVoted,
    toggleVote: toggleVote,
    isVisible: isVisible,
    setStatus: setStatus,
    setHidden: setHidden,
    mergeQuestions: mergeQuestions,
    pairKey: pairKey,
    keepBoth: keepBoth,
    isKeptPair: isKeptPair,
    onQuestionsChange: onQuestionsChange,
    ensureDemoData: ensureDemoData,
    resetDemoData: resetDemoData
  };
})();
