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
      } catch (error) {
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
        try { asJson = JSON.parse(trimmed); } catch (error) { asJson = null; }
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
    var path = "";
    try {
      var parsedUrl = new URL(url);
      host = parsedUrl.host;
      path = parsedUrl.pathname;
    } catch (error) {
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
    var named = /(?:^|: )([a-z0-9.\/-]+) "([^"]+)" is forbidden/i.exec(s);
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
    var rule = [];
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
     Registry
     ------------------------------------------------------------------------- */

  var TOOLS = {
    serial: mountSerial,
    precedence: mountPrecedence,
    curl2uri: mountCurl,
    forbidden: mountForbidden,
    rollout: mountRollout,
    hpa: mountHpa,
    units: mountUnits
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
      parseQuantity: parseQuantity
    }
  };
});
