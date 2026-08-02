// McPhee — drop-in, dictionary-based spell highlighting + one-click local
// fixes for any <textarea>, no build step, no server, no framework.
//
// Named for John McPhee, who ran Kedit's All command over every piece to see
// each use of a chosen word and the distance between occurrences: a
// distinctive word got one appearance per piece, and bunched ordinary words
// got respaced ("Draft No. 4", essay "Structure"). The repetition detectors
// below automate that check. Known as SpellWell through v1.5.0.
//
// CANONICAL HOME: C:\proj\mcphee (git). Consumer projects receive verbatim
// copies of this folder; check McPhee.version against the canonical
// CHANGELOG.md to see how far behind a copy is.
//
// Origin: grown out of the fuseki4_ai article-editor prototype (typo-js +
// Hunspell en_US + localStorage custom dictionary) and the stalin-mode.html
// screenshot editor; packaged so it can be copied into any project as a
// folder (mcphee.js + mcphee.css + vendor/typo/{typo.min.js,en_US.aff,
// en_US.dic}).
//
// Usage:
//   <link rel="stylesheet" href="mcphee/mcphee.css">
//   <script src="mcphee/vendor/typo/typo.min.js"></script>
//   <script src="mcphee/mcphee.js"></script>
//   const sw = await McPhee.create({
//     affUrl: "mcphee/vendor/typo/en_US.aff",
//     dicUrl: "mcphee/vendor/typo/en_US.dic",
//     freqUrl: "mcphee/vendor/wordfreq/en-30k.txt", // optional; powers the
//                                                      // repetition detectors
//     extraWords: ["recraft", "grok"],            // project jargon, always ok
//     customDictStorageKey: "myapp_mcphee",     // localStorage, user-grown
//     profile: "standard",                         // default rule profile
//   });
//   const ctl = sw.attach(document.querySelector("textarea"));
//   const panel = sw.attachPanel({ textarea, container, controller: ctl });
//   const guard = sw.guardForm(form, { blockOn: ["misspelled"], watch: true });
//   sw.applyFixes(textarea);   // undo-preserving one-click fix
//
// Rule profiles (see McPhee.profiles):
//   standard  misspelled + unknown + doublespace + echo + obscureRepeat
//   strict    standard + sentenceCapitalization + terminalPunctuation
//   casual    misspelled + doublespace only — no unknown-word nagging, no
//             capitalization/punctuation rules, no repetition detectors (for
//             contexts where lowercase proper nouns and unpunctuated prose
//             are intentional)
// Any create/attach/analyze call takes { profile } or { rules: {...} }
// overrides; word lists (extraWords, custom dictionary) always apply.
//
// Repetition detectors (the McPhee rules — a distinctive word ordinarily
// earns one appearance per piece, and bunched ordinary words betray the ear):
//   echo           the same content word (case/possessive/plural-folded)
//                  reappears within echoWindowWords words (default 50).
//                  Function words and words ranked more common than
//                  echoCommonRank (default 2000) in the frequency list are
//                  exempt.
//   obscureRepeat  a dictionary word ranked rarer than obscureRank (default
//                  10000) — or absent from the frequency list entirely —
//                  used 2+ times anywhere in the text. Requires freqUrl.
// Personal-dictionary and extraWords entries are exempt from both (they are
// the text's topic vocabulary). There is no autofix — word choice is the
// author's call; the panel offers hover-to-scroll and a session-scoped
// dismiss per word (checker.ignoreRepeat(word)).
//
// Highlighting model (deliberately NOT the browser's red squiggles):
//   .mcphee-mark-misspelled      lowercase word not in any dictionary -> pink
//   .mcphee-mark-unknown         not in dictionary but plausibly meant -> blue
//                                   (Capitalized, ALLCAPS, camelCase)
//   .mcphee-mark-doublespace     an ILLEGITIMATE extra-space run, marked as
//                                   ONE joined yellow rectangle (no internal
//                                   divisions). Two legitimate space patterns
//                                   are never flagged: exactly two spaces
//                                   after sentence-ending punctuation (the
//                                   author double-spaces sentences on
//                                   purpose) and line-leading indentation
//                                   (Markdown code blocks / list continuations)
//   .mcphee-mark-capitalization  lowercase sentence-start word -> orange
//   .mcphee-mark-punctuation     text ends without terminal punctuation
//                                   (last character boxed) -> orange outline
//   .mcphee-mark-echo            same word reused nearby -> lavender
//   .mcphee-mark-obscure         rare word reused in the text -> green
// The overlay renders BEHIND the textarea (transparent text, colored
// backgrounds only), so typing latency and native selection are untouched.

var McPhee = (function () {
  "use strict";

  var VERSION = "2.0.0";

  var WORD_RE = /[A-Za-z]+(?:['\u2019][A-Za-z]+)*/g;
  var TOKEN_RE = /([A-Za-z]+(?:['\u2019][A-Za-z]+)*)|( {2,})/g;
  var SENTENCE_START_RE = /(?:^|[.!?\u2026]["')\]]?\s+)([a-z])/g;
  var TERMINAL_PUNCT_RE = /[.!?\u2026:;"'\u2019\u201d)\]]$/;
  var SENTENCE_ENDS = ".!?\u2026";
  var TRAILING_CLOSERS = "\"'\u2019\u201d)]";

  // Named rule profiles. "standard" is the historical behavior; "strict" adds
  // the capitalization/punctuation rules; "casual" is the no-nagging mode for
  // contexts where lowercase proper nouns and unpunctuated prose are the
  // author's intent.
  var PROFILES = {
    standard: {
      misspelled: true, unknown: true, doublespace: true,
      sentenceCapitalization: false, terminalPunctuation: false,
      echo: true, obscureRepeat: true,
    },
    strict: {
      misspelled: true, unknown: true, doublespace: true,
      sentenceCapitalization: true, terminalPunctuation: true,
      echo: true, obscureRepeat: true,
    },
    casual: {
      misspelled: true, unknown: false, doublespace: true,
      sentenceCapitalization: false, terminalPunctuation: false,
      echo: false, obscureRepeat: false,
    },
  };

  // Function words that repeat constantly in healthy prose; never echo
  // candidates even without a frequency list. Content words only get past
  // this AND the echoCommonRank frequency gate.
  var STOPWORDS = new Set(("a about above after again against all also although always am an and any are around as at be because been before being below between both but by came can cannot come could day did do does doing down during each even every few first for from get give go good got had has have having he her here hers herself him himself his how however i if in into is it its itself just know like little long made make many may me might more most much must my myself never new no nor not now of off on once one only onto or other our ours ourselves out over own said same see she should since so some still such take than that the their theirs them themselves then there these they this those through time to too two under until up upon us used very was way we well went were what when where which while who whom why will with without would year you your yours yourself yourselves").split(" "));

  // Lowercases and strips a possessive; the shared normal form for the
  // repetition detectors.
  function normWord(word) {
    var n = word.toLowerCase().replace(/\u2019/g, "'");
    if (n.slice(-2) === "'s") n = n.slice(0, -2);
    return n;
  }

  // Naive plural fold: "leopards" counts as another "leopard". Only strips a
  // bare trailing s from longer words, so short words and double-s words are
  // left alone; good enough for repetition detection, not for grammar.
  function pluralKey(norm) {
    return norm.length > 4 && norm.slice(-1) === "s" && norm.slice(-2) !== "ss"
      ? norm.slice(0, -1) : norm;
  }

  // Classic finger-slips whose right answer typo-js ranks poorly or misses
  // entirely (its suggest() for "teh" doesn't even include "the"). Checked
  // before the suggestion machinery; extensible per-project via
  // options.autofixMap.
  var COMMON_TYPOS = {
    teh: "the", hte: "the", taht: "that", thsi: "this", tihs: "this",
    adn: "and", jsut: "just", waht: "what", wiht: "with", thier: "their",
    woudl: "would", coudl: "could", beleive: "believe", untill: "until",
    wierd: "weird", becuase: "because", tommorow: "tomorrow", tommorrow: "tomorrow",
    dont: "don't", doesnt: "doesn't", isnt: "isn't", didnt: "didn't",
    wasnt: "wasn't", couldnt: "couldn't", wouldnt: "wouldn't", shouldnt: "shouldn't",
  };

  // Optimal-string-alignment distance (Levenshtein + adjacent transposition
  // counted as 1), which is what typing errors actually look like.
  function editDistance(a, b) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 2) return 3;
    var d = [];
    for (var i = 0; i <= la; i++) { d[i] = [i]; }
    for (var j = 0; j <= lb; j++) { d[0][j] = j; }
    for (i = 1; i <= la; i++) {
      for (j = 1; j <= lb; j++) {
        var cost = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[la][lb];
  }

  // True when b is a by exactly one adjacent-character swap (teh/the,
  // recieve/receive, wierd/weird) — the single most characteristic typo.
  function isAdjacentTransposition(a, b) {
    if (a.length !== b.length || a === b) return false;
    for (var i = 0; i < a.length - 1; i++) {
      if (a[i] !== b[i]) {
        return a[i] === b[i + 1] && a[i + 1] === b[i]
          && a.slice(i + 2) === b.slice(i + 2);
      }
    }
    return false;
  }

  function sharedPrefixSuffixLength(a, b) {
    var prefix = 0;
    while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
    var suffix = 0;
    while (suffix < a.length - prefix && suffix < b.length - prefix
      && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
    return prefix + suffix;
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Classifies a run of 2+ spaces. Returns null when the run is legitimate:
  // line-leading indentation (start of text or right after a newline), or a
  // deliberate two-space sentence separator — exactly two spaces following
  // sentence-ending punctuation, closing quotes/brackets allowed in between.
  // Violations return the string the run should collapse to: a sentence
  // separator that grew to 3+ spaces collapses back to two, everything else
  // to one.
  function classifySpaceRun(text, start, length) {
    if (start === 0 || text.charAt(start - 1) === "\n") return null;
    var i = start - 1;
    while (i >= 0 && TRAILING_CLOSERS.indexOf(text.charAt(i)) !== -1) i--;
    var afterSentence = i >= 0 && SENTENCE_ENDS.indexOf(text.charAt(i)) !== -1;
    if (afterSentence && length === 2) return null;
    return { collapseTo: afterSentence ? "  " : " " };
  }

  // Character offsets of every lowercase letter that begins a sentence.
  function sentenceStartOffsets(text) {
    var offsets = new Set();
    SENTENCE_START_RE.lastIndex = 0;
    var m;
    while ((m = SENTENCE_START_RE.exec(text)) !== null) {
      offsets.add(m.index + m[0].length - 1);
    }
    return offsets;
  }

  // Replaces textarea[start..end) with `replacement` through the browser's
  // editing pipeline so the native undo stack survives (direct .value writes
  // detach it — the original fuseki prototype's replaceWord bug).
  // execCommand("insertText") is deprecated but remains the only
  // undo-integrated programmatic edit; setRangeText is the fallback.
  function replaceRange(textarea, start, end, replacement) {
    textarea.focus();
    textarea.setSelectionRange(start, end);
    var ok = false;
    try {
      ok = document.execCommand("insertText", false, replacement);
    } catch (e) { ok = false; }
    if (!ok) {
      textarea.setRangeText(replacement, start, end, "end");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function Checker(dict, options, freqRank) {
    this.dict = dict;
    this.extraWords = new Set((options.extraWords || []).map(function (w) { return w.toLowerCase(); }));
    this.storageKey = options.customDictStorageKey || "mcphee_custom_dict";
    this.autofixMap = Object.assign({}, COMMON_TYPOS, options.autofixMap || {});
    this.defaultRules = this.resolveRules(options);
    this.suggestionCache = new Map();
    this.customWords = new Set();
    this.loadCustomDict();
    // Repetition-detector state: word -> frequency rank (1 = most common),
    // tuning knobs, and the session's "this repetition is deliberate" set.
    this.freqRank = freqRank || null;
    this.echoWindowWords = options.echoWindowWords || 50;
    this.echoCommonRank = options.echoCommonRank || 2000;
    this.obscureRank = options.obscureRank || 10000;
    this.ignoredRepeats = new Set();
  }

  // Session-scoped: silences echo/obscureRepeat for this word until reload.
  // Permanent exemption = add the word to the personal dictionary.
  Checker.prototype.ignoreRepeat = function (word) {
    this.ignoredRepeats.add(pluralKey(normWord(String(word))));
  };

  // Frequency rank of a word's normal form, plural-folded; Infinity when the
  // word is rarer than the vendored list, null when no list was loaded.
  Checker.prototype.rankOf = function (norm) {
    if (!this.freqRank) return null;
    var r = this.freqRank.get(norm);
    if (r === undefined) r = this.freqRank.get(pluralKey(norm));
    return r === undefined ? Infinity : r;
  };

  // opts may carry { profile: "strict" } and/or { rules: { unknown: false } };
  // rules win over the profile, the profile wins over the instance default.
  Checker.prototype.resolveRules = function (opts) {
    opts = opts || {};
    var base = this.defaultRules || PROFILES.standard;
    if (opts.profile) {
      if (!PROFILES[opts.profile]) throw new Error("McPhee: unknown profile '" + opts.profile + "'");
      base = PROFILES[opts.profile];
    }
    return Object.assign({}, base, opts.rules || {});
  };

  Checker.prototype.loadCustomDict = function () {
    try {
      var stored = JSON.parse(localStorage.getItem(this.storageKey) || "[]");
      this.customWords = new Set(stored.map(function (w) { return String(w).toLowerCase(); }));
    } catch (e) {
      this.customWords = new Set();
    }
  };

  Checker.prototype.saveCustomDict = function () {
    localStorage.setItem(this.storageKey, JSON.stringify(Array.from(this.customWords).sort()));
  };

  Checker.prototype.addCustomWord = function (word) {
    this.customWords.add(String(word).toLowerCase());
    this.saveCustomDict();
  };

  Checker.prototype.removeCustomWord = function (word) {
    this.customWords.delete(String(word).toLowerCase());
    this.saveCustomDict();
  };

  Checker.prototype.listCustomWords = function () {
    return Array.from(this.customWords).sort();
  };

  // Union-merge a word list into the custom dictionary (migration from older
  // storage keys, or a future remote dictionary pull — union is always safe
  // because the personal dictionary only grows; removals are explicit).
  Checker.prototype.importWords = function (words) {
    var self = this;
    var added = 0;
    (words || []).forEach(function (w) {
      var lower = String(w).toLowerCase();
      if (lower && !self.customWords.has(lower)) { self.customWords.add(lower); added++; }
    });
    if (added) this.saveCustomDict();
    return added;
  };

  // "ok" | "misspelled" | "unknown". Deliberately heuristic and predictable:
  // a plain-lowercase word the dictionary doesn't know is a misspelling
  // (pink); anything shaped like a name/acronym/identifier is unknown (blue).
  // Sentence-initial capitalized typos therefore read as unknown — acceptable
  // for the "don't nag me about proper nouns" trade this makes. A lowercase
  // word whose Capitalized form IS in the dictionary (english, virginians,
  // mainer) is also unknown, not misspelled: it's a casually-lowercased
  // proper noun, and "correcting" it to an unrelated word (english→anguish)
  // would be vandalism.
  Checker.prototype.classify = function (word) {
    if (word.length <= 1) return "ok";
    var lower = word.toLowerCase();
    var normalizedApostrophe = lower.replace(/\u2019/g, "'");
    if (this.customWords.has(normalizedApostrophe) || this.extraWords.has(normalizedApostrophe)) return "ok";
    var plain = word.replace(/\u2019/g, "'");
    if (this.dict.check(plain)) return "ok";
    if (plain !== normalizedApostrophe && this.dict.check(normalizedApostrophe)) return "ok";
    if (word !== lower) return "unknown";
    if (this.dict.check(plain.charAt(0).toUpperCase() + plain.slice(1))) return "unknown";
    return "misspelled";
  };

  Checker.prototype.suggest = function (word, limit) {
    var key = word + "\u0000" + (limit || 3);
    if (!this.suggestionCache.has(key)) {
      this.suggestionCache.set(key, this.dict.suggest(word.replace(/\u2019/g, "'"), limit || 3));
    }
    return this.suggestionCache.get(key);
  };

  // Tokenizes text into issue entries { kind, value, start, end,
  // classification? } filtered by the active rules. Kinds:
  //   word           misclassified word (classification: misspelled|unknown)
  //   doublespace    an illegitimate extra-space run (sentence-separator
  //                  double spaces and line-leading indentation are fine;
  //                  the issue carries collapseTo, the run's correct form)
  //   capitalization lowercase sentence-start word that IS in the dictionary
  //   punctuation    the text ends without terminal punctuation
  //   echo           same content word reused within echoWindowWords words
  //                  (carries norm + distance, both occurrences flagged)
  //   obscure        rare word (rank >= obscureRank or unranked) used 2+
  //                  times anywhere (carries norm + count, all flagged)
  // Only issues are returned; clean text yields [].
  Checker.prototype.analyze = function (text, opts) {
    var rules = this.resolveRules(opts);
    var issues = [];
    var words = [];
    var starts = rules.sentenceCapitalization ? sentenceStartOffsets(text) : null;
    TOKEN_RE.lastIndex = 0;
    var m;
    while ((m = TOKEN_RE.exec(text)) !== null) {
      if (m[1] !== undefined) {
        var cls = this.classify(m[1]);
        words.push({ value: m[1], start: m.index, end: m.index + m[1].length, cls: cls });
        if (cls !== "ok" && rules[cls]) {
          issues.push({ kind: "word", value: m[1], start: m.index, end: m.index + m[1].length, classification: cls });
        } else if (starts && starts.has(m.index) && cls === "ok") {
          // Only dictionary words get the capitalization nag; a misspelled or
          // unknown sentence-start word is already flagged (or muted) above.
          issues.push({ kind: "capitalization", value: m[1], start: m.index, end: m.index + m[1].length, classification: "capitalization" });
        }
      } else if (rules.doublespace) {
        var run = classifySpaceRun(text, m.index, m[2].length);
        if (run) {
          issues.push({ kind: "doublespace", value: m[2], start: m.index, end: m.index + m[2].length, collapseTo: run.collapseTo });
        }
      }
    }
    if (rules.echo || rules.obscureRepeat) {
      this.addRepetitionIssues(words, rules, issues);
    }
    if (rules.terminalPunctuation) {
      var trimmed = text.replace(/\s+$/, "");
      if (trimmed.length && !TERMINAL_PUNCT_RE.test(trimmed)) {
        issues.push({ kind: "punctuation", value: trimmed.slice(-1), start: trimmed.length - 1, end: trimmed.length, classification: "punctuation" });
      }
    }
    return issues;
  };

  // The McPhee detectors. Both work on the words the dictionary already
  // accepts (misspellings are someone else's problem) minus function words,
  // dictionary/jargon words, and session-dismissed words.
  //   echo:          keep the last position of each normal form; a
  //                  reappearance within echoWindowWords words flags BOTH
  //                  occurrences. Words more common than echoCommonRank are
  //                  exempt when a frequency list is loaded.
  //   obscureRepeat: count plural-folded occurrences of words rarer than
  //                  obscureRank; 2+ uses flag every occurrence not already
  //                  flagged as an echo. Needs the frequency list — without
  //                  it there is no notion of "obscure".
  Checker.prototype.addRepetitionIssues = function (words, rules, issues) {
    var norms = new Array(words.length);
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.cls !== "ok") { norms[i] = null; continue; }
      var n = normWord(w.value);
      if (n.length < 4 || STOPWORDS.has(n)
        || this.customWords.has(n) || this.extraWords.has(n)
        || this.ignoredRepeats.has(pluralKey(n))) { norms[i] = null; continue; }
      norms[i] = n;
    }
    var echoFlagged = new Set();
    if (rules.echo) {
      var lastSeen = new Map(); // plural-folded key -> last word index
      for (i = 0; i < words.length; i++) {
        var norm = norms[i];
        if (!norm) continue;
        var rank = this.rankOf(norm);
        if (rank !== null && rank < this.echoCommonRank) continue;
        var key = pluralKey(norm);
        var prev = lastSeen.get(key);
        if (prev !== undefined && i - prev <= this.echoWindowWords) {
          var distance = i - prev;
          if (!echoFlagged.has(prev)) {
            echoFlagged.add(prev);
            issues.push({ kind: "echo", value: words[prev].value, start: words[prev].start, end: words[prev].end, classification: "echo", norm: key, distance: distance });
          }
          echoFlagged.add(i);
          issues.push({ kind: "echo", value: words[i].value, start: words[i].start, end: words[i].end, classification: "echo", norm: key, distance: distance });
        }
        lastSeen.set(key, i);
      }
    }
    if (rules.obscureRepeat && this.freqRank) {
      var occurrences = new Map(); // plural-folded key -> word indexes
      for (i = 0; i < words.length; i++) {
        var n2 = norms[i];
        if (!n2 || echoFlagged.has(i)) continue;
        if (this.rankOf(n2) < this.obscureRank) continue;
        var k2 = pluralKey(n2);
        if (!occurrences.has(k2)) occurrences.set(k2, []);
        occurrences.get(k2).push(i);
      }
      occurrences.forEach(function (idxs, key) {
        if (idxs.length < 2) return;
        idxs.forEach(function (wi) {
          issues.push({ kind: "obscure", value: words[wi].value, start: words[wi].start, end: words[wi].end, classification: "obscure", norm: key, count: idxs.length });
        });
      });
    }
  };

  // Picks a correction for a misspelled word, or null when nothing is safe to
  // apply. Precision over recall — a wrong "fix" is worse than a highlight:
  //   1. the common-typos map wins outright (typo-js ranks these badly);
  //   2. otherwise take typo-js suggestions within edit distance 2 and keep
  //      the minimum-distance ones (transposition counts as 1 edit);
  //   3. a distance tie prefers a UNIQUE adjacent-transposition candidate
  //      (recieve→receive beats relieve; wierd→weird beats wield), then a
  //      strictly longer shared prefix+suffix; anything still ambiguous is
  //      left alone and stays highlighted rather than guessed.
  Checker.prototype.pickCorrection = function (word) {
    var mapped = this.autofixMap[word.toLowerCase()];
    if (mapped) return mapped;
    var suggestions = this.suggest(word, 8) || [];
    var lower = word.toLowerCase();
    var bestDistance = 3;
    for (var i = 0; i < suggestions.length; i++) {
      bestDistance = Math.min(bestDistance, editDistance(lower, suggestions[i].toLowerCase()));
    }
    if (bestDistance >= 3) return null;
    var candidates = suggestions.filter(function (s) { return editDistance(lower, s.toLowerCase()) === bestDistance; });
    if (candidates.length === 1) return candidates[0];
    var transpositions = candidates.filter(function (s) { return isAdjacentTransposition(lower, s.toLowerCase()); });
    if (transpositions.length === 1) return transpositions[0];
    candidates.sort(function (a, b) {
      return sharedPrefixSuffixLength(lower, b.toLowerCase()) - sharedPrefixSuffixLength(lower, a.toLowerCase());
    });
    var top = sharedPrefixSuffixLength(lower, candidates[0].toLowerCase());
    var second = sharedPrefixSuffixLength(lower, candidates[1].toLowerCase());
    return top > second ? candidates[0] : null;
  };

  // One-click local fix: collapse every illegitimate extra-space run
  // (sentence separators back to two spaces, everything else to one;
  // legitimate sentence double-spaces and indentation untouched), replace
  // each pink (misspelled) word with a confidently-chosen correction (see
  // pickCorrection), and — when the sentenceCapitalization rule is on —
  // capitalize lowercase dictionary words that start a sentence. Ambiguous
  // words, words with no usable suggestion, and blue (unknown) words are left
  // alone; missing terminal punctuation is never auto-fixed (. vs ? vs ! is a
  // guess). Returns the new text plus an exact change list so the caller can
  // report and undo.
  Checker.prototype.localFix = function (text, opts) {
    var rules = this.resolveRules(opts);
    var wordChanges = [];
    var self = this;
    var starts = rules.sentenceCapitalization ? sentenceStartOffsets(text) : null;
    var fixedWords = text.replace(WORD_RE, function (word, offset) {
      var cls = self.classify(word);
      if (cls === "misspelled" && rules.misspelled) {
        var correction = self.pickCorrection(word);
        if (correction) {
          wordChanges.push({ from: word, to: correction, offset: offset });
          return correction;
        }
        return word;
      }
      if (starts && starts.has(offset) && cls === "ok") {
        var capitalized = word.charAt(0).toUpperCase() + word.slice(1);
        wordChanges.push({ from: word, to: capitalized, offset: offset });
        return capitalized;
      }
      return word;
    });
    var spaceRuns = 0;
    var fixed = rules.doublespace
      ? fixedWords.replace(/ {2,}/g, function (run, offset) {
          var v = classifySpaceRun(fixedWords, offset, run.length);
          if (!v) return run;
          spaceRuns++;
          return v.collapseTo;
        })
      : fixedWords;
    return { text: fixed, wordChanges: wordChanges, spaceRuns: spaceRuns };
  };

  // localFix applied straight to a textarea through the undo-preserving
  // editing pipeline (one undo step). Returns the localFix result with an
  // extra `applied` flag.
  Checker.prototype.applyFixes = function (textarea, opts) {
    var fix = this.localFix(textarea.value, opts);
    fix.applied = fix.text !== textarea.value;
    if (fix.applied) {
      replaceRange(textarea, 0, textarea.value.length, fix.text);
    }
    return fix;
  };

  // ---------- overlay rendering ----------

  var MIRRORED_STYLES = [
    "fontFamily", "fontSize", "fontWeight", "fontStyle", "letterSpacing",
    "lineHeight", "textTransform", "wordSpacing", "textIndent",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "borderRadius", "boxSizing",
  ];

  Checker.prototype.renderHtml = function (text, opts) {
    var issues = this.analyze(text, opts);
    // Issues can overlap only at the tail (punctuation over a flagged last
    // word); keep the earlier-starting issue and drop the overlapper.
    issues.sort(function (a, b) { return a.start - b.start || a.end - b.end; });
    var out = [];
    var last = 0;
    for (var i = 0; i < issues.length; i++) {
      var issue = issues[i];
      if (issue.start < last) continue;
      out.push(escapeHtml(text.slice(last, issue.start)));
      if (issue.kind === "doublespace") {
        // The whole illegitimate run is one joined rectangle — no internal
        // divisions.
        out.push('<mark class="mcphee-mark-doublespace">'
          + text.slice(issue.start, issue.end) + "</mark>");
      } else {
        var cls = issue.kind === "word" ? issue.classification : issue.kind;
        out.push('<mark class="mcphee-mark-' + cls + '">'
          + escapeHtml(text.slice(issue.start, issue.end)) + "</mark>");
      }
      last = issue.end;
    }
    out.push(escapeHtml(text.slice(last)));
    // A trailing newline needs a visible line for scroll-height parity.
    out.push("\n");
    return out.join("");
  };

  // Wraps the textarea in a positioning host and slides a mirrored backdrop
  // underneath it. The textarea keeps focus/selection/native behavior; only
  // its background becomes transparent so the marks show through.
  Checker.prototype.attach = function (textarea, opts) {
    var self = this;
    var renderOpts = { rules: this.resolveRules(opts) };
    var computed = getComputedStyle(textarea);

    var host = document.createElement("div");
    host.className = "mcphee-host";
    var backdrop = document.createElement("div");
    backdrop.className = "mcphee-backdrop";
    backdrop.setAttribute("aria-hidden", "true");

    MIRRORED_STYLES.forEach(function (prop) {
      backdrop.style[prop] = computed[prop];
    });
    backdrop.style.background = computed.backgroundColor;

    textarea.parentNode.insertBefore(host, textarea);
    host.appendChild(backdrop);
    host.appendChild(textarea);
    textarea.classList.add("mcphee-textarea");
    // McPhee's marks replace the browser's red squiggles.
    textarea.spellcheck = false;

    var lastRendered = null;
    var enabled = true;

    // The backdrop must mirror the textarea's CLIENT box (plus borders), not
    // its offset box: a vertical scrollbar shrinks the client width and would
    // otherwise skew where lines wrap.
    function syncGeometry() {
      var bl = parseFloat(computed.borderLeftWidth) || 0;
      var br = parseFloat(computed.borderRightWidth) || 0;
      var bt = parseFloat(computed.borderTopWidth) || 0;
      var bb = parseFloat(computed.borderBottomWidth) || 0;
      backdrop.style.width = (textarea.clientWidth + bl + br) + "px";
      backdrop.style.height = (textarea.clientHeight + bt + bb) + "px";
    }

    function refresh(force) {
      if (!enabled) return;
      if (force === true || textarea.value !== lastRendered) {
        lastRendered = textarea.value;
        backdrop.innerHTML = self.renderHtml(textarea.value, renderOpts);
        syncGeometry();
      }
      backdrop.scrollTop = textarea.scrollTop;
      backdrop.scrollLeft = textarea.scrollLeft;
    }

    function onEvent() { refresh(); }

    textarea.addEventListener("input", onEvent);
    textarea.addEventListener("scroll", onEvent);
    var resizeObserver = new ResizeObserver(function () {
      syncGeometry();
      refresh();
    });
    resizeObserver.observe(textarea);
    // Programmatic .value writes fire no event; a light poll keeps the
    // overlay honest without every caller having to remember refresh().
    var pollTimer = setInterval(refresh, 700);
    refresh();

    // Scrolls the textarea so the character at `offset` sits roughly a third
    // of the way down the view. The backdrop mirrors the textarea's exact
    // wrapping, so a collapsed Range over its text nodes gives the true pixel
    // position of any character offset.
    function scrollToOffset(offset) {
      if (!enabled) return;
      refresh();
      var walker = document.createTreeWalker(backdrop, NodeFilter.SHOW_TEXT);
      var remaining = offset;
      var node;
      while ((node = walker.nextNode())) {
        var len = node.nodeValue.length;
        if (remaining <= len) {
          var range = document.createRange();
          range.setStart(node, Math.max(0, Math.min(remaining, len)));
          range.collapse(true);
          var rect = range.getBoundingClientRect();
          var backdropRect = backdrop.getBoundingClientRect();
          var y = rect.top - backdropRect.top + backdrop.scrollTop;
          textarea.scrollTop = Math.max(0, y - textarea.clientHeight / 3);
          refresh();
          return;
        }
        remaining -= len;
      }
    }

    return {
      // refresh(true) forces a re-render (e.g. after addCustomWord, which
      // changes classification without changing the text).
      refresh: refresh,
      scrollToOffset: scrollToOffset,
      setRules: function (o) {
        renderOpts.rules = self.resolveRules(o);
        refresh(true);
      },
      setEnabled: function (on) {
        enabled = !!on;
        backdrop.style.visibility = enabled ? "visible" : "hidden";
        textarea.spellcheck = !enabled;
        if (enabled) { lastRendered = null; refresh(); }
      },
      detach: function () {
        clearInterval(pollTimer);
        resizeObserver.disconnect();
        textarea.removeEventListener("input", onEvent);
        textarea.removeEventListener("scroll", onEvent);
        textarea.classList.remove("mcphee-textarea");
        textarea.spellcheck = true;
        host.parentNode.insertBefore(textarea, host);
        host.remove();
      },
    };
  };

  // ---------- issues panel ----------

  // Live issue list with per-word actions: suggestion buttons (replace all
  // occurrences, undo-preserving), add-to-dictionary for misspelled/unknown
  // words, capitalize for sentence-start nags, collapse for double spaces.
  // config: { textarea, container, controller?, profile?, rules?, onChange? }
  Checker.prototype.attachPanel = function (config) {
    var self = this;
    var textarea = config.textarea;
    var container = config.container;
    var analyzeOpts = { rules: this.resolveRules(config) };

    container.classList.add("mcphee-panel");

    function refreshOverlay() {
      if (config.controller) config.controller.refresh(true);
    }

    function afterAction() {
      refreshOverlay();
      render();
      if (config.onChange) config.onChange();
    }

    function replaceAllOccurrences(word, replacement) {
      var re = new RegExp("\\b" + escapeRegExp(word) + "\\b", "g");
      var newText = textarea.value.replace(re, replacement);
      if (newText !== textarea.value) {
        replaceRange(textarea, 0, textarea.value.length, newText);
      }
      afterAction();
    }

    function button(label, className, onClick) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mcphee-panel-btn " + className;
      b.textContent = label;
      b.addEventListener("click", onClick);
      return b;
    }

    // Hovering a row scrolls the textarea to that issue's location so the
    // author can see what they'd be correcting.
    function scrollOnHover(row, offset) {
      if (!config.controller || !config.controller.scrollToOffset) return;
      row.addEventListener("mouseenter", function () {
        config.controller.scrollToOffset(offset);
      });
    }

    // "Move cursor here": focuses the textarea with the issue's text SELECTED
    // so the author can immediately retype over it. The issue is re-located
    // in the current value at click time (text may have moved since render).
    function selectButton(match) {
      return button("select", "mcphee-panel-select", function () {
        var current = self.analyze(textarea.value, analyzeOpts).find(match);
        if (!current) return;
        textarea.focus();
        textarea.setSelectionRange(current.start, current.end);
        if (config.controller && config.controller.scrollToOffset) {
          config.controller.scrollToOffset(current.start);
        }
      });
    }

    function wordRow(value, classification, count, firstStart) {
      var row = document.createElement("div");
      row.className = "mcphee-panel-item";
      scrollOnHover(row, firstStart);
      var label = document.createElement("span");
      label.className = "mcphee-panel-word mcphee-panel-word-" + classification;
      label.textContent = count > 1 ? value + " \u00d7" + count : value;
      row.appendChild(label);
      if (classification === "misspelled") {
        var seen = new Set();
        var preferred = self.pickCorrection(value);
        var suggestions = (preferred ? [preferred] : []).concat(self.suggest(value, 3) || []);
        suggestions.forEach(function (s) {
          var key = s.toLowerCase();
          if (seen.has(key) || seen.size >= 3) return;
          seen.add(key);
          row.appendChild(button(s, "mcphee-panel-suggestion", function () {
            replaceAllOccurrences(value, s);
          }));
        });
      }
      row.appendChild(button("+ dict", "mcphee-panel-adddict", function () {
        self.addCustomWord(value);
        afterAction();
      }));
      row.appendChild(selectButton(function (i) {
        return i.kind === "word" && i.value === value;
      }));
      return row;
    }

    function render() {
      var issues = self.analyze(textarea.value, analyzeOpts);
      container.innerHTML = "";

      var header = document.createElement("div");
      header.className = "mcphee-panel-header";
      header.textContent = issues.length
        ? issues.length + " issue" + (issues.length === 1 ? "" : "s")
        : "no issues";
      container.appendChild(header);

      // Group repeated words into a single row (remembering the first
      // occurrence so hover can scroll to it).
      var wordGroups = new Map();
      var repeatGroups = new Map(); // norm -> echo/obscure group
      var doubleSpaces = 0;
      var firstDoubleSpaceStart = null;
      issues.forEach(function (issue) {
        if (issue.kind === "word") {
          var key = issue.value + "\u0000" + issue.classification;
          var group = wordGroups.get(key);
          if (group) {
            group.count++;
          } else {
            wordGroups.set(key, { count: 1, start: issue.start });
          }
        } else if (issue.kind === "echo" || issue.kind === "obscure") {
          // An echo outranks an obscure row for the same word.
          var rg = repeatGroups.get(issue.norm);
          if (!rg || (issue.kind === "echo" && rg.kind === "obscure")) {
            rg = { kind: issue.kind, value: issue.value, count: 0, start: issue.start, distance: issue.distance };
            repeatGroups.set(issue.norm, rg);
          }
          if (issue.kind === rg.kind) {
            rg.count++;
            if (issue.distance !== undefined) {
              rg.distance = rg.distance === undefined ? issue.distance : Math.min(rg.distance, issue.distance);
            }
          }
        } else if (issue.kind === "doublespace") {
          doubleSpaces++;
          if (firstDoubleSpaceStart === null) firstDoubleSpaceStart = issue.start;
        }
      });

      wordGroups.forEach(function (group, key) {
        var parts = key.split("\u0000");
        container.appendChild(wordRow(parts[0], parts[1], group.count, group.start));
      });

      // Repetition rows: no autofix (word choice is the author's), just
      // hover-to-scroll plus a session dismiss.
      repeatGroups.forEach(function (group, norm) {
        var row = document.createElement("div");
        row.className = "mcphee-panel-item";
        scrollOnHover(row, group.start);
        var label = document.createElement("span");
        label.className = "mcphee-panel-word mcphee-panel-word-" + group.kind;
        label.textContent = group.kind === "echo"
          ? group.value + " \u00d7" + group.count + " \u00b7 " + group.distance + " word" + (group.distance === 1 ? "" : "s") + " apart"
          : group.value + " \u00d7" + group.count + " \u00b7 rare word reused";
        row.appendChild(label);
        row.appendChild(button("dismiss", "mcphee-panel-adddict", function () {
          self.ignoreRepeat(norm);
          afterAction();
        }));
        row.appendChild(selectButton(function (i) {
          return (i.kind === "echo" || i.kind === "obscure") && i.norm === norm;
        }));
        container.appendChild(row);
      });

      issues.forEach(function (issue) {
        if (issue.kind === "capitalization") {
          var row = document.createElement("div");
          row.className = "mcphee-panel-item";
          scrollOnHover(row, issue.start);
          var label = document.createElement("span");
          label.className = "mcphee-panel-word mcphee-panel-word-capitalization";
          label.textContent = issue.value;
          row.appendChild(label);
          row.appendChild(button("Capitalize", "mcphee-panel-suggestion", function () {
            // Re-locate the issue in the current value; text may have moved.
            var current = self.analyze(textarea.value, analyzeOpts).find(function (i) {
              return i.kind === "capitalization" && i.value === issue.value;
            });
            if (current) {
              replaceRange(textarea, current.start, current.end,
                current.value.charAt(0).toUpperCase() + current.value.slice(1));
            }
            afterAction();
          }));
          row.appendChild(selectButton(function (i) {
            return i.kind === "capitalization" && i.value === issue.value;
          }));
          container.appendChild(row);
        } else if (issue.kind === "punctuation") {
          var prow = document.createElement("div");
          prow.className = "mcphee-panel-item mcphee-panel-note";
          scrollOnHover(prow, issue.start);
          var ptext = document.createElement("span");
          ptext.textContent = "missing end punctuation";
          prow.appendChild(ptext);
          prow.appendChild(selectButton(function (i) {
            return i.kind === "punctuation";
          }));
          container.appendChild(prow);
        }
      });

      if (doubleSpaces) {
        var srow = document.createElement("div");
        srow.className = "mcphee-panel-item";
        scrollOnHover(srow, firstDoubleSpaceStart);
        var slabel = document.createElement("span");
        slabel.className = "mcphee-panel-word mcphee-panel-word-doublespace";
        slabel.textContent = doubleSpaces + " extra-space run" + (doubleSpaces === 1 ? "" : "s");
        srow.appendChild(slabel);
        srow.appendChild(button("collapse", "mcphee-panel-suggestion", function () {
          var value = textarea.value;
          var newText = value.replace(/ {2,}/g, function (run, offset) {
            var v = classifySpaceRun(value, offset, run.length);
            return v ? v.collapseTo : run;
          });
          if (newText !== value) {
            replaceRange(textarea, 0, value.length, newText);
          }
          afterAction();
        }));
        srow.appendChild(selectButton(function (i) {
          return i.kind === "doublespace";
        }));
        container.appendChild(srow);
      }

      var dictLine = document.createElement("div");
      dictLine.className = "mcphee-panel-dictcount";
      dictLine.textContent = "personal dictionary: " + self.customWords.size + " words";
      container.appendChild(dictLine);
    }

    var debounceTimer = null;
    function onInput() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(render, 400);
    }
    textarea.addEventListener("input", onInput);
    render();

    return {
      refresh: render,
      detach: function () {
        clearTimeout(debounceTimer);
        textarea.removeEventListener("input", onInput);
        container.classList.remove("mcphee-panel");
        container.innerHTML = "";
      },
    };
  };

  // ---------- form submit gating ----------

  function issueMatches(issue, blockOn) {
    return blockOn.indexOf(issue.kind) !== -1
      || (issue.classification && blockOn.indexOf(issue.classification) !== -1);
  }

  // Blocks form submission while registered fields contain blocking issues.
  // options:
  //   fields         textareas to check (default: all textareas in the form)
  //   blockOn        issue kinds/classifications that block (default
  //                  ["misspelled"] — blue unknowns don't block by default)
  //   profile/rules  rule overrides for the gating analysis
  //   allowOverride  when true (default), resubmitting the same unchanged
  //                  text within overrideMs passes — an escape hatch so a
  //                  false positive can never hold the user hostage
  //   overrideMs     override window, default 6000
  //   watch          when true, live-disable the form's submit buttons while
  //                  blocking issues exist (the "insists" mode)
  //   onBlock        callback(blockedFields) for custom UI; default behavior
  //                  focuses the first offending field
  Checker.prototype.guardForm = function (form, options) {
    var self = this;
    options = options || {};
    var fields = options.fields || Array.prototype.slice.call(form.querySelectorAll("textarea"));
    var blockOn = options.blockOn || ["misspelled"];
    var analyzeOpts = { rules: this.resolveRules(options) };
    var allowOverride = options.allowOverride !== false;
    var overrideMs = options.overrideMs || 6000;
    var lastBlockedSignature = null;
    var lastBlockedAt = 0;

    function blockedFields() {
      var blocked = [];
      fields.forEach(function (field) {
        var issues = self.analyze(field.value, analyzeOpts).filter(function (issue) {
          return issueMatches(issue, blockOn);
        });
        if (issues.length) blocked.push({ field: field, issues: issues });
      });
      return blocked;
    }

    function signature() {
      return fields.map(function (f) { return f.value; }).join("\u0000");
    }

    function onSubmit(event) {
      var blocked = blockedFields();
      if (!blocked.length) return;
      var sig = signature();
      if (allowOverride && sig === lastBlockedSignature && Date.now() - lastBlockedAt < overrideMs) {
        return; // deliberate resubmit of unchanged text — let it through
      }
      event.preventDefault();
      lastBlockedSignature = sig;
      lastBlockedAt = Date.now();
      if (options.onBlock) {
        options.onBlock(blocked);
      } else {
        blocked[0].field.focus();
      }
    }

    form.addEventListener("submit", onSubmit, true);

    var watchTimer = null;
    var submitButtons = [];
    if (options.watch) {
      submitButtons = Array.prototype.slice.call(
        form.querySelectorAll('button[type="submit"], button:not([type]), input[type="submit"]'));
      var updateButtons = function () {
        var count = 0;
        blockedFields().forEach(function (b) { count += b.issues.length; });
        submitButtons.forEach(function (btn) {
          btn.disabled = count > 0;
          btn.title = count > 0
            ? count + " spelling issue" + (count === 1 ? "" : "s") + " \u2014 fix or add to dictionary"
            : "";
        });
      };
      fields.forEach(function (f) { f.addEventListener("input", updateButtons); });
      watchTimer = setInterval(updateButtons, 1000);
      updateButtons();
    }

    return {
      check: blockedFields,
      detach: function () {
        form.removeEventListener("submit", onSubmit, true);
        if (watchTimer) clearInterval(watchTimer);
        submitButtons.forEach(function (btn) { btn.disabled = false; btn.title = ""; });
      },
    };
  };

  // ---------- factory ----------

  function create(options) {
    if (typeof Typo === "undefined") {
      return Promise.reject(new Error("McPhee: typo.min.js must be loaded first (mcphee/vendor/typo/typo.min.js)"));
    }
    if (!options || !options.affUrl || !options.dicUrl) {
      return Promise.reject(new Error("McPhee.create requires { affUrl, dicUrl }"));
    }
    var loads = [
      fetch(options.affUrl).then(function (r) {
        if (!r.ok) throw new Error("McPhee: failed to load " + options.affUrl + " (HTTP " + r.status + ")");
        return r.text();
      }),
      fetch(options.dicUrl).then(function (r) {
        if (!r.ok) throw new Error("McPhee: failed to load " + options.dicUrl + " (HTTP " + r.status + ")");
        return r.text();
      }),
    ];
    if (options.freqUrl) {
      // Rank list: one word per line, most common first (line number = rank).
      // Optional — without it, echo falls back to the stopword list alone and
      // obscureRepeat stays inert. A load failure degrades the same way
      // rather than killing the spellchecker.
      loads.push(fetch(options.freqUrl).then(function (r) {
        return r.ok ? r.text() : null;
      }).catch(function () { return null; }));
    }
    return Promise.all(loads).then(function (parts) {
      var dict = new Typo("en_US", parts[0], parts[1]);
      var freqRank = null;
      if (parts[2]) {
        freqRank = new Map();
        var lines = parts[2].split(/\r?\n/);
        for (var i = 0; i < lines.length; i++) {
          var word = lines[i].trim();
          if (word && !freqRank.has(word)) freqRank.set(word, i + 1);
        }
      }
      return new Checker(dict, options, freqRank);
    });
  }

  return { create: create, version: VERSION, profiles: PROFILES };
})();
