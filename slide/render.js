/* ------------------------------------------------------------------ *
 *  Render ats-slide.html to a PowerPoint-ready video.
 *
 *    node slide/render.js [--page FILE] [--fps N] [--dsf N]
 *                        [--format png|jpeg] [--out DIR] [--frames N]
 *
 *  --page picks which slide to render (default ats-slide.html); the output
 *  files take their basename from it, so ats-slide.html -> out/ats-slide.mp4
 *  and linc-slide.html -> out/linc-slide.mp4. Frame scratch dirs and the
 *  debug port are per-page too, so two renders can run at once.
 *
 *  Drives headless Chrome over the DevTools Protocol and pulls one
 *  screenshot per simulation frame, so the result is deterministic: the
 *  page never uses the wall clock in capture mode, it advances exactly
 *  one fixed dt per renderFrame(i) call. Nothing is installed -- CDP is
 *  spoken over Node's built-in WebSocket (Node >= 22).
 *
 *  Frames are captured at dsf x the design size the page reports in
 *  window.SLIDE_META, then downscaled by ffmpeg with lanczos, which
 *  supersamples the canvas antialiasing and keeps the plot labels crisp.
 * ------------------------------------------------------------------ */
"use strict";
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/* ---------- args ---------- */
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf("--" + k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const DSF    = parseFloat(arg("dsf", "2"));
const FORMAT = arg("format", "png");
const HERE   = __dirname;
const OUTDIR = path.resolve(arg("out", path.join(HERE, "out")));
const PAGE   = path.resolve(arg("page", path.join(HERE, "ats-slide.html")));
const PAGEF  = path.basename(PAGE);
const BASE   = PAGEF.replace(/\.html?$/i, "");
const PORT   = parseInt(arg("port", "9333"), 10);
const FRAMEDIR = path.join(os.tmpdir(), "slide-frames-" + BASE);

/* ---------- chrome ---------- */
function findChrome(){
  const c = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean);
  for (const p of c) if (fs.existsSync(p)) return p;
  throw new Error("no Chrome or Edge found; set CHROME_PATH");
}

/* ---------- minimal CDP client over the built-in WebSocket ---------- */
class CDP {
  constructor(ws){ this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)){
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(m.method + ": " + JSON.stringify(m.error))) : resolve(m.result);
      }
    };
  }
  static async connect(url){
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    return new CDP(ws);
  }
  send(method, params){
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  async eval(expr){
    const r = await this.send("Runtime.evaluate",
      { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("page: " + r.exceptionDetails.text +
      " " + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description));
    return r.result.value;
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fetchJSON(url, tries){
  for (let i = 0; i < tries; i++){
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) {}
    await sleep(200);
  }
  throw new Error("chrome did not answer on " + url);
}

/* ---------- ffmpeg ---------- */
function ffmpeg(args, label){
  const r = spawnSync("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
  if (r.status !== 0){
    process.stderr.write(r.stderr ? r.stderr.toString() : "");
    throw new Error("ffmpeg failed for " + label);
  }
}

(async function main(){
  const chrome = findChrome();
  if (!fs.existsSync(PAGE)) throw new Error("no such page: " + PAGE);
  console.log("page:", PAGE);
  fs.rmSync(FRAMEDIR, { recursive: true, force: true });
  fs.mkdirSync(FRAMEDIR, { recursive: true });
  fs.mkdirSync(OUTDIR, { recursive: true });

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ats-chrome-"));
  const url = "file:///" + PAGE.replace(/\\/g, "/") + "?capture=1";
  const proc = spawn(chrome, [
    "--headless=new",
    "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + profile,
    "--window-size=1920,1080",
    "--force-device-scale-factor=1",
    "--hide-scrollbars",
    "--disable-lcd-text",            // no subpixel colour fringes to survive downscaling
    "--force-color-profile=srgb",
    "--disable-gpu",                 // software raster: identical output every run
    "--no-first-run", "--no-default-browser-check", "--disable-extensions",
    "--allow-file-access-from-files",
    url,
  ], { stdio: ["ignore", "ignore", "ignore"] });

  let cdp;
  try {
    // find the page target
    let target = null;
    for (let i = 0; i < 100 && !target; i++){
      const list = await fetchJSON("http://127.0.0.1:" + PORT + "/json/list", 1).catch(() => []);
      target = (list || []).find(t => t.type === "page" && t.url.indexOf(PAGEF) >= 0);
      if (!target) await sleep(200);
    }
    if (!target) throw new Error("slide page target never appeared");

    cdp = await CDP.connect(target.webSocketDebuggerUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    // wait for the page's own script to be ready
    let meta = null;
    for (let i = 0; i < 100 && !meta; i++){
      meta = await cdp.eval("window.renderFrame ? window.SLIDE_META : null").catch(() => null);
      if (!meta) await sleep(100);
    }
    if (!meta) throw new Error("renderFrame() never became available");
    const FPS = parseInt(arg("fps", String(meta.FPS)), 10);
    // the page declares its own frame size; h264 yuv420p needs both even
    if (meta.VW % 2 || meta.VH % 2)
      throw new Error("frame size " + meta.VW + "x" + meta.VH + " must be even for h264");
    await cdp.send("Emulation.setDeviceMetricsOverride",
      { width: meta.VW, height: meta.VH, deviceScaleFactor: DSF, mobile: false });
    await sleep(250);                       // let the relayout settle
    const got = await cdp.eval("document.getElementById('c').clientWidth");
    if (got !== meta.VW)
      throw new Error("canvas laid out at " + got + " css px, expected " + meta.VW);
    console.log("page ready:", JSON.stringify(meta));
    console.log("capture: up to", meta.NFRAMES, "frames at",
                meta.VW + "x" + meta.VH, DSF + "x", "->", FORMAT);

    const shotOpts = FORMAT === "jpeg"
      ? { format: "jpeg", quality: 95, captureBeyondViewport: false }
      : { format: "png", captureBeyondViewport: false };
    const ext = FORMAT === "jpeg" ? "jpg" : "png";

    // --frames N renders only the first N frames, for a quick look
    const NF = Math.min(parseInt(arg("frames", String(meta.NFRAMES)), 10), meta.NFRAMES);
    const t0 = Date.now();
    let peak = 0;
    for (let i = 0; i < NF; i++){
      const st = await cdp.eval("JSON.stringify(window.renderFrame(" + i + "))");
      const s = JSON.parse(st);
      peak = Math.max(peak, Math.abs(s.phi));
      const shot = await cdp.send("Page.captureScreenshot", shotOpts);
      fs.writeFileSync(path.join(FRAMEDIR, "f" + String(i).padStart(5, "0") + "." + ext),
                       Buffer.from(shot.data, "base64"));
      if (i % 60 === 0 || i === NF - 1)
        console.log("  frame " + i + "/" + NF +
                    "  t=" + s.t.toFixed(1) + "s  phi=" + s.phi.toFixed(3) +
                    "  env=" + s.env.toFixed(3));
    }
    console.log("captured in " + ((Date.now() - t0)/1000).toFixed(1) + "s, peak |phi| = " +
                peak.toFixed(3) + " rad");

    // sanity check: undriven + balanced still has to ring up, or the slide is blank
    if (NF === meta.NFRAMES && peak < 0.5)
      throw new Error("rotor never rang up (peak |phi| = " + peak + ")");
    if (NF !== meta.NFRAMES){ console.log("smoke test only, no encode"); return; }

    const pat = path.join(FRAMEDIR, "f%05d." + ext);
    const mp4 = path.join(OUTDIR, BASE + ".mp4");
    const gif = path.join(OUTDIR, BASE + ".gif");
    const png = path.join(OUTDIR, BASE + "-poster.png");
    const scale = "scale=" + meta.VW + ":" + meta.VH + ":flags=lanczos";

    // H.264 / yuv420p in an MP4 -- what PowerPoint plays natively on both
    // Windows and macOS. faststart so it starts without buffering the file.
    console.log("encoding mp4 ...");
    ffmpeg(["-y", "-framerate", String(FPS), "-i", pat,
            "-vf", scale, "-c:v", "libx264", "-preset", "slow", "-crf", "18",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4], "mp4");

    // poster frame: the last frame, for a static fallback on the slide
    console.log("poster frame ...");
    ffmpeg(["-y", "-i", path.join(FRAMEDIR, "f" + String(meta.NFRAMES - 1).padStart(5, "0") + "." + ext),
            "-vf", scale, png], "poster");

    // animated GIF -- loops on its own in PowerPoint with no media controls
    console.log("encoding gif ...");
    const pal = path.join(FRAMEDIR, "pal.png");
    // fps= in the filter graph, not -r: -r drops frames unevenly and judders.
    // 12 fps at 720 tall keeps the 30 s LINC gif near 4 MB; at 15/960 it was
    // 8.9 MB, too heavy to mail around, which is the only reason the gif
    // exists. The mp4 is the one to actually put on a slide.
    const gscale = "fps=12,scale=-2:720:flags=lanczos";
    ffmpeg(["-y", "-framerate", String(FPS), "-i", pat,
            "-vf", gscale + ",palettegen=max_colors=128:stats_mode=diff", pal], "palette");
    ffmpeg(["-y", "-framerate", String(FPS), "-i", pat, "-i", pal,
            "-lavfi", gscale + " [v];[v][1:v] paletteuse=dither=bayer:bayer_scale=4",
            "-loop", "0", gif], "gif");

    for (const f of [mp4, gif, png])
      console.log("  " + f + "  " + (fs.statSync(f).size/1048576).toFixed(2) + " MB");
  } finally {
    if (cdp) { try { await cdp.send("Browser.close"); } catch (e) {} }
    proc.kill();
    await sleep(300);
    fs.rmSync(profile, { recursive: true, force: true });
  }
  console.log("done");
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
