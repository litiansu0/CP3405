// js/ui.js – shared UI components used by BOTH the student and lecturer pages.
// Sprint 1 retrospective action: one question card and one status label,
// so wording and layout stay consistent everywhere.
// Only createElement / textContent is used (never innerHTML).

var UI = (function () {
  // PBI-06: every status has a colour (CSS class), an icon and a word.
  var STATUS_INFO = {
    submitted: { label: "Submitted", icon: "○", description: "Sent, waiting for the lecturer" },
    seen:      { label: "Seen",      icon: "◐", description: "The lecturer has seen it" },
    answered:  { label: "Answered",  icon: "✓", description: "The lecturer has answered it" }
  };

  // Small helper: create an element with an optional class and text.
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  // PBI-02: how the author is shown – never a name for anonymous questions.
  function authorText(question) {
    return question.anonymous ? "Anonymous" : question.authorName;
  }

  function formatTime(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function voteText(count) {
    return count === 1 ? "1 vote" : count + " votes";
  }

  // PBI-06: status label = colour + icon + word (never colour alone).
  function createStatusLabel(status) {
    var info = STATUS_INFO[status] || STATUS_INFO.submitted;
    var label = el("span", "status-label status-" + status);
    var icon = el("span", "status-icon", info.icon);
    icon.setAttribute("aria-hidden", "true");
    label.appendChild(icon);
    label.appendChild(el("span", "", info.label));
    return label;
  }

  // PBI-06: legend explaining the three statuses.
  function createStatusLegend() {
    var list = el("ul", "legend");
    list.setAttribute("aria-label", "Status legend");
    Store.STATUSES.forEach(function (status) {
      var item = el("li", "legend-item");
      item.appendChild(createStatusLabel(status));
      item.appendChild(el("span", "legend-text", STATUS_INFO[status].description));
      list.appendChild(item);
    });
    return list;
  }

  // PBI-04: the shared question card.
  // options:
  //   viewerId – the student id of this tab (null on the lecturer page)
  //   isNew    – true if the question arrived after the page was loaded
  //   onVote   – function(question); when given, a vote button is shown (student page)
  function createQuestionCard(question, options) {
    options = options || {};
    var isOwn = !!options.viewerId && question.studentId === options.viewerId;
    var votes = Store.voteCount(question);

    var card = el("li", "question-card");
    card.setAttribute("data-id", question.id);

    // Top row: status + tags
    var top = el("div", "card-top");
    top.appendChild(createStatusLabel(question.status));
    if (options.isNew) {
      top.appendChild(el("span", "tag tag-new", "New"));          // PBI-04
    }
    if (isOwn) {
      top.appendChild(el("span", "tag tag-yours", "Yours"));
    }
    card.appendChild(top);

    card.appendChild(el("p", "question-text", question.text));
    card.appendChild(el("p", "question-meta",
      "Asked by " + authorText(question) + " · " + formatTime(question.createdAt)));

    // Bottom row: votes
    var bottom = el("div", "card-bottom");
    if (options.onVote && !isOwn) {
      // PBI-05: upvote button (press again to undo)
      var voted = Store.hasVoted(question, options.viewerId);
      var button = el("button", "vote-btn");
      button.type = "button";
      button.setAttribute("aria-pressed", voted ? "true" : "false");
      var arrow = el("span", "vote-icon", "▲");
      arrow.setAttribute("aria-hidden", "true");
      button.appendChild(arrow);
      button.appendChild(el("span", "", voted ? " Upvoted" : " Upvote"));
      button.appendChild(el("span", "vote-count", " · " + voteText(votes)));
      button.addEventListener("click", function () {
        options.onVote(question);
      });
      bottom.appendChild(button);
    } else {
      // PBI-05 / PBI-07: vote count only (own question, or lecturer view)
      var total = el("span", "vote-total");
      var icon = el("span", "vote-icon", "▲ ");
      icon.setAttribute("aria-hidden", "true");
      total.appendChild(icon);
      total.appendChild(el("span", "", voteText(votes)));
      bottom.appendChild(total);
      if (isOwn && options.onVote) {
        bottom.appendChild(el("span", "hint small", "You cannot upvote your own question"));
      }
    }
    card.appendChild(bottom);
    return card;
  }

  // PBI-04 / PBI-07: sort helpers shared by both pages.
  function sortByNewest(a, b) {
    return b.createdAt - a.createdAt;
  }

  function sortByVotes(a, b) {
    return Store.voteCount(b) - Store.voteCount(a) || sortByNewest(a, b);
  }

  return {
    STATUS_INFO: STATUS_INFO,
    clear: clear,
    authorText: authorText,
    createStatusLabel: createStatusLabel,
    createStatusLegend: createStatusLegend,
    createQuestionCard: createQuestionCard,
    sortByNewest: sortByNewest,
    sortByVotes: sortByVotes
  };
})();
