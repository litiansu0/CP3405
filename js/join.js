// js/join.js – student join page (index.html).

(function () {
  var form = document.getElementById("join-form");
  var codeInput = document.getElementById("class-code");
  var codeError = document.getElementById("code-error");
  var nameField = document.getElementById("name-field");
  var nameInput = document.getElementById("student-name");
  var nameError = document.getElementById("name-error");

  function selectedMode() {
    var checked = form.querySelector('input[name="mode"]:checked');
    return checked ? checked.value : "named";
  }

  // PBI-02: the name field is only shown for named participation.
  function updateNameField() {
    var named = selectedMode() === "named";
    nameField.hidden = !named;
    if (!named) {
      nameInput.value = ""; // do not keep a name around for anonymous students
      showError(nameInput, nameError, "");
    }
  }

  function showError(input, errorEl, message) {
    errorEl.textContent = message;
    if (message) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }

  form.addEventListener("change", function (event) {
    if (event.target.name === "mode") {
      updateNameField();
    }
  });

  // Clear an error as soon as the student starts fixing it.
  codeInput.addEventListener("input", function () {
    showError(codeInput, codeError, "");
  });
  nameInput.addEventListener("input", function () {
    showError(nameInput, nameError, "");
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var code = Store.normaliseCode(codeInput.value);
    var mode = selectedMode();
    var name = nameInput.value.trim();
    var firstInvalid = null;

    // PBI-01: empty or invalid code shows an error message.
    if (code === "") {
      showError(codeInput, codeError, "Please enter a class code.");
      firstInvalid = codeInput;
    } else if (!Store.findSeminar(code)) {
      showError(codeInput, codeError, "Class code \"" + code + "\" was not found. Check the code and try again.");
      firstInvalid = codeInput;
    } else {
      showError(codeInput, codeError, "");
    }

    // PBI-02: a named student must type a name.
    if (mode === "named" && name === "") {
      showError(nameInput, nameError, "Please enter your name, or choose Anonymous.");
      firstInvalid = firstInvalid || nameInput;
    }

    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    // PBI-01: valid code -> enter the seminar.
    Store.startSession(code, mode, name);
    window.location.href = "seminar.html";
  });

  // If this tab already joined, show the code again for convenience.
  var existing = Store.getSession();
  if (existing) {
    codeInput.value = existing.seminarCode;
  }
  updateNameField();
})();
