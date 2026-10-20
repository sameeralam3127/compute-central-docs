// Unit tests for the pure logic behind docs/javascripts/tools.js.
// Run: node --test scripts/test_tools.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { logic: t } = require("../docs/javascripts/tools.js");

const argv = (cmd, o = {}) => t.shRun(cmd, o).commands.map((c) => c.argv);

test("ansible serial percentages truncate and never drop below one host", () => {
  // (29 / 100) * 100 is 28.999... in floating point, exactly as in Python, so Ansible makes batches of 28
  const values = t.parseSerial("29%").values;
  assert.deepEqual(t.serialBatches(100, values).map((b) => b.size), [28, 28, 28, 16]);
  assert.equal(t.pctToInt({ pct: 10 }, 5), 1);
});

test("kubernetes rollout fenceposts round surge up and unavailable down", () => {
  const pct = t.parseIntOrPercent("25%");
  assert.deepEqual(t.resolveFenceposts(10, pct, pct), { surge: 3, unavailable: 2, bumped: false });
  const zero = t.parseIntOrPercent("0");
  assert.equal(t.resolveFenceposts(10, zero, zero).unavailable, 1);
});

test("bash: quoting, splitting, and empty variables", () => {
  assert.deepEqual(argv("cp $FILE /backup/", { vars: "FILE=Q3 report.pdf" }), [["cp", "Q3", "report.pdf", "/backup/"]]);
  assert.deepEqual(argv("cp \"$FILE\" /backup/", { vars: "FILE=Q3 report.pdf" }), [["cp", "Q3 report.pdf", "/backup/"]]);
  assert.deepEqual(argv("[ $ENV = prod ]", { vars: "ENV=" }), [["[", "=", "prod", "]"]]);
  assert.deepEqual(argv("printf x \"$EMPTY\" ''", { vars: "EMPTY=" }), [["printf", "x", "", ""]]);
  assert.deepEqual(argv("echo 'a  b' $'tab\\there'"), [["echo", "a  b", "tab\there"]]);
});

test("bash: the Steam rm -rf expands to every top-level directory", () => {
  const run = t.shRun("rm -rf \"$STEAMROOT/\"*", { vars: "STEAMROOT=" });
  const args = run.commands[0].argv;
  assert.equal(args[0], "rm");
  assert.ok(args.includes("/usr") && args.includes("/home"));
  assert.ok(t.shAdvice(run.commands[0]).danger.length > 0);
});

test("bash: ${VAR:?} stops before running", () => {
  const run = t.shRun("rm -rf \"${STEAMROOT:?}/\"*", { vars: "STEAMROOT=" });
  assert.equal(run.stopped, "bash: STEAMROOT: parameter null or not set");
});

test("bash: set -u catches unset but not empty variables", () => {
  assert.equal(t.shRun("echo $NOPE", { nounset: true }).stopped, "bash: NOPE: unbound variable");
  assert.equal(t.shRun("echo $EMPTY", { nounset: true, vars: "EMPTY=" }).stopped, null);
});

test("bash: the Bumblebee stray space is flagged", () => {
  const run = t.shRun("rm -rf /usr /lib/nvidia-current/xorg/xorg");
  assert.deepEqual(run.commands[0].argv, ["rm", "-rf", "/usr", "/lib/nvidia-current/xorg/xorg"]);
  assert.ok(t.shAdvice(run.commands[0]).danger.length > 0);
});

test("bash: \"$@\" keeps arguments, $* re-splits, \"$*\" joins", () => {
  const args = "\"my file.txt\" -v";
  assert.deepEqual(argv("f \"$@\"", { args }), [["f", "my file.txt", "-v"]]);
  assert.deepEqual(argv("f $*", { args }), [["f", "my", "file.txt", "-v"]]);
  assert.deepEqual(argv("f \"$*\"", { args }), [["f", "my file.txt -v"]]);
  assert.deepEqual(argv("f \"$@\""), [["f"]]);
});

test("bash: brace, tilde, arithmetic, and parameter operators", () => {
  assert.deepEqual(argv("cp nginx.conf{,.bak}"), [["cp", "nginx.conf", "nginx.conf.bak"]]);
  assert.deepEqual(argv("echo {01..03} {a..c}"), [["echo", "01", "02", "03", "a", "b", "c"]]);
  assert.deepEqual(argv("ls ~/x \"~/y\"", { vars: "HOME=/home/sam" }), [["ls", "/home/sam/x", "~/y"]]);
  assert.deepEqual(argv("echo $((N * 2 + 1))", { vars: "N=20" }), [["echo", "41"]]);
  assert.deepEqual(argv("echo ${F%.*} ${F##*/} ${F/log/txt} ${F: -3} ${#F} ${X:-def}", { vars: "F=/var/app.log" }), [["echo", "/var/app", "app.log", "/var/app.txt", "log", "12", "def"]]);
});

test("bash: globs match the given files, skip dotfiles, and pass through unmatched", () => {
  const files = "app.log error.log notes.md .hidden.log";
  assert.deepEqual(argv("echo $PATTERN", { vars: "PATTERN=*.log", files }), [["echo", "app.log", "error.log"]]);
  assert.deepEqual(argv("echo \"$PATTERN\"", { vars: "PATTERN=*.log", files }), [["echo", "*.log"]]);
  assert.deepEqual(argv("echo *.bak", { files }), [["echo", "*.bak"]]);
  assert.deepEqual(argv("echo *.bak", { files, nullglob: true }), [["echo"]]);
});

test("bash: commands, assignments, and redirections", () => {
  const run = t.shRun("DIR=/tmp/x; rm -rf \"$DIR\" 2>/dev/null && echo done");
  assert.deepEqual(run.commands.map((c) => c.argv), [[], ["rm", "-rf", "/tmp/x"], ["echo", "done"]]);
  assert.deepEqual(run.commands[1].redirs, [{ op: ">", fd: "2", target: "/dev/null" }]);
  const order = t.shRun("./backup.sh 2>&1 > /var/log/b.log");
  assert.ok(t.shAdvice(order.commands[0]).warn.some((w) => w.includes("Order matters")));
  assert.deepEqual(argv("[[ $X == a b ]]", { vars: "X=1 2" }), [["[[", "1 2", "==", "a", "b", "]]"]]);
  assert.match(t.shRun("echo 'oops").error, /single quote/);
});

const NGINX = `f: /home/alice/site/index.html
drwxr-xr-x root  root  /
drwxr-xr-x root  root  home
drwx------ alice alice alice
drwxr-xr-x alice alice site
-rw-r--r-- alice alice index.html`;

test("permissions: a 700 home directory blocks another user", () => {
  const walk = t.permWalk(t.parsePathListing(NGINX).entries, t.parseIdentity("uid=33(www-data) gid=33(www-data) groups=33(www-data)"), "read");
  assert.equal(walk.fail.entry.name, "alice");
  assert.equal(walk.fail.cls, "other");
  const root = t.permWalk(t.parsePathListing(NGINX).entries, t.parseIdentity("uid=0(root) gid=0(root) groups=0(root)"), "read");
  assert.equal(root.fail, null);
});

test("permissions: owner bits apply first, delete depends on the directory", () => {
  const listing = "drwxr-xr-x root root /\ndrwxr-xr-x bob ops app\n----rw-rw- bob ops config.yml";
  const bob = t.parseIdentity("uid=1001(bob) gid=1001(bob) groups=1001(bob),2000(ops)");
  assert.equal(t.permWalk(t.parsePathListing(listing).entries, bob, "read").fail.cls, "owner");
  const shared = "drwxr-xr-x root root /\ndrwxrwsr-x root devops shared\n-r--r--r-- alice alice report.txt";
  assert.equal(t.permWalk(t.parsePathListing(shared).entries, t.parseIdentity("bob devops"), "remove").fail, null);
  const tmp = "drwxr-xr-x root root /\ndrwxrwxrwt root root tmp\n-rw-rw-rw- alice alice build.lock";
  assert.equal(t.permWalk(t.parsePathListing(tmp).entries, t.parseIdentity("carol"), "remove").fail.sticky, true);
  const script = "drwxr-xr-x root root /\n-rwx--x--x root root deploy.sh";
  assert.deepEqual(t.permWalk(t.parsePathListing(script).entries, t.parseIdentity("bob"), "script").fail.missing, ["r"]);
  assert.equal(t.permWalk(t.parsePathListing(script).entries, t.parseIdentity("bob"), "exec").fail, null);
});

test("exit codes: signals, wraparound, and command tables", () => {
  assert.equal(t.explainExit("137", "container", "").signal, 9);
  assert.equal(t.explainExit("-9", "python", "").signal, 9);
  assert.equal(t.explainExit("256", "shell", "").code, 0);
  assert.equal(t.explainExit("-1", "shell", "").code, 255);
  assert.match(t.explainExit("1", "shell", "grep").title, /no lines matched/);
  assert.match(t.explainExit("124", "shell", "timeout").title, /time limit/);
  assert.match(t.explainExit("127", "shell", "").title, /not found/);
});

test("cidr: normalizes host bits and finds containment", () => {
  const c = t.parseCidr("172.20.0.5/16");
  assert.equal(c.text, "172.20.0.0/16");
  assert.equal(c.hostBits, true);
  const plan = t.cidrPlan("a 10.0.0.0/16\nb 10.0.64.0/18\nc 10.1.0.0/16", true);
  assert.equal(plan.overlaps.length, 1);
  assert.equal(plan.overlaps[0].rel, "contains");
  assert.ok(plan.defaults.some((d) => d.name.includes("Swarm")));
  assert.match(t.parseCidr("10.0.0.256/24").error, /valid IPv4/);
});

test("ports: TIME-WAIT dominates the budget", () => {
  const r = t.portBudget({ range: "net.ipv4.ip_local_port_range = 32768 60999", rate: 500, dests: 1, duration: 0, clientCloses: true });
  assert.equal(r.ports, 28232);
  assert.equal(Math.round(r.inUse), 30000);
  assert.equal(Math.floor(r.maxRate), 470);
  assert.equal(t.portBudget({ range: "32768 60999", rate: 500, dests: 1, duration: 0, clientCloses: false }).inUse, 0);
});

test("certificates: lifetime schedule and openssl dates", () => {
  assert.equal(t.certRule(Date.UTC(2026, 2, 14)).days, 398);
  assert.equal(t.certRule(Date.UTC(2026, 2, 15)).days, 200);
  assert.equal(t.certRule(Date.UTC(2029, 5, 1)).dcv, 10);
  const info = t.certInfo("notBefore=Oct  1 00:00:00 2026 GMT\nnotAfter=Apr 19 23:59:59 2027 GMT", Date.UTC(2026, 9, 20));
  assert.equal(Math.round(info.lifetime), 201);
  assert.equal(info.tooLong, false);
  assert.equal(info.daysLeft, 181);
});

test("reflog: finds the state before a reset, a rebase, and a deleted branch", () => {
  const log = t.parseReflog(`e44a7b1 (HEAD -> feature/retry) HEAD@{0}: reset: moving to HEAD~2
91c0d3e HEAD@{1}: commit: Add retry metrics
b7e41c9 HEAD@{2}: checkout: moving from feature/search to feature/retry
5d0f8a2 HEAD@{3}: commit: Search by SKU`);
  assert.equal(t.reflogRescue(log, "reset").target.sha, "91c0d3e");
  assert.equal(t.reflogRescue(log, "branch", "feature/search").target.sha, "5d0f8a2");
  const rebase = t.parseReflog(`aaa1111 HEAD@{0}: rebase (finish): returning to refs/heads/x
bbb2222 HEAD@{1}: rebase (pick): two
ccc3333 HEAD@{2}: rebase (start): checkout main
ddd4444 HEAD@{3}: commit: two`);
  assert.equal(t.reflogRescue(rebase, "rebase").target.sha, "ddd4444");
});

test("cron: day-of-month and day-of-week are ORed unless one starts with *", () => {
  const c = t.parseCron("0 9 1 * 1");
  const runs = t.cronNext(c, Date.UTC(2026, 9, 20, 12), 5, true).map((d) => d.toISOString().slice(0, 10));
  assert.deepEqual(runs, ["2026-10-26", "2026-11-01", "2026-11-02", "2026-11-09", "2026-11-16"]);
  const star = t.cronNext(t.parseCron("0 0 */2 * 1"), Date.UTC(2026, 9, 20), 2, true).map((d) => d.toISOString().slice(0, 10));
  assert.deepEqual(star, ["2026-11-09", "2026-11-23"]); // odd days AND Mondays
  const leap = t.cronNext(t.parseCron("0 0 29 2 *"), Date.UTC(2026, 9, 20), 1, true);
  assert.equal(leap[0].toISOString().slice(0, 10), "2028-02-29");
  assert.match(t.parseCron("0 0 * * * *").error, /6 fields/);
  assert.ok(t.cronAdvice(t.parseCron("*/45 * * * *")).some((n) => n.includes("restarts every hour")));
});
