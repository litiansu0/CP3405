// js/store.js – data layer.
// All localStorage / sessionStorage access lives in this file.
// localStorage  = shared "database" for every tab (questions).
// sessionStorage = this tab's student session (so two tabs = two students).

var Store = (function () {
  var QUESTIONS_KEY = "jcuqa.questions";
  var SESSION_KEY = "jcuqa.session";
  var MAX_QUESTION_LENGTH = 300;

  // PBI-01: the seminars a student can join (demo data, no server).
  var SEMINARS = {
    CP3405: { code: "CP3405", title: "CP3405 Seminar – Scrum in Practice" },
    CP2408: { code: "CP2408", title: "CP2408 Seminar – Lean UX" }
  };

  // PBI-01: tidy up what the student typed ("  cp3405 " -> "CP3405").
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

  // ---------- Session (this tab only) ----------

  // PBI-01 + PBI-02: start a session after a successful join.
  // For anonymous students the name is NOT saved anywhere.
  function startSession(code, mode, name) {
    var session = {
      seminarCode: normaliseCode(code),
      mode: mode === "named" ? "named" : "anonymous",
      name: mode === "named" ? String(name).trim() : null,
      // Random id so the tab can recognise "my questions" without knowing who you are.
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

  // ---------- Questions (shared by all tabs) ----------

  function loadQuestions() {
    try {
      var list = JSON.parse(localStorage.getItem(QUESTIONS_KEY));
      return Array.isArray(list) ? list : [];
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
      createdAt: Date.now()
    };

    var list = loadQuestions();
    list.push(question);
    saveQuestions(list);
    return { ok: true, question: question };
  }

  // PBI-03: the questions this tab's student has asked in this seminar, newest first.
  function getMyQuestions(session) {
    return loadQuestions()
      .filter(function (q) {
        return q.seminarCode === session.seminarCode && q.studentId === session.studentId;
      })
      .sort(function (a, b) {
        return b.createdAt - a.createdAt;
      });
  }

  return {
    MAX_QUESTION_LENGTH: MAX_QUESTION_LENGTH,
    normaliseCode: normaliseCode,
    findSeminar: findSeminar,
    startSession: startSession,
    getSession: getSession,
    endSession: endSession,
    addQuestion: addQuestion,
    getMyQuestions: getMyQuestions
  };
})();
