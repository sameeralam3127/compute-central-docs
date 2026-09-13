(function () {
  "use strict";

  var reduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Incremented on every page render so timers from a previous render
  // (instant navigation keeps this script alive) stop themselves.
  var generation = 0;

  /* ---------------------------------------------------------------------------
     Count-up stats
     ------------------------------------------------------------------------- */

  function finalText(el) {
    return el.getAttribute("data-count") + (el.getAttribute("data-suffix") || "");
  }

  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    if (isNaN(target)) return;

    var duration = 1000;
    var start = null;

    function step(timestamp) {
      if (start === null) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);
  }

  function setupCounters() {
    var counters = document.querySelectorAll(".cc-stat-number[data-count]");
    if (!counters.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      counters.forEach(function (el) {
        el.textContent = finalText(el);
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    counters.forEach(function (el) {
      el.textContent = "0";
      observer.observe(el);
    });
  }

  /* ---------------------------------------------------------------------------
     Hero terminal: types real commands from the guides
     ------------------------------------------------------------------------- */

  var SCENARIOS = [
    {
      label: "Docker",
      href: "docker/14-caddy-web-app-lab/",
      lines: [
        { cmd: "docker compose up -d" },
        { out: "✔ Container caddylab-db-1      Healthy" },
        { out: "✔ Container caddylab-api-1     Started" },
        { out: "✔ Container caddylab-caddy-1   Started" },
        { cmd: "curl -s localhost/api/todos | jq length" },
        { out: "3", ok: true }
      ]
    },
    {
      label: "Kubernetes",
      href: "kubernetes/getting-started/04-your-first-deployment/",
      lines: [
        { cmd: "kubectl set image deployment/hello-web nginx=nginx:1.27.1" },
        { out: "deployment.apps/hello-web image updated" },
        { cmd: "kubectl rollout status deployment/hello-web" },
        { out: "Waiting for deployment \"hello-web\" rollout to finish: 2 out of 3 new replicas have been updated..." },
        { out: "deployment \"hello-web\" successfully rolled out", ok: true }
      ]
    },
    {
      label: "Ansible",
      href: "ansible/case-studies/01-rolling-nginx-deployment/",
      lines: [
        { cmd: "ansible-playbook -i inventories/production playbooks/deploy_nginx.yml" },
        { out: "PLAY [Roll out nginx across web fleet] ***" },
        { out: "TASK [nginx : Deploy nginx configuration] ***" },
        { out: "changed: [web01]" },
        { out: "PLAY RECAP ***" },
        { out: "web01 : ok=5  changed=3  unreachable=0  failed=0", ok: true }
      ]
    },
    {
      label: "Terraform",
      href: "terraform/overview/",
      lines: [
        { cmd: "terraform plan -out=tfplan" },
        { out: "  + resource \"random_pet\" \"server\" {" },
        { out: "  + resource \"local_file\" \"inventory\" {" },
        { out: "Plan: 2 to add, 0 to change, 0 to destroy." },
        { cmd: "terraform apply tfplan" },
        { out: "Apply complete! Resources: 2 added, 0 changed, 0 destroyed.", ok: true }
      ]
    }
  ];

  var TYPE_MS = 30;
  var AFTER_CMD_MS = 380;
  var OUTPUT_MS = 260;
  var HOLD_MS = 2800;

  function scenarioDuration(scenario) {
    var total = HOLD_MS;
    scenario.lines.forEach(function (line) {
      total += line.cmd ? line.cmd.length * TYPE_MS + AFTER_CMD_MS : OUTPUT_MS;
    });
    return total;
  }

  function setupTerminal(gen) {
    var root = document.querySelector("[data-cc-terminal]");
    if (!root) return;

    var body = root.querySelector("[data-cc-terminal-body]");
    var tabsWrap = root.querySelector("[data-cc-terminal-tabs]");
    var link = root.querySelector("[data-cc-terminal-link]");
    if (!body || !tabsWrap) return;

    var timer = null;
    var inView = true;
    var tabs = [];
    var current = 0;

    function alive() {
      return gen === generation && document.body.contains(root);
    }

    // Single pending timer; pauses while the tab is hidden or the terminal is off screen.
    function later(fn, ms) {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        if (!alive()) return;
        if (document.hidden || !inView) {
          later(fn, 500);
          return;
        }
        fn();
      }, ms);
    }

    function addLine(className) {
      var el = document.createElement("span");
      el.className = "cc-t-line " + className;
      body.appendChild(el);
      return el;
    }

    function addPrompt(el) {
      var prompt = document.createElement("span");
      prompt.className = "cc-t-prompt";
      prompt.textContent = "$ ";
      el.appendChild(prompt);
    }

    function makeCaret() {
      var caret = document.createElement("span");
      caret.className = "cc-caret";
      caret.setAttribute("aria-hidden", "true");
      return caret;
    }

    function selectTab(index, duration) {
      tabs.forEach(function (tab, i) {
        var selected = i === index;
        tab.setAttribute("aria-selected", selected ? "true" : "false");
        tab.classList.remove("is-running");
        if (selected && !reduceMotion) {
          void tab.offsetWidth; // restart the progress animation
          tab.style.setProperty("--cc-dur", duration + "ms");
          tab.classList.add("is-running");
        }
      });
      if (link) {
        link.setAttribute("href", SCENARIOS[index].href);
        link.textContent = "Open the " + SCENARIOS[index].label + " guide →";
      }
    }

    function renderStatic(scenario) {
      body.textContent = "";
      scenario.lines.forEach(function (line) {
        if (line.cmd) {
          var el = addLine("cc-t-cmd");
          addPrompt(el);
          el.appendChild(document.createTextNode(line.cmd));
        } else {
          addLine(line.ok ? "cc-t-out cc-t-ok" : "cc-t-out").textContent = line.out;
        }
      });
    }

    function play(index) {
      current = (index + SCENARIOS.length) % SCENARIOS.length;
      var scenario = SCENARIOS[current];
      selectTab(current, scenarioDuration(scenario));

      if (reduceMotion) {
        window.clearTimeout(timer);
        renderStatic(scenario);
        return;
      }

      body.textContent = "";
      var lineIndex = 0;

      function nextLine() {
        if (lineIndex >= scenario.lines.length) {
          var idle = addLine("cc-t-cmd");
          addPrompt(idle);
          idle.appendChild(makeCaret());
          later(function () {
            play(current + 1);
          }, HOLD_MS);
          return;
        }

        var line = scenario.lines[lineIndex++];

        if (line.cmd) {
          var el = addLine("cc-t-cmd");
          addPrompt(el);
          var text = document.createTextNode("");
          var caret = makeCaret();
          el.appendChild(text);
          el.appendChild(caret);
          var typed = 0;

          (function typeNext() {
            typed += 1;
            text.data = line.cmd.slice(0, typed);
            if (typed < line.cmd.length) {
              later(typeNext, TYPE_MS);
            } else {
              later(function () {
                caret.remove();
                nextLine();
              }, AFTER_CMD_MS);
            }
          })();
        } else {
          addLine(line.ok ? "cc-t-out cc-t-ok" : "cc-t-out").textContent = line.out;
          later(nextLine, OUTPUT_MS);
        }
      }

      nextLine();
    }

    tabsWrap.textContent = "";
    SCENARIOS.forEach(function (scenario, i) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "cc-terminal-tab";
      tab.setAttribute("role", "tab");
      tab.textContent = scenario.label;
      tab.addEventListener("click", function () {
        play(i);
      });
      tabsWrap.appendChild(tab);
      tabs.push(tab);
    });
    tabsWrap.hidden = false;

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
      }).observe(root);
    }

    play(0);
  }

  /* ---------------------------------------------------------------------------
     Track filter chips
     ------------------------------------------------------------------------- */

  function setupFilter() {
    var bar = document.querySelector("[data-cc-filter]");
    if (!bar) return;

    var cards = Array.prototype.slice.call(document.querySelectorAll(".cc-card[data-cc-tags]"));
    var buttons = Array.prototype.slice.call(bar.querySelectorAll("button[data-cc-value]"));
    var count = bar.querySelector("[data-cc-count]");

    function apply(value) {
      var shown = 0;
      buttons.forEach(function (button) {
        button.setAttribute("aria-pressed", button.getAttribute("data-cc-value") === value ? "true" : "false");
      });
      cards.forEach(function (card) {
        var tags = card.getAttribute("data-cc-tags").split(/\s+/);
        var show = value === "all" || tags.indexOf(value) !== -1;
        card.classList.toggle("cc-filtered-out", !show);
        card.classList.remove("cc-pop");
        if (show) {
          if (!reduceMotion) {
            void card.offsetWidth; // restart the entrance animation
            card.style.setProperty("--cc-delay", shown * 40 + "ms");
            card.classList.add("cc-pop");
          }
          shown += 1;
        }
      });
      if (count) count.textContent = shown + (shown === 1 ? " track" : " tracks");
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        apply(button.getAttribute("data-cc-value"));
      });
    });

    bar.hidden = false;
  }

  /* ---------------------------------------------------------------------------
     Pointer spotlight on cards and stats
     ------------------------------------------------------------------------- */

  function setupSpotlight() {
    document.querySelectorAll(".cc-card, .cc-stat").forEach(function (el) {
      el.addEventListener("pointermove", function (event) {
        var rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", event.clientX - rect.left + "px");
        el.style.setProperty("--my", event.clientY - rect.top + "px");
      });
    });
  }

  /* ---------------------------------------------------------------------------
     Reveal sections as they scroll into view
     ------------------------------------------------------------------------- */

  function setupReveal() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;

    var sections = document.querySelectorAll("[data-cc-reveal]");
    if (!sections.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.remove("cc-pending");
          entry.target.classList.add("cc-in");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    sections.forEach(function (section) {
      section.querySelectorAll(".cc-card, .cc-news-item, li").forEach(function (item, i) {
        item.style.setProperty("--i", i);
      });
      // Only hide sections the reader hasn't reached yet, so nothing visible flickers.
      if (section.getBoundingClientRect().top < window.innerHeight * 0.9) return;
      section.classList.add("cc-pending");
      observer.observe(section);
    });
  }

  /* ---------------------------------------------------------------------------
     Wiring
     ------------------------------------------------------------------------- */

  function setup() {
    generation += 1;
    setupCounters();
    setupTerminal(generation);
    setupFilter();
    setupSpotlight();
    setupReveal();
  }

  if (typeof document$ !== "undefined") {
    // Material/Zensical instant-navigation observable — fires on every
    // page render, including the first one.
    document$.subscribe(setup);
  } else {
    document.addEventListener("DOMContentLoaded", setup);
  }
})();
