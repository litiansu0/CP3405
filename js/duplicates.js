// js/duplicates.js – PBI-08: find possible duplicate questions.
// This is NOT AI. It is simple word matching:
//   1. lower-case the text and remove punctuation
//   2. remove common words ("how", "the", "should", ...)
//   3. compare the remaining key words of two questions
// score = shared key words / all key words of both questions (0 – 1).
// The lecturer always makes the final decision (merge or keep both).

var Duplicates = (function () {
  var MIN_SCORE = 0.5;   // at least half of the key words are the same
  var MIN_SHARED = 2;    // and at least two key words in common

  var COMMON_WORDS = [
    "a", "an", "the", "and", "or", "but", "if", "of", "to", "in", "on", "at", "for",
    "with", "by", "from", "about", "into", "as", "so", "not", "no", "just", "also",
    "than", "then", "is", "are", "was", "were", "be", "been", "being", "am",
    "do", "does", "did", "done", "can", "could", "should", "would", "will", "shall",
    "may", "might", "must", "have", "has", "had", "get", "got", "put", "make",
    "i", "me", "my", "we", "us", "our", "you", "your", "he", "she", "it", "its",
    "they", "them", "their", "this", "that", "these", "those", "there", "here",
    "what", "which", "who", "whom", "how", "why", "when", "where",
    "many", "much", "one", "some", "any", "all", "each", "every", "very", "really",
    "still", "only", "need", "please"
  ];

  // Key words of a question, e.g.
  // "How many story points should one sprint have?" -> ["story", "point", "sprint"]
  function keyWords(text) {
    var words = String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
    var result = [];
    words.forEach(function (word) {
      if (word.length < 2 || COMMON_WORDS.indexOf(word) !== -1) {
        return;
      }
      // Very simple plural handling: "points" -> "point" (but keep "class").
      if (word.length > 3 && /[^s]s$/.test(word)) {
        word = word.slice(0, -1);
      }
      if (result.indexOf(word) === -1) {
        result.push(word);
      }
    });
    return result;
  }

  // Compare two questions. Returns { score, shared }.
  function compare(textA, textB) {
    var wordsA = keyWords(textA);
    var wordsB = keyWords(textB);
    var shared = wordsA.filter(function (w) {
      return wordsB.indexOf(w) !== -1;
    });
    var total = wordsA.length + wordsB.length - shared.length;
    return { score: total === 0 ? 0 : shared.length / total, shared: shared };
  }

  // All possible duplicate pairs in a list of (visible) questions.
  // isKeptPair(idA, idB) -> true when the lecturer already chose "keep both".
  // In each pair, "a" is the question with more votes (suggested to keep).
  function findPairs(questions, isKeptPair) {
    var pairs = [];
    for (var i = 0; i < questions.length; i++) {
      for (var j = i + 1; j < questions.length; j++) {
        var a = questions[i];
        var b = questions[j];
        if (isKeptPair(a.id, b.id)) {
          continue;
        }
        var result = compare(a.text, b.text);
        if (result.score >= MIN_SCORE && result.shared.length >= MIN_SHARED) {
          var aFirst = Store.voteCount(a) > Store.voteCount(b) ||
            (Store.voteCount(a) === Store.voteCount(b) && a.createdAt <= b.createdAt);
          pairs.push({
            a: aFirst ? a : b,
            b: aFirst ? b : a,
            score: result.score,
            shared: result.shared
          });
        }
      }
    }
    pairs.sort(function (x, y) {
      return y.score - x.score;
    });
    return pairs;
  }

  return {
    keyWords: keyWords,
    compare: compare,
    findPairs: findPairs
  };
})();
