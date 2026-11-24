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
  //   updated  – true to highlight a card whose status just changed (Sprint 3)
  //   note     – extra explanation shown on the card, e.g. why it was merged (Sprint 3)
  function createQuestionCard(question, options) {
    options = options || {};
    var isOwn = !!options.viewerId && question.studentId === options.viewerId;
    var votes = Store.voteCount(question);

    var card = el("li", "question-card" + (options.updated ? " card-updated" : ""));
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
    // Sprint 2 retrospective: make status changes clearer (word, not only colour).
    if (options.updated) {
      top.appendChild(el("span", "tag tag-updated", "Updated"));
    }
    // PBI-08: moderation tags.
    if (question.mergedInto) {
      top.appendChild(el("span", "tag tag-removed", "Merged"));
    } else if (question.hidden) {
      top.appendChild(el("span", "tag tag-removed", "Hidden"));
    }
    card.appendChild(top);

    var textNode = el("p", "question-text", question.text);
    textNode.id = "qtext-" + question.id; // lets buttons refer to the question (aria-describedby)
    card.appendChild(textNode);
    card.appendChild(el("p", "question-meta",
      "Asked by " + authorText(question) + " · " + formatTime(question.createdAt)));

    // PBI-08: a kept question shows how many duplicates were merged into it.
    var merged = question.mergedFrom ? question.mergedFrom.length : 0;
    if (merged > 0) {
      card.appendChild(el("p", "question-meta",
        "Combined with " + merged + (merged === 1 ? " similar question" : " similar questions")));
    }
    if (options.note) {
      card.appendChild(el("p", "card-note", options.note));
    }

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

  // PBI-07 (Sprint 3): lecturer priority – unhandled questions first,
  // answered questions sink to the bottom; most votes first inside each status.
  function sortByPriority(a, b) {
    return Store.STATUSES.indexOf(a.status) - Store.STATUSES.indexOf(b.status) || sortByVotes(a, b);
  }

  // Short version of a question for messages, e.g. "How many story points…"
  function shortText(question) {
    return question.text.length > 60 ? question.text.slice(0, 57) + "…" : question.text;
  }

  return {
    STATUS_INFO: STATUS_INFO,
    el: el,
    shortText: shortText,
    sortByPriority: sortByPriority,
    clear: clear,
    authorText: authorText,
    createStatusLabel: createStatusLabel,
    createStatusLegend: createStatusLegend,
    createQuestionCard: createQuestionCard,
    sortByNewest: sortByNewest,
    sortByVotes: sortByVotes
  };
})();
