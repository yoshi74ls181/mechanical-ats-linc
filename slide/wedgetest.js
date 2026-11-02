/*
 * Does the scissor sector always contain the bias axis?
 *
 *   node wedgetest.js <file.html> [port]
 *
 * The sector between the arms spans 2*delta and is bisected by the bias axis dir(phi + sigma).
 * So for ANY delta, two probe points either side of that bisector must land on pink fill.
 * If "draw the smaller sector" flips the sector to the opposite half-plane when 2*delta > pi, the probes land on bare paper instead, and that is the bug.
 *
 * Drives the real page: freezes its rAF loop, marches St.t across several delta = pi/2 crossings, redraws, and reads the canvas back with getImageData.
 * No changes to the page under test.
 */
"use strict";
const { spawn } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");

const FILE = path.resolve(process.argv[2]);
const PORT = parseInt(process.argv[3] || "9377", 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "wt-"));
  const proc = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
    "--headless=new", "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + profile, "--window-size=1600,900",
    "--force-device-scale-factor=1", "--hide-scrollbars", "--disable-gpu",
    "--force-color-profile=srgb", "--no-first-run",
    "--allow-file-access-from-files",
    "file:///" + FILE.replace(/\\/g, "/"),
  ], { stdio: "ignore" });

  let t = null;
  for (let i = 0; i < 80 && !t; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      t = (await r.json()).find(x => x.type === "page" && x.url.endsWith(".html"));
    } catch (e) {}
    if (!t) await sleep(200);
  }
  if (!t) { console.error("page never appeared"); process.exit(2); }

  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let id = 0; const pend = new Map(); const errs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === "Runtime.exceptionThrown")
      errs.push(m.params.exceptionDetails.text + " " +
        ((m.params.exceptionDetails.exception || {}).description || ""));
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
  };
  const send = (method, params = {}) => {
    const i = ++id;
    ws.send(JSON.stringify({ id: i, method, params }));
    return new Promise(r => pend.set(i, r));
  };
  const ev = async expr => {
    const r = await send("Runtime.evaluate",
      { expression: expr, returnByValue: true });
    if (r.exceptionDetails)
      throw new Error("eval: " + JSON.stringify(r.exceptionDetails.text) + " " +
        ((r.exceptionDetails.exception || {}).description || ""));
    return r.result && r.result.value;
  };
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride",
    { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(900);

  // freeze the animation loop, then drive it by hand
  await ev(`window.requestAnimationFrame = function(){ return 0; };`);
  await sleep(300);
  const lay = await ev(`JSON.stringify({narrow: LAY.narrow, cx: LAY.cx, eps: St.eps,
                                        pump: St.pump, div: St.pumpDiv})`);
  console.log("file:", path.basename(FILE));
  console.log("layout/state:", lay);
  if (JSON.parse(lay).narrow) { console.error("needs the WIDE layout"); process.exit(2); }

  // Probe: +/-0.5 rad either side of the bias axis, at radius 45 -- inside the sector (52), outside the torsion spring (30) and the mode wedge (40), and off the bias axis itself so the exaggerated centre-of-mass marker (which for both devices runs ALONG that axis) cannot be mistaken for the fill.
  const probe = `(function(tt){
    last = performance.now();
    St.t = tt;
    frame(performance.now());
    const dev = DEVS[0];                      // ATS panel, wide layout: ox=0, oy=0
    const d   = scissor(dev, St.t);
    const sc = SCALE, dpr = window.devicePixelRatio || 1;
    const tx = (cv.clientWidth - VW*sc)/2, ty = 6;
    const P = (dx,dy) => [Math.round(dpr*(tx + dx*sc)), Math.round(dpr*(ty + dy*sc))];
    const pivx = LAY.cx, pivy = 415;
    const out = [];
    for (const off of [0.5, -0.5]){
      const a = dev.phi + dev.sigma + off;
      const dx = pivx - Math.sin(a)*45, dy = pivy + Math.cos(a)*45;
      const p = P(dx, dy);
      const px = ctx.getImageData(p[0], p[1], 1, 1).data;
      out.push({r:px[0], g:px[1], b:px[2],
                pink: (px[0]-px[1]) > 15 && (px[2]-px[1]) > 5});
    }
    return JSON.stringify({t:St.t, phi:dev.phi, delta:d,
                           dgt: d > Math.PI/2, span2d: 2*d, probes:out});
  })`;

  let pass = 0, fail = 0;
  const rows = [];
  for (let k = 0; k < 16; k++) {
    const tt = 0.2 + k * 0.4;
    const r = JSON.parse(await ev(`${probe}(${tt})`));
    const ok = r.probes.every(p => p.pink);
    ok ? pass++ : fail++;
    rows.push({ t: r.t.toFixed(2), delta: r.delta.toFixed(3),
                span: r.span2d.toFixed(3), gt: r.dgt ? "2d>pi" : "2d<pi",
                ok: ok ? "ok  " : "FAIL",
                px: r.probes.map(p => `(${p.r},${p.g},${p.b})`).join(" ") });
  }
  console.log("\n   t    delta    2*delta          probes(rgb)                  result");
  for (const r of rows)
    console.log(`${r.t.padStart(5)}  ${r.delta}   ${r.span}  ${r.gt.padEnd(6)} ${r.px.padEnd(28)} ${r.ok}`);
  console.log(`\n${pass} pass, ${fail} FAIL  (sector must contain the bias axis at every delta)`);
  if (errs.length) console.log("page errors:", errs);

  try { await send("Browser.close"); } catch (e) {}
  proc.kill(); await sleep(300);
  fs.rmSync(profile, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})();
