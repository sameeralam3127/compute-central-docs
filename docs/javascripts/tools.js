/* Interactive tools for Compute Central pages.

   javascripts/extra.js downloads this file only on pages that contain a
   placeholder such as:

     <div class="cc-tool" data-cc-tool="rollout" markdown>
     Text shown when JavaScript is off.
     </div>

   Each tool replaces the placeholder with a small form whose results update
   as the reader types. The calculations follow the code they model (the
   Kubernetes Deployment and HPA controllers, ansible-core's batching, the
   API server's RBAC error format); the page around each tool explains the
   rules. The pure functions are exported under Node for unit tests.
*/
/* global module */ // the Node export below is for unit tests only
(function (global, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else global.ccTools = api;
})(this, function () {
  "use strict";

  /* ---------------------------------------------------------------------------
     DOM helpers
     ------------------------------------------------------------------------- */

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value === null || value === undefined || value === false) return;
      if (key === "text") el.textContent = value;
      else if (key === "className") el.className = value;
      else if (key.indexOf("on") === 0) el.addEventListener(key.slice(2), value);
      else if (key === "value") el.value = value;
      else if (key === "checked") el.checked = Boolean(value);
      else el.setAttribute(key, value === true ? "" : value);
    });
    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      el.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return el;
  }

  // "Text with `code` and **bold**" -> inline elements.
  function rich(text) {
    var span = document.createElement("span");
    String(text).split(/(`[^`]+`|\*\*[^*]+\*\*)/).forEach(function (part) {
      if (!part) return;
      if (part.charAt(0) === "`") span.appendChild(h("code", { text: part.slice(1, -1) }));
      else if (part.indexOf("**") === 0) span.appendChild(h("strong", { text: part.slice(2, -2) }));
      else span.appendChild(document.createTextNode(part));
    });
    return span;
  }

  function para(text, className) {
    return h("p", { className: className || null }, [rich(text)]);
  }

  function bullets(items) {
    return h("ul", null, items.map(function (item) {
      return h("li", null, [rich(item)]);
    }));
  }

  var fieldId = 0;

  function field(label, input, hint) {
    fieldId += 1;
    input.id = "cc-tool-field-" + fieldId;
    return h("div", { className: "cc-tool-field" }, [
      h("label", { for: input.id, text: label }),
      input,
      hint ? h("small", { text: hint }) : null
    ]);
  }

  function textInput(value, attrs) {
    var input = h("input", Object.assign({ type: "text", value: value, spellcheck: "false", autocomplete: "off" }, attrs || {}));
    return input;
  }

  function numberInput(value, attrs) {
    return h("input", Object.assign({ type: "number", value: value, inputmode: "numeric" }, attrs || {}));
  }

  function table(headers, rows) {
    return h("div", { className: "cc-tool-table" }, [
      h("table", null, [
        h("thead", null, [h("tr", null, headers.map(function (text) {
          return h("th", null, [rich(text)]);
        }))]),
        h("tbody", null, rows.map(function (row) {
          return h("tr", { className: row.highlight ? "is-highlight" : null }, row.cells.map(function (cell) {
            return h("td", null, [rich(String(cell))]);
          }));
        }))
      ])
    ]);
  }

  function copyText(text, button) {
    function done(label) {
      button.textContent = label;
      window.setTimeout(function () {
        button.textContent = "Copy";
      }, 1600);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        done("Copied");
      }, function () {
        done("Press Ctrl+C");
      });
    } else {
      done("Select and copy");
    }
  }

  function codeBlock(text) {
    var button = h("button", { type: "button", className: "cc-tool-copy", text: "Copy" });
    button.addEventListener("click", function () {
      copyText(text, button);
    });
    return h("div", { className: "cc-tool-code" }, [button, h("pre", null, [h("code", { text: text })])]);
  }

  function frame(root, title, intro) {
    root.textContent = "";
    root.appendChild(h("p", { className: "cc-tool-head" }, [
      h("span", { className: "cc-tool-badge", text: "Interactive" }),
      h("strong", { text: title })
    ]));
    if (intro) root.appendChild(para(intro, "cc-tool-intro"));
    var form = h("form", { className: "cc-tool-form", novalidate: true });
    form.addEventListener("submit", function (event) {
      event.preventDefault();
    });
    var summary = h("p", { className: "cc-tool-result", "aria-live": "polite" });
    var details = h("div");
    var out = h("div", { className: "cc-tool-out" }, [summary, details]);
    root.appendChild(form);
    root.appendChild(out);
    return {
      form: form,
      show: function (headline, nodes) {
        summary.textContent = "";
        summary.appendChild(rich(headline));
        details.textContent = "";
        (nodes || []).forEach(function (node) {
          if (node) details.appendChild(node);
        });
      }
    };
  }

  function live(inputs, update) {
    inputs.forEach(function (input) {
      input.addEventListener("input", update);
      input.addEventListener("change", update);
    });
    update();
  }

  function plural(count, one, many) {
    return count + " " + (count === 1 ? one : many || one + "s");
  }

  function parseIntStrict(text) {
    var s = String(text).trim();
    return /^-?\d+$/.test(s) ? parseInt(s, 10) : NaN;
  }

  /* ---------------------------------------------------------------------------
     Ansible: serial batches and max_fail_percentage
     Mirrors ansible-core's PlaybookExecutor._get_serialized_batches() and
     pct_to_int(): percentages are of the play's total host count, truncated,
     never below 1, and the last list value repeats.
     ------------------------------------------------------------------------- */

  function parseSerial(text) {
    var s = String(text).trim().replace(/^\[|\]$/g, "").trim();
    if (!s) return { values: [] };
    var values = [];
    var parts = s.split(",");
    for (var i = 0; i < parts.length; i++) {
      var token = parts[i].trim().replace(/^["']|["']$/g, "").trim();
      if (/^\d+%$/.test(token)) values.push({ pct: parseInt(token, 10), text: token });
      else if (/^-?\d+$/.test(token)) values.push({ count: parseInt(token, 10), text: token });
      else return { error: "`" + (token || " ") + "` isn't a whole number or a whole percentage such as `25%`." };
    }
    return { values: values };
  }

  function pctToInt(value, total) {
    if (value.pct !== undefined) return Math.trunc((value.pct / 100) * total) || 1;
    return value.count;
  }

  function serialBatches(total, values) {
    var list = values.length ? values : [{ count: -1, text: "all" }];
    var remaining = total;
    var batches = [];
    var item = 0;
    while (remaining > 0) {
      var value = list[item];
      var size = pctToInt(value, total);
      if (size <= 0) {
        batches.push({ size: remaining, value: value });
        break;
      }
      size = Math.min(size, remaining);
      batches.push({ size: size, value: value });
      remaining -= size;
      item = Math.min(item + 1, list.length - 1);
    }
    return batches;
  }

  // Failed hosts in one batch that stop the play. Ansible compares
  // failed / batch_size > max_fail_percentage / 100 (exceeded, not equaled),
  // and a batch in which every host fails always ends the play.
  function failThreshold(size, maxFailPct) {
    if (maxFailPct === null || maxFailPct === undefined) return size;
    for (var failed = 1; failed <= size; failed++) {
      if (failed / size > maxFailPct / 100) return failed;
    }
    return size;
  }

  function mountSerial(root) {
    var ui = frame(root, "Serial batch planner", "Enter a host count and a `serial` value to see the batches Ansible will run and how many failures stop the rollout.");
    var hosts = numberInput(20, { min: 1, max: 100000 });
    var serial = textInput("1, 25%, 100%", { placeholder: "1, 25%, 100%" });
    var maxFail = textInput("", { placeholder: "unset" });
    var forks = numberInput(5, { min: 1, max: 1000 });
    var fatalId = "cc-tool-field-" + (++fieldId);
    var fatal = h("input", { type: "checkbox", id: fatalId });
    ui.form.appendChild(h("div", { className: "cc-tool-grid" }, [
      field("Hosts in the play", hosts),
      field("serial", serial, "Number, percentage, or a list"),
      field("max_fail_percentage", maxFail, "Leave blank for unset"),
      field("forks", forks, "Default 5")
    ]));
    ui.form.appendChild(h("p", { className: "cc-tool-check" }, [fatal, h("label", { for: fatalId, text: "any_errors_fatal: true" })]));

    live([hosts, serial, maxFail, forks, fatal], function () {
      var total = parseIntStrict(hosts.value);
      var parsed = parseSerial(serial.value);
      var pctText = maxFail.value.trim();
      var pct = pctText === "" ? null : parseIntStrict(pctText);
      var forkCount = parseIntStrict(forks.value);
      if (!(total >= 1)) return ui.show("Enter how many hosts the play targets.");
      if (total > 100000) return ui.show("That's more hosts than this planner draws. Try 100,000 or fewer.");
      if (parsed.error) return ui.show(parsed.error);
      if (pct !== null && !(pct >= 0 && pct <= 100)) return ui.show("`max_fail_percentage` is a whole number from 0 to 100.");
      if (!(forkCount >= 1)) forkCount = 5;

      var batches = serialBatches(total, parsed.values);
      var shown = batches.slice(0, 12);
      var start = 1;
      var rows = shown.map(function (batch, i) {
        var end = start + batch.size - 1;
        var range = batch.size === 1 ? "host " + start : "hosts " + start + "–" + end;
        start = end + 1;
        var stop = fatal.checked ? 1 : failThreshold(batch.size, pct);
        var stopText = fatal.checked
          ? "1 failure (any_errors_fatal)"
          : stop === batch.size
            ? (batch.size === 1 ? "its 1 host fails" : "all " + batch.size + " fail")
            : stop + " of " + batch.size + " fail";
        return {
          highlight: i === 0 && batches.length > 1,
          cells: [i + 1, "`" + batch.value.text + "`", range, batch.size, stopText, Math.ceil(batch.size / forkCount)]
        };
      });
      if (batches.length > shown.length) {
        var rest = batches.slice(shown.length).reduce(function (sum, b) { return sum + b.size; }, 0);
        rows.push({ cells: ["…", "", plural(batches.length - shown.length, "more batch", "more batches"), rest, "", ""] });
      }

      var notes = [];
      var truncated = parsed.values.filter(function (v) {
        return v.pct !== undefined && (v.pct / 100) * total !== Math.trunc((v.pct / 100) * total);
      });
      if (truncated.length) {
        var v = truncated[0];
        var exact = (v.pct / 100) * total;
        notes.push("`" + v.text + "` of " + total + " hosts is " + +exact.toFixed(2) + ", and Ansible rounds down" +
          (Math.trunc(exact) === 0 ? " to 0, then uses the minimum of 1 host." : " to " + Math.trunc(exact) + ". A percentage never gives fewer than 1 host."));
      }
      if (parsed.values.some(function (v) { return v.pct !== undefined; })) {
        notes.push("Percentages are of all " + total + " hosts in the play, not of the hosts still waiting.");
      }
      if (parsed.values.length && batches.length > parsed.values.length) {
        notes.push("The list has " + plural(parsed.values.length, "value") + ", so the last one, `" + parsed.values[parsed.values.length - 1].text + "`, repeats until every host is done.");
      }
      notes.push("`run_once` tasks run once per batch: " + plural(batches.length, "time") + " in this play.");
      notes.push("Waves per task is how many rounds of `forks` connections one task needs inside the batch.");

      var warning = null;
      if (!fatal.checked && pct === null && batches.length > 1) {
        warning = para("Nothing here stops a bad release early. With `max_fail_percentage` unset, failed hosts are dropped and the next batch starts anyway; only a batch in which **every** host fails ends the play. Set `max_fail_percentage` (or `any_errors_fatal: true`) for a real canary.", "cc-tool-warn");
      } else if (!fatal.checked && pct !== null && pct > 0) {
        warning = para("`max_fail_percentage: " + pct + "` must be **exceeded**, not met, and it is checked per batch. A rescued task doesn't count as a failure.", "cc-tool-ok");
      }

      ui.show(plural(batches.length, "batch", "batches") + ": " + batches.slice(0, 8).map(function (b) { return b.size; }).join(" → ") + (batches.length > 8 ? " → …" : ""), [
        warning,
        table(["Batch", "From", "Hosts", "Size", "Play stops if", "Waves per task"], rows),
        bullets(notes)
      ]);
    });
  }

  /* ---------------------------------------------------------------------------
     Ansible: variable precedence
     Rank 1 is highest, matching the table on the precedence page.
     ------------------------------------------------------------------------- */

  var PRECEDENCE = [
    [1, "Extra vars", "-e key=value"],
    [2, "Include params", "vars: on include_tasks / include_role"],
    [3, "Role params", "vars: on a role, or on import_role"],
    [4, "set_fact and registered vars", "set_fact, register:"],
    [5, "include_vars", "ansible.builtin.include_vars"],
    [6, "Task vars", "vars: on a task"],
    [7, "Block vars", "vars: on a block"],
    [8, "Role vars", "roles/<role>/vars/main.yml"],
    [9, "Play vars_files", "vars_files: on a play"],
    [10, "Play vars_prompt", "vars_prompt: on a play"],
    [11, "Play vars", "vars: on a play"],
    [12, "Host facts and cached set_fact", "setup, fact cache"],
    [13, "Playbook host_vars/*", "next to the playbook"],
    [14, "Inventory host_vars/*", "next to the inventory"],
    [15, "Inventory file host vars", "web01 http_port=8080"],
    [16, "Playbook group_vars/*", "group_vars/web.yml by the playbook"],
    [17, "Inventory group_vars/*", "group_vars/web.yml by the inventory"],
    [18, "Playbook group_vars/all", "by the playbook"],
    [19, "Inventory group_vars/all", "by the inventory"],
    [20, "Inventory file group vars", "[web:vars] in hosts.ini"],
    [21, "Role defaults", "roles/<role>/defaults/main.yml"],
    [22, "Command-line options (not variables)", "-u deploy, --private-key"]
  ];

  function precedenceNotes(ranks) {
    var has = function (r) { return ranks.indexOf(r) !== -1; };
    var any = function (from, to) { return ranks.some(function (r) { return r >= from && r <= to; }); };
    var winner = Math.min.apply(null, ranks);
    var notes = [];
    if (has(22) && ranks.length > 1) notes.push("Rank 22 is a connection option, not a variable. `ansible_user` set anywhere above it wins, which is why `-u deploy` looks ignored. Use `-e ansible_user=deploy` to really override it.");
    if (winner === 12 && any(13, 20)) notes.push("A gathered fact beats every inventory variable. Don't give your own variables fact names such as `ansible_hostname`.");
    if (winner === 8 && any(13, 20)) notes.push("Role `vars/main.yml` beats all of inventory. If inventory should be able to change the value, it belongs in the role's `defaults/`.");
    if (has(1) && has(4)) notes.push("`-e` beats `set_fact` too, and keeps winning on every later task in the run.");
    if (winner === 4 && any(5, 21)) notes.push("Once `set_fact` or `register` sets it, no file-based source can take it back for the rest of the run.");
    if (any(13, 15) && any(16, 20)) notes.push("Host-level values beat group-level ones.");
    if ((has(16) || has(17)) && (has(18) || has(19))) notes.push("A specific group (`group_vars/web`) beats `group_vars/all`. Between sibling groups at the same depth, the alphabetically last one wins unless `ansible_group_priority` says otherwise.");
    if (winner === 21) notes.push("Role defaults are a role's public interface: every other source overrides them.");
    return notes;
  }

  function mountPrecedence(root) {
    var ui = frame(root, "Which value wins?", "Tick every place the same variable is set. The checker names the value Ansible uses and explains the surprise, if there is one.");
    var boxes = {};
    var presets = [
      ["group_vars/all vs role vars", [19, 8]],
      ["host_vars vs set_fact", [14, 4]],
      ["Fact vs group_vars", [12, 17]],
      ["-u vs ansible_user", [22, 17]],
      ["-e vs everything", [1, 4, 8, 14, 21]]
    ];
    var chipButtons = [];
    var chips = h("div", { className: "cc-tool-chips" }, [h("span", { className: "cc-tool-muted", text: "Try:" })]);
    presets.forEach(function (preset) {
      var chip = h("button", { type: "button", className: "cc-tool-chip", "aria-pressed": "false", text: preset[0] });
      chip.addEventListener("click", function () {
        PRECEDENCE.forEach(function (row) {
          boxes[row[0]].checked = preset[1].indexOf(row[0]) !== -1;
        });
        update();
        chipButtons.forEach(function (b) { b.setAttribute("aria-pressed", b === chip ? "true" : "false"); });
      });
      chipButtons.push(chip);
      chips.appendChild(chip);
    });
    var clear = h("button", { type: "button", className: "cc-tool-chip", text: "Clear" });
    clear.addEventListener("click", function () {
      PRECEDENCE.forEach(function (row) { boxes[row[0]].checked = false; });
      chipButtons.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      update();
    });
    chips.appendChild(clear);
    ui.form.appendChild(chips);

    var list = h("div", { className: "cc-tool-checks", role: "group", "aria-label": "Where the variable is set" });
    PRECEDENCE.forEach(function (row) {
      var box = h("input", { type: "checkbox", value: String(row[0]) });
      boxes[row[0]] = box;
      box.addEventListener("change", function () {
        chipButtons.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
        update();
      });
      list.appendChild(h("label", null, [
        box,
        h("span", { className: "cc-rank", text: String(row[0]) }),
        h("span", null, [document.createTextNode(row[1] + " "), h("small", { className: "cc-tool-muted", text: row[2] })])
      ]));
    });
    ui.form.appendChild(list);

    function update() {
      var ranks = PRECEDENCE.filter(function (row) { return boxes[row[0]].checked; }).map(function (row) { return row[0]; });
      if (!ranks.length) return ui.show("Tick two or more places, or pick an example above.");
      var winner = PRECEDENCE[Math.min.apply(null, ranks) - 1];
      if (ranks.length === 1) return ui.show("Only one source: **" + winner[1] + "** (rank " + winner[0] + ") is the value.");
      var rows = ranks.map(function (rank) {
        var row = PRECEDENCE[rank - 1];
        return { highlight: rank === winner[0], cells: [rank, row[1], rank === winner[0] ? "**Used**" : "Overridden"] };
      });
      var notes = precedenceNotes(ranks);
      ui.show("**" + winner[1] + "** wins (rank " + winner[0] + " of 22).", [
        table(["Rank", "Source", "Result"], rows),
        notes.length ? bullets(notes) : null
      ]);
    }
    update();
  }

  /* ---------------------------------------------------------------------------
     Ansible: curl command -> ansible.builtin.uri task
     ------------------------------------------------------------------------- */

  function shellWords(input) {
    var words = [];
    var word = null;
    var s = String(input).replace(/\\\r?\n/g, " ");
    var i = 0;
    function push(ch) {
      word = (word === null ? "" : word) + ch;
    }
    while (i < s.length) {
      var c = s.charAt(i);
      if (c === "'" ) {
        var end = s.indexOf("'", i + 1);
        if (end === -1) return { error: "A single quote isn't closed." };
        push(s.slice(i + 1, end));
        i = end + 1;
      } else if (c === "$" && s.charAt(i + 1) === "'") {
        var j = i + 2;
        var out = "";
        while (j < s.length && s.charAt(j) !== "'") {
          if (s.charAt(j) === "\\" && j + 1 < s.length) {
            var e = s.charAt(j + 1);
            var map = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", "\"": "\"", "?": "?", a: "\u0007", b: "\b", e: "\u001b", f: "\f", v: "\v" };
            if (map[e] !== undefined) { out += map[e]; j += 2; }
            else if (e === "x" && /^[0-9a-fA-F]{1,2}/.test(s.slice(j + 2))) {
              var hex = /^[0-9a-fA-F]{1,2}/.exec(s.slice(j + 2))[0];
              out += String.fromCharCode(parseInt(hex, 16));
              j += 2 + hex.length;
            } else if (e === "u" && /^[0-9a-fA-F]{4}/.test(s.slice(j + 2))) {
              out += String.fromCharCode(parseInt(s.slice(j + 2, j + 6), 16));
              j += 6;
            } else { out += "\\" + e; j += 2; }
          } else { out += s.charAt(j); j += 1; }
        }
        if (j >= s.length) return { error: "A $'…' string isn't closed." };
        push(out);
        i = j + 1;
      } else if (c === "\"") {
        var k = i + 1;
        var buf = "";
        while (k < s.length && s.charAt(k) !== "\"") {
          if (s.charAt(k) === "\\" && "$`\"\\\n".indexOf(s.charAt(k + 1)) !== -1) { buf += s.charAt(k + 1); k += 2; }
          else { buf += s.charAt(k); k += 1; }
        }
        if (k >= s.length) return { error: "A double quote isn't closed." };
        push(buf);
        i = k + 1;
      } else if (c === "\\") {
        if (i + 1 < s.length) push(s.charAt(i + 1));
        i += 2;
      } else if (/\s/.test(c)) {
        if (word !== null) { words.push(word); word = null; }
        i += 1;
      } else {
        push(c);
        i += 1;
      }
    }
    if (word !== null) words.push(word);
    return { words: words };
  }

  var CURL_ARGS = {
    "-X": "request", "--request": "request", "-H": "header", "--header": "header",
    "-d": "data", "--data": "data", "--data-ascii": "data", "--data-binary": "data-binary",
    "--data-raw": "data-raw", "--data-urlencode": "data-urlencode", "--json": "json",
    "-F": "form", "--form": "form", "--form-string": "form-string",
    "-u": "user", "--user": "user", "-o": "output", "--output": "output",
    "-A": "agent", "--user-agent": "agent", "-b": "cookie", "--cookie": "cookie",
    "-e": "referer", "--referer": "referer", "-m": "max-time", "--max-time": "max-time",
    "--connect-timeout": "connect-timeout", "-x": "proxy", "--proxy": "proxy",
    "-E": "cert", "--cert": "cert", "--key": "key", "--cacert": "cacert", "--capath": "cacert",
    "--url": "url", "--oauth2-bearer": "bearer", "--unix-socket": "unix-socket",
    "--retry": "retry", "--retry-delay": "retry-delay", "-T": "upload", "--upload-file": "upload",
    "-w": "skip", "--write-out": "skip", "--resolve": "skip", "-c": "skip", "--cookie-jar": "skip",
    "--retry-max-time": "skip", "--limit-rate": "skip", "-r": "skip", "--range": "skip", "-K": "skip",
    "--config": "skip", "--interface": "skip", "-y": "skip", "-Y": "skip", "--trace": "skip",
    "--trace-ascii": "skip", "--stderr": "skip", "--proxy-user": "skip", "-U": "skip"
  };

  var CURL_FLAGS = {
    "-L": "location", "--location": "location", "--location-trusted": "location",
    "-k": "insecure", "--insecure": "insecure", "-I": "head", "--head": "head",
    "-G": "get", "--get": "get", "-f": "fail", "--fail": "fail", "--fail-with-body": "fail",
    "-O": "remote-name", "--remote-name": "remote-name", "-n": "netrc", "--netrc": "netrc"
  };

  var CURL_QUIET = ["-s", "--silent", "-S", "--show-error", "-i", "--include", "-v", "--verbose",
    "--compressed", "-N", "--no-buffer", "-g", "--globoff", "--http1.1", "--http2", "--http1.0",
    "-#", "--progress-bar", "-Z", "-q", "--tlsv1.2", "--tlsv1.3", "-4", "-6", "--ipv4", "--ipv6",
    "--path-as-is", "--no-progress-meter", "--raw", "--tr-encoding", "--http2-prior-knowledge"];

  function parseCurl(text) {
    var tokens = shellWords(String(text).trim());
    if (tokens.error) return { error: tokens.error };
    var words = tokens.words;
    if (words[0] === "curl" || /(^|\/)curl(\.exe)?$/.test(words[0] || "")) words = words.slice(1);
    if (!words.length) return { error: "Paste a curl command, starting with `curl`." };

    var st = { urls: [], headers: [], data: [], form: [], flags: {}, ignored: [], unknown: [] };
    var optionsEnded = false;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var name = null;
      var value = null;
      if (optionsEnded) {
        st.urls.push(w);
        continue;
      }
      if (w === "--") {
        optionsEnded = true;
        continue;
      }
      if (w.indexOf("--") === 0 && w.length > 2) {
        var eq = w.indexOf("=");
        if (eq !== -1 && CURL_ARGS[w.slice(0, eq)]) { name = w.slice(0, eq); value = w.slice(eq + 1); }
        else name = w;
      } else if (w.charAt(0) === "-" && w.length > 1) {
        // Short options can be bundled: -sSL, -XPOST, -HAccept:x
        var j = 1;
        while (j < w.length) {
          var opt = "-" + w.charAt(j);
          if (CURL_ARGS[opt]) {
            name = opt;
            if (j + 1 < w.length) value = w.slice(j + 1);
            break;
          }
          if (CURL_FLAGS[opt]) st.flags[CURL_FLAGS[opt]] = true;
          else if (CURL_QUIET.indexOf(opt) !== -1) st.ignored.push(opt);
          else st.unknown.push(opt);
          j += 1;
        }
        if (!name) continue;
      } else {
        st.urls.push(w);
        continue;
      }

      if (CURL_ARGS[name]) {
        if (value === null) {
          if (i + 1 >= words.length) return { error: "`" + name + "` needs a value after it." };
          value = words[++i];
        }
        var kind = CURL_ARGS[name];
        if (kind === "header") st.headers.push(value);
        else if (kind === "data" || kind === "data-binary" || kind === "data-raw" || kind === "data-urlencode" || kind === "json") st.data.push({ kind: kind, value: value });
        else if (kind === "form" || kind === "form-string") st.form.push({ kind: kind, value: value });
        else if (kind === "url") st.urls.push(value);
        else if (kind === "skip") st.ignored.push(name);
        else st[kind] = value;
      } else if (CURL_FLAGS[name]) {
        st.flags[CURL_FLAGS[name]] = true;
      } else if (CURL_QUIET.indexOf(name) !== -1) {
        st.ignored.push(name);
      } else {
        st.unknown.push(name);
      }
    }
    if (!st.urls.length) return { error: "No URL found in the command." };
    return { state: st };
  }

  var YAML_PLAIN = /^[A-Za-z0-9_./~][A-Za-z0-9_ ./~:@%+=,;()&?!*'-]*$/;

  function yamlString(value) {
    var s = String(value);
    if (s === "") return "\"\"";
    if (YAML_PLAIN.test(s) && !/:(\s|$)|\s$|^[-+]?(\d|\.\d)/.test(s) &&
        !/^(true|false|yes|no|on|off|y|n|null)$/i.test(s)) return s;
    return JSON.stringify(s);
  }

  function yamlKey(key) {
    return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key) ? key : JSON.stringify(key);
  }

  function isScalar(v) {
    return v === null || typeof v !== "object";
  }

  function isEmpty(v) {
    return typeof v === "object" && v !== null && (Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0);
  }

  function yamlScalar(v) {
    if (v === null) return "null";
    if (typeof v === "boolean" || typeof v === "number") return String(v);
    if (Array.isArray(v)) return "[]";
    if (typeof v === "object") return "{}";
    return yamlString(v);
  }

  function yamlLines(value, indent) {
    var pad = new Array(indent + 1).join(" ");
    var lines = [];
    if (Array.isArray(value)) {
      value.forEach(function (item) {
        if (isScalar(item) || isEmpty(item)) lines.push(pad + "- " + yamlScalar(item));
        else {
          var nested = yamlLines(item, indent + 2);
          lines.push(pad + "- " + nested[0].slice(indent + 2));
          Array.prototype.push.apply(lines, nested.slice(1));
        }
      });
    } else {
      Object.keys(value).forEach(function (key) {
        var item = value[key];
        if (isScalar(item) || isEmpty(item)) lines.push(pad + yamlKey(key) + ": " + yamlScalar(item));
        else {
          lines.push(pad + yamlKey(key) + ":");
          Array.prototype.push.apply(lines, yamlLines(item, indent + 2));
        }
      });
    }
    return lines;
  }

  var SECRET_HEADERS = /^(authorization|proxy-authorization|x-api-key|api-key|apikey|x-auth-token|x-access-token|private-token|x-vault-token|x-gitlab-token|x-github-token|x-figma-token)$/i;
  var BROWSER_HEADERS = /^(sec-.*|priority|dnt|upgrade-insecure-requests|accept-encoding|accept-language|cache-control|pragma|origin|connection)$/i;

  function decodeForm(text) {
    var out = {};
    var ok = true;
    text.split("&").forEach(function (pair) {
      if (!pair) return;
      var eq = pair.indexOf("=");
      if (eq <= 0) { ok = false; return; }
      try {
        out[decodeURIComponent(pair.slice(0, eq).replace(/\+/g, " "))] = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, " "));
      } catch {
        ok = false;
      }
    });
    return ok && Object.keys(out).length ? out : null;
  }

  function curlToUri(text) {
    var parsed = parseCurl(text);
    if (parsed.error) return parsed;
    var st = parsed.state;
    var notes = [];
    var task = [];
    var url = st.urls[0];
    if (st.urls.length > 1) notes.push("The command has " + st.urls.length + " URLs; this task uses the first. Loop over a list for the others.");
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
      url = "http://" + url;
      notes.push("curl assumes `http://` when the scheme is missing, so the task spells it out.");
    }

    var headers = [];
    var secret = false;
    var dropped = [];
    var contentType = "";
    st.headers.forEach(function (raw) {
      var colon = raw.indexOf(":");
      var semi = raw.indexOf(";");
      var key;
      var value;
      if (colon > 0) {
        key = raw.slice(0, colon).trim();
        value = raw.slice(colon + 1).trim();
      } else if (semi > 0 && semi === raw.length - 1) {
        key = raw.slice(0, semi).trim();
        value = "";
      } else {
        notes.push("Skipped the header `" + raw + "`: curl uses that form to remove a header, which uri doesn't need.");
        return;
      }
      if (BROWSER_HEADERS.test(key)) { dropped.push(key); return; }
      if (/^content-type$/i.test(key)) contentType = value;
      if (SECRET_HEADERS.test(key)) {
        secret = true;
        var scheme = /^(Bearer|Basic|Token|Digest)\s+/i.exec(value);
        value = scheme ? scheme[1] + " {{ api_token }}" : "{{ api_token }}";
      }
      headers.push([key, value]);
    });
    if (st.bearer) {
      headers.push(["Authorization", "Bearer {{ api_token }}"]);
      secret = true;
    }
    var sendsJson = st.data.some(function (d) { return d.kind === "json"; });
    if (sendsJson && !headers.some(function (hd) { return /^accept$/i.test(hd[0]); })) {
      headers.push(["Accept", "application/json"]);
    }
    if (st.cookie) {
      if (st.cookie.indexOf("=") !== -1) headers.push(["Cookie", st.cookie]);
      else notes.push("`-b " + st.cookie + "` reads cookies from a file; send them in a `Cookie` header instead.");
    }
    if (st.referer) headers.push(["Referer", st.referer]);
    if (dropped.length) notes.push("Dropped browser-only headers: " + dropped.map(function (k) { return "`" + k + "`"; }).join(", ") + ".");

    // Request body
    var body = null;
    var bodyFormat = null;
    var src = null;
    var jsonParts = st.data.filter(function (d) { return d.kind === "json"; });
    var rawText = st.data.map(function (d) {
      if (d.kind === "data-urlencode") {
        var eq = d.value.indexOf("=");
        if (eq > 0) return d.value.slice(0, eq) + "=" + encodeURIComponent(d.value.slice(eq + 1));
        if (eq === 0) return encodeURIComponent(d.value.slice(1));
        return encodeURIComponent(d.value);
      }
      return d.value;
    }).join(jsonParts.length === st.data.length ? "" : "&");

    var fileData = st.data.filter(function (d) {
      return (d.kind === "data" || d.kind === "data-binary" || d.kind === "json") && d.value.charAt(0) === "@";
    });
    if (fileData.length) {
      src = fileData[0].value.slice(1);
      notes.push("`@" + src + "` sends a file. uri's `src` reads it from the control node; add `remote_src: true` if the file is on the managed node.");
    } else if (st.data.length && st.flags.get) {
      url += (url.indexOf("?") === -1 ? "?" : "&") + rawText;
      notes.push("`-G` moves the data into the query string, so it's part of `url`.");
    } else if (st.data.length) {
      var trimmed = rawText.trim();
      var asJson = null;
      if (/^[[{]/.test(trimmed)) {
        try { asJson = JSON.parse(trimmed); } catch { asJson = null; }
      }
      var jsonType = /json/i.test(contentType);
      if (asJson !== null && (jsonParts.length || jsonType || !contentType)) {
        body = asJson;
        bodyFormat = "json";
        if (!jsonParts.length && !contentType) {
          notes.push("This body is JSON, but plain `curl -d` labels it `application/x-www-form-urlencoded`. The task sends `application/json` via `body_format: json`; switch back to `raw` only if the API really expects the form label.");
        }
      } else if (!jsonType && !/multipart/i.test(contentType) && decodeForm(trimmed)) {
        body = decodeForm(trimmed);
        bodyFormat = "form-urlencoded";
      } else {
        body = rawText;
        bodyFormat = null;
        if (asJson === null && jsonType) notes.push("The header says JSON but the body doesn't parse as JSON, so it's sent as-is.");
      }
    }

    if (st.form.length) {
      bodyFormat = "form-multipart";
      body = {};
      st.form.forEach(function (f) {
        var eq = f.value.indexOf("=");
        if (eq <= 0) return;
        var key = f.value.slice(0, eq);
        var val = f.value.slice(eq + 1);
        var typeMatch = /;type=([^;]+)/.exec(val);
        var plainVal = val.replace(/;type=[^;]+/, "");
        if (f.kind === "form" && plainVal.charAt(0) === "@") {
          var file = { filename: plainVal.slice(1) };
          if (typeMatch) file.mime_type = typeMatch[1];
          body[key] = file;
        } else if (f.kind === "form" && plainVal.charAt(0) === "<") {
          body[key] = "{{ lookup('file', '" + plainVal.slice(1) + "') }}";
        } else {
          body[key] = plainVal;
        }
      });
    }

    if (bodyFormat === "json" && /^application\/json\s*(;.*)?$/i.test(contentType)) {
      headers = headers.filter(function (hd) { return !/^content-type$/i.test(hd[0]); });
    } else if (bodyFormat === "form-urlencoded" && /x-www-form-urlencoded/i.test(contentType)) {
      headers = headers.filter(function (hd) { return !/^content-type$/i.test(hd[0]); });
    } else if (bodyFormat === "form-multipart") {
      if (contentType) notes.push("uri sets the multipart `Content-Type` (with its boundary) itself, so the header was left out.");
      headers = headers.filter(function (hd) { return !/^content-type$/i.test(hd[0]); });
    }

    var method = st.request ? st.request.toUpperCase() :
      st.flags.head ? "HEAD" :
      st.upload ? "PUT" :
      (st.data.length || st.form.length) && !st.flags.get ? "POST" : "GET";
    if (st.upload) {
      src = st.upload;
      notes.push("`-T` uploads a file; `src` reads it from the control node unless you add `remote_src: true`.");
    }

    var host = "";
    var path;
    try {
      var parsedUrl = new URL(url);
      host = parsedUrl.host;
      path = parsedUrl.pathname;
    } catch {
      path = url;
    }

    task.push("- name: " + yamlString(method + " " + (path || "/") + (host ? " on " + host : "")));
    task.push("  ansible.builtin.uri:");
    task.push("    url: " + yamlString(url));
    if (method !== "GET") task.push("    method: " + method);

    if (st.user !== undefined) {
      var colon = st.user.indexOf(":");
      var userName = colon === -1 ? st.user : st.user.slice(0, colon);
      task.push("    url_username: " + yamlString(userName));
      task.push("    url_password: \"{{ api_password }}\"");
      task.push("    force_basic_auth: true");
      secret = true;
      notes.push("`force_basic_auth: true` sends the credentials on the first request, like curl does. Without it, uri waits for a `401` challenge that many APIs never send.");
    }
    if (headers.length) {
      task.push("    headers:");
      headers.forEach(function (hd) {
        task.push("      " + yamlKey(hd[0]) + ": " + yamlString(hd[1]));
      });
    }
    if (bodyFormat) task.push("    body_format: " + bodyFormat);
    if (body !== null && typeof body === "object" && !isEmpty(body)) {
      task.push("    body:");
      Array.prototype.push.apply(task, yamlLines(body, 6));
    } else if (body !== null) {
      task.push("    body: " + yamlScalar(body));
    }
    if (src) task.push("    src: " + yamlString(src));

    var codes = { POST: "[200, 201]", PUT: "[200, 201, 204]", PATCH: "[200, 204]", DELETE: "[200, 202, 204]" }[method];
    if (codes) {
      task.push("    status_code: " + codes);
      notes.push("`status_code` defaults to `[200]` only, so a `" + method + "` that answers `201` or `204` would fail the task. Adjust the list to what the API documents.");
    }
    if (st.flags.insecure) {
      task.push("    validate_certs: false");
      notes.push("`-k` became `validate_certs: false`. Fine in a lab; in production point `ca_path` at the CA bundle instead.");
    }
    if (st.cacert) task.push("    ca_path: " + yamlString(st.cacert));
    if (st.cert) task.push("    client_cert: " + yamlString(st.cert.replace(/:.*$/, "")));
    if (st.key) task.push("    client_key: " + yamlString(st.key));
    if (st.flags.location) task.push("    follow_redirects: all");
    if (st["max-time"]) {
      var seconds = Math.ceil(parseFloat(st["max-time"]));
      if (seconds > 0) task.push("    timeout: " + seconds);
    }
    if (st.agent) task.push("    http_agent: " + yamlString(st.agent));
    if (st["unix-socket"]) task.push("    unix_socket: " + yamlString(st["unix-socket"]));
    if (st.output) {
      task.push("    dest: " + yamlString(st.output));
      notes.push("`dest` is a path on the managed node. For plain downloads, `ansible.builtin.get_url` adds `checksum`, `owner`, and `mode`.");
    } else if (st.flags["remote-name"]) {
      notes.push("`-O` saves the file under its remote name; use `ansible.builtin.get_url` with `dest:` for downloads.");
    }
    if (st.proxy) {
      task.push("  environment:");
      task.push("    " + (/^https:/i.test(url) ? "https_proxy" : "http_proxy") + ": " + yamlString(st.proxy));
    }
    task.push("  register: response");
    if (st.retry) {
      task.push("  retries: " + (parseIntStrict(st.retry) || 3));
      task.push("  delay: " + (parseIntStrict(st["retry-delay"]) || 5));
      task.push("  until: response is succeeded");
      notes.push("curl retries only transient errors; `until: response is succeeded` retries any failure, including a wrong status code.");
    }
    if (secret) {
      task.push("  no_log: true");
      notes.push("Credentials moved to variables (`api_token`, `api_password`). Keep them in Ansible Vault; `no_log: true` keeps them out of the output.");
    }
    if (st.flags.fail) notes.push("`--fail` needs no equivalent: uri already fails on any status code not in `status_code`.");
    if (st["connect-timeout"]) notes.push("uri has one `timeout` for the whole request; `--connect-timeout` has no separate setting.");
    if (st.flags.netrc) notes.push("uri reads `~/.netrc` on the managed node by default (`use_netrc: true`), much like `curl -n`.");
    if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) {
      notes.push("`" + host + "` is the managed node itself: uri runs there, not on your control node.");
    } else {
      notes.push("uri runs on the managed node. To call this API once from the control node, add `delegate_to: localhost` and `run_once: true`.");
    }
    var skipped = st.ignored.filter(function (v, idx, arr) { return arr.indexOf(v) === idx; });
    if (skipped.length) notes.push("Not needed in uri: " + skipped.map(function (k) { return "`" + k + "`"; }).join(", ") + ".");
    if (st.unknown.length) notes.push("Not converted: " + st.unknown.map(function (k) { return "`" + k + "`"; }).join(", ") + ". Check whether the task needs an equivalent.");

    return { yaml: task.join("\n"), notes: notes, method: method };
  }

  function mountCurl(root) {
    var ui = frame(root, "curl to uri converter", "Paste a curl command (including one copied from browser developer tools). The task updates as you type; nothing leaves your browser.");
    var input = h("textarea", { rows: "5", spellcheck: "false", autocomplete: "off", "aria-label": "curl command" });
    input.value = "curl -sS -X POST https://registry.example.com/api/v1/hosts \\\n  -H 'Authorization: Bearer s3cr3t-token' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"hostname\": \"web01\", \"role\": \"web\", \"tags\": [\"prod\", \"eu\"]}'";
    ui.form.appendChild(field("curl command", input));
    live([input], function () {
      var result = curlToUri(input.value);
      if (result.error) return ui.show(result.error);
      ui.show("Equivalent `ansible.builtin.uri` task (" + result.method + "):", [
        codeBlock(result.yaml),
        result.notes.length ? bullets(result.notes) : null
      ]);
    });
  }

  /* ---------------------------------------------------------------------------
     Kubernetes: RBAC "Forbidden" error -> least-privilege Role and binding
     Parses the API server's message:
       User "u" cannot VERB resource "R[/sub]" in API group "G" in the namespace "N"
       User "u" cannot VERB resource "R" in API group "G" at the cluster scope
       User "u" cannot VERB path "/p"
     ------------------------------------------------------------------------- */

  var CLUSTER_SCOPED = ["nodes", "namespaces", "persistentvolumes", "clusterroles", "clusterrolebindings",
    "customresourcedefinitions", "storageclasses", "priorityclasses", "csidrivers", "csinodes",
    "volumeattachments", "ingressclasses", "runtimeclasses", "mutatingwebhookconfigurations",
    "validatingwebhookconfigurations", "validatingadmissionpolicies", "validatingadmissionpolicybindings",
    "apiservices", "certificatesigningrequests", "componentstatuses", "flowschemas",
    "prioritylevelconfigurations", "gatewayclasses", "tokenreviews", "subjectaccessreviews",
    "selfsubjectaccessreviews", "selfsubjectrulesreviews", "clustertrustbundles", "deviceclasses"];

  var DANGEROUS = [
    { resource: /^secrets$/, verbs: ["get", "list", "watch", "*"], why: "Reading Secrets hands over every credential in scope; `list` and `watch` return the contents too, not just names." },
    { resource: /^pods$/, verbs: ["create", "*"], why: "Whoever can create Pods can mount any Secret and run as any ServiceAccount in the namespace." },
    { resource: /^(deployments|daemonsets|statefulsets|replicasets|jobs|cronjobs|replicationcontrollers)$/, verbs: ["create", "update", "patch", "*"], why: "Creating or changing a workload is creating Pods: it can mount any Secret and use any ServiceAccount in the namespace." },
    { resource: /^pods\/(exec|attach|portforward)$/, verbs: ["create", "get", "*"], why: "This is a shell (or a tunnel) into running Pods, with their tokens and mounted Secrets." },
    { resource: /^nodes\/proxy$/, verbs: ["get", "create", "*"], why: "`nodes/proxy` reaches the kubelet API on every node, which bypasses most other controls." },
    { resource: /^serviceaccounts\/token$/, verbs: ["create", "*"], why: "This mints tokens for any ServiceAccount in scope, so it grants whatever those accounts can do." },
    { resource: /^(roles|clusterroles)$/, verbs: ["escalate", "bind", "*"], why: "`escalate` and `bind` let a subject grant itself permissions it doesn't have." },
    { resource: /^(rolebindings|clusterrolebindings)$/, verbs: ["create", "update", "patch", "*"], why: "Whoever writes bindings can bind themselves to `cluster-admin` or `admin`." },
    { resource: /^(users|groups|serviceaccounts|uids|userextras\/.*)$/, verbs: ["impersonate", "*"], why: "`impersonate` lets a subject act as anyone, including administrators." },
    { resource: /^(mutatingwebhookconfigurations|validatingwebhookconfigurations)$/, verbs: ["create", "update", "patch", "delete", "*"], why: "Changing admission webhooks can disable or redirect policy for the whole cluster." },
    { resource: /^certificatesigningrequests\/approval$/, verbs: ["update", "patch", "*"], why: "Approving CSRs can mint client certificates for powerful identities." }
  ];

  function dnsName(text) {
    return String(text).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-").slice(0, 63).replace(/-+$/, "") || "access";
  }

  function parseForbidden(text) {
    var s = String(text).replace(/\s+/g, " ").trim();
    var m = /User "([^"]*)" cannot ([a-zA-Z*]+) (?:resource "([^"]+)" in API group "([^"]*)"(?: in the namespace "([^"]+)"| at the cluster scope)|path "([^"]+)")/.exec(s);
    if (!m) return { error: "Paste the full message, including `User \"…\" cannot …`. It comes from kubectl, an API client's log, or an operator's events." };
    var named = /(?:^|: )([a-z0-9./-]+) "([^"]+)" is forbidden/i.exec(s);
    var user = m[1];
    var sa = /^system:serviceaccount:([^:]+):(.+)$/.exec(user);
    return {
      user: user,
      serviceAccount: sa ? { namespace: sa[1], name: sa[2] } : null,
      verb: m[2],
      resource: m[3] || null,
      group: m[4] === undefined ? null : m[4],
      namespace: m[5] || null,
      path: m[6] || null,
      objectName: named ? named[2] : null,
      missingRole: /RBAC: (?:cluster)?role(?:\.rbac\.authorization\.k8s\.io)? "([^"]+)" not found/.exec(s),
      gkeIam: /requires one of \[/.test(s)
    };
  }

  function rbacFix(info, reusable) {
    var subjectName = info.serviceAccount ? info.serviceAccount.name : info.user.replace(/^system:/, "");
    var base = dnsName(subjectName + "-" + (info.path ? "path" : info.resource.replace(/\//g, "-")) + "-" + info.verb.replace("*", "all"));
    var namespaced = Boolean(info.namespace);
    var subject = info.serviceAccount
      ? ["  - kind: ServiceAccount", "    name: " + yamlString(info.serviceAccount.name), "    namespace: " + yamlString(info.serviceAccount.namespace)]
      : ["  - kind: User", "    name: " + yamlString(info.user), "    apiGroup: rbac.authorization.k8s.io"];
    var rule;
    if (info.path) {
      rule = ["  - nonResourceURLs: [" + JSON.stringify(info.path) + "]", "    verbs: [" + JSON.stringify(info.verb) + "]"];
    } else {
      rule = [
        "  - apiGroups: [" + JSON.stringify(info.group) + "]",
        "    resources: [" + JSON.stringify(info.resource) + "]"
      ];
      if (info.objectName && ["get", "update", "patch", "delete"].indexOf(info.verb) !== -1) {
        rule.push("    resourceNames: [" + JSON.stringify(info.objectName) + "]");
      }
      rule.push("    verbs: [" + JSON.stringify(info.verb) + "]");
    }
    var roleKind = namespaced && !reusable ? "Role" : "ClusterRole";
    var bindingKind = namespaced ? "RoleBinding" : "ClusterRoleBinding";
    var lines = ["apiVersion: rbac.authorization.k8s.io/v1", "kind: " + roleKind, "metadata:", "  name: " + base];
    if (roleKind === "Role") lines.push("  namespace: " + yamlString(info.namespace));
    lines.push("rules:");
    Array.prototype.push.apply(lines, rule);
    lines.push("---", "apiVersion: rbac.authorization.k8s.io/v1", "kind: " + bindingKind, "metadata:", "  name: " + base);
    if (namespaced) lines.push("  namespace: " + yamlString(info.namespace));
    lines.push("subjects:");
    Array.prototype.push.apply(lines, subject);
    lines.push("roleRef:", "  apiGroup: rbac.authorization.k8s.io", "  kind: " + roleKind, "  name: " + base);

    var check;
    if (info.path) {
      check = "kubectl auth can-i " + info.verb + " " + info.path;
    } else {
      var parts = info.resource.split("/");
      var target = parts[0] + (info.group ? "." + info.group : "");
      check = "kubectl auth can-i " + info.verb + " " + target + (parts[1] ? " --subresource=" + parts[1] : "");
      if (info.objectName && rule.join("").indexOf("resourceNames") !== -1) check += " " + info.objectName;
      if (namespaced) check += " -n " + info.namespace;
      else if (CLUSTER_SCOPED.indexOf(parts[0]) === -1) check += " --all-namespaces";
    }
    check += " --as=" + info.user;
    return { yaml: lines.join("\n"), check: check, roleKind: roleKind, bindingKind: bindingKind };
  }

  function forbiddenNotes(info) {
    var warnings = [];
    var notes = [];
    if (info.user === "system:anonymous") {
      warnings.push("The request reached the API server **without credentials**: `system:anonymous` means the token or certificate wasn't sent or wasn't accepted. Fix the kubeconfig or token. Granting RBAC to `system:anonymous` opens the API to the internet; attackers have used exactly that to backdoor clusters.");
    }
    if (/^system:node:/.test(info.user)) {
      warnings.push("Kubelets are authorized by the Node authorizer and NodeRestriction, not by bindings you write. This error usually means a node identity is reaching for something outside its own Pods.");
    }
    if (info.serviceAccount && info.serviceAccount.name === "default") {
      warnings.push("This is the namespace's `default` ServiceAccount, which every Pod there uses unless told otherwise. Create a dedicated ServiceAccount for the workload and bind that instead.");
    }
    if (info.resource) {
      DANGEROUS.forEach(function (d) {
        if (d.resource.test(info.resource) && (d.verbs.indexOf(info.verb) !== -1 || info.verb === "*")) {
          warnings.push("Grant with care: " + d.why);
        }
      });
    }
    if (info.verb === "*" || info.resource === "*") warnings.push("A wildcard also matches resources and verbs added in future releases. List them explicitly.");
    if (info.missingRole) notes.push("The message also says `" + info.missingRole[0] + "`: an existing binding points at a role that doesn't exist. Create it, or fix the binding's `roleRef`.");
    if (info.gkeIam) notes.push("On GKE the request is also checked against IAM; either an RBAC binding or the listed IAM permission is enough.");
    if (info.verb === "list" || info.verb === "watch") notes.push("Controllers and operators built on informers need `list` and `watch` together; add the other one if the client keeps failing.");
    if (info.verb === "create" && info.objectName) notes.push("`create` can't be limited with `resourceNames`: the object doesn't exist yet when the request is authorized.");
    if (info.namespace && !info.serviceAccount) notes.push("For people, bind a **Group** from your identity provider rather than individual users, so access follows team membership.");
    if (!info.namespace && !info.path && CLUSTER_SCOPED.indexOf(info.resource.split("/")[0]) === -1) {
      notes.push("`" + info.resource + "` is namespaced but was requested across all namespaces, so only a ClusterRoleBinding can allow it. If the client only needs one namespace, make it query that namespace instead.");
    }
    notes.push("RBAC only adds permissions; there are no deny rules. Every binding you create widens access, so name and label them so they can be audited.");
    return { warnings: warnings, notes: notes };
  }

  function mountForbidden(root) {
    var ui = frame(root, "Forbidden error to least-privilege RBAC", "Paste a `Forbidden` error. You get the smallest Role and binding that allow exactly that request, the command to verify it, and a warning if the permission is riskier than it looks.");
    var input = h("textarea", { rows: "4", spellcheck: "false", autocomplete: "off", "aria-label": "Forbidden error message" });
    input.value = "Error from server (Forbidden): pods is forbidden: User \"system:serviceaccount:ci:deployer\" cannot list resource \"pods\" in API group \"\" in the namespace \"checkout\"";
    var reuse = h("input", { type: "checkbox" });
    ui.form.appendChild(field("Error message", input));
    var reuseId = "cc-tool-field-reuse-" + (++fieldId);
    reuse.id = reuseId;
    ui.form.appendChild(h("p", { className: "cc-tool-check" }, [reuse, h("label", { for: reuseId, text: "Reusable ClusterRole, bound per namespace" })]));

    live([input, reuse], function () {
      var info = parseForbidden(input.value);
      if (info.error) return ui.show(info.error);
      var fix = rbacFix(info, reuse.checked);
      var extra = forbiddenNotes(info);
      var who = info.serviceAccount ? "ServiceAccount `" + info.serviceAccount.namespace + "/" + info.serviceAccount.name + "`" : "`" + info.user + "`";
      var what = info.path ? "`" + info.verb + "` on the path `" + info.path + "`" : "`" + info.verb + "` on `" + info.resource + "`" + (info.group ? " (API group `" + info.group + "`)" : " (core API group)");
      var where = info.namespace ? " in namespace `" + info.namespace + "`" : " cluster-wide";
      ui.show(who + " needs " + what + where + ": a " + fix.roleKind + " and a " + fix.bindingKind + ".", [
        extra.warnings.length ? h("div", null, extra.warnings.map(function (w) { return para(w, "cc-tool-warn"); })) : null,
        codeBlock(fix.yaml),
        para("Verify before and after you apply it:"),
        codeBlock(fix.check),
        bullets(extra.notes)
      ]);
    });
  }

  /* ---------------------------------------------------------------------------
     Kubernetes: rolling update fenceposts
     Mirrors the Deployment controller's ResolveFenceposts(): maxSurge rounds
     up, maxUnavailable rounds down, and if both resolve to 0, maxUnavailable
     becomes 1.
     ------------------------------------------------------------------------- */

  function parseIntOrPercent(text) {
    var m = /^\s*(\d+)\s*(%?)\s*$/.exec(String(text));
    if (!m) return null;
    return { value: parseInt(m[1], 10), percent: m[2] === "%" };
  }

  function resolveFenceposts(replicas, surgeSpec, unavailSpec) {
    var surge = surgeSpec.percent ? Math.ceil(surgeSpec.value * replicas / 100) : surgeSpec.value;
    var unavailable = unavailSpec.percent ? Math.floor(unavailSpec.value * replicas / 100) : unavailSpec.value;
    var bumped = false;
    if (surge === 0 && unavailable === 0) {
      unavailable = 1;
      bumped = true;
    }
    return { surge: surge, unavailable: unavailable, bumped: bumped };
  }

  // Assumes each new Pod becomes Ready at once, so it shows the controller's
  // limits rather than real timing.
  function rolloutSteps(replicas, surge, unavailable) {
    var old = replicas;
    var fresh = 0;
    var steps = [{ old: old, fresh: fresh, note: "Start" }];
    for (var guard = 0; guard < 500 && (fresh < replicas || old > 0); guard++) {
      var room = replicas + surge - (old + fresh);
      var add = Math.max(0, Math.min(replicas - fresh, room));
      if (add > 0) {
        fresh += add;
        steps.push({ old: old, fresh: fresh, note: "Create " + plural(add, "new Pod") });
      }
      var remove = Math.max(0, Math.min(old, old + fresh - (replicas - unavailable)));
      if (remove > 0) {
        old -= remove;
        steps.push({ old: old, fresh: fresh, note: "Delete " + plural(remove, "old Pod") });
      }
      if (add === 0 && remove === 0) break;
    }
    return steps;
  }

  function mountRollout(root) {
    var ui = frame(root, "Rolling update calculator", "Enter `replicas`, `maxSurge`, and `maxUnavailable` (a number or a percentage) to see the limits the Deployment controller enforces during a rollout.");
    var replicas = numberInput(10, { min: 0, max: 10000 });
    var surge = textInput("25%");
    var unavail = textInput("25%");
    ui.form.appendChild(h("div", { className: "cc-tool-grid" }, [
      field("replicas", replicas),
      field("maxSurge", surge, "Default 25%"),
      field("maxUnavailable", unavail, "Default 25%")
    ]));
    live([replicas, surge, unavail], function () {
      var r = parseIntStrict(replicas.value);
      var s = parseIntOrPercent(surge.value);
      var u = parseIntOrPercent(unavail.value);
      if (!(r >= 0) || r > 10000) return ui.show("`replicas` is a whole number from 0 to 10,000.");
      if (!s || !u) return ui.show("Use a whole number such as `1` or a percentage such as `25%`.");
      if (u.percent && u.value > 100) return ui.show("`maxUnavailable` can't be more than `100%`; the API rejects the Deployment.");
      if (s.value === 0 && u.value === 0) return ui.show("The API rejects `maxSurge: 0` together with `maxUnavailable: 0`: a rollout with no room to add or remove Pods can't make progress.");
      if (r === 0) return ui.show("With 0 replicas there is nothing to roll; the new ReplicaSet is simply created at 0.");

      var f = resolveFenceposts(r, s, u);
      var maxPods = r + f.surge;
      var minReady = Math.max(0, r - f.unavailable);
      var steps = rolloutSteps(r, f.surge, f.unavailable);
      var notes = [];
      if (s.percent) notes.push("`maxSurge: " + s.value + "%` of " + r + " is " + +(s.value * r / 100).toFixed(2) + ", **rounded up** to " + f.surge + ".");
      if (u.percent) notes.push("`maxUnavailable: " + u.value + "%` of " + r + " is " + +(u.value * r / 100).toFixed(2) + ", **rounded down** to " + (f.bumped ? 0 : f.unavailable) + ".");
      if (f.bumped) notes.push("Both limits resolved to 0, so the controller sets `maxUnavailable` to **1**. Otherwise the rollout could never start.");
      var warnings = [];
      if (minReady === 0) warnings.push(para("During this rollout **every Pod can be down at once**: `maxUnavailable` covers all " + plural(r, "replica") + ". Lower it or raise `replicas`.", "cc-tool-warn"));
      else if (r === 1 && f.surge === 0) warnings.push(para("One replica with no surge means the only Pod is deleted before its replacement is Ready: a short outage on every deploy.", "cc-tool-warn"));
      if (f.surge > 0) notes.push("Surge Pods need spare capacity: the cluster must fit " + maxPods + " Pods' worth of requests, or new Pods sit `Pending` and the rollout stalls.");
      notes.push("The table assumes each new Pod is Ready immediately. Real rollouts wait on readiness probes, `minReadySeconds`, and scheduling.");
      var shown = steps.slice(0, 40);
      ui.show("At most **" + maxPods + "** Pods exist at once, and at least **" + minReady + "** stay available.", warnings.concat([
        table(["Step", "Old Pods", "New Pods", "Total", "What changed"], shown.map(function (step, i) {
          return { cells: [i, step.old, step.fresh, step.old + step.fresh, step.note] };
        })),
        steps.length > shown.length ? para("… " + (steps.length - shown.length) + " more steps.", "cc-tool-muted") : null,
        bullets(notes)
      ]));
    });
  }

  /* ---------------------------------------------------------------------------
     Kubernetes: HorizontalPodAutoscaler desired replicas
     Mirrors the replica calculator: utilization is an integer percentage of
     the CPU request, desired = ceil(ratio x current), no change within the
     tolerance, then clamped to min/max.
     ------------------------------------------------------------------------- */

  function hpaDesired(o) {
    var ratio = o.current / o.target;
    var within = (1 - o.tolerance) <= ratio && ratio <= (1 + o.tolerance);
    var raw = within ? o.replicas : Math.ceil(ratio * o.replicas);
    var desired = Math.min(o.max, Math.max(o.min, raw));
    return { ratio: ratio, within: within, raw: raw, desired: desired };
  }

  function mountHpa(root) {
    var ui = frame(root, "HPA replica calculator", "See the replica count the HorizontalPodAutoscaler computes, including the tolerance band and the default scaling speed limits.");
    var mode = h("select", null, [
      h("option", { value: "cpu", text: "CPU utilization" }),
      h("option", { value: "value", text: "Any metric per Pod" })
    ]);
    var replicas = numberInput(4, { min: 1 });
    var request = numberInput(500, { min: 1 });
    var usage = numberInput(450, { min: 0 });
    var targetUtil = numberInput(60, { min: 1 });
    var current = numberInput(150, { min: 0 });
    var target = numberInput(100, { min: 1 });
    var min = numberInput(2, { min: 1 });
    var max = numberInput(20, { min: 1 });
    var tolerance = numberInput(10, { min: 0, max: 99 });
    var cpuFields = [field("CPU request per Pod (m)", request), field("Average usage per Pod (m)", usage), field("Target utilization (%)", targetUtil)];
    var valueFields = [field("Current value per Pod", current, "e.g. requests/s"), field("Target value per Pod", target)];
    ui.form.appendChild(h("div", { className: "cc-tool-grid" }, [field("Metric", mode), field("Current replicas", replicas)].concat(cpuFields, valueFields, [
      field("minReplicas", min), field("maxReplicas", max), field("Tolerance (%)", tolerance, "Default 10")
    ])));

    live([mode, replicas, request, usage, targetUtil, current, target, min, max, tolerance], function () {
      var cpu = mode.value === "cpu";
      cpuFields.forEach(function (f) { f.hidden = !cpu; });
      valueFields.forEach(function (f) { f.hidden = cpu; });
      var n = parseIntStrict(replicas.value);
      var lo = parseIntStrict(min.value);
      var hi = parseIntStrict(max.value);
      var tol = parseFloat(tolerance.value);
      if (!(n >= 1)) return ui.show("Current replicas must be at least 1. At 0 the HPA can't measure resource metrics; scale-to-zero (beta in v1.37) needs object or external metrics.");
      if (!(lo >= 1) || !(hi >= lo)) return ui.show("Use `minReplicas` of at least 1 and a `maxReplicas` no lower than it.");
      if (!(tol >= 0 && tol < 100)) return ui.show("Tolerance is a percentage from 0 to 99.");
      var cur;
      var tgt;
      var lines = [];
      if (cpu) {
        var req = parseIntStrict(request.value);
        var use = parseIntStrict(usage.value);
        tgt = parseIntStrict(targetUtil.value);
        if (!(req >= 1) || !(use >= 0) || !(tgt >= 1)) return ui.show("Enter whole millicores (for example `500` for half a CPU) and a target percentage.");
        cur = Math.trunc(use * 100 / req);
        lines.push("Utilization is measured against the **request**, not the limit: " + use + "m of " + req + "m is **" + cur + "%**" + (use * 100 % req ? " (the HPA drops the fraction)" : "") + ".");
      } else {
        cur = parseFloat(current.value);
        tgt = parseFloat(target.value);
        if (!(cur >= 0) || !(tgt > 0)) return ui.show("Enter the current and target value per Pod.");
      }
      var r = hpaDesired({ current: cur, target: tgt, replicas: n, min: lo, max: hi, tolerance: tol / 100 });
      lines.push("Ratio = " + cur + " / " + tgt + " = **" + (+r.ratio.toFixed(3)) + "**.");
      if (r.within) {
        lines.push("That's within the ±" + tol + "% tolerance (" + (+(1 - tol / 100).toFixed(3)) + " to " + (+(1 + tol / 100).toFixed(3)) + "), so the HPA **does nothing**. Changes this small would only cause flapping.");
      } else {
        lines.push("ceil(" + (+r.ratio.toFixed(3)) + " × " + n + ") = **" + r.raw + "** replicas" + (r.raw !== r.desired ? ", clamped to " + r.desired + " by min/max" : "") + ".");
      }
      var notes = [];
      if (r.desired > n) {
        var firstStep = Math.min(r.desired, Math.max(n * 2, n + 4));
        notes.push("Default scale-up: up to double, or +4 Pods, every 15 seconds (whichever is more). From " + n + " that's " + firstStep + " in the first period" + (firstStep < r.desired ? ", then " + r.desired + " later" : "") + ".");
        notes.push("New Pods count as using 0% until they're Ready, which damps the next step. Slow-starting apps should set a startup probe.");
      } else if (r.desired < n) {
        notes.push("Default scale-down waits for a **5-minute stabilization window**: the HPA uses the highest recommendation of the last 5 minutes, so it drops to " + r.desired + " only if load stays low.");
      }
      if (r.raw > hi) notes.push("`maxReplicas` is capping it. If this happens at peak, raise the cap or the cluster will run hot exactly when it matters.");
      if (cpu && cur > 100) notes.push("Utilization above 100% is normal: Pods may use more than they request, up to their limit.");
      notes.push("The tolerance is cluster-wide by default (`--horizontal-pod-autoscaler-tolerance`); since v1.37 each HPA can set its own under `behavior.scaleUp.tolerance` / `scaleDown.tolerance`.");
      ui.show(r.desired === n ? "Stays at **" + n + "** replicas." : "Scales " + (r.desired > n ? "up" : "down") + " from " + n + " to **" + r.desired + "** replicas.", [
        bullets(lines),
        bullets(notes)
      ]);
    });
  }

  /* ---------------------------------------------------------------------------
     Kubernetes: resource quantities (CPU and memory units)
     ------------------------------------------------------------------------- */

  var BINARY = { Ki: 1, Mi: 2, Gi: 3, Ti: 4, Pi: 5, Ei: 6 };
  var DECIMAL = { n: -9, u: -6, m: -3, "": 0, k: 3, M: 6, G: 9, T: 12, P: 15, E: 18 };
  var SUFFIX_HINTS = {
    K: "Use `k` (1,000) or `Ki` (1,024). Uppercase `K` isn't a valid suffix.",
    KB: "Drop the B: `512k` or `512Ki`.", MB: "Drop the B: `512M` (decimal) or `512Mi` (binary).",
    GB: "Drop the B: `1G` or `1Gi`.", TB: "Drop the B: `1T` or `1Ti`.",
    KiB: "Drop the B: `512Ki`.", MiB: "Drop the B: `512Mi`.", GiB: "Drop the B: `1Gi`.",
    mi: "Suffixes are case-sensitive: `Mi`, not `mi`.", gi: "Suffixes are case-sensitive: `Gi`, not `gi`.",
    ki: "Suffixes are case-sensitive: `Ki`, not `ki`.", g: "Suffixes are case-sensitive: `G`, not `g`.",
    cores: "Write cores as a bare number: `2` or `0.5`.", core: "Write cores as a bare number: `1`.",
    mcpu: "Write millicores with a lowercase m: `250m`."
  };

  function parseQuantity(text) {
    var s = String(text).trim();
    var m = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(.*)$/.exec(s);
    if (!m) return { error: "A quantity starts with a number, such as `250m`, `0.5`, `512Mi`, or `1G`." };
    var number = parseFloat(m[1]);
    var suffix = m[2].trim() === m[2] ? m[2] : null;
    if (suffix === null) return { error: "Remove the space between the number and the suffix." };
    if (Object.prototype.hasOwnProperty.call(BINARY, suffix)) return { number: number, suffix: suffix, value: number * Math.pow(1024, BINARY[suffix]), kind: "binary" };
    if (Object.prototype.hasOwnProperty.call(DECIMAL, suffix)) return { number: number, suffix: suffix, value: number * Math.pow(10, DECIMAL[suffix]), kind: "decimal" };
    var e = /^[eE]([+-]?\d+)$/.exec(suffix);
    if (e) return { number: number, suffix: suffix, value: number * Math.pow(10, parseInt(e[1], 10)), kind: "exponent" };
    return { error: "`" + suffix + "` isn't a Kubernetes suffix. " + (SUFFIX_HINTS[suffix] || "Valid ones are `m`, `k`, `M`, `G`, `T`, `Ki`, `Mi`, `Gi`, `Ti`, or an exponent such as `1e3`.") };
  }

  function formatNumber(value, digits) {
    if (value === 0) return "0";
    var abs = Math.abs(value);
    if (abs >= 1e15 || abs < 1e-3) return value.toExponential(3).replace(/\.?0+e/, "e");
    return (+value.toFixed(digits === undefined ? 3 : digits)).toLocaleString("en-US", { maximumFractionDigits: digits === undefined ? 3 : digits });
  }

  function mountUnits(root) {
    var ui = frame(root, "Resource quantity converter", "Type a CPU or memory value exactly as it would appear in a manifest. The converter shows what Kubernetes actually reads.");
    var resource = h("select", null, [h("option", { value: "memory", text: "Memory" }), h("option", { value: "cpu", text: "CPU" })]);
    var value = textInput("512Mi", { placeholder: "512Mi" });
    var chips = h("div", { className: "cc-tool-chips" }, [h("span", { className: "cc-tool-muted", text: "Try:" })]);
    [["memory", "512Mi"], ["memory", "1G"], ["memory", "512m"], ["memory", "1K"], ["cpu", "250m"], ["cpu", "0.1"], ["cpu", "1.5"]].forEach(function (ex) {
      var chip = h("button", { type: "button", className: "cc-tool-chip", text: (ex[0] === "cpu" ? "CPU " : "memory ") + ex[1] });
      chip.addEventListener("click", function () {
        resource.value = ex[0];
        value.value = ex[1];
        update();
      });
      chips.appendChild(chip);
    });
    ui.form.appendChild(chips);
    ui.form.appendChild(h("div", { className: "cc-tool-grid" }, [field("Resource", resource), field("Value", value)]));

    function update() {
      var q = parseQuantity(value.value);
      if (q.error) return ui.show(q.error);
      var warnings = [];
      var rows;
      var headline;
      if (q.number < 0) warnings.push("Requests and limits can't be negative.");
      if (resource.value === "cpu") {
        var milli = q.value * 1000;
        headline = "**" + formatNumber(q.value, 4) + "** CPU = **" + formatNumber(milli, 3) + "m** (millicores).";
        rows = [
          { cells: ["Cores", formatNumber(q.value, 4)] },
          { cells: ["Millicores", formatNumber(milli, 3) + "m"] },
          { cells: ["CFS quota as a limit", formatNumber(milli * 100, 0) + "µs of CPU time per 100ms period"] }
        ];
        if (Math.abs(milli - Math.round(milli)) > 1e-9) warnings.push("CPU can't be more precise than `1m`; write it in millicores.");
        if (q.kind === "binary") warnings.push("Binary suffixes are legal for CPU but meaningless here: `1Ki` CPU is 1,024 cores.");
        if (q.value >= 64) warnings.push("That's " + formatNumber(q.value) + " full cores. Did you mean `" + (q.number) + "m`?");
      } else {
        var bytes = q.value;
        headline = "**" + (bytes >= 1 ? Math.round(bytes).toLocaleString("en-US") : formatNumber(bytes, 6)) + "** bytes.";
        rows = [{ cells: ["Bytes", bytes >= 1 ? Math.round(bytes).toLocaleString("en-US") : formatNumber(bytes, 6)] }];
        if (bytes >= 1) {
          rows.push({ cells: ["KiB / MiB / GiB", formatNumber(bytes / 1024, 2) + " Ki · " + formatNumber(bytes / Math.pow(1024, 2), 3) + " Mi · " + formatNumber(bytes / Math.pow(1024, 3), 4) + " Gi"] });
          rows.push({ cells: ["kB / MB / GB", formatNumber(bytes / 1e3, 2) + " k · " + formatNumber(bytes / 1e6, 3) + " M · " + formatNumber(bytes / 1e9, 4) + " G"] });
        }
        if (["m", "u", "n"].indexOf(q.suffix) !== -1) warnings.push("Lowercase `" + q.suffix + "` is a fraction: `" + value.value.trim() + "` is " + formatNumber(bytes, 6) + " bytes, not mebibytes. The API accepts it, so the mistake only shows up when the container gets a memory limit of about one byte and won't start. Write `" + q.number + "Mi`.");
        else if (q.kind === "decimal" && ["k", "M", "G", "T"].indexOf(q.suffix) !== -1) warnings.push("`" + q.suffix + "` is decimal: `" + value.value.trim() + "` is " + formatNumber(bytes / Math.pow(1024, ({ k: 1, M: 2, G: 3, T: 4 })[q.suffix]), 3) + q.suffix + "i, about " + formatNumber(100 - 100 * bytes / (q.number * Math.pow(1024, ({ k: 1, M: 2, G: 3, T: 4 })[q.suffix])), 1) + "% less than `" + q.number + q.suffix + "i`.");
        else if (q.suffix === "" && bytes > 0 && bytes < 1024 * 1024) warnings.push("A bare number is bytes: `" + value.value.trim() + "` is " + Math.round(bytes) + " bytes. Did you mean `" + q.number + "Mi`?");
        if (bytes > 0 && bytes < 6 * 1024 * 1024 && ["m", "u", "n"].indexOf(q.suffix) === -1) warnings.push("A limit this small leaves no room for the process to start; most containers need tens of MiB.");
      }
      ui.show(headline, [
        table(["Unit", "Value"], rows),
        warnings.length ? h("div", null, warnings.map(function (w) { return para(w, "cc-tool-warn"); })) : para("Valid quantity.", "cc-tool-ok")
      ]);
    }
    resource.addEventListener("change", update);
    value.addEventListener("input", update);
    update();
  }

  /* ---------------------------------------------------------------------------
     Shell: how Bash turns a command line into arguments
     A model of Bash's expansions for simple commands, applied in Bash's
     order: brace expansion, tilde expansion, parameter and arithmetic
     expansion, command substitution (shown, never run), word splitting,
     pathname expansion, and quote removal.
     ------------------------------------------------------------------------- */

  var SH_SPECIAL = "@*#?$!-0_";
  var SH_ROOT = ["bin", "boot", "dev", "etc", "home", "lib", "lib64", "media", "mnt", "opt", "proc", "root", "run", "sbin", "srv", "sys", "tmp", "usr", "var"];
  var SH_LEAD = { "if": 1, "then": 1, "else": 1, "elif": 1, "do": 1, "while": 1, "until": 1, "!": 1, "time": 1, "{": 1 };
  var SH_ONLY = { "fi": 1, "done": 1, "esac": 1, "}": 1 };
  var SH_DECL = { "export": 1, "local": 1, "declare": 1, "readonly": 1, "typeset": 1 };

  function shBacktick(src, i) {
    for (var j = i + 1; j < src.length; j++) {
      if (src.charAt(j) === "\\") j++;
      else if (src.charAt(j) === "`") return j;
    }
    return -1;
  }

  function shSkipDouble(src, i) {
    for (var j = i + 1; j < src.length; j++) {
      var c = src.charAt(j);
      if (c === "\\") j++;
      else if (c === "\"") return j;
      else if (c === "$" && src.charAt(j + 1) === "(") {
        j = shMatch(src, j + 1, "(", ")");
        if (j < 0) return -1;
      }
    }
    return -1;
  }

  // Index of the bracket that closes the one at src[i], skipping quoted text.
  function shMatch(src, i, open, close) {
    var depth = 0;
    for (var j = i; j < src.length; j++) {
      var c = src.charAt(j);
      if (c === "\\") j++;
      else if (c === "'") {
        j = src.indexOf("'", j + 1);
        if (j < 0) return -1;
      } else if (c === "\"") {
        j = shSkipDouble(src, j);
        if (j < 0) return -1;
      } else if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return j;
      }
    }
    return -1;
  }

  function shAnsiC(src, i) {
    var map = { n: "\n", t: "\t", r: "\r", a: "\u0007", b: "\b", e: "\u001b", E: "\u001b", f: "\f", v: "\v", "\\": "\\", "'": "'", "\"": "\"", "?": "?" };
    var out = "";
    for (var j = i + 2; j < src.length; j++) {
      var c = src.charAt(j);
      if (c === "'") return { text: out, end: j + 1 };
      if (c !== "\\" || j + 1 >= src.length) {
        out += c;
        continue;
      }
      var rest = src.slice(j + 1);
      var m;
      if (map[rest.charAt(0)] !== undefined) {
        out += map[rest.charAt(0)];
        j += 1;
      } else if ((m = /^x([0-9a-fA-F]{1,2})/.exec(rest))) {
        out += String.fromCharCode(parseInt(m[1], 16));
        j += m[0].length;
      } else if ((m = /^[0-7]{1,3}/.exec(rest))) {
        out += String.fromCharCode(parseInt(m[0], 8));
        j += m[0].length;
      } else {
        out += "\\" + rest.charAt(0);
        j += 1;
      }
    }
    return { error: "A `$'` quote is never closed." };
  }

  function shParamSpec(inner) {
    var m = /^#([A-Za-z_][A-Za-z0-9_]*|[0-9]+|[@*#?$!-])$/.exec(inner);
    if (m) return { name: m[1], op: "len" };
    if (inner.charAt(0) === "!" && /^![A-Za-z_][A-Za-z0-9_]*$/.test(inner)) return { name: inner.slice(1), op: "indirect" };
    m = /^([A-Za-z_][A-Za-z0-9_]*|[0-9]+|[@*#?$!-])/.exec(inner);
    if (!m) return { error: "`${" + inner + "}` is a bad substitution." };
    var rest = inner.slice(m[1].length);
    if (rest === "") return { name: m[1], op: "" };
    if (rest.charAt(0) === "[") return { name: m[1], op: "array" };
    var ops = [":-", ":=", ":?", ":+", "-", "=", "?", "+", "##", "#", "%%", "%", "//", "/#", "/%", "/", "^^", "^", ",,", ",", ":"];
    for (var k = 0; k < ops.length; k++) {
      if (rest.indexOf(ops[k]) === 0) return { name: m[1], op: ops[k], arg: rest.slice(ops[k].length) };
    }
    return { error: "`${" + inner + "}` is a bad substitution." };
  }

  function shDollar(src, i, quoted) {
    var next = src.charAt(i + 1);
    var end;
    if (next === "(" && src.charAt(i + 2) === "(") {
      end = shMatch(src, i + 1, "(", ")");
      if (end > 0 && src.charAt(end - 1) === ")") {
        return { unit: { t: "e", kind: "arith", expr: src.slice(i + 3, end - 1), q: quoted, src: src.slice(i, end + 1) }, end: end + 1 };
      }
    }
    if (next === "(") {
      end = shMatch(src, i + 1, "(", ")");
      if (end < 0) return { error: "A `$(` is never closed." };
      return { unit: { t: "e", kind: "cmd", cmd: src.slice(i + 2, end).trim(), q: quoted, src: src.slice(i, end + 1) }, end: end + 1 };
    }
    if (next === "{") {
      end = shMatch(src, i + 1, "{", "}");
      if (end < 0) return { error: "A `${` is never closed." };
      var inner = src.slice(i + 2, end);
      if (/^[\s|]/.test(inner)) {
        // Bash 5.3: ${ cmd; } and ${| cmd; } run in the current shell.
        return { unit: { t: "e", kind: "cmd", cmd: inner.replace(/^\|/, "").trim().replace(/;$/, ""), q: quoted, src: src.slice(i, end + 1), nofork: true }, end: end + 1 };
      }
      var spec = shParamSpec(inner);
      if (spec.error) return { error: spec.error };
      spec.t = "e";
      spec.kind = "param";
      spec.q = quoted;
      spec.src = src.slice(i, end + 1);
      return { unit: spec, end: end + 1 };
    }
    var m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i + 1));
    if (m) return { unit: { t: "e", kind: "param", name: m[0], op: "", q: quoted, src: "$" + m[0] }, end: i + 1 + m[0].length };
    if (/[0-9]/.test(next)) return { unit: { t: "e", kind: "param", name: next, op: "", q: quoted, src: "$" + next, digit: true }, end: i + 2 };
    if (next && SH_SPECIAL.indexOf(next) !== -1) return { unit: { t: "e", kind: "param", name: next, op: "", q: quoted, src: "$" + next }, end: i + 2 };
    return null;
  }

  // Lex Bash source into commands of words. A word is a list of units:
  //   { t: "c", c, q }   one character; q = quoted, so never split or globbed
  //   { t: "q", at }     an opening quote, which keeps an empty word alive
  //   { t: "e", kind }   an expansion: param, cmd, arith, or procsub
  // With inner = true the text is one word (the argument of ${x:-word}).
  function shLex(src, inner) {
    var commands = [];
    var notes = [];
    var cmd = { words: [], redirs: [] };
    var word = null;
    var redir = null;
    var i = 0;

    function add(u, at) {
      if (!word) word = { units: [], start: at };
      word.units.push(u);
    }
    function endWord(at) {
      if (!word) return;
      word.src = src.slice(word.start, at);
      if (redir) {
        redir.target = word;
        cmd.redirs.push(redir);
        redir = null;
      } else cmd.words.push(word);
      word = null;
    }
    function endCommand(sep) {
      if (cmd.words.length || cmd.redirs.length) {
        cmd.sep = sep;
        commands.push(cmd);
      }
      cmd = { words: [], redirs: [] };
    }
    function dollar(at, quoted) {
      var d = shDollar(src, at, quoted);
      if (d && d.unit && d.unit.digit && /[0-9]/.test(src.charAt(d.end))) {
        var two = d.unit.name + src.charAt(d.end);
        notes.push("`$" + two + "` is `${" + d.unit.name + "}" + src.charAt(d.end) + "`: only one digit follows a bare `$`. Write `${" + two + "}` for argument " + two + ".");
      }
      return d;
    }

    while (i < src.length) {
      var c = src.charAt(i);
      var at = i;
      var d;
      if (c === "\\") {
        if (src.charAt(i + 1) === "\n") {
          i += 2;
          continue;
        }
        add({ t: "c", c: i + 1 < src.length ? src.charAt(i + 1) : "\\", q: true }, at);
        i += 2;
        continue;
      }
      if (c === "'") {
        var close = src.indexOf("'", i + 1);
        if (close < 0) return { error: "A single quote is never closed, so Bash would wait for more input." };
        add({ t: "q" }, at);
        for (var k = i + 1; k < close; k++) word.units.push({ t: "c", c: src.charAt(k), q: true });
        i = close + 1;
        continue;
      }
      if (c === "$" && src.charAt(i + 1) === "'") {
        var ansi = shAnsiC(src, i);
        if (ansi.error) return { error: ansi.error };
        add({ t: "q" }, at);
        for (var a = 0; a < ansi.text.length; a++) word.units.push({ t: "c", c: ansi.text.charAt(a), q: true });
        i = ansi.end;
        continue;
      }
      if (c === "\"" || (c === "$" && src.charAt(i + 1) === "\"")) {
        var j = i + (c === "$" ? 2 : 1);
        var seg = [];
        var closed = false;
        while (j < src.length) {
          var ch = src.charAt(j);
          if (ch === "\"") {
            closed = true;
            j++;
            break;
          }
          if (ch === "\\" && j + 1 < src.length && "$`\"\\\n".indexOf(src.charAt(j + 1)) !== -1) {
            if (src.charAt(j + 1) !== "\n") seg.push({ t: "c", c: src.charAt(j + 1), q: true });
            j += 2;
            continue;
          }
          if (ch === "$") {
            d = dollar(j, true);
            if (d && d.error) return { error: d.error };
            if (d) {
              seg.push(d.unit);
              j = d.end;
              continue;
            }
          }
          if (ch === "`") {
            var bq = shBacktick(src, j);
            if (bq < 0) return { error: "A backquote is never closed." };
            seg.push({ t: "e", kind: "cmd", cmd: src.slice(j + 1, bq).trim(), q: true, src: src.slice(j, bq + 1) });
            j = bq + 1;
            continue;
          }
          seg.push({ t: "c", c: ch, q: true });
          j++;
        }
        if (!closed) return { error: "A double quote is never closed, so Bash would wait for more input." };
        var onlyAt = seg.length === 1 && seg[0].kind === "param" && seg[0].name === "@" && !seg[0].op;
        add({ t: "q", at: onlyAt }, at);
        seg.forEach(function (u) { word.units.push(u); });
        i = j;
        continue;
      }
      if (c === "$") {
        d = dollar(i, false);
        if (d && d.error) return { error: d.error };
        if (d) {
          add(d.unit, at);
          i = d.end;
          continue;
        }
      }
      if (c === "`") {
        var b = shBacktick(src, i);
        if (b < 0) return { error: "A backquote is never closed." };
        add({ t: "e", kind: "cmd", cmd: src.slice(i + 1, b).trim(), q: false, src: src.slice(i, b + 1) }, at);
        i = b + 1;
        continue;
      }
      if (!inner) {
        if (c === " " || c === "\t") {
          endWord(i);
          i++;
          continue;
        }
        if (c === "#" && !word) {
          var nl = src.indexOf("\n", i);
          i = nl < 0 ? src.length : nl;
          continue;
        }
        if ((c === "<" || c === ">") && src.charAt(i + 1) === "(") {
          var ps = shMatch(src, i + 1, "(", ")");
          if (ps < 0) return { error: "A process substitution `" + c + "(` is never closed." };
          add({ t: "e", kind: "procsub", cmd: src.slice(i + 2, ps).trim(), q: false, src: src.slice(i, ps + 1) }, at);
          i = ps + 1;
          continue;
        }
        if (c === "&" && src.charAt(i + 1) === ">") {
          endWord(i);
          redir = { op: src.charAt(i + 2) === ">" ? "&>>" : "&>", fd: null };
          i += redir.op.length;
          while (src.charAt(i) === " " || src.charAt(i) === "\t") i++;
          continue;
        }
        if ("\n;&|()".indexOf(c) !== -1) {
          var pair = src.substr(i, 2);
          var op = ["&&", "||", ";;", "|&"].indexOf(pair) !== -1 ? pair : c;
          endWord(i);
          if (redir) return { error: "The redirection `" + redir.op + "` has no target." };
          endCommand(op);
          i += op.length;
          continue;
        }
        if (c === "<" || c === ">") {
          var fd = null;
          if (word && word.units.every(function (u) { return u.t === "c" && !u.q && /[0-9]/.test(u.c); })) {
            fd = word.units.map(function (u) { return u.c; }).join("");
            word = null;
          } else endWord(i);
          if (redir) return { error: "The redirection `" + redir.op + "` has no target." };
          var rop = /^(<<<|<<-|<<|<>|<&|>>|>&|>\||<|>)/.exec(src.slice(i))[1];
          i += rop.length;
          var dup = (rop === ">&" || rop === "<&") && /^(\d+|-)/.exec(src.slice(i));
          if (dup) {
            cmd.redirs.push({ op: rop, fd: fd, target: dup[1] });
            i += dup[1].length;
            continue;
          }
          redir = { op: rop, fd: fd };
          while (src.charAt(i) === " " || src.charAt(i) === "\t") i++;
          continue;
        }
      }
      add({ t: "c", c: c, q: false }, at);
      i++;
    }
    if (inner) return { units: word ? word.units : [] };
    endWord(i);
    if (redir) return { error: "The redirection `" + redir.op + "` has no target." };
    endCommand("");
    return { commands: commands, notes: notes };
  }

  function shChars(text, flags, name) {
    var out = [];
    for (var i = 0; i < text.length; i++) out.push({ c: text.charAt(i), split: flags, glob: flags, v: name });
    return out;
  }

  function shText(pieces) {
    return pieces.filter(function (p) { return p.c !== undefined; }).map(function (p) { return p.c; }).join("");
  }

  function shLookup(name, ctx) {
    if (/^[0-9]+$/.test(name)) {
      var n = parseInt(name, 10);
      if (n === 0) return "./script.sh";
      return n <= ctx.args.length ? ctx.args[n - 1] : undefined;
    }
    var fixed = { "#": String(ctx.args.length), "?": "0", "$": "4242", "!": "", "-": "hB", "_": "" };
    if (fixed[name] !== undefined) return fixed[name];
    if (name === "@" || name === "*") return ctx.args.length ? ctx.args.join(" ") : undefined;
    return Object.prototype.hasOwnProperty.call(ctx.vars, name) ? ctx.vars[name] : undefined;
  }

  // Glob pieces -> regular expression source. Only unquoted * ? [...] are wildcards.
  function shGlobSource(pieces, path) {
    var out = "";
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      if (p.glob && p.c === "*") out += path ? "[^/]*" : "[\\s\\S]*";
      else if (p.glob && p.c === "?") out += path ? "[^/]" : "[\\s\\S]";
      else if (p.glob && p.c === "[") {
        var j = i + 1;
        var neg = j < pieces.length && (pieces[j].c === "!" || pieces[j].c === "^");
        if (neg) j++;
        var body = "";
        var first = true;
        while (j < pieces.length && (pieces[j].c !== "]" || first)) {
          body += /[\\\][^]/.test(pieces[j].c) ? "\\" + pieces[j].c : pieces[j].c;
          first = false;
          j++;
        }
        if (j < pieces.length && body) {
          out += "[" + (neg ? "^" : "") + body + "]";
          i = j;
        } else out += "\\[";
      } else out += p.c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    }
    return out;
  }

  function shTrim(value, pieces, op) {
    var re = new RegExp("^(?:" + shGlobSource(pieces, false) + ")$");
    var n = value.length;
    var k;
    if (op === "#") { for (k = 0; k <= n; k++) if (re.test(value.slice(0, k))) return value.slice(k); }
    if (op === "##") { for (k = n; k >= 0; k--) if (re.test(value.slice(0, k))) return value.slice(k); }
    if (op === "%") { for (k = n; k >= 0; k--) if (re.test(value.slice(k))) return value.slice(0, k); }
    if (op === "%%") { for (k = 0; k <= n; k++) if (re.test(value.slice(k))) return value.slice(0, k); }
    return value;
  }

  function shSplitSlash(text) {
    for (var i = 0; i < text.length; i++) {
      if (text.charAt(i) === "\\") i++;
      else if (text.charAt(i) === "/") return [text.slice(0, i), text.slice(i + 1)];
    }
    return [text, ""];
  }

  // Integer arithmetic for $(( )): + - * / % ** comparisons, && || and parentheses.
  function shArith(expr, ctx) {
    var s = expr.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, "$1");
    var tokens = s.match(/\d+|[A-Za-z_][A-Za-z0-9_]*|\*\*|<=|>=|==|!=|&&|\|\||[-+*/%()<>!]|\S/g) || [];
    var pos = 0;
    var levels = [["||"], ["&&"], ["==", "!="], ["<", "<=", ">", ">="], ["+", "-"], ["*", "/", "%"]];
    function fail(msg) { throw new Error(msg); }
    function atom() {
      var t = tokens[pos++];
      if (t === undefined) fail("the expression ends early");
      if (t === "(") {
        var v = level(0);
        if (tokens[pos++] !== ")") fail("a `(` isn't closed");
        return v;
      }
      if (t === "-") return -unary();
      if (t === "+") return unary();
      if (t === "!") return unary() ? 0 : 1;
      if (/^\d+$/.test(t)) return parseInt(t, 10);
      if (/^[A-Za-z_]/.test(t)) {
        var raw = ctx.vars[t];
        return raw && /^\s*-?\d+\s*$/.test(raw) ? parseInt(raw, 10) : 0;
      }
      fail("`" + t + "` isn't supported here");
    }
    function unary() {
      var base = atom();
      if (tokens[pos] === "**") {
        pos++;
        return Math.pow(base, unary());
      }
      return base;
    }
    function level(n) {
      if (n === levels.length) return unary();
      var left = level(n + 1);
      while (levels[n].indexOf(tokens[pos]) !== -1) {
        var op = tokens[pos++];
        var right = level(n + 1);
        if ((op === "/" || op === "%") && right === 0) fail("division by 0");
        left = op === "||" ? (left || right ? 1 : 0) : op === "&&" ? (left && right ? 1 : 0)
          : op === "==" ? +(left === right) : op === "!=" ? +(left !== right)
          : op === "<" ? +(left < right) : op === "<=" ? +(left <= right) : op === ">" ? +(left > right) : op === ">=" ? +(left >= right)
          : op === "+" ? left + right : op === "-" ? left - right : op === "*" ? left * right
          : op === "/" ? Math.trunc(left / right) : left % right;
      }
      return left;
    }
    try {
      if (!tokens.length) return { value: 0 };
      var value = level(0);
      if (pos < tokens.length) fail("`" + tokens[pos] + "` isn't supported here");
      return { value: value };
    } catch (e) {
      return { error: e.message };
    }
  }

  function shArgPieces(text, ctx, quoted, info) {
    var lexed = shLex(text || "", true);
    if (lexed.error) {
      ctx.error = lexed.error;
      return [];
    }
    return shExpandUnits(shTilde(lexed.units, info), ctx, { quoted: quoted, literalSplit: !quoted, info: info });
  }

  function shParam(u, ctx, q, out, info) {
    var name = u.name;
    if ((name === "@" || name === "*") && u.op === "") {
      info.at = info.at || (q ? "\"$" + name + "\"" : "$" + name);
      if (name === "*" && q) {
        var sep = ctx.vars.IFS === undefined ? " " : ctx.vars.IFS.charAt(0);
        out.push({ mark: true });
        shChars(ctx.args.join(sep), false, null).forEach(function (p) { out.push(p); });
        return;
      }
      ctx.args.forEach(function (arg, k) {
        if (k > 0) out.push({ brk: true, force: q });
        if (q) out.push({ mark: true });
        shChars(arg, !q, null).forEach(function (p) { out.push(p); });
      });
      return;
    }
    var value = shLookup(name, ctx);
    var set = value !== undefined;
    var isNull = !set || value === "";
    var colon = u.op.length === 2 && u.op.charAt(0) === ":";
    var missing = colon ? isNull : !set;
    var result = set ? value : "";
    var pieces = null;
    switch (u.op) {
      case "":
        if (!set && ctx.nounset && SH_SPECIAL.indexOf(name) === -1) {
          ctx.error = "bash: " + name + ": unbound variable";
          return;
        }
        break;
      case ":-": case "-":
        if (missing) pieces = shArgPieces(u.arg, ctx, q, info);
        break;
      case ":=": case "=":
        if (missing) {
          if (!/^[A-Za-z_]/.test(name)) {
            ctx.error = "bash: $" + name + ": cannot assign in this way";
            return;
          }
          pieces = shArgPieces(u.arg, ctx, q, info);
          ctx.vars[name] = shText(pieces);
          ctx.notes.push("`" + u.src + "` also **assigned** `" + name + "`, so later words and commands see the new value.");
        }
        break;
      case ":?": case "?":
        if (missing) {
          var msg = shText(shArgPieces(u.arg, ctx, true, info));
          ctx.error = "bash: " + name + ": " + (msg || (colon ? "parameter null or not set" : "parameter not set"));
          return;
        }
        break;
      case ":+": case "+":
        pieces = (colon ? !isNull : set) ? shArgPieces(u.arg, ctx, q, info) : [];
        break;
      case "len":
        result = name === "@" || name === "*" ? String(ctx.args.length) : String(result.length);
        break;
      case "#": case "##": case "%": case "%%":
        result = shTrim(result, shArgPieces(u.arg, ctx, false, info), u.op);
        break;
      case "/": case "//": case "/#": case "/%":
        var parts = shSplitSlash(u.arg);
        var pat = shGlobSource(shArgPieces(parts[0], ctx, false, info), false);
        var rep = shText(shArgPieces(parts[1], ctx, true, info));
        if (pat) {
          if (u.op === "/#") pat = "^(?:" + pat + ")";
          if (u.op === "/%") pat = "(?:" + pat + ")$";
          result = result.replace(new RegExp(pat, u.op === "//" ? "g" : ""), function () { return rep; });
        }
        break;
      case "^^": result = result.toUpperCase(); break;
      case ",,": result = result.toLowerCase(); break;
      case "^": result = result.charAt(0).toUpperCase() + result.slice(1); break;
      case ",": result = result.charAt(0).toLowerCase() + result.slice(1); break;
      case ":":
        var nums = u.arg.split(":");
        var off = shArith(nums[0], ctx);
        var len = nums.length > 1 ? shArith(nums[1], ctx) : null;
        if (off.error || (len && len.error)) {
          ctx.error = "bash: " + u.src + ": " + (off.error || len.error);
          return;
        }
        if (/^\s*-/.test(u.arg) === false && /^-/.test(nums[0])) info.minusTrap = true;
        var start = off.value < 0 ? Math.max(0, result.length + off.value) : off.value;
        var stop = len === null ? result.length : len.value < 0 ? result.length + len.value : start + len.value;
        result = result.slice(start, Math.max(start, stop));
        break;
      case "indirect":
        result = set ? shLookup(value, ctx) || "" : "";
        break;
      default:
        result = "\u2039" + u.src + "\u203a";
        ctx.notes.push("Arrays aren't simulated here, so `" + u.src + "` is shown as a placeholder.");
    }
    if (u.op === ":-" && /^-?\d/.test(u.arg || "")) info.minusTrap = true;
    if (q) out.push({ mark: true });
    if (pieces) {
      pieces.forEach(function (p) { if (!p.mark || q) out.push(p); });
      if (!pieces.some(function (p) { return p.c !== undefined; })) info.empty.push(u.src);
      return;
    }
    if (result === "") info.empty.push(u.src);
    shChars(result, !q, u.src).forEach(function (p) { out.push(p); });
  }

  function shExpandUnits(units, ctx, opts) {
    var out = [];
    var info = opts.info;
    for (var i = 0; i < units.length && !ctx.error; i++) {
      var u = units[i];
      var q = u.q || opts.quoted;
      if (u.t === "q") {
        if (!u.at || ctx.args.length) out.push({ mark: true });
      } else if (u.t === "c") {
        out.push({ c: u.c, split: opts.literalSplit && !q, glob: !q });
      } else if (u.kind === "cmd") {
        if (q) out.push({ mark: true });
        shChars("\u2039" + u.cmd + "\u203a", false, null).forEach(function (p) { out.push(p); });
        info.cmds.push({ src: u.src, quoted: q, nofork: u.nofork });
      } else if (u.kind === "procsub") {
        shChars("/dev/fd/63", false, null).forEach(function (p) { out.push(p); });
        info.procsub = true;
      } else if (u.kind === "arith") {
        var r = shArith(u.expr, ctx);
        if (r.error) ctx.error = "bash: " + u.expr.trim() + ": " + r.error;
        else shChars(String(r.value), !q, u.src).forEach(function (p) { out.push(p); });
      } else shParam(u, ctx, q, out, info);
    }
    return out;
  }

  function shTilde(units, info) {
    if (!units.length || units[0].t !== "c" || units[0].c !== "~") return units;
    if (units[0].q) {
      info.quotedTilde = true;
      return units;
    }
    var j = 1;
    var user = "";
    while (j < units.length && units[j].t === "c" && !units[j].q && units[j].c !== "/") user += units[j++].c;
    if (j < units.length && (units[j].t !== "c" || units[j].q)) return units;
    if (!/^[A-Za-z0-9._-]*$/.test(user)) return units;
    var home = user === "" ? (info.home === undefined ? "/home/you" : info.home) : user === "root" ? "/root" : "/home/" + user;
    return home.split("").map(function (ch) { return { t: "c", c: ch, q: true }; }).concat(units.slice(j));
  }

  // Brace expansion on unquoted { , } and {a..b}; expansions inside stay intact.
  function shBrace(units, limit) {
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      if (u.t !== "c" || u.q || u.c !== "{") continue;
      var depth = 0;
      var commas = [];
      var close = -1;
      for (var j = i; j < units.length; j++) {
        var v = units[j];
        if (v.t !== "c" || v.q) continue;
        if (v.c === "{") depth++;
        else if (v.c === "}" && --depth === 0) {
          close = j;
          break;
        } else if (v.c === "," && depth === 1) commas.push(j);
      }
      if (close < 0) continue;
      var alts = [];
      if (commas.length) {
        var from = i + 1;
        commas.concat([close]).forEach(function (end) {
          alts.push(units.slice(from, end));
          from = end + 1;
        });
      } else {
        var inner = units.slice(i + 1, close);
        if (!inner.every(function (x) { return x.t === "c" && !x.q; })) continue;
        var seq = shSequence(inner.map(function (x) { return x.c; }).join(""), limit);
        if (!seq) continue;
        alts = seq.map(function (s) { return s.split("").map(function (ch) { return { t: "c", c: ch, q: false }; }); });
      }
      var out = [];
      for (var a = 0; a < alts.length && out.length <= limit; a++) {
        shBrace(units.slice(0, i).concat(alts[a], units.slice(close + 1)), limit).forEach(function (w) { out.push(w); });
      }
      return out.slice(0, limit + 1);
    }
    return [units];
  }

  function shSequence(text, limit) {
    var m = /^(-?\d+)\.\.(-?\d+)(?:\.\.(-?\d+))?$/.exec(text);
    var out = [];
    var step;
    if (m) {
      var a = parseInt(m[1], 10);
      var b = parseInt(m[2], 10);
      step = Math.abs(parseInt(m[3] || "1", 10)) || 1;
      var width = /^-?0\d/.test(m[1]) || /^-?0\d/.test(m[2]) ? Math.max(m[1].length, m[2].length) : 0;
      for (var n = a; a <= b ? n <= b : n >= b; n += a <= b ? step : -step) {
        var s = String(Math.abs(n));
        while (s.length < width - (n < 0 ? 1 : 0)) s = "0" + s;
        out.push((n < 0 ? "-" : "") + s);
        if (out.length > limit) break;
      }
      return out;
    }
    m = /^([A-Za-z])\.\.([A-Za-z])(?:\.\.(-?\d+))?$/.exec(text);
    if (!m) return null;
    var x = m[1].charCodeAt(0);
    var y = m[2].charCodeAt(0);
    step = Math.abs(parseInt(m[3] || "1", 10)) || 1;
    for (var c = x; x <= y ? c <= y : c >= y; c += x <= y ? step : -step) out.push(String.fromCharCode(c));
    return out;
  }

  function shSplit(pieces, ifs, info) {
    var ws = "";
    var other = "";
    for (var k = 0; k < ifs.length; k++) {
      if (" \t\n".indexOf(ifs.charAt(k)) !== -1) ws += ifs.charAt(k);
      else other += ifs.charAt(k);
    }
    var fields = [];
    var cur = [];
    var has = false;
    var afterWs = false;
    function flush(force) {
      if (has || force) fields.push(cur);
      cur = [];
      has = false;
    }
    pieces.forEach(function (p) {
      if (p.brk) {
        flush(p.force);
        afterWs = false;
      } else if (p.mark) {
        has = true;
        afterWs = false;
      } else if (p.split && ws.indexOf(p.c) !== -1) {
        if (has) {
          if (p.v) info.splitVars.push(p.v);
          flush(false);
          afterWs = true;
        }
      } else if (p.split && other.indexOf(p.c) !== -1) {
        if (p.v) info.splitVars.push(p.v);
        if (!(afterWs && !has)) flush(true);
        afterWs = false;
      } else {
        cur.push(p);
        has = true;
        afterWs = false;
      }
    });
    flush(false);
    return fields;
  }

  function shGlob(field, ctx, info) {
    var text = shText(field);
    if (!field.some(function (p) { return p.glob && "*?[".indexOf(p.c) !== -1; })) return [text];
    if (field.some(function (p) { return p.glob && p.v && "*?[".indexOf(p.c) !== -1; })) info.globVars.push(field.filter(function (p) { return p.v; })[0].v);
    var candidates = null;
    var prefix = "";
    var pattern = field;
    if (text.indexOf("/") === -1) candidates = ctx.files;
    else if (/^\/[^/]*$/.test(text)) {
      candidates = SH_ROOT;
      prefix = "/";
      pattern = field.slice(1);
    }
    if (!candidates) {
      info.unsimulated.push(text);
      return [text];
    }
    var re = new RegExp("^" + (pattern.length && pattern[0].c === "." ? "" : "(?!\\.)") + shGlobSource(pattern, true) + "$");
    var hits = candidates.filter(function (name) { return re.test(name); }).sort().map(function (name) { return prefix + name; });
    if (hits.length) {
      info.matched.push({ pattern: text, count: hits.length, root: prefix === "/" });
      return hits;
    }
    info.nomatch.push(text);
    return ctx.nullglob ? [] : [text];
  }

  function shExpandWord(word, ctx, mode) {
    var info = { src: word.src, empty: [], splitVars: [], globVars: [], matched: [], nomatch: [], unsimulated: [], cmds: [], home: ctx.vars.HOME };
    var variants = mode.brace ? shBrace(word.units, 500) : [word.units];
    if (variants.length > 1) info.brace = variants.length;
    var out = [];
    var ifs = ctx.vars.IFS === undefined ? " \t\n" : ctx.vars.IFS;
    variants.forEach(function (units) {
      if (ctx.error) return;
      var pieces = shExpandUnits(shTilde(units, info), ctx, { quoted: false, literalSplit: false, info: info });
      if (ctx.error) return;
      var fields = mode.split ? shSplit(pieces, ifs, info) : [pieces.map(function (p) { return p.brk ? { c: " " } : p; }).filter(function (p) { return !p.mark; })];
      fields.forEach(function (f) {
        (mode.glob && !ctx.noglob ? shGlob(f, ctx, info) : [shText(f)]).forEach(function (t) { out.push(t); });
      });
    });
    info.fields = out;
    return info;
  }

  function shAssign(word) {
    var name = "";
    for (var i = 0; i < word.units.length; i++) {
      var u = word.units[i];
      if (u.t !== "c" || u.q) return null;
      if (u.c === "=" || (u.c === "+" && word.units[i + 1] && word.units[i + 1].c === "=")) {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null;
        var skip = u.c === "+" ? 2 : 1;
        return { name: name, append: u.c === "+", units: word.units.slice(i + skip), src: word.src };
      }
      name += u.c;
    }
    return null;
  }

  function shParseVars(text) {
    var vars = {};
    String(text || "").split(/\r?\n/).forEach(function (line) {
      var m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
      if (!m) return;
      var raw = m[2].replace(/\s+$/, "");
      var q = /^(['"])([\s\S]*)\1$/.exec(raw);
      vars[m[1]] = q ? (q[1] === "\"" ? q[2].replace(/\\(["\\$`])/g, "$1") : q[2]) : raw;
    });
    return vars;
  }

  function shRun(src, options) {
    var o = options || {};
    var lexed = shLex(String(src || "").replace(/\r\n?/g, "\n"), false);
    if (lexed.error) return { error: lexed.error };
    var args = shellWords(o.args || "");
    var files = shellWords(o.files || "");
    if (args.error) return { error: "Script arguments: " + args.error };
    if (files.error) return { error: "Files: " + files.error };
    var ctx = { vars: shParseVars(o.vars), args: args.words, files: files.words, nounset: !!o.nounset, nullglob: !!o.nullglob, notes: [], error: null };
    var results = [];
    var loopVar = null;
    for (var c = 0; c < lexed.commands.length && !ctx.error; c++) {
      var cmd = lexed.commands[c];
      var words = cmd.words.slice();
      while (words.length && SH_LEAD[words[0].src]) words.shift();
      if (!words.length && !cmd.redirs.length) continue;
      if (words.length === 1 && SH_ONLY[words[0].src]) continue;
      var res = { assigns: [], argv: [], words: [], redirs: [], sep: cmd.sep };
      if (words[0] && words[0].src === "for" && words[1]) {
        res.loop = words[1].src;
        var items = [];
        var listWords = words[2] && words[2].src === "in" ? words.slice(3) : null;
        if (!listWords) items = ctx.args.slice();
        else listWords.forEach(function (w) {
          var info = shExpandWord(w, ctx, { split: true, glob: true, brace: true });
          res.words.push(info);
          info.fields.forEach(function (f) { items.push(f); });
        });
        res.argv = items;
        if (items.length) {
          ctx.vars[res.loop] = items[0];
          loopVar = res.loop;
        }
        results.push(res);
        continue;
      }
      var k = 0;
      var asg;
      while (k < words.length && (asg = shAssign(words[k]))) {
        var info0 = { src: asg.src, empty: [], splitVars: [], globVars: [], matched: [], nomatch: [], unsimulated: [], cmds: [] };
        var value = shText(shExpandUnits(shTilde(asg.units, info0), ctx, { quoted: false, literalSplit: false, info: info0 }).filter(function (p) { return !p.mark; }));
        if (ctx.error) break;
        res.assigns.push({ name: asg.name, value: (asg.append && ctx.vars[asg.name] ? ctx.vars[asg.name] : "") + value });
        k++;
      }
      if (ctx.error) {
        res.stopped = ctx.error;
        results.push(res);
        break;
      }
      if (k === words.length) {
        res.assigns.forEach(function (a) { ctx.vars[a.name] = a.value; });
        res.assignOnly = true;
      }
      if (words[k] && words[k + 1] && /^[A-Za-z_][A-Za-z0-9_]*$/.test(words[k].src) && /^=/.test(words[k + 1].src)) res.spacedAssign = words[k].src;
      var dbl = words[k] && words[k].src === "[[";
      res.dbl = dbl;
      var decl = false;
      for (var w = k; w < words.length && !ctx.error; w++) {
        var asgWord = decl && shAssign(words[w]);
        var flat = dbl || !!asgWord;
        var ex = shExpandWord(words[w], ctx, { split: !flat, glob: !flat, brace: !flat });
        if (ctx.error) break;
        ex.assignArg = !!asgWord;
        res.words.push(ex);
        ex.fields.forEach(function (f) { res.argv.push(f); });
        if (w === k && SH_DECL[res.argv[0]]) decl = true;
      }
      cmd.redirs.forEach(function (r) {
        if (ctx.error) return;
        var target = typeof r.target === "string" ? r.target : shExpandWord(r.target, ctx, { split: false, glob: false, brace: false }).fields[0];
        res.redirs.push({ op: r.op, fd: r.fd, target: target });
      });
      res.prefixRef = res.assigns.filter(function (a) {
        return !res.assignOnly && res.words.some(function (info) { return new RegExp("\\$\\{?" + a.name + "\\b").test(info.src); });
      }).map(function (a) { return a.name; });
      if (ctx.error) res.stopped = ctx.error;
      results.push(res);
    }
    return { commands: results, notes: lexed.notes.concat(ctx.notes), stopped: ctx.error, loopVar: loopVar, vars: ctx.vars };
  }

  var SH_TOP = /^\/(?:bin|boot|dev|etc|home|lib|lib32|lib64|media|mnt|opt|proc|root|run|sbin|srv|sys|tmp|usr|var)\/?$/;

  // Warnings for one expanded command. Returns { danger, warn, note } lists.
  function shAdvice(res) {
    var danger = [];
    var warn = [];
    var note = [];
    var argv = res.argv;
    var name = argv[0] ? argv[0].replace(/^.*\//, "") : "";
    function uniq(list) { return list.filter(function (x, i) { return list.indexOf(x) === i; }); }
    if (name === "rm" && !res.loop) {
      var recursive = false;
      var operands = [];
      var ended = false;
      argv.slice(1).forEach(function (a) {
        if (!ended && a === "--") ended = true;
        else if (!ended && /^-[a-zA-Z]+$/.test(a)) recursive = recursive || /[rR]/.test(a);
        else if (!ended && /^--/.test(a)) recursive = recursive || a === "--recursive";
        else operands.push(a);
      });
      var top = operands.filter(function (a) { return SH_TOP.test(a); });
      if (recursive && operands.indexOf("/") !== -1) danger.push("This is `rm -r /`. GNU `rm` refuses it by default (`--preserve-root`), but only for `/` itself: `/*` expands to every top-level directory and is not protected.");
      if (recursive && top.length) {
        var fromRoot = res.words.some(function (info) { return info.matched.some(function (m) { return m.root; }); });
        var emptied = res.words.filter(function (info) { return info.empty.length && info.fields.some(function (f) { return SH_TOP.test(f) || f === "/"; }); });
        danger.push("This deletes " + (top.length === 1 ? "`" + top[0] + "`" : top.length + " top-level directories (`" + top.slice(0, 4).join("`, `") + "`…)") + "." +
          (emptied.length ? " `" + uniq([].concat.apply([], emptied.map(function (i) { return i.empty; }))).join("`, `") + "` expanded to nothing, so the path collapsed to the root. Steam for Linux shipped exactly this in 2015." : fromRoot ? " The glob was matched against `/`." : " A stray space can do this: Bumblebee's 2011 installer split `/usr/lib/...` into `/usr` and `/lib/...`."));
        danger.push("Guard it: `rm -rf \"${DIR:?}\"/*` stops the script when `DIR` is empty or unset. `set -u` alone doesn't help, because an empty variable is set.");
      }
      if (recursive && operands.some(function (a) { return a === "." || a === ".."; })) warn.push("`rm` refuses `.` and `..` by name, but `rm -rf *` in the wrong directory doesn't. Check `cd` succeeded: `cd \"$dir\" || exit 1`.");
    }
    res.words.forEach(function (info) {
      if (info.empty.length && !info.fields.length) {
        warn.push("`" + info.src + "` expanded to nothing and **vanished**: the command got one argument fewer. Quote it (`\"" + info.src.replace(/^"|"$/g, "") + "\"`) to pass an empty string instead.");
      }
      if (info.splitVars.length && info.fields.length > 1 && !info.brace) {
        warn.push("`" + uniq(info.splitVars).join("`, `") + "` contained spaces, so `" + info.src + "` became **" + info.fields.length + " arguments**. Quote it to keep one.");
      }
      if (info.globVars.length) warn.push("`" + info.globVars[0] + "` contains a wildcard, and because it isn't quoted Bash expanded it against filenames.");
      info.nomatch.forEach(function (p) { note.push("`" + p + "` matched no files, so Bash passed it through unchanged. `shopt -s nullglob` drops it instead; `failglob` stops the command."); });
      info.unsimulated.forEach(function (p) { note.push("`" + p + "` would be matched against the real filesystem; this page can't list it."); });
      info.cmds.forEach(function (cmdsub) {
        note.push("`" + cmdsub.src + "` isn't run here; its output is shown as a placeholder." + (cmdsub.quoted ? "" : " Unquoted, the output is also split on spaces and globbed. Write `\"" + cmdsub.src + "\"`.") + (cmdsub.nofork ? " This Bash 5.3 form runs in the current shell, without a subshell." : ""));
      });
      if (info.quotedTilde) note.push("A quoted `~` isn't expanded. Use `$HOME` inside quotes.");
      if (info.procsub) note.push("A process substitution becomes a path such as `/dev/fd/63`, which the command opens like a file.");
      if (info.minusTrap) note.push("`${x:-1}` is a default value, not a substring. For the last characters write `${x: -1}`, with a space.");
      if (info.at === "$*" || info.at === "$@") note.push("Unquoted `" + info.at + "` re-splits every argument. `\"$@\"` keeps each one intact.");
      if (info.at === "\"$*\"") note.push("`\"$*\"` joins all arguments into **one** string. Use `\"$@\"` to pass them on separately.");
    });
    if ((name === "[" || name === "test") && res.words.some(function (info) { return info.empty.length && !info.fields.length; })) {
      warn.push("`[` is an ordinary command, so a vanished operand changes its syntax: Bash reports `unary operator expected`. Quote the variable, or use `[[ ]]`.");
    }
    if (res.dbl) note.push("Inside `[[ ]]` Bash doesn't split or glob words, which is why `[[ $x == prod ]]` is safe unquoted while `[ $x = prod ]` isn't.");
    if (name === "echo" && res.words.some(function (info) { return info.splitVars.length; })) note.push("`echo` joins its arguments with single spaces, which is why `echo $var` squeezes runs of spaces and newlines.");
    if (res.spacedAssign) warn.push("Spaces around `=` make Bash run a **command** named `" + res.spacedAssign + "`. Write `" + res.spacedAssign + "=value` with no spaces.");
    if (res.prefixRef && res.prefixRef.length) warn.push("`" + res.prefixRef.join("`, `") + "` is expanded **before** the prefix assignment applies; `VAR=x cmd` only sets it in `cmd`'s environment.");
    if (res.words.some(function (info) { return info.assignArg; })) note.push("`" + argv[0] + "` arguments that look like assignments aren't split or globbed. But `local x=$(cmd)` still hides `cmd`'s exit status; declare first, then assign.");
    var r2 = res.redirs.map(function (r) { return (r.fd || "") + r.op; });
    var dupAt = r2.indexOf("2>&");
    var outAt = r2.findIndex(function (op, i) { return /^1?>{1,2}$/.test(op) && i > dupAt; });
    if (dupAt !== -1 && outAt !== -1 && res.redirs[dupAt].target === "1") warn.push("Order matters: `2>&1` copies stderr to where stdout points **now**, then `>` moves only stdout. Write `> file 2>&1`.");
    return { danger: danger, warn: warn, note: note };
  }

  var SH_PRESETS = [
    { label: "Steam 2015", cmd: "rm -rf \"$STEAMROOT/\"*", vars: "STEAMROOT=" },
    { label: "…with the guard", cmd: "rm -rf \"${STEAMROOT:?}/\"*", vars: "STEAMROOT=" },
    { label: "Bumblebee 2011", cmd: "rm -rf /usr /lib/nvidia-current/xorg/xorg", vars: "" },
    { label: "Spaces in a filename", cmd: "cp $FILE /backup/", vars: "FILE=Q3 report.pdf" },
    { label: "Empty test", cmd: "[ $ENV = prod ] && echo deploying", vars: "ENV=" },
    { label: "\"$@\" vs $*", cmd: "printf '<%s>\\n' \"$@\" $*", args: "\"my file.txt\" -v" },
    { label: "Braces", cmd: "cp nginx.conf{,.bak} && mkdir -p logs/{2025..2027}", vars: "" },
    { label: "Wildcard in a variable", cmd: "echo Cleaning $PATTERN", vars: "PATTERN=*.log", files: "app.log error.log notes.md" },
    { label: "Redirect order", cmd: "./backup.sh 2>&1 > /var/log/backup.log", vars: "" }
  ];

  function shArgvList(argv, loop) {
    return h("ol", { className: "cc-argv" }, argv.map(function (a, i) {
      var shown = a.replace(/\n/g, "\u21b5").replace(/\t/g, "\u21e5");
      return h("li", null, [
        h("span", { className: "cc-argv-n", text: loop ? String(i + 1) : i === 0 ? "cmd" : "$" + i }),
        a === "" ? h("code", { className: "cc-argv-w is-empty", text: "\"\"" }) : h("code", { className: "cc-argv-w", text: shown })
      ]);
    }));
  }

  function mountArgv(root) {
    var ui = frame(root, "What Bash actually runs", "Type a command and the variables it uses. See the exact arguments the program receives after quoting, expansion, word splitting, and globbing.");
    var cmd = h("textarea", { rows: "2", className: "cc-tool-short", spellcheck: "false", autocomplete: "off" });
    var vars = h("textarea", { rows: "3", className: "cc-tool-short", spellcheck: "false", autocomplete: "off", placeholder: "DIR=\nFILE=Q3 report.pdf" });
    var args = textInput("", { placeholder: "\"my file.txt\" -v" });
    var files = textInput("app.log error.log notes.md", { placeholder: "app.log 'old report.txt'" });
    var nounsetId = "cc-tool-field-" + (++fieldId);
    var nullId = "cc-tool-field-" + (++fieldId);
    var nounset = h("input", { type: "checkbox", id: nounsetId });
    var nullglob = h("input", { type: "checkbox", id: nullId });
    var chips = h("div", { className: "cc-tool-chips" }, [h("span", { className: "cc-tool-muted", text: "Try:" })]);
    SH_PRESETS.forEach(function (p) {
      var chip = h("button", { type: "button", className: "cc-tool-chip", text: p.label });
      chip.addEventListener("click", function () {
        cmd.value = p.cmd;
        vars.value = p.vars || "";
        args.value = p.args || "";
        if (p.files) files.value = p.files;
        update();
      });
      chips.appendChild(chip);
    });
    cmd.value = SH_PRESETS[0].cmd;
    vars.value = SH_PRESETS[0].vars;
    ui.form.appendChild(chips);
    ui.form.appendChild(field("Command line", cmd));
    ui.form.appendChild(h("div", { className: "cc-tool-grid" }, [
      field("Variables, one per line", vars, "NAME=value. A missing name is unset; NAME= is empty."),
      field("Script arguments ($1, $2…)", args, "Quoted like a shell command line"),
      field("Files in the current directory", files, "Used to expand globs such as *.log")
    ]));
    ui.form.appendChild(h("p", { className: "cc-tool-check" }, [nounset, h("label", { for: nounsetId, text: "set -u" }), nullglob, h("label", { for: nullId, text: "shopt -s nullglob" })]));

    function update() {
      var run = shRun(cmd.value, { vars: vars.value, args: args.value, files: files.value, nounset: nounset.checked, nullglob: nullglob.checked });
      if (run.error) return ui.show(run.error);
      if (!run.commands.length) return ui.show("Type a command, such as `rm -rf \"$DIR\"/*`.");
      var nodes = [];
      var dangers = [];
      var lastArgv = null;
      run.commands.forEach(function (res, i) {
        var advice = shAdvice(res);
        dangers = dangers.concat(advice.danger);
        var head = res.loop
          ? "The `for` loop runs **" + plural(res.argv.length, "time") + "**, with `" + res.loop + "` set to:"
          : res.stopped ? (run.commands.length > 1 ? "**Command " + (i + 1) + "** · " : "") + "Expanding the arguments failed:"
          : res.assignOnly ? "Sets shell variables:"
          : (run.commands.length > 1 ? "**Command " + (i + 1) + "** · " : "") + (res.argv.length ? "`" + res.argv[0] + "` receives " + plural(res.argv.length - 1, "argument") + ":" : "Only redirections:");
        nodes.push(para(head));
        if (res.assigns.length) nodes.push(bullets(res.assigns.map(function (a) { return "`" + a.name + "=" + a.value + "`" + (res.assignOnly ? "" : " (in this command's environment only)"); })));
        if (res.argv.length && !res.assignOnly && !res.stopped) nodes.push(shArgvList(res.argv, !!res.loop));
        if (res.redirs.length) nodes.push(bullets(res.redirs.map(function (r) { return "Redirection `" + (r.fd || "") + r.op + (/&$/.test(r.op) ? "" : " ") + r.target + "`"; })));
        advice.danger.forEach(function (t) { nodes.push(para(t, "cc-tool-danger")); });
        advice.warn.forEach(function (t) { nodes.push(para(t, "cc-tool-warn")); });
        if (advice.note.length) nodes.push(bullets(advice.note.filter(function (t, j, list) { return list.indexOf(t) === j; })));
        if (res.stopped) nodes.push(para("Bash stops here with `" + res.stopped + "`. A script exits with status 1, and nothing after this runs.", res.stopped.indexOf("parameter null") !== -1 ? "cc-tool-ok" : "cc-tool-warn"));
        if (res.argv.length && !res.loop && !res.stopped) lastArgv = res.argv;
      });
      if (run.notes.length) nodes.push(bullets(run.notes.filter(function (t, j, list) { return list.indexOf(t) === j; })));
      if (run.loopVar) nodes.push(para("Later commands show the first loop iteration.", "cc-tool-muted"));
      var headline = run.stopped ? "Bash stops " + (lastArgv ? "partway" : "before running anything") + ": `" + run.stopped + "`."
        : dangers.length ? "Danger: this deletes system directories."
        : run.commands.length === 1 && lastArgv ? "`" + lastArgv[0] + "` receives " + plural(lastArgv.length - 1, "argument") + "."
        : plural(run.commands.length, "command") + ".";
      ui.show(headline, nodes);
    }
    live([cmd, vars, args, files, nounset, nullglob], update);
  }

  /* ---------------------------------------------------------------------------
     Linux: "Permission denied" walker
     The kernel checks one class per object, first match wins: owner, then
     group (any of the process's groups), then other. Directories need x to
     be traversed; deleting needs w and x on the parent, plus the sticky rule.
     Root bypasses read/write checks, but executing needs some x bit.
     ------------------------------------------------------------------------- */

  function parsePathListing(text) {
    var entries = [];
    var path = null;
    var bad = [];
    String(text || "").split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var f = /^\s*f:\s*(\S.*)$/.exec(line);
      if (f) {
        path = f[1].trim();
        return;
      }
      var m = /^\s*([dlcbps-])([rwxsStT-]{9})([.+@]?)\s+(?:(\d+)\s+)?(\S+)\s+(\S+)\s+(.+?)\s*$/.exec(line);
      if (!m) {
        bad.push(line.trim());
        return;
      }
      var name = m[7];
      if (m[4] !== undefined) {
        // ls -l: size, month, day, time or year come before the name
        var lsName = /^(?:\d+,\s*)?\d+\s+\S+\s+\S+\s+\S+\s+(.+)$/.exec(name);
        if (lsName) name = lsName[1];
      }
      var link = null;
      if (m[1] === "l" && name.indexOf(" -> ") !== -1) {
        link = name.slice(name.indexOf(" -> ") + 4);
        name = name.slice(0, name.indexOf(" -> "));
      }
      entries.push({ type: m[1], mode: m[2], mark: m[3], owner: m[5], group: m[6], name: name, link: link });
    });
    return { path: path, entries: entries, bad: bad };
  }

  function parseIdentity(text) {
    var s = String(text || "").trim();
    if (!s) return { error: "Enter who is running the command: paste `id` output, or a user name followed by its groups." };
    var uid = /uid=(\d+)(?:\(([^)]*)\))?/.exec(s);
    if (uid) {
      var groups = [];
      var gl = /groups=(\S+)/.exec(s);
      var gid = /gid=(\d+)(?:\(([^)]*)\))?/.exec(s);
      (gl ? gl[1].split(",") : []).concat(gid ? [gid[0].slice(4)] : []).forEach(function (g) {
        var gm = /^(\d+)(?:\(([^)]*)\))?$/.exec(g);
        if (gm) {
          if (gm[2] && groups.indexOf(gm[2]) === -1) groups.push(gm[2]);
          if (groups.indexOf(gm[1]) === -1) groups.push(gm[1]);
        }
      });
      return { user: uid[2] || uid[1], uid: uid[1], groups: groups, root: uid[1] === "0" };
    }
    var parts = s.replace(":", " ").split(/\s+/).filter(Boolean);
    return { user: parts[0], uid: parts[0] === "root" ? "0" : null, groups: parts.length > 1 ? parts.slice(1) : [parts[0]], root: parts[0] === "root", guessed: parts.length === 1 };
  }

  function permClass(entry, who) {
    if (who.root) return "root";
    if (entry.owner === who.user || (who.uid !== null && entry.owner === who.uid)) return "owner";
    if (who.groups.indexOf(entry.group) !== -1) return "group";
    return "other";
  }

  function permBits(mode, cls) {
    var at = { owner: 0, group: 3, other: 6 }[cls];
    var x = mode.charAt(at + 2);
    return { r: mode.charAt(at) === "r", w: mode.charAt(at + 1) === "w", x: x === "x" || x === "s" || x === "t" };
  }

  var PERM_OPS = {
    read: { label: "Read the file", need: "r" },
    write: { label: "Write to the file", need: "w" },
    exec: { label: "Run it as a program", need: "x" },
    script: { label: "Run it as a script (#!)", need: "rx" },
    list: { label: "List the directory (ls)", need: "r" },
    enter: { label: "cd into the directory", need: "x" },
    create: { label: "Create a file inside the directory", need: "wx" },
    remove: { label: "Delete or rename it", need: "parent" }
  };

  function permCheck(entry, who, need) {
    var cls = permClass(entry, who);
    var missing = [];
    need.split("").forEach(function (bit) {
      if (cls === "root") {
        if (bit === "x" && entry.type !== "d" && !/[xst]/.test(entry.mode.charAt(2) + entry.mode.charAt(5) + entry.mode.charAt(8))) missing.push("x");
      } else if (!permBits(entry.mode, cls)[bit]) missing.push(bit);
    });
    return { cls: cls, missing: missing, ok: !missing.length };
  }

  function permWalk(entries, who, op) {
    var real = entries.filter(function (e) { return e.type !== "l"; });
    if (!real.length) return { error: "Paste the output of `namei -l /full/path` (or `ls -ld` for each directory)." };
    var target = real[real.length - 1];
    var steps = [];
    var fail = null;
    var parent = real.length > 1 ? real[real.length - 2] : null;
    for (var i = 0; i < real.length; i++) {
      var e = real[i];
      var need;
      var why;
      if (e !== target) {
        if (e.type !== "d") return { error: "`" + e.name + "` isn't a directory, but more path follows it." };
        need = op === "remove" && e === parent ? "wx" : "x";
        why = need === "wx" ? "Delete an entry: write and search on its directory" : "Search (traverse)";
      } else if (op === "remove") {
        need = "";
        why = "The file's own mode doesn't matter for deleting it";
      } else {
        need = PERM_OPS[op].need;
        why = PERM_OPS[op].label;
      }
      var check = need ? permCheck(e, who, need) : { cls: permClass(e, who), missing: [], ok: true };
      var step = { entry: e, need: need, why: why, cls: check.cls, missing: check.missing, ok: check.ok };
      if (op === "remove" && e === parent && check.ok && /[tT]/.test(e.mode.charAt(8)) && !who.root && target.owner !== who.user && e.owner !== who.user) {
        step.ok = false;
        step.sticky = true;
      }
      steps.push(step);
      if (!step.ok && !fail) fail = step;
    }
    var typeIssue = null;
    if ((op === "list" || op === "enter" || op === "create") && target.type !== "d") typeIssue = "`" + target.name + "` is a file, not a directory.";
    if ((op === "read" || op === "write" || op === "exec" || op === "script") && target.type === "d") typeIssue = "`" + target.name + "` is a directory. Use **List** or **cd** instead.";
    if (op === "remove" && !parent) typeIssue = "Deleting needs the parent directory too: include it in the listing.";
    return { steps: steps, fail: fail, target: target, parent: parent, typeIssue: typeIssue };
  }

  function permFixes(fail, who, path) {
    var e = fail.entry;
    var name = e.name === "/" ? "/" : path && path.indexOf(e.name) !== -1 ? path.slice(0, path.indexOf(e.name) + e.name.length) : e.name;
    var bits = fail.missing.join("");
    var fixes = [];
    if (fail.sticky) {
      fixes.push("The sticky bit (`t`) on `" + name + "` means only the file's owner, the directory's owner, or root may delete or rename entries. That's how `/tmp` stops users deleting each other's files.");
      return fixes;
    }
    if (fail.cls === "owner") {
      fixes.push("You **own** `" + name + "`, so only the owner bits apply, even though the group or other bits may allow more. The owner can always fix it: `chmod u+" + bits + " " + name + "`.");
      return fixes;
    }
    if (fail.cls === "root") {
      fixes.push("Even root can't execute a file with no `x` bit at all. Add one (`chmod +x " + name + "`), or run it through its interpreter: `bash " + name + "` needs only read access.");
      return fixes;
    }
    fixes.push("Grant just this user: `sudo setfacl -m u:" + who.user + ":" + bits + " " + name + "`");
    if (fail.cls === "other" && permBits(e.mode, "group")[bits.charAt(0)]) {
      fixes.push("Or add `" + who.user + "` to group `" + e.group + "`: `sudo usermod -aG " + e.group + " " + who.user + "`. The change applies to **new** logins only; a running process or shell keeps its old groups until it restarts.");
    }
    fixes.push("Or open it to everyone: `sudo chmod o+" + bits + " " + name + "`" + (bits === "x" && e.type === "d" ? " (lets anyone traverse it, but not list it)." : "."));
    return fixes;
  }

  var PERM_PRESETS = [
    { label: "nginx can't read a home dir", listing: "f: /home/alice/site/index.html\ndrwxr-xr-x root  root  /\ndrwxr-xr-x root  root  home\ndrwx------ alice alice alice\ndrwxr-xr-x alice alice site\n-rw-r--r-- alice alice index.html", id: "uid=33(www-data) gid=33(www-data) groups=33(www-data)", op: "read" },
    { label: "Owner bits win", listing: "f: /srv/app/config.yml\ndrwxr-xr-x root root /\ndrwxr-xr-x root root srv\ndrwxr-xr-x bob  ops  app\n----rw-rw- bob  ops  config.yml", id: "uid=1001(bob) gid=1001(bob) groups=1001(bob),2000(ops)", op: "read" },
    { label: "Delete in /tmp", listing: "f: /tmp/build.lock\ndrwxr-xr-x root  root  /\ndrwxrwxrwt root  root  tmp\n-rw-rw-rw- alice alice build.lock", id: "uid=1002(carol) gid=1002(carol) groups=1002(carol)", op: "remove" },
    { label: "Delete a file you can't write", listing: "f: /srv/shared/report.txt\ndrwxr-xr-x root  root   /\ndrwxr-xr-x root  root   srv\ndrwxrwsr-x root  devops shared\n-r--r--r-- alice alice  report.txt", id: "uid=1001(bob) gid=1001(bob) groups=1001(bob),3000(devops)", op: "remove" },
    { label: "Script with x but no r", listing: "f: /usr/local/bin/deploy.sh\ndrwxr-xr-x root root /\ndrwxr-xr-x root root usr\ndrwxr-xr-x root root local\ndrwxr-xr-x root root bin\n-rwx--x--x root root deploy.sh", id: "uid=1001(bob) gid=1001(bob) groups=1001(bob)", op: "script" }
  ];

  function mountPerms(root) {
    var ui = frame(root, "Permission denied, explained", "Paste `namei -l` for the path and `id` for the user. The walker checks every component the way the kernel does and names the one that blocks you.");
    var listing = h("textarea", { rows: "6", spellcheck: "false", autocomplete: "off" });
    var ident = textInput("", { placeholder: "uid=33(www-data) gid=33(www-data) groups=33(www-data)" });
    var op = h("select", null, Object.keys(PERM_OPS).map(function (k) { return h("option", { value: k, text: PERM_OPS[k].label }); }));
    var chips = h("div", { className: "cc-tool-chips" }, [h("span", { className: "cc-tool-muted", text: "Try:" })]);
    function load(p) {
      listing.value = p.listing;
      ident.value = p.id;
      op.value = p.op;
    }
    PERM_PRESETS.forEach(function (p) {
      var chip = h("button", { type: "button", className: "cc-tool-chip", text: p.label });
      chip.addEventListener("click", function () {
        load(p);
        update();
      });
      chips.appendChild(chip);
    });
    load(PERM_PRESETS[0]);
    ui.form.appendChild(chips);
    ui.form.appendChild(field("namei -l /path (or ls -ld for each directory)", listing));
    ui.form.appendChild(h("div", { className: "cc-tool-grid" }, [field("id output, or user and groups", ident), field("What are you trying to do?", op)]));

    function update() {
      var parsed = parsePathListing(listing.value);
      var who = parseIdentity(ident.value);
      if (who.error) return ui.show(who.error);
      if (parsed.bad.length && !parsed.entries.length) return ui.show("These lines don't look like `namei -l` output: `" + parsed.bad[0] + "`.");
      var walk = permWalk(parsed.entries, who, op.value);
      if (walk.error) return ui.show(walk.error);
      if (walk.typeIssue) return ui.show(walk.typeIssue);
      var rows = walk.steps.map(function (s) {
        var bitText = s.need ? s.need.split("").join("+") : "—";
        return {
          highlight: s === walk.fail,
          cells: [
            "`" + s.entry.type + s.entry.mode + s.entry.mark + "`",
            "`" + s.entry.name + "`",
            s.cls === "root" ? "root" : s.cls + " (`" + (s.cls === "owner" ? s.entry.owner : s.cls === "group" ? s.entry.group : "everyone else") + "`)",
            bitText,
            s.ok ? "✓" : s.sticky ? "✗ sticky bit" : "✗ missing " + s.missing.join("+")
          ]
        };
      });
      var notes = [];
      if (who.guessed) notes.push("Only a user name was given, so its groups are assumed to be just `" + who.user + "`. Paste `id " + who.user + "` for the real list.");
      if (parsed.entries.some(function (e) { return e.mark === "+"; })) notes.push("A `+` after the mode means an **ACL** is present: run `getfacl` on it. ACL entries can grant more, and the group bits shown are then the ACL mask.");
      if (parsed.entries.some(function (e) { return e.type === "l"; })) notes.push("Symlink permissions are ignored (always `lrwxrwxrwx`); what counts is every directory on the path to the target.");
      if (!who.root) notes.push("Groups come from the process, fixed when it started. `id` shows a fresh login's groups; check a running service with `grep Groups /proc/<pid>/status`.");
      if (op.value === "exec" || op.value === "script") notes.push("If the bits pass and it still says `Permission denied`, check the mount: `findmnt -T <path>` showing `noexec` blocks execution (shell exit status 126).");
      if (op.value === "remove" && walk.target) notes.push("Deleting is an operation on the **directory**: the file's own mode is irrelevant, which is why `rm` only asks before removing a write-protected file instead of failing.");
      notes.push("If the walk passes but access is still denied, the cause is outside these bits: SELinux or AppArmor (`ausearch -m avc -ts recent`), `chattr +i`, or a read-only mount.");
      var headline;
      var extra = [];
      if (walk.fail) {
        headline = "Blocked at `" + walk.fail.entry.name + "`" + (walk.fail.sticky ? " by the sticky bit." : ": " + who.user + " is in class **" + walk.fail.cls + "** there, which lacks `" + walk.fail.missing.join("") + "`.");
        extra.push(bullets(permFixes(walk.fail, who, parsed.path)));
      } else headline = "Allowed: every check passes for " + (who.root ? "root" : "`" + who.user + "`") + ".";
      ui.show(headline, [table(["Mode", "Component", "You are", "Needs", "Result"], rows)].concat(extra, [bullets(notes)]));
    }
    live([listing, ident, op], update);
  }

  /* ---------------------------------------------------------------------------
     Linux: exit status decoder
     A shell reports death by signal N as 128+N; Python's subprocess reports -N.
     Exit statuses are 8 bits, so exit 256 is 0 and exit -1 is 255.
     ------------------------------------------------------------------------- */

  var SIGNALS = [null,
    ["SIGHUP", "hangup: the terminal or SSH session closed, or a daemon was asked to reload"],
    ["SIGINT", "interrupt: Ctrl+C"],
    ["SIGQUIT", "quit (Ctrl+\\), with a core dump"],
    ["SIGILL", "illegal instruction: a binary built for a newer CPU, or memory corruption"],
    ["SIGTRAP", "trace or breakpoint trap"],
    ["SIGABRT", "abort: an `assert` failed, or the C library detected corruption such as a double free"],
    ["SIGBUS", "bus error: often a memory-mapped file that was truncated underneath the process"],
    ["SIGFPE", "arithmetic error, such as integer division by zero"],
    ["SIGKILL", "the kill signal, which can't be caught or ignored"],
    ["SIGUSR1", "user-defined signal 1, with no handler installed"],
    ["SIGSEGV", "segmentation fault: invalid memory access"],
    ["SIGUSR2", "user-defined signal 2, with no handler installed"],
    ["SIGPIPE", "broken pipe: it wrote to a pipe whose reader had exited"],
    ["SIGALRM", "an alarm timer fired"],
    ["SIGTERM", "terminate: a polite stop request"],
    ["SIGSTKFLT", "stack fault"], ["SIGCHLD", "child status changed"], ["SIGCONT", "continue"], ["SIGSTOP", "stopped"],
    ["SIGTSTP", "terminal stop (Ctrl+Z)"], ["SIGTTIN", "background read from the terminal"], ["SIGTTOU", "background write to the terminal"],
    ["SIGURG", "urgent socket data"], ["SIGXCPU", "CPU time limit (`ulimit -t`) exceeded"], ["SIGXFSZ", "file size limit (`ulimit -f`) exceeded"],
    ["SIGVTALRM", "virtual timer"], ["SIGPROF", "profiling timer"], ["SIGWINCH", "window size changed"], ["SIGIO", "I/O possible"],
    ["SIGPWR", "power failure"], ["SIGSYS", "bad system call: often a seccomp filter blocking a syscall"]];

  var EXIT_SIGNAL_TIPS = {
    2: "Interactive Ctrl+C. Since Python 3.8, an uncaught `KeyboardInterrupt` re-raises SIGINT so the caller sees this too.",
    9: "Who sends SIGKILL: the kernel OOM killer (`journalctl -k | grep -i 'killed process'`), `kill -9`, `timeout -s KILL`, systemd after `TimeoutStopSec`, or Docker and Kubernetes when the grace period ends after SIGTERM.",
    11: "A crash in native code. Get a core dump (`coredumpctl list`, `coredumpctl gdb`) or rerun under `gdb`; for interpreted languages suspect a C extension.",
    13: "Usually harmless: `producer | head -1` kills the producer once `head` exits. With `set -o pipefail` this fails the whole pipeline; consider `|| true` or `grep -m1`.",
    15: "The process didn't install a SIGTERM handler, so it died immediately. That's fine for stateless work; servers should catch it and drain in-flight requests first."
  };

  var EXIT_COMMANDS = {
    grep: { 0: "a line matched", 1: "**no lines matched**, which isn't an error but stops a `set -e` script", 2: "an error: missing file, unreadable file, or bad pattern. With `-q`, a match exits 0 even if an error occurred" },
    diff: { 0: "the inputs are identical", 1: "the inputs differ (normal, not an error)", 2: "trouble, such as a missing file" },
    curl: { 3: "the URL is malformed", 6: "couldn't resolve the host name (DNS)", 7: "couldn't connect: refused, unreachable, or nothing listening", 22: "HTTP status 400 or higher with `--fail`/`-f`", 23: "couldn't write the output (disk full, permissions)", 28: "timed out (`--max-time` or `--connect-timeout`)", 35: "the TLS handshake failed", 47: "too many redirects", 52: "the server closed the connection without replying", 56: "failure receiving data: the connection was reset", 60: "the server's certificate couldn't be verified against known CAs" },
    timeout: { 124: "the time limit was reached and the command was sent SIGTERM", 125: "`timeout` itself failed", 126: "the command was found but couldn't be run", 127: "the command wasn't found", 137: "SIGKILL was sent (by `-s KILL` or `--kill-after`), to the command or to `timeout`" },
    ssh: { 255: "**ssh itself failed**: connection refused or timed out, host key mismatch, or authentication failure. Any other status is the remote command's" },
    rsync: { 1: "syntax or usage error", 2: "protocol incompatibility", 3: "errors selecting input or output files or directories", 5: "error starting the client-server protocol", 10: "error in socket I/O", 11: "error in file I/O", 12: "error in the rsync protocol data stream, often the remote side died", 20: "received SIGINT, SIGTERM, or SIGHUP", 23: "**partial transfer due to error**: some files weren't copied", 24: "partial transfer because source files vanished during the copy (common on live logs)", 25: "`--max-delete` stopped deletions", 30: "timeout in data send or receive", 35: "timeout waiting for the daemon connection" },
    systemctl: { 0: "the unit is active", 1: "the unit is dead and a PID file still exists", 3: "the unit is **not running** (`systemctl status` and `is-active` return this)", 4: "no such unit" }
  };

  function explainExit(raw, context, command) {
    var n = parseIntStrict(raw);
    if (isNaN(n)) return { error: "Enter an exit status, such as `137` or `-9`." };
    var lines = [];
    var code = n;
    var signal = null;
    if (context === "python" && n < 0) signal = -n;
    else {
      if (n < 0 || n > 255) {
        code = ((n % 256) + 256) % 256;
        lines.push("Exit statuses are 8 bits: `exit " + n + "` reaches the parent as **" + code + "** (" + n + " mod 256)." + (code === 0 ? " A script that exits 256 reports success." : ""));
      }
      if (code > 128 && code < 128 + SIGNALS.length) signal = code - 128;
    }
    var title;
    var cmdTable = EXIT_COMMANDS[command];
    if (cmdTable && cmdTable[code] !== undefined && !(signal && command !== "timeout")) {
      title = "`" + command + "` exit " + code + ": " + cmdTable[code] + ".";
      if (command === "timeout" && code === 137) signal = null;
    } else if (signal && signal < SIGNALS.length && SIGNALS[signal]) {
      var s = SIGNALS[signal];
      title = (context === "python" ? "`returncode " + n + "`" : "Exit " + code) + ": killed by **" + s[0] + "** (signal " + signal + "), " + s[1] + ".";
      lines.push(context === "python" ? "subprocess reports death by signal N as **-N**; a shell would show " + (128 + signal) + "." : "A process killed by a signal has no exit code of its own; the shell reports 128 + " + signal + " = " + code + ".");
      if (EXIT_SIGNAL_TIPS[signal]) lines.push(EXIT_SIGNAL_TIPS[signal]);
      if (context === "container" && signal === 9) lines.push("In Kubernetes, `kubectl describe pod` separates the two: `Reason: OOMKilled` means the container hit its memory limit; `Reason: Error` with 137 usually means SIGKILL after `terminationGracePeriodSeconds`, often a failed liveness probe.");
      if (context === "container" && signal === 15) lines.push("Exit 143 after `docker stop` or a rollout is a clean SIGTERM death. If you see **137** instead, the app ignored SIGTERM; a common cause is PID 1 being a shell (`sh -c`), since the kernel doesn't apply default signal actions to PID 1 in a container.");
    } else if (code === 0) title = "Success.";
    else if (code === 1) title = "Exit 1: a general failure. Most programs use it for any error; read stderr.";
    else if (code === 2) title = "Exit 2: usually a usage error. Bash builtins, argparse, and many CLIs return 2 for bad options or arguments.";
    else if (code === 126) {
      title = "Exit 126: found, but couldn't be executed.";
      lines.push("Causes: no execute bit (`chmod +x`), a `noexec` mount (`findmnt -T <path>`), a directory, or a binary for the wrong architecture (`file <path>`).");
    } else if (code === 127) {
      title = "Exit 127: command not found.";
      lines.push("Check `PATH` (cron and systemd use a minimal one), typos, and the **shebang**: `#!/usr/bin/env python` fails with 127 on systems that only ship `python3`.");
    } else if (code === 128) title = "Exit 128: invalid argument to `exit`, or a program's own fatal code (Git uses 128 for fatal errors).";
    else if (code === 255) title = "Exit 255: often `exit -1`, or ssh failing to connect. Check whether the remote command even ran.";
    else if (cmdTable && cmdTable[code] !== undefined) title = "`" + command + "` exit " + code + ": " + cmdTable[code] + ".";
    else title = "Exit " + code + ": specific to the program. Check its man page's EXIT STATUS section.";
    if (command && cmdTable && cmdTable[code] === undefined && !signal && code > 2) lines.push("`" + command + "` doesn't document " + code + "; it may come from something it ran.");
    if (context === "shell") lines.push("In a pipeline, `$?` is the **last** command's status. `set -o pipefail` reports the last non-zero one, and `${PIPESTATUS[@]}` lists them all.");
    return { title: title, lines: lines, code: code, signal: signal };
  }

  function mountExitcode(root) {
    var ui = frame(root, "Exit status decoder", "Enter the number you got and where it came from.");
    var code = textInput("137", { inputmode: "numeric" });
    var context = h("select", null, [
      h("option", { value: "shell", text: "Shell ($?)" }),
      h("option", { value: "container", text: "Docker or Kubernetes container" }),
      h("option", { value: "python", text: "Python subprocess returncode" })
    ]);
    var command = h("select", null, [h("option", { value: "", text: "Any program" })].concat(Object.keys(EXIT_COMMANDS).map(function (k) { return h("option", { value: k, text: k }); })));
    var chips = h("div", { className: "cc-tool-chips" }, [h("span", { className: "cc-tool-muted", text: "Try:" })]);
    [["137", "container", ""], ["143", "container", ""], ["127", "shell", ""], ["141", "shell", ""], ["-9", "python", ""], ["1", "shell", "grep"], ["28", "shell", "curl"], ["24", "shell", "rsync"], ["256", "shell", ""]].forEach(function (ex) {
      var chip = h("button", { type: "button", className: "cc-tool-chip", text: (ex[2] ? ex[2] + " " : "") + ex[0] });
      chip.addEventListener("click", function () {
        code.value = ex[0];
        context.value = ex[1];
        command.value = ex[2];
        update();
      });
      chips.appendChild(chip);
    });
    ui.form.appendChild(chips);
    ui.form.appendChild(h("div", { className: "cc-tool-grid" }, [field("Exit status", code), field("Where you saw it", context), field("Program", command)]));
    function update() {
      var r = explainExit(code.value, context.value, command.value);
      if (r.error) return ui.show(r.error);
      ui.show(r.title, [r.lines.length ? bullets(r.lines) : null]);
    }
    live([code, context, command], update);
  }

  /* ---------------------------------------------------------------------------
     Networking: CIDR planner and overlap checker (IPv4)
     ------------------------------------------------------------------------- */

  var CIDR_DEFAULTS = [
    ["Docker default bridge (docker0)", "172.17.0.0/16"],
    ["Docker user networks and Compose (/16s)", "172.18.0.0/15"],
    ["Docker user networks and Compose (/16s)", "172.20.0.0/14"],
    ["Docker user networks and Compose (/16s)", "172.24.0.0/14"],
    ["Docker user networks and Compose (/16s)", "172.28.0.0/14"],
    ["Docker user networks after 172.x (/20s)", "192.168.0.0/16"],
    ["Docker Swarm overlay networks (/24s)", "10.0.0.0/8"],
    ["AWS default VPC", "172.31.0.0/16"],
    ["kubeadm / kind Service CIDR", "10.96.0.0/12"],
    ["Flannel / kind Pod CIDR", "10.244.0.0/16"],
    ["Calico default IP pool", "192.168.0.0/16"],
    ["k3s Pod CIDR", "10.42.0.0/16"],
    ["k3s Service CIDR", "10.43.0.0/16"],
    ["EKS Service CIDR (one of two defaults)", "10.100.0.0/16"],
    ["EKS Service CIDR (one of two defaults)", "172.20.0.0/16"],
    ["Carrier-grade NAT, Tailscale", "100.64.0.0/10"],
    ["Link-local, cloud metadata 169.254.169.254", "169.254.0.0/16"]
  ];

  function ipToInt(text) {
    var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
    if (!m) return null;
    var n = 0;
    for (var i = 1; i <= 4; i++) {
      var o = parseInt(m[i], 10);
      if (o > 255 || (m[i].length > 1 && m[i].charAt(0) === "0")) return null;
      n = n * 256 + o;
    }
    return n;
  }

  function intToIp(n) {
    return [Math.floor(n / 16777216) % 256, Math.floor(n / 65536) % 256, Math.floor(n / 256) % 256, n % 256].join(".");
  }

  function parseCidr(text) {
    var s = String(text).trim();
    if (s.indexOf(":") !== -1) return { error: "`" + s + "` is IPv6; this planner handles IPv4 only." };
    var m = /^([\d.]+)(?:\/(\d{1,2}))?$/.exec(s);
    if (!m) return { error: "`" + s + "` isn't an IPv4 CIDR such as `10.0.0.0/16`." };
    var ip = ipToInt(m[1]);
    if (ip === null) return { error: "`" + m[1] + "` isn't a valid IPv4 address (four numbers 0–255, no leading zeros)." };
    var prefix = m[2] === undefined ? 32 : parseInt(m[2], 10);
    if (prefix > 32) return { error: "A prefix length is 0–32, not /" + prefix + "." };
    var size = Math.pow(2, 32 - prefix);
    var network = Math.floor(ip / size) * size;
    return { text: intToIp(network) + "/" + prefix, start: network, end: network + size - 1, prefix: prefix, size: size, hostBits: ip !== network, given: s };
  }

  // Two CIDR blocks are either disjoint or one contains the other.
  function cidrRelation(a, b) {
    if (a.end < b.start || b.end < a.start) return null;
    if (a.start === b.start && a.end === b.end) return "same";
    return a.start <= b.start && a.end >= b.end ? "contains" : "inside";
  }

  function cidrPlan(text, withDefaults) {
    var blocks = [];
    var errors = [];
    String(text || "").split(/\r?\n/).forEach(function (line) {
      var t = line.replace(/#.*/, "").trim();
      if (!t) return;
      var parts = t.split(/\s+/);
      var cidrText = parts[parts.length - 1];
      var label = parts.slice(0, -1).join(" ") || cidrText;
      var c = parseCidr(cidrText);
      if (c.error) errors.push(c.error);
      else {
        c.label = label;
        blocks.push(c);
      }
    });
    var overlaps = [];
    for (var i = 0; i < blocks.length; i++) {
      for (var j = i + 1; j < blocks.length; j++) {
        var rel = cidrRelation(blocks[i], blocks[j]);
        if (rel) overlaps.push({ a: blocks[i], b: blocks[j], rel: rel });
      }
    }
    var defaults = [];
    if (withDefaults) {
      blocks.forEach(function (b) {
        CIDR_DEFAULTS.forEach(function (d) {
          var dc = parseCidr(d[1]);
          var rel = cidrRelation(b, dc);
          if (rel) defaults.push({ block: b, name: d[0], cidr: dc.text, rel: rel });
        });
      });
    }
    return { blocks: blocks, errors: errors, overlaps: overlaps, defaults: defaults };
  }

  function cidrUsable(size, reserved) {
    if (size <= 2 && reserved === 2) return size === 2 ? "2 (point-to-point /31)" : "1";
    return Math.max(0, size - reserved).toLocaleString("en-US");
  }

  function mountCidr(root) {
    var ui = frame(root, "CIDR planner and overlap checker", "List the ranges you plan to connect, one per line with an optional name. The planner sizes each one and flags every overlap.");
    var input = h("textarea", { rows: "5", spellcheck: "false", autocomplete: "off" });
    input.value = "prod-vpc 10.0.0.0/16\nstaging-vpc 10.1.0.0/16\noffice-vpn 192.168.0.0/22\neks-pods 10.0.64.0/18\nlegacy 172.20.0.5/16";
    var defId = "cc-tool-field-" + (++fieldId);
    var defaults = h("input", { type: "checkbox", id: defId, checked: true });
    ui.form.appendChild(field("Ranges", input, "One CIDR per line, optionally after a name"));
    ui.form.appendChild(h("p", { className: "cc-tool-check" }, [defaults, h("label", { for: defId, text: "Also check Docker, Kubernetes, and cloud defaults" })]));
    function update() {
      var plan = cidrPlan(input.value, defaults.checked);
      if (!plan.blocks.length) return ui.show(plan.errors[0] || "Enter at least one range, such as `10.0.0.0/16`.");
      var rows = plan.blocks.map(function (b) {
        return { cells: [b.label, "`" + b.text + "`", intToIp(b.start) + " – " + intToIp(b.end), b.size.toLocaleString("en-US"), b.prefix <= 30 ? cidrUsable(b.size, 2) : cidrUsable(b.size, 2), b.prefix >= 16 && b.prefix <= 28 ? cidrUsable(b.size, 5) : "not allowed", cidrUsable(b.size, 4)] };
      });
      var warnings = plan.errors.map(function (e) { return para(e, "cc-tool-warn"); });
      plan.blocks.filter(function (b) { return b.hostBits; }).forEach(function (b) {
        warnings.push(para("`" + b.given + "` has host bits set; the network is `" + b.text + "`. AWS rejects it and Python's `ipaddress.ip_network()` raises `ValueError` unless `strict=False`.", "cc-tool-warn"));
      });
      plan.overlaps.forEach(function (o) {
        var how = o.rel === "same" ? "are the same range" : o.rel === "contains" ? "contains **" + o.b.label + "**" : "sits inside **" + o.b.label + "**";
        warnings.push(para("**" + o.a.label + "** (`" + o.a.text + "`) " + how + " (`" + o.b.text + "`). Overlapping ranges can't be routed to each other without NAT.", "cc-tool-warn"));
      });
      var defaultNotes = plan.defaults.map(function (d) { return "**" + d.block.label + "** overlaps " + d.name + " (`" + d.cidr + "`)."; });
      var headline = plan.overlaps.length ? plural(plan.overlaps.length, "overlap") + " between your ranges." : "No overlaps between your " + plural(plan.blocks.length, "range") + ".";
      ui.show(headline, [
        table(["Name", "Network", "Range", "Addresses", "Usable (classic)", "Usable in AWS / Azure", "Usable in GCP"], rows)
      ].concat(warnings, [
        defaultNotes.length ? para("Defaults that collide:") : null,
        defaultNotes.length ? bullets(defaultNotes) : null,
        bullets(["Two CIDR blocks can never partly overlap: either they're disjoint or one contains the other.", "AWS and Azure reserve 5 addresses per subnet (network, router, DNS, one future, broadcast); GCP reserves 4. AWS subnets must be /16 to /28."])
      ]));
    }
    live([input, defaults], update);
  }

  /* ---------------------------------------------------------------------------
     Networking: ephemeral port and TIME-WAIT budget
     Linux keeps a closed connection in TIME-WAIT for 60 seconds (hard-coded
     TCP_TIMEWAIT_LEN) on the side that closed first. A connect() source port
     only has to be unique per destination address and port, unless the
     application bind()s before connecting.
     ------------------------------------------------------------------------- */

  function portBudget(o) {
    var range = /^\s*(\d+)\s+(\d+)\s*$/.exec(String(o.range).replace(/^.*=\s*/, ""));
    if (!range) return { error: "Paste the range as two numbers, such as `32768 60999`." };
    var lo = parseInt(range[1], 10);
    var hi = parseInt(range[2], 10);
    if (!(lo >= 1 && hi <= 65535 && hi >= lo)) return { error: "The range must be two ports from 1 to 65535, low then high." };
    var ports = hi - lo + 1;
    if (!(o.rate > 0) || !(o.dests >= 1) || !(o.duration >= 0)) return { error: "Enter a positive connection rate, at least one destination, and a duration." };
    var linger = o.duration + (o.clientCloses ? 60 : 0);
    var perDest = o.rate / o.dests;
    var inUse = o.bindFirst ? o.rate * linger : perDest * linger;
    var limit = ports;
    var maxRate = (o.bindFirst ? ports : ports * o.dests) / Math.max(linger, 0.001);
    var r = { ports: ports, perDest: perDest, inUse: inUse, limit: limit, pct: inUse / limit * 100, maxRate: maxRate, linger: linger };
    if (o.nat) {
      r.natLimit = 55000 * o.natIps;
      r.natUse = perDest * o.duration;
      r.natPct = r.natUse / r.natLimit * 100;
    }
    return r;
  }

  function mountPorts(root) {
    var ui = frame(root, "Ephemeral port budget", "Estimate how close a client is to `Cannot assign requested address` from opening new connections too fast.");
    var range = textInput("32768 60999", { placeholder: "32768 60999" });
    var rate = numberInput(300, { min: 1 });
    var dests = numberInput(1, { min: 1 });
    var duration = numberInput(0.2, { min: 0, step: "0.1" });
    var closer = h("select", null, [h("option", { value: "client", text: "This host (client)" }), h("option", { value: "server", text: "The server" })]);
    var bindId = "cc-tool-field-" + (++fieldId);
    var natId = "cc-tool-field-" + (++fieldId);
    var bindFirst = h("input", { type: "checkbox", id: bindId });
    var nat = h("input", { type: "checkbox", id: natId });
    var natIps = numberInput(1, { min: 1, max: 8 });
    ui.form.appendChild(h("div", { className: "cc-tool-grid" }, [
      field("net.ipv4.ip_local_port_range", range, "sysctl net.ipv4.ip_local_port_range"),
      field("New connections per second", rate),
      field("Destination IP:port pairs", dests, "Backends the traffic spreads across"),
      field("Seconds each connection is open", duration),
      field("Who closes first", closer, "That side holds TIME-WAIT"),
      field("NAT gateway IPs", natIps, "AWS: up to 8")
    ]));
    ui.form.appendChild(h("p", { className: "cc-tool-check" }, [bindFirst, h("label", { for: bindId, text: "The app calls bind() before connect()" }), nat, h("label", { for: natId, text: "Traffic leaves through an AWS NAT gateway" })]));
    function update() {
      var r = portBudget({ range: range.value, rate: parseFloat(rate.value), dests: parseIntStrict(dests.value), duration: parseFloat(duration.value), clientCloses: closer.value === "client", bindFirst: bindFirst.checked, nat: nat.checked, natIps: parseIntStrict(natIps.value) || 1 });
      if (r.error) return ui.show(r.error);
      var rows = [
        { cells: ["Ephemeral ports", r.ports.toLocaleString("en-US")] },
        { cells: ["Each port stays busy", +r.linger.toFixed(2) + " s" + (closer.value === "client" ? " (open time + 60 s TIME-WAIT)" : "")] },
        { cells: [bindFirst.checked ? "Ports in use (shared by all destinations)" : "Ports in use per destination", Math.round(r.inUse).toLocaleString("en-US")], highlight: true },
        { cells: ["Highest sustainable rate", Math.floor(r.maxRate).toLocaleString("en-US") + " new connections/s"] }
      ];
      if (nat.checked) rows.push({ cells: ["NAT gateway connections per destination", Math.round(r.natUse).toLocaleString("en-US") + " of " + r.natLimit.toLocaleString("en-US")] });
      var notes = [];
      if (r.pct >= 100) notes.push(para("Exhausted: new `connect()` calls fail with `EADDRNOTAVAIL` (`Cannot assign requested address`).", "cc-tool-warn"));
      else if (r.pct >= 50) notes.push(para("Over half the range is busy. `connect()` gets slower as the kernel searches for a free port, long before it fails outright.", "cc-tool-warn"));
      else notes.push(para("Comfortable headroom.", "cc-tool-ok"));
      if (nat.checked && r.natPct >= 80) notes.push(para("The NAT gateway limit is close: watch the `ErrorPortAllocation` metric, add secondary IPs (each adds 55,000), or spread traffic across more destinations.", "cc-tool-warn"));
      var tips = ["The real fix is reuse: HTTP keep-alive and connection pools turn thousands of connections a second into a few dozen long-lived ones."];
      if (closer.value === "server") tips.push("When the server closes first, TIME-WAIT sits on the **server**, which costs memory there but no client ports.");
      if (bindFirst.checked) tips.push("`bind()` before `connect()` reserves a port for **every** destination at once. Set `IP_BIND_ADDRESS_NO_PORT` (Linux 4.2+) so the port is chosen at `connect()` time.");
      tips.push("`net.ipv4.tcp_fin_timeout` does **not** shorten TIME-WAIT; it limits FIN-WAIT-2. TIME-WAIT is fixed at 60 seconds in the kernel.");
      tips.push("`tcp_tw_reuse` defaults to `2` (loopback only); `1` reuses TIME-WAIT ports for outgoing connections safely when timestamps are on. `tcp_tw_recycle` broke clients behind NAT and was removed in Linux 4.12.");
      if (nat.checked) tips.push("AWS NAT gateways drop connections idle for **350 seconds** and answer later packets with a reset. Linux's default keepalive starts after 7,200 seconds, so idle database connections die silently.");
      ui.show(Math.round(r.pct) + "% of the port range is in use" + (bindFirst.checked ? "." : " for each destination."), [table(["", "Value"], rows)].concat(notes, [bullets(tips)]));
    }
    live([range, rate, dests, duration, closer, bindFirst, nat, natIps], update);
  }

  /* ---------------------------------------------------------------------------
     Networking: TLS certificate lifetime planner
     CA/Browser Forum ballot SC-081 limits for publicly trusted certificates.
     ------------------------------------------------------------------------- */

  var CERT_SCHEDULE = [
    { from: Date.UTC(2020, 8, 1), days: 398, dcv: 398 },
    { from: Date.UTC(2026, 2, 15), days: 200, dcv: 200 },
    { from: Date.UTC(2027, 2, 15), days: 100, dcv: 100 },
    { from: Date.UTC(2029, 2, 15), days: 47, dcv: 10 }
  ];
  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  function parseCertDate(text) {
    var s = String(text).trim();
    var m = /^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})(?:\s+GMT)?$/.exec(s);
    if (m && MONTHS[m[1].toLowerCase()] !== undefined) return Date.UTC(+m[6], MONTHS[m[1].toLowerCase()], +m[2], +m[3], +m[4], +m[5]);
    m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?\s*Z?$/.exec(s);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return null;
  }

  function certRule(time) {
    var rule = CERT_SCHEDULE[0];
    CERT_SCHEDULE.forEach(function (r) { if (time >= r.from) rule = r; });
    return rule;
  }

  function certInfo(text, now) {
    var nb = /notBefore\s*=\s*(.+)/.exec(text);
    var na = /notAfter\s*=\s*(.+)/.exec(text);
    if (!nb && !na) return null;
    var start = nb ? parseCertDate(nb[1]) : null;
    var end = na ? parseCertDate(na[1]) : null;
    if ((nb && start === null) || (na && end === null)) return { error: "Couldn't read the dates. Paste the output of `openssl x509 -noout -dates`." };
    var r = { start: start, end: end, now: now };
    if (end !== null) r.daysLeft = Math.floor((end - now) / 86400000);
    if (start !== null && end !== null) {
      r.lifetime = (end - start) / 86400000;
      r.rule = certRule(start);
      r.renewAt = start + (end - start) * 2 / 3;
      r.tooLong = r.lifetime > r.rule.days + 1;
    }
    var subj = /subject\s*=\s*(.+)/.exec(text);
    if (subj) r.subject = subj[1].trim();
    return r;
  }

  function fmtDate(t) {
    return new Date(t).toISOString().slice(0, 10);
  }

  function mountCertlife(root) {
    var ui = frame(root, "Certificate lifetime planner", "Paste `openssl x509 -noout -dates` output to check a certificate, and see what manual renewal will cost as the maximum lifetime shrinks.");
    var dates = h("textarea", { rows: "3", className: "cc-tool-short", spellcheck: "false", autocomplete: "off" });
    var now = Date.now();
    dates.value = "notBefore=" + new Date(now - 30 * 86400000).toUTCString().slice(8, 11) + " " + new Date(now - 30 * 86400000).getUTCDate() + " 00:00:00 " + new Date(now - 30 * 86400000).getUTCFullYear() + " GMT\nnotAfter=" + new Date(now + 170 * 86400000).toUTCString().slice(8, 11) + " " + new Date(now + 170 * 86400000).getUTCDate() + " 23:59:59 " + new Date(now + 170 * 86400000).getUTCFullYear() + " GMT";
    var certs = numberInput(40, { min: 0 });
    var minutes = numberInput(30, { min: 0 });
    ui.form.appendChild(field("Certificate dates", dates, "openssl s_client -connect host:443 -servername host </dev/null 2>/dev/null | openssl x509 -noout -dates"));
    ui.form.appendChild(h("div", { className: "cc-tool-grid" }, [field("Certificates renewed by hand", certs), field("Minutes per manual renewal", minutes)]));
    function update() {
      var t = Date.now();
      var info = certInfo(dates.value, t);
      var nodes = [];
      var headline = "Today's maximum for a new public certificate is **" + certRule(t).days + " days**.";
      if (info && info.error) nodes.push(para(info.error, "cc-tool-warn"));
      else if (info) {
        var lines = [];
        if (info.daysLeft !== undefined) {
          headline = info.daysLeft < 0 ? "Expired " + plural(-info.daysLeft, "day") + " ago." : "Expires in **" + plural(info.daysLeft, "day") + "** (" + fmtDate(info.end) + ").";
          if (info.daysLeft >= 0 && info.daysLeft < 14) nodes.push(para("Less than two weeks left. Renew now and find out why automation didn't.", "cc-tool-warn"));
        }
        if (info.lifetime !== undefined) {
          lines.push("Lifetime: " + Math.round(info.lifetime) + " days, issued " + fmtDate(info.start) + ", when the limit was " + info.rule.days + " days" + (info.tooLong ? " — **longer than allowed**, so this is a private CA or a certificate browsers will reject." : "."));
          lines.push("Renew at about two-thirds of its life: **" + fmtDate(info.renewAt) + "**" + (info.renewAt < t ? " (already past)." : "."));
        }
        if (info.subject) lines.push("Subject: `" + info.subject + "`");
        nodes.push(bullets(lines));
      }
      var n = parseFloat(certs.value) || 0;
      var mins = parseFloat(minutes.value) || 0;
      var rows = CERT_SCHEDULE.map(function (r) {
        var perYear = 365 / (r.days * 2 / 3);
        return {
          highlight: certRule(t) === r,
          cells: [r.from < Date.UTC(2026, 0, 1) ? "Until 2026-03-15" : "From " + fmtDate(r.from), r.days + " days", r.dcv + " days", +perYear.toFixed(1), Math.round(n * perYear * mins / 60).toLocaleString("en-US") + " h"]
        };
      });
      nodes.push(table(["Issued", "Max lifetime", "Domain validation reuse", "Renewals per year", "Manual work per year"], rows));
      nodes.push(bullets([
        "Domain validation reuse shrinks too: by 2029 a CA may reuse a domain check for only 10 days, so renewal tooling must be able to re-prove control on its own (an ACME HTTP-01 or DNS-01 challenge), not just resubmit a CSR.",
        "Let's Encrypt stopped sending expiry reminder emails on 4 June 2025, and shut down OCSP on 6 August 2025. Monitor expiry yourself.",
        "Let's Encrypt's default lifetime drops from 90 to 64 days on 10 February 2027 and to 45 days on 16 February 2028; the `tlsserver` profile already issues 45-day certificates."
      ]));
      ui.show(headline, nodes);
    }
    live([dates, certs, minutes], update);
  }

  /* ---------------------------------------------------------------------------
     Git: reflog rescue
     Reads `git reflog` output and finds where HEAD was before the last
     reset, rebase, amend, merge or pull, or the last commit of a deleted
     branch.
     ------------------------------------------------------------------------- */

  function parseReflog(text) {
    var entries = [];
    String(text || "").split(/\r?\n/).forEach(function (line) {
      var m = /^\s*([0-9a-f]{4,40})\s+(?:\(([^)]*)\)\s+)?(\S+@\{(\d+)\}):\s*(.*)$/.exec(line);
      if (m) entries.push({ sha: m[1], deco: m[2] || "", ref: m[3], n: parseInt(m[4], 10), msg: m[5].trim() });
    });
    return entries;
  }

  function reflogKind(msg) {
    if (/^reset: moving to/.test(msg)) return "reset";
    if (/^rebase.*\((start|pick|continue|squash|fixup|reword|edit)\)/.test(msg)) return "rebase-step";
    if (/^rebase.*\(finish\)/.test(msg)) return "rebase-finish";
    if (/^rebase.*\(abort\)/.test(msg)) return "rebase-abort";
    if (/^commit \(amend\)/.test(msg)) return "amend";
    if (/^commit \(merge\)|^merge /.test(msg)) return "merge";
    if (/^pull/.test(msg)) return "pull";
    if (/^checkout: moving from/.test(msg)) return "checkout";
    if (/^cherry-pick/.test(msg)) return "cherry-pick";
    if (/^commit/.test(msg)) return "commit";
    return "other";
  }

  function reflogRescue(entries, goal, branch) {
    var byIndex = entries.slice().sort(function (a, b) { return a.n - b.n; });
    function at(n) {
      for (var i = 0; i < byIndex.length; i++) if (byIndex[i].n === n) return byIndex[i];
      return null;
    }
    if (goal === "branch") {
      var name = String(branch || "").trim();
      if (!name) return { error: "Enter the deleted branch's name." };
      for (var i = 0; i < byIndex.length; i++) {
        var e = byIndex[i];
        if (e.msg.indexOf("checkout: moving from " + name + " to ") === 0) {
          var before = at(e.n + 1);
          if (!before) return { error: "Found the checkout away from `" + name + "`, but the entry before it isn't in what you pasted. Paste more of the reflog." };
          return { event: e, target: before, how: "HEAD was on `" + name + "` at `" + before.sha + "` just before you switched away (" + e.ref + ")." , commands: ["git branch " + name + " " + before.sha, "git log --oneline -5 " + name] };
        }
      }
      return { error: "No `checkout: moving from " + name + "` entry found. If you never checked it out here, the commit may only be on the remote: `git fetch` and look at `origin/" + name + "`." };
    }
    var kinds = { reset: ["reset"], rebase: ["rebase-finish", "rebase-step"], amend: ["amend"], merge: ["merge", "pull"], any: ["reset", "rebase-finish", "rebase-step", "amend", "merge", "pull"] }[goal];
    for (var k = 0; k < byIndex.length; k++) {
      var ev = byIndex[k];
      if (kinds.indexOf(reflogKind(ev.msg)) === -1) continue;
      var kind = reflogKind(ev.msg);
      var startIdx = ev.n;
      if (kind === "rebase-finish" || kind === "rebase-step") {
        // walk back to the "(start)" entry of this rebase
        for (var j = k; j < byIndex.length; j++) {
          if (/^rebase.*\(start\)/.test(byIndex[j].msg)) {
            startIdx = byIndex[j].n;
            break;
          }
          if (!/^rebase/.test(byIndex[j].msg)) break;
        }
      }
      var target = at(startIdx + 1);
      if (!target) return { error: "Found `" + ev.msg + "`, but the entry before it isn't in what you pasted. Paste more of the reflog." };
      return {
        event: ev,
        target: target,
        how: "Before `" + (kind.indexOf("rebase") === 0 ? at(startIdx).msg : ev.msg) + "` (" + "HEAD@{" + startIdx + "}" + "), HEAD was at `" + target.sha + "`: " + target.msg + ".",
        commands: ["git branch rescue-" + target.sha.slice(0, 7) + " " + target.sha, "git reset --hard " + target.sha + "    # only if you want the current branch back there, and have no uncommitted work"]
      };
    }
    return { error: "No " + (goal === "any" ? "reset, rebase, amend, merge, or pull" : goal) + " found in the pasted reflog." };
  }

  function mountReflog(root) {
    var ui = frame(root, "Reflog rescue", "Paste `git reflog` output and say what went wrong. You'll get the commit to go back to, and a safe command to save it.");
    var log = h("textarea", { rows: "7", spellcheck: "false", autocomplete: "off" });
    log.value = "e44a7b1 (HEAD -> feature/retry) HEAD@{0}: reset: moving to HEAD~2\n91c0d3e HEAD@{1}: commit: Add retry metrics\n7ab21f4 HEAD@{2}: commit: Retry on 503\nb7e41c9 HEAD@{3}: checkout: moving from feature/search to feature/retry\n5d0f8a2 HEAD@{4}: commit: Search by SKU\nb7e41c9 HEAD@{5}: checkout: moving from main to feature/search";
    var goal = h("select", null, [
      h("option", { value: "any", text: "Undo the last reset, rebase, amend, or merge" }),
      h("option", { value: "reset", text: "Undo the last reset" }),
      h("option", { value: "rebase", text: "Undo the last rebase" }),
      h("option", { value: "amend", text: "Get back the commit before an amend" }),
      h("option", { value: "merge", text: "Undo the last merge or pull" }),
      h("option", { value: "branch", text: "Recover a deleted branch" })
    ]);
    var branch = textInput("feature/search", { placeholder: "feature/search" });
    var branchField = field("Deleted branch name", branch);
    ui.form.appendChild(field("git reflog", log));
    ui.form.appendChild(h("div", { className: "cc-tool-grid" }, [field("What do you need?", goal), branchField]));
    function update() {
      branchField.hidden = goal.value !== "branch";
      var entries = parseReflog(log.value);
      if (!entries.length) return ui.show("Paste lines like `91c0d3e HEAD@{1}: commit: Add retry metrics`.");
      var r = reflogRescue(entries, goal.value, branch.value);
      if (r.error) return ui.show(r.error);
      ui.show("Go back to **" + r.target.sha + "**.", [
        para(r.how),
        codeBlock(r.commands.join("\n")),
        bullets([
          "Creating a branch first is always safe: nothing is overwritten, and you can inspect it with `git log`.",
          "`ORIG_HEAD` also points at the commit before the most recent reset, rebase, or merge: `git reset --hard ORIG_HEAD`.",
          "Reflogs are local and expire (unreachable entries after 30 days by default), and `git gc` then deletes the commits. A teammate's clone can't recover your unpushed work."
        ])
      ]);
    }
    live([log, goal, branch], update);
  }

  /* ---------------------------------------------------------------------------
     Linux: cron schedule preview
     Vixie cron and cronie semantics: when both day-of-month and day-of-week
     are restricted, a job runs when EITHER matches. A field that starts with
     "*" counts as unrestricted, even one with a step.
     ------------------------------------------------------------------------- */

  var CRON_FIELDS = [
    { name: "minute", min: 0, max: 59 },
    { name: "hour", min: 0, max: 23 },
    { name: "day of month", min: 1, max: 31 },
    { name: "month", min: 1, max: 12, names: ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] },
    { name: "day of week", min: 0, max: 7, names: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] }
  ];
  var CRON_MACROS = { "@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *", "@monthly": "0 0 1 * *", "@weekly": "0 0 * * 0", "@daily": "0 0 * * *", "@midnight": "0 0 * * *", "@hourly": "0 * * * *" };

  function cronField(text, spec) {
    var set = {};
    var steps = [];
    var parts = text.split(",");
    for (var i = 0; i < parts.length; i++) {
      var m = /^(\*|[a-z0-9]+(?:-[a-z0-9]+)?)(?:\/(\d+))?$/i.exec(parts[i]);
      if (!m) return { error: "`" + parts[i] + "` isn't valid in the " + spec.name + " field." };
      var lo = spec.min;
      var hi = spec.max === 7 ? 6 : spec.max;
      if (m[1] !== "*") {
        var range = m[1].split("-").map(function (v) {
          var idx = spec.names ? spec.names.indexOf(v.toLowerCase()) : -1;
          return idx !== -1 ? idx + (spec.name === "month" ? 1 : 0) : /^\d+$/.test(v) ? parseInt(v, 10) : NaN;
        });
        lo = range[0];
        hi = range.length > 1 ? range[1] : m[2] ? (spec.max === 7 ? 6 : spec.max) : range[0];
        if (isNaN(lo) || isNaN(hi) || lo < spec.min || hi > spec.max || lo > hi) return { error: "`" + parts[i] + "` is out of range for " + spec.name + " (" + spec.min + "–" + spec.max + ")." };
      }
      var step = m[2] ? parseInt(m[2], 10) : 1;
      if (step < 1) return { error: "A step of 0 isn't allowed." };
      if (m[2]) steps.push({ text: parts[i], step: step, lo: lo, hi: hi });
      for (var v2 = lo; v2 <= hi; v2 += step) set[spec.max === 7 && v2 === 7 ? 0 : v2] = true;
    }
    return { set: set, star: text.charAt(0) === "*", steps: steps };
  }

  function parseCron(text) {
    var s = String(text).trim();
    if (s === "@reboot") return { reboot: true };
    var macro = CRON_MACROS[s.split(/\s+/)[0]];
    var parts = (macro || s).split(/\s+/);
    if (parts.length >= 6 && !macro && /^[\d*,/-]+$/.test(parts[5])) return { error: "That's 6 fields. Standard cron has 5 (minute hour day month weekday); a leading seconds field is Quartz/Spring syntax, and a 6th field in /etc/crontab or /etc/cron.d is the user name." };
    if (parts.length < 5) return { error: "A cron schedule has 5 fields: minute, hour, day of month, month, day of week." };
    var fields = [];
    for (var i = 0; i < 5; i++) {
      var f = cronField(parts[i], CRON_FIELDS[i]);
      if (f.error) return { error: f.error };
      fields.push(f);
    }
    return { fields: fields, expr: parts.slice(0, 5).join(" "), command: macro ? s.split(/\s+/).slice(1).join(" ") : parts.slice(5).join(" ") };
  }

  function cronMatches(c, d, utc) {
    var f = c.fields;
    var get = function (name) { return d[(utc ? "getUTC" : "get") + name](); };
    if (!f[0].set[get("Minutes")] || !f[1].set[get("Hours")] || !f[3].set[get("Month") + 1]) return false;
    var dom = !!f[2].set[get("Date")];
    var dow = !!f[4].set[get("Day")];
    return f[2].star || f[4].star ? dom && dow : dom || dow;
  }

  function cronNext(c, from, count, utc) {
    var out = [];
    var d = new Date(from);
    d.setUTCSeconds(0, 0);
    d = new Date(d.getTime() + 60000);
    var limit = from + 4 * 366 * 86400000;
    while (out.length < count && d.getTime() < limit) {
      if (cronMatches(c, d, utc)) {
        out.push(new Date(d.getTime()));
        d = new Date(d.getTime() + 60000);
      } else {
        var monthOk = c.fields[3].set[(utc ? d.getUTCMonth() : d.getMonth()) + 1];
        var hourOk = c.fields[1].set[utc ? d.getUTCHours() : d.getHours()];
        var dayOk = cronMatches({ fields: [{ set: allSet(60) }, { set: allSet(24) }, c.fields[2], c.fields[3], c.fields[4]] }, d, utc);
        var step = !monthOk || !dayOk ? 86400000 - ((utc ? d.getUTCHours() : d.getHours()) * 60 + (utc ? d.getUTCMinutes() : d.getMinutes())) * 60000 : !hourOk ? (60 - (utc ? d.getUTCMinutes() : d.getMinutes())) * 60000 : 60000;
        d = new Date(d.getTime() + Math.max(60000, step));
      }
    }
    return out;
  }

  function allSet(n) {
    var s = {};
    for (var i = 0; i < n; i++) s[i] = true;
    return s;
  }

  function cronAdvice(c) {
    var notes = [];
    var f = c.fields;
    if (!f[2].star && !f[4].star) notes.push("Both day of month and day of week are set, so cron runs when **either** matches, not both. `0 9 1 * 1` runs on the 1st **and** every Monday. To get \"the first Monday\", schedule `0 9 1-7 * *` and test `[ \"$(date +\\%u)\" = 1 ]` in the command.");
    if ((f[2].star && /^\*\/\d/.test(c.expr.split(" ")[2])) || (f[4].star && /^\*\/\d/.test(c.expr.split(" ")[4]))) notes.push("A field starting with `*` counts as unrestricted for the either/or rule, even `*/2`.");
    f.forEach(function (fld, i) {
      fld.steps.forEach(function (s) {
        var span = s.hi - s.lo + 1;
        if (span % s.step !== 0 && i < 2) notes.push("`" + s.text + "` restarts every " + (i === 0 ? "hour" : "day") + ": the last run of the " + (i === 0 ? "hour" : "day") + " is followed by one only " + (span - Math.floor((span - 1) / s.step) * s.step) + " " + (i === 0 ? "minute(s)" : "hour(s)") + " later, at " + (i === 0 ? ":00" : "00:00") + ". It is not every " + s.step + " " + (i === 0 ? "minutes" : "hours") + " around the clock.");
      });
    });
    if (f[2].set[31] && !f[2].star) notes.push("Day 31 only exists in seven months; the job silently skips the rest.");
    if (f[2].set[29] && !f[2].set[28] && f[3].set[2] && Object.keys(f[3].set).length === 1) notes.push("29 February only exists in leap years.");
    var hours = Object.keys(f[1].set).map(Number);
    if (hours.some(function (hr) { return hr >= 1 && hr <= 2; }) && hours.length < 24) notes.push("Runs between 01:00 and 03:00 local time can be skipped or doubled on daylight-saving changes. Run the server in UTC, or use `CRON_TZ=` (cronie) or a Kubernetes CronJob's `timeZone` field.");
    notes.push("Cron uses the system time zone; a Kubernetes CronJob without `.spec.timeZone` uses the kube-controller-manager's. Check a systemd timer with `systemd-analyze calendar --iterations=5 '<expr>'`.");
    if (c.command && c.command.indexOf("%") !== -1) notes.push("The command contains `%`, which cron turns into a newline. Escape it as `\\%`.");
    return notes;
  }

  function mountCron(root) {
    var ui = frame(root, "Cron schedule preview", "Type a cron line to see when it really runs.");
    var expr = textInput("0 9 1 * 1  /usr/local/bin/report.sh", { placeholder: "*/15 * * * *" });
    var zone = h("select", null, [h("option", { value: "local", text: "Your browser's time zone" }), h("option", { value: "utc", text: "UTC" })]);
    var chips = h("div", { className: "cc-tool-chips" }, [h("span", { className: "cc-tool-muted", text: "Try:" })]);
    ["0 9 1 * 1", "*/45 * * * *", "0 */5 * * *", "30 2 31 * *", "0 0 29 2 *", "15 1 * * *", "@weekly", "0 0 * * 0-7"].forEach(function (ex) {
      var chip = h("button", { type: "button", className: "cc-tool-chip", text: ex });
      chip.addEventListener("click", function () {
        expr.value = ex;
        update();
      });
      chips.appendChild(chip);
    });
    ui.form.appendChild(chips);
    ui.form.appendChild(h("div", { className: "cc-tool-grid" }, [field("Cron line", expr), field("Show times in", zone)]));
    function update() {
      var c = parseCron(expr.value);
      if (c.error) return ui.show(c.error);
      if (c.reboot) return ui.show("`@reboot` runs once each time the cron daemon starts, usually at boot.", [para("It also runs when cron itself is restarted. For start-up work, a systemd unit with proper dependencies is more reliable.", "cc-tool-muted")]);
      var utc = zone.value === "utc";
      var runs = cronNext(c, Date.now(), 8, utc);
      var fmt = function (d) {
        var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        var pad = function (n) { return (n < 10 ? "0" : "") + n; };
        return utc ? days[d.getUTCDay()] + " " + d.toISOString().slice(0, 16).replace("T", " ") + " UTC"
          : days[d.getDay()] + " " + d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
      };
      if (!runs.length) return ui.show("This schedule never runs in the next four years.", [bullets(cronAdvice(c))]);
      ui.show("Next run: **" + fmt(runs[0]) + "**.", [
        table(["#", "Runs at"], runs.map(function (d, i) { return { cells: [i + 1, fmt(d)] }; })),
        bullets(cronAdvice(c))
      ]);
    }
    live([expr, zone], update);
  }

  /* ---------------------------------------------------------------------------
     Registry
     ------------------------------------------------------------------------- */

  var TOOLS = {
    serial: mountSerial,
    precedence: mountPrecedence,
    curl2uri: mountCurl,
    forbidden: mountForbidden,
    rollout: mountRollout,
    hpa: mountHpa,
    units: mountUnits,
    argv: mountArgv,
    perms: mountPerms,
    exitcode: mountExitcode,
    cidr: mountCidr,
    ports: mountPorts,
    certlife: mountCertlife,
    reflog: mountReflog,
    cron: mountCron
  };

  function mount(root) {
    var name = root.getAttribute("data-cc-tool");
    if (!TOOLS[name] || root.hasAttribute("data-cc-mounted")) return;
    root.setAttribute("data-cc-mounted", "");
    var fallback = Array.prototype.slice.call(root.childNodes);
    try {
      TOOLS[name](root);
    } catch (error) {
      // Put the placeholder's own text back rather than leave a broken form.
      root.textContent = "";
      fallback.forEach(function (node) {
        root.appendChild(node);
      });
      if (window.console) window.console.error(error);
    }
  }

  return {
    mount: mount,
    logic: {
      parseSerial: parseSerial,
      pctToInt: pctToInt,
      serialBatches: serialBatches,
      failThreshold: failThreshold,
      precedenceNotes: precedenceNotes,
      shellWords: shellWords,
      curlToUri: curlToUri,
      yamlString: yamlString,
      parseForbidden: parseForbidden,
      rbacFix: rbacFix,
      forbiddenNotes: forbiddenNotes,
      parseIntOrPercent: parseIntOrPercent,
      resolveFenceposts: resolveFenceposts,
      rolloutSteps: rolloutSteps,
      hpaDesired: hpaDesired,
      parseQuantity: parseQuantity,
      shRun: shRun,
      shAdvice: shAdvice,
      parsePathListing: parsePathListing,
      parseIdentity: parseIdentity,
      permWalk: permWalk,
      explainExit: explainExit,
      parseCidr: parseCidr,
      cidrPlan: cidrPlan,
      portBudget: portBudget,
      certInfo: certInfo,
      certRule: certRule,
      parseReflog: parseReflog,
      reflogRescue: reflogRescue,
      parseCron: parseCron,
      cronNext: cronNext,
      cronAdvice: cronAdvice
    }
  };
});
