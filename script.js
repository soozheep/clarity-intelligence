/* PBCA MVP — vanilla JS, static, localStorage-only */

const STORAGE_KEY = "pbca_session_v1";

const SCREENS = ["landing","access","payment","audit1","audit2","audit3","audit4","review","report","post"];

const state = {
  screen: "landing",
  access: {
    calibration: "",
    problem: "",
    duration: "",
    costToDate: "",
    projectedCost: "",
    humanChecks: [],
    humanCostText: "",
    attempted: "",
    attemptsText: ""
  },
  audit: {
    outcome: "",
    behaviour: "",
    incentive: "",
    loss: "",
    costRating: 7,
    incRating: 7,
    options: [
      { text: "", inc: 7, cost: 7 },
      { text: "", inc: 7, cost: 7 },
      { text: "", inc: 7, cost: 7 }
    ],
    picked: ""
  },
  post: {
    considered: false,
    email: ""
  },
  session: {
    id: "",
    timestampISO: ""
  }
};

const els = {};
let saveTimer = null;

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }

function clampInt(n, min, max){
  const x = parseInt(n, 10);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function moneySanitize(raw){
  if (raw == null) return "";
  const s = String(raw).replace(/[^\d.]/g, "");
  // avoid multiple dots
  const parts = s.split(".");
  if (parts.length > 2) return parts[0] + "." + parts.slice(1).join("");
  return s;
}

function moneyFormat(nStr){
  const s = moneySanitize(nStr);
  if (!s) return "";
  const num = Number(s);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function genSessionId(){
  const a = Math.floor(1000 + Math.random() * 9000);
  return `X-${a}-PBCA`;
}

function nowISO(){
  return new Date().toISOString();
}

function friendlyTimestamp(iso){
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function load(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return;

    // Shallow merge with guards
    Object.assign(state, data);
    if (!SCREENS.includes(state.screen)) state.screen = "landing";
  }catch(e){
    // ignore
  }
}

function scheduleSave(){
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 180);
}

function save(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }catch(e){
    // ignore
  }
}

function resetSession(){
  localStorage.removeItem(STORAGE_KEY);
  // hard reload to guarantee clean UI
  location.reload();
}

function setBackEnabled(enabled){
  els.btnBack.disabled = !enabled;
}

function go(screen){
  if (!SCREENS.includes(screen)) return;

  const prev = state.screen;
  if (prev === screen) return;

  const prevEl = document.querySelector(`.screen[data-screen="${prev}"]`);
  const nextEl = document.querySelector(`.screen[data-screen="${screen}"]`);

  if (prevEl){
    prevEl.classList.remove("is-active");
    prevEl.classList.add(screenIndex(screen) > screenIndex(prev) ? "is-exiting-left" : "is-exiting-right");
    setTimeout(() => prevEl.classList.remove("is-exiting-left","is-exiting-right"), 280);
  }
  if (nextEl){
    nextEl.classList.add("is-active");
  }

  state.screen = screen;
  scheduleSave();

  setBackEnabled(screen !== "landing");
  if (screen === "review") renderReview();
  if (screen === "report") renderReportView();
}

function screenIndex(s){ return SCREENS.indexOf(s); }

function back(){
  const i = screenIndex(state.screen);
  if (i <= 0) return;
  // disallow backing out of report -> go review
  const prev = SCREENS[i - 1];
  go(prev);
}

function bindNav(){
  $all("[data-next]").forEach(btn => {
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-next");
      if (next === "review"){
        const ok = validateAudit4Selection();
        if (!ok) return;
      }
      go(next);
    });
  });

  els.btnBack.addEventListener("click", back);

  // reset links (hidden, low prominence)
  $all("#resetLink, #resetLink2, #resetLink3, #resetLink4, #resetLink5, #resetLink6, #resetLink7, #resetLink8, #resetLink9, #resetLink10").forEach(a=>{
    a.addEventListener("click",(e)=>{
      e.preventDefault();
      resetSession();
    });
  });
}

function bindAccess(){
  const calibration = $("#calibration");
  const problem = $("#problem");
  const duration = $("#duration");
  const costToDate = $("#costToDate");
  const projectedCost = $("#projectedCost");
  const humanCostText = $("#humanCostText");
  const attemptsText = $("#attemptsText");

  calibration.value = state.access.calibration || "";
  problem.value = state.access.problem || "";
  duration.value = state.access.duration || "";
  costToDate.value = state.access.costToDate || "";
  projectedCost.value = state.access.projectedCost || "";
  humanCostText.value = state.access.humanCostText || "";
  attemptsText.value = state.access.attemptsText || "";

  // checkboxes
  $all(".hc").forEach(cb=>{
    cb.checked = state.access.humanChecks.includes(cb.value);
    cb.addEventListener("change", ()=>{
      const set = new Set(state.access.humanChecks);
      if (cb.checked) set.add(cb.value); else set.delete(cb.value);
      state.access.humanChecks = Array.from(set);
      scheduleSave();
    });
  });

  // radios
  $all('input[name="attempted"]').forEach(r=>{
    r.checked = (state.access.attempted === r.value);
    r.addEventListener("change", ()=>{
      state.access.attempted = r.value;
      scheduleSave();
    });
  });

  calibration.addEventListener("input", ()=>{ state.access.calibration = calibration.value; scheduleSave(); });
  problem.addEventListener("input", ()=>{ state.access.problem = problem.value; scheduleSave(); });
  duration.addEventListener("change", ()=>{ state.access.duration = duration.value; scheduleSave(); });

  costToDate.addEventListener("input", ()=>{
    costToDate.value = moneySanitize(costToDate.value);
    state.access.costToDate = costToDate.value;
    scheduleSave();
  });
  projectedCost.addEventListener("input", ()=>{
    projectedCost.value = moneySanitize(projectedCost.value);
    state.access.projectedCost = projectedCost.value;
    scheduleSave();
  });

  humanCostText.addEventListener("input", ()=>{ state.access.humanCostText = humanCostText.value; scheduleSave(); });
  attemptsText.addEventListener("input", ()=>{ state.access.attemptsText = attemptsText.value; scheduleSave(); });
}

function bindAudit1(){
  const outcome = $("#a1Outcome");
  const behaviour = $("#a1Behaviour");
  outcome.value = state.audit.outcome || "";
  behaviour.value = state.audit.behaviour || "";

  outcome.addEventListener("input", ()=>{ state.audit.outcome = outcome.value; scheduleSave(); });
  behaviour.addEventListener("input", ()=>{ state.audit.behaviour = behaviour.value; scheduleSave(); });
}

function bindAudit2(){
  const incentive = $("#a2Incentive");
  const loss = $("#a2Loss");
  incentive.value = state.audit.incentive || "";
  loss.value = state.audit.loss || "";

  incentive.addEventListener("input", ()=>{ state.audit.incentive = incentive.value; scheduleSave(); });
  loss.addEventListener("input", ()=>{ state.audit.loss = loss.value; scheduleSave(); });
}

function bindAudit3(){
  const cost = $("#a3Cost");
  const inc = $("#a3Inc");
  const costVal = $("#a3CostVal");
  const incVal = $("#a3IncVal");

  cost.value = state.audit.costRating ?? 7;
  inc.value = state.audit.incRating ?? 7;
  costVal.textContent = cost.value;
  incVal.textContent = inc.value;

  cost.addEventListener("input", ()=>{
    const v = clampInt(cost.value, 1, 10);
    state.audit.costRating = v;
    costVal.textContent = v;
    scheduleSave();
  });
  inc.addEventListener("input", ()=>{
    const v = clampInt(inc.value, 1, 10);
    state.audit.incRating = v;
    incVal.textContent = v;
    scheduleSave();
  });
}

function bindAudit4(){
  const optIds = [
    { t:"#opt1Text", i:"#opt1Inc", c:"#opt1Cost", iv:"#opt1IncVal", cv:"#opt1CostVal", idx:0 },
    { t:"#opt2Text", i:"#opt2Inc", c:"#opt2Cost", iv:"#opt2IncVal", cv:"#opt2CostVal", idx:1 },
    { t:"#opt3Text", i:"#opt3Inc", c:"#opt3Cost", iv:"#opt3IncVal", cv:"#opt3CostVal", idx:2 }
  ];

  optIds.forEach(o=>{
    const t = $(o.t), i = $(o.i), c = $(o.c), iv = $(o.iv), cv = $(o.cv);

    t.value = state.audit.options[o.idx].text || "";
    i.value = state.audit.options[o.idx].inc ?? 7;
    c.value = state.audit.options[o.idx].cost ?? 7;
    iv.textContent = i.value;
    cv.textContent = c.value;

    t.addEventListener("input", ()=>{
      state.audit.options[o.idx].text = t.value;
      scheduleSave();
    });

    i.addEventListener("input", ()=>{
      const v = clampInt(i.value, 1, 10);
      state.audit.options[o.idx].inc = v;
      iv.textContent = v;
      scheduleSave();
    });

    c.addEventListener("input", ()=>{
      const v = clampInt(c.value, 1, 10);
      state.audit.options[o.idx].cost = v;
      cv.textContent = v;
      scheduleSave();
    });
  });

  // picked option
  $all('input[name="picked"]').forEach(r=>{
    r.checked = (state.audit.picked === r.value);
    r.addEventListener("change", ()=>{
      state.audit.picked = r.value;
      scheduleSave();
    });
  });
}

function validateAudit4Selection(){
  if (!state.audit.picked){
    // minimal, no motivational language
    alert("Selection required: Option 1 / 2 / 3.");
    return false;
  }
  return true;
}

function renderBar(el, value){
  el.innerHTML = "";
  const v = clampInt(value, 1, 10);
  for (let i=1;i<=10;i++){
    const s = document.createElement("span");
    if (i <= v) s.classList.add("on");
    el.appendChild(s);
  }
}

function selectedOption(){
  const p = parseInt(state.audit.picked, 10);
  if (![1,2,3].includes(p)) return null;
  return { idx: p-1, num: p, ...state.audit.options[p-1] };
}

function ensureSessionMeta(){
  if (!state.session.id) state.session.id = genSessionId();
  if (!state.session.timestampISO) state.session.timestampISO = nowISO();
}

function renderReview(){
  ensureSessionMeta();

  $("#rvOutcome").textContent = state.audit.outcome || "—";
  $("#rvBehaviour").textContent = state.audit.behaviour || "—";
  $("#rvIncentive").textContent = state.audit.incentive || "—";

  const exposure = moneyFormat(state.access.projectedCost);
  $("#rvExposure").textContent = exposure ? `$ ${exposure}` : "$ —";

  renderBar($("#rvCostBar"), state.audit.costRating || 1);
  renderBar($("#rvIncBar"), state.audit.incRating || 1);

  const pick = selectedOption();
  if (pick){
    $("#rvPicked").textContent = `Option ${pick.num}`;
    $("#rvPickedText").textContent = pick.text || "—";
    renderBar($("#rvProjIncBar"), pick.inc || 1);
    renderBar($("#rvProjCostBar"), pick.cost || 1);
  }else{
    $("#rvPicked").textContent = "Option —";
    $("#rvPickedText").textContent = "—";
    renderBar($("#rvProjIncBar"), 1);
    renderBar($("#rvProjCostBar"), 1);
  }
}

function computeDifferentials(){
  const currentCost = clampInt(state.audit.costRating || 1, 1, 10);
  const currentInc = clampInt(state.audit.incRating || 1, 1, 10);
  const pick = selectedOption();

  if (!pick) return { currentCost, currentInc, pickCost: null, pickInc: null, costDiff: null, incDiff: null };

  const pickCost = clampInt(pick.cost || 1, 1, 10);
  const pickInc = clampInt(pick.inc || 1, 1, 10);

  // Positive costDiff = reduction
  const costDiff = currentCost - pickCost;
  // Positive incDiff = increase retained (higher incentive)
  const incDiff = pickInc - currentInc;

  return { currentCost, currentInc, pickCost, pickInc, costDiff, incDiff };
}

function buildReportHTML(){
  ensureSessionMeta();

  const exposureRaw = moneyFormat(state.access.projectedCost);
  const exposure = exposureRaw ? `$ ${exposureRaw}` : "$ —";

  const pick = selectedOption();
  const diffs = computeDifferentials();

  const pickedText = pick?.text || "—";

  const costDiffLabel = (diffs.costDiff == null) ? "—" : `${diffs.costDiff >= 0 ? diffs.costDiff : diffs.costDiff} point(s)`;
  const incDiffLabel  = (diffs.incDiff  == null) ? "—" : `${diffs.incDiff >= 0 ? diffs.incDiff : diffs.incDiff} point(s)`;

  const ts = friendlyTimestamp(state.session.timestampISO);

  const safe = (s) => (s || "—");

  return `
    <h3>CONFIDENTIAL<br>PRIVATE BEHAVIOURAL CONTRACT AUDIT (PBCA)  REVIEW</h3>
    <div class="meta"><strong>Session ID:</strong> ${state.session.id}<br><strong>Date:</strong> ${ts}</div>

    <div class="hr"></div>

    <div class="blockTitle">Declared Exposure (User Estimated)</div>
    <div class="text">${exposure}</div>

    <div class="blockTitle">Incentive Rating</div>
    <div class="text">${clampInt(state.audit.incRating || 1, 1, 10)}/10</div>

    <div class="blockTitle">Cost Exposure</div>
    <div class="text">${clampInt(state.audit.costRating || 1, 1, 10)}/10</div>

    <div class="hr"></div>

    <div class="blockTitle">Compounding Outcome</div>
    <div class="text">${safe(state.audit.outcome)}</div>

    <div class="blockTitle">Sustaining Behaviour</div>
    <div class="text">${safe(state.audit.behaviour)}</div>

    <div class="blockTitle">Protected Incentive</div>
    <div class="text">${safe(state.audit.incentive)}</div>

    <div class="blockTitle">Selected Rewrite Path</div>
    <div class="text">${pickedText}</div>

    <div class="blockTitle">Projected Leverage Differential</div>
    <div class="text">
      Cost Reduction: ${costDiffLabel}<br>
      Incentive Retained: ${incDiffLabel}
    </div>

    <div class="hr"></div>

    <div class="endcap">
      <div>The incentive is valid.<br>
      The behaviour securing it is inefficient.<br>
      It extracts more than it delivers.</div>
    </div>

    <div class="footer">Private. Automated. No human review.</div>
  `;
}

function renderReportView(){
  $("#reportPaper").innerHTML = buildReportHTML();
}

function downloadHTMLReport(){
  const ts = new Date(state.session.timestampISO || nowISO());
  const stamp = `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,"0")}-${String(ts.getDate()).padStart(2,"0")}`;
  const filename = `PBCA-${state.session.id}-${stamp}.html`;

  const doc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${filename}</title>
  <style>
    body{ margin:0; background:#fff; color:#111; font-family: Inter, Arial, sans-serif; }
    .wrap{ max-width: 820px; margin: 0 auto; padding: 28px 22px; }
    h3{ font-family: "Cormorant Garamond","EB Garamond",serif; margin:0 0 8px; font-size: 22px; letter-spacing: 0.02em; }
    .meta{ font-size: 13px; color: rgba(0,0,0,0.65); line-height: 1.45; }
    .hr{ height: 1px; background: rgba(0,0,0,0.12); margin: 16px 0; }
    .blockTitle{ font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(0,0,0,0.55); margin: 12px 0 6px; }
    .text{ font-size: 14px; line-height: 1.55; white-space: pre-wrap; }
    .endcap{ margin-top: 18px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.12); font-size: 14px; line-height: 1.55; }
    .footer{ margin-top: 12px; font-size: 13px; color: rgba(0,0,0,0.6); }
    @media print{
      .wrap{ padding: 0; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    ${buildReportHTML()}
  </div>
</body>
</html>`;

  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(()=>URL.revokeObjectURL(url), 800);
}

function bindReviewAndReport(){
  $("#btnDownload").addEventListener("click", ()=>{
    // generate + download + show report view
    downloadHTMLReport();
    go("report");
  });

  $("#btnPrint").addEventListener("click", ()=>{
    window.print();
  });
}

function bindPost(){
  const considered = $("#considered");
  const email = $("#email");

  considered.checked = !!state.post.considered;
  email.value = state.post.email || "";

  considered.addEventListener("change", ()=>{
    state.post.considered = considered.checked;
    scheduleSave();
  });

  email.addEventListener("input", ()=>{
    state.post.email = email.value;
    scheduleSave();
  });

  $("#btnFinish").addEventListener("click", ()=>{
    // Close = return to landing (session remains unless reset)
    go("landing");
  });
}

function hydrateScreen(){
  // activate correct screen after load
  $all(".screen").forEach(s=>s.classList.remove("is-active","is-exiting-left","is-exiting-right"));
  const active = document.querySelector(`.screen[data-screen="${state.screen}"]`) || document.querySelector('.screen[data-screen="landing"]');
  active.classList.add("is-active");
  setBackEnabled(state.screen !== "landing");
  if (state.screen === "review") renderReview();
  if (state.screen === "report") renderReportView();
}

function init(){
  els.btnBack = $("#btnBack");

  load();

  // Ensure session meta exists once user reaches review/report
  if (state.session && typeof state.session !== "object"){
    state.session = { id:"", timestampISO:"" };
  }

  bindNav();
  bindAccess();
  bindAudit1();
  bindAudit2();
  bindAudit3();
  bindAudit4();
  bindReviewAndReport();
  bindPost();

  hydrateScreen();

  // If user resumes on review/report, keep it coherent
  if (state.screen === "review") renderReview();
  if (state.screen === "report") renderReportView();
}

document.addEventListener("DOMContentLoaded", init);
