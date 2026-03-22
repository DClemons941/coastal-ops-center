if (typeof window !== 'undefined' && !window.storage) {
  window.storage = {
    get: async (k) => { try { const v = localStorage.getItem(k); return v ? { key: k, value: v } : null; } catch { return null; } },
    set: async (k, v) => { try { localStorage.setItem(k, String(v)); return { key: k, value: v }; } catch { return null; } },
    delete: async (k) => { try { localStorage.removeItem(k); return { key: k, deleted: true }; } catch { return null; } },
    list: async (prefix) => { try { const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix)); return { keys }; } catch { return { keys: [] }; } }
  };
}import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const DAYS_SHORT   = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
const DAY_DATES    = ["Mar 9","Mar 10","Mar 11","Mar 12","Mar 13","Mar 14","Mar 15"];
const DAY_FULL     = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// Dynamic today — find which slot in the week strip matches today
const _now = new Date();
const _todayISO = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,"0")}-${String(_now.getDate()).padStart(2,"0")}`;
const _weekISOs = ["2026-03-09","2026-03-10","2026-03-11","2026-03-12","2026-03-13","2026-03-14","2026-03-15"];
const TODAY_IDX  = Math.max(0, _weekISOs.indexOf(_todayISO)); // falls back to Mon if not in range
const TODAY_ISO  = _todayISO;
const TODAY_DATE = _now.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});

const CAL_DAYS     = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const DOMAIN = {
  Business: { accent:"#3B82F6", dim:"#1e3a5f33", label:"#93C5FD" },
  Personal: { accent:"#10B981", dim:"#14532d33", label:"#6EE7B7" },
  Family:   { accent:"#F472B6", dim:"#4a194233", label:"#FBCFE8" },
  Health:   { accent:"#F59E0B", dim:"#451a0333", label:"#FCD34D" },
};
const STATUS_META = {
  ACTIVE:    { color:"#10B981", bg:"#052e1699" },
  QUEUED:    { color:"#F59E0B", bg:"#1c100399" },
  WAITING:   { color:"#F97316", bg:"#1c0a0399" },
  RECURRING: { color:"#A78BFA", bg:"#1e1b4b99" },
  DONE:      { color:"#374151", bg:"#11182799" },
};
const BID_STATUS = {
  NEW:       { color:"#F59E0B", bg:"#1c100388", label:"New",       icon:"🆕" },
  REVIEWING: { color:"#3B82F6", bg:"#1e3a5f88", label:"Reviewing", icon:"🔍" },
  BIDDING:   { color:"#A78BFA", bg:"#1e1b4b88", label:"Bidding",   icon:"✏️" },
  SUBMITTED: { color:"#10B981", bg:"#052e1688", label:"Submitted", icon:"📤" },
  WON:       { color:"#10B981", bg:"#052e1699", label:"Won 🏆",    icon:"🏆" },
  LOST:      { color:"#374151", bg:"#11182799", label:"Lost",       icon:"❌" },
  DECLINED:  { color:"#EF4444", bg:"#45090a88", label:"Declined",  icon:"🚫" },
};
const PEOPLE = ["David","Hannah","Annie","Britney","Elma","Claude","Roger","Hugo","Assign →"];

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA — 3 REAL BIDS FROM INBOX
// ─────────────────────────────────────────────────────────────────────────────
const SEED_TASKS = [
  { id:1,  icon:"👷", title:"Director of Construction",   subtitle:"Shortlist resumes → begin interviews",            domain:"Business", priority:1,  status:"ACTIVE",    owner:"David",    deadline:"ASAP",      day:"MON", progress:10, nextAction:"Send resumes to Claude for scoring & ranking",    dateAdded:"2026-03-09" },
  { id:2,  icon:"🏗️", title:"Soletta Project Setup",      subtitle:"File structure, job account, materials, trailer", domain:"Business", priority:2,  status:"ACTIVE",    owner:"Assign →", deadline:"This Week", day:"MON", progress:20, nextAction:"Name the owner for job account + materials — NOW", dateAdded:"2026-03-09" },
  { id:11, icon:"📋", title:"FrankCrum PEO — Due Mar 12", subtitle:"Loss runs + enrollment must close by Mar 12",     domain:"Business", priority:1,  status:"ACTIVE",    owner:"David",    deadline:"Mar 12",    day:"TUE", progress:60, nextAction:"Confirm loss runs sent to Tami Collinsworth",      dateAdded:"2026-03-09" },
  { id:5,  icon:"🏡", title:"Land + Construction Loan",   subtitle:"Requirements, timeline, Q2 possession plan",      domain:"Personal", priority:5,  status:"ACTIVE",    owner:"David",    deadline:"EOQ2",      day:"TUE", progress:5,  nextAction:"Tell Claude: what county? One home or compound?", dateAdded:"2026-03-09" },
  { id:3,  icon:"📊", title:"2026 Coastal Budget",         subtitle:"Revenue targets, overhead, margin analysis",      domain:"Business", priority:3,  status:"QUEUED",    owner:"David",    deadline:"This Week", day:"WED", progress:0,  nextAction:"Block 90 min Wednesday to build the framework",   dateAdded:"2026-03-09" },
  { id:7,  icon:"⚾", title:"Reagan's Softball",           subtitle:"Next game — is David making it?",                 domain:"Family",   priority:7,  status:"RECURRING", owner:"David",    deadline:"Weekly",    day:"WED", progress:0,  nextAction:"Confirm next game time and block calendar now",   dateAdded:"2026-03-09" },
  { id:10, icon:"⚖️", title:"Davis Reed / K-1 Dispute",   subtitle:"Book corrections, amended returns 2022–2024",     domain:"Business", priority:10, status:"WAITING",   owner:"Britney",  deadline:"ASAP",      day:"THU", progress:35, nextAction:"Confirm Britney finished reclassifications",      dateAdded:"2026-03-09" },
  { id:12, icon:"💻", title:"BuilderTrend vs Jobtread",    subtitle:"Decision deadline end of week",                   domain:"Business", priority:3,  status:"ACTIVE",    owner:"David",    deadline:"Mar 13",    day:"FRI", progress:0,  nextAction:"Stop deferring — make the call by Friday",        dateAdded:"2026-03-09" },
  { id:8,  icon:"👟", title:"Daily Steps",                 subtitle:"3,000 avg → 10,000 goal",                         domain:"Health",   priority:8,  status:"RECURRING", owner:"David",    deadline:"Daily",     day:"MON", progress:30, nextAction:"Log yesterday's steps right now",                 dateAdded:"2026-03-09" },
  { id:4,  icon:"🧾", title:"Receipt Capture App",         subtitle:"Forward receipts → auto-route to accounting",    domain:"Business", priority:4,  status:"QUEUED",    owner:"Claude",   deadline:"Next Week", day:null,  progress:0,  nextAction:"Confirm priority — this week or next?",           dateAdded:"2026-03-09" },
  { id:6,  icon:"🏘️", title:"Family Compound Plan",        subtitle:"In-laws + Britney — legal, financial, emotional", domain:"Personal", priority:6,  status:"QUEUED",    owner:"Britney",  deadline:"EOY",       day:null,  progress:0,  nextAction:"Schedule a dedicated brainstorm — not this week", dateAdded:"2026-03-09" },
  { id:9,  icon:"🎂", title:"Reagan's 5th Birthday",       subtitle:"April 26 — planning is overdue",                  domain:"Family",   priority:9,  status:"QUEUED",    owner:"Britney",  deadline:"Apr 26",    day:null,  progress:0,  nextAction:"Party at home or venue? Text Britney today.",     dateAdded:"2026-03-09" },
];

const SEED_BIDS = [
  {
    id: "bid-1",
    gcName: "R.E. Crawford",
    gcEmail: "bids1@recrawford.com",
    gcPhone: "(941) 907-0010",
    rfiEmail: "jhearn@recrawford.com",
    projectName: "Kay Jeweler's — Orlando, FL",
    projectAddress: "753 N. Alafaya Trail, H05, Orlando, FL 32828",
    scope: "2,182 sqft · Retail Upfit",
    trades: "Div. 15 — Plumbing, Fire Protection, HVAC",
    bidDue: "2026-03-16T22:00:00.000Z",   // Mar 16 5:00 PM ET
    projectStart: "",
    docsLink: "https://www.dropbox.com/scl/fo/ck25z3o46s8p9bmd4109l/AOHfxfhWxzrseN3qWD4L25c",
    status: "NEW",
    assignedTo: "Assign →",
    notes: "",
    receivedDate: "2026-03-09",
    emailSubject: "Invitation to Bid - Kay Jeweler's - Orlando, FL : All Trades",
  },
  {
    id: "bid-2",
    gcName: "Case Contracting",
    gcEmail: "estimating@casecontracting.com",
    gcPhone: "",
    rfiEmail: "estimating@casecontracting.com",
    projectName: "Aldi #2503 — Wesley Chapel, FL",
    projectAddress: "27301 Wesley Chapel, FL 33544",
    scope: "Retrofit · All Trades",
    trades: "All Trades — Plumbing included",
    bidDue: "2026-03-24T19:00:00.000Z",   // Mar 24 2:00 PM ET (extended)
    projectStart: "",
    docsLink: "",
    status: "NEW",
    assignedTo: "Assign →",
    notes: "Bid date extended from original — addendum pending. PDF bids to estimating@casecontracting.com",
    receivedDate: "2026-03-09",
    emailSubject: "BID DATE EXTENSION - Aldi #2503 Wesley Chapel : All Trades",
  },
  {
    id: "bid-3",
    gcName: "Bidcraft / Annie's Lead",
    gcEmail: "chris@bidcraftestimate.com",
    gcPhone: "(321) 382-5723",
    rfiEmail: "",
    projectName: "Starbucks — Coconut Point Outlets",
    projectAddress: "8076 Mediterranean Dr, Estero, FL 33928",
    scope: "Retail · All Trades",
    trades: "Plumbing",
    bidDue: "2026-03-12T17:00:00.000Z",   // Mar 12 12:00 PM ET
    projectStart: "",
    docsLink: "",
    status: "NEW",
    assignedTo: "Annie",
    notes: "Estimating firm noticed Annie's interest. Confirm if Coastal is actually pursuing this.",
    receivedDate: "2026-03-09",
    emailSubject: "Starbucks - Coconut Point Premium Outlets",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE KEYS
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = "coastal-ops-v2";
const STEPS_KEY   = "coastal-steps-v2";
const CAL_KEY     = "coastal-cal-v2";
const BIDS_KEY    = "coastal-bids-v3";
const SCAN_KEY    = "coastal-scan-v2";

const FIREBASE_URL = "https://coastal---ops-default-rtdb.firebaseio.com";

async function stGet(k,fb){try{const r=await window.storage.get(k);if(r?.value)return JSON.parse(r.value);}catch{}return fb;}
async function stSet(k,v){try{await window.storage.set(k,JSON.stringify(v));}catch{}}

// Map Firebase task format → app task format
function mapFirebaseTask(t) {
  const iconMap = {Business:"📌",Personal:"🔹",Family:"💙",Health:"💪"};
  return {
    id:         t.id || String(Date.now() + Math.random()),
    icon:       iconMap[t.domain] || "📌",
    title:      t.text || "(untitled)",
    subtitle:   t.mins ? `~${t.mins} min` : "",
    domain:     t.domain || "Business",
    priority:   t.urgent ? 1 : 5,
    status:     t.status || "QUEUED",
    owner:      t.owner || "David",
    deadline:   t.urgent ? "ASAP" : "TBD",
    day:        null,
    progress:   t.status === "DONE" ? 100 : 0,
    nextAction: "",
    dateAdded:  t.createdAt || TODAY_ISO,
  };
}

// Fetch tasks from Firebase
async function fbFetchTasks() {
  try {
    const res = await fetch(`${FIREBASE_URL}/tasks.json`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data)) return null;
    return data.map(mapFirebaseTask);
  } catch { return null; }
}

// Write full tasks array back to Firebase
async function fbWriteTasks(tasks) {
  try {
    // Convert back to Firebase format preserving original fields where possible
    const fbTasks = tasks.map(t => ({
      id:           t.id,
      text:         t.title,
      domain:       t.domain,
      status:       t.status,
      owner:        t.owner,
      urgent:       t.priority <= 2,
      mins:         0,
      createdAt:    t.dateAdded || TODAY_ISO,
      ...(t.status === "DONE" ? { completedAt: new Date().toISOString(), completedToday: true } : {}),
    }));
    await fetch(`${FIREBASE_URL}/tasks.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fbTasks),
    });
  } catch { /* silent fail — local state is still intact */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────
const fmt12 = iso => {
  const d = new Date(iso);
  let h = d.getUTCHours(), m = d.getUTCMinutes();
  const ap = h>=12?"PM":"AM"; h=h%12||12;
  return `${h}:${m.toString().padStart(2,"0")} ${ap}`;
};
const calDayKey = iso => {
  const d = new Date(iso);
  const ds = `${d.getUTCMonth()+1}/${d.getUTCDate()}`;
  return {"3/9":"MON","3/10":"TUE","3/11":"WED","3/12":"THU","3/13":"FRI","3/14":"SAT","3/15":"SUN"}[ds]||null;
};
const daysUntil = iso => {
  if (!iso) return null;
  const now = new Date(TODAY_ISO); now.setHours(0,0,0,0);
  const due = new Date(iso);       due.setHours(0,0,0,0);
  return Math.round((due-now)/(1000*60*60*24));
};
const urgColor = d => {
  if (d===null) return "#475569";
  if (d<0)  return "#EF4444";
  if (d<=2) return "#EF4444";
  if (d<=7) return "#F59E0B";
  return "#10B981";
};
const isoToYMD = iso => iso ? iso.slice(0,10) : "";

// Build calendar grid for a given year/month (0-indexed)
function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i=0;i<firstDay;i++) cells.push(null);
  for (let d=1;d<=daysInMonth;d++) cells.push(d);
  while (cells.length%7!==0) cells.push(null);
  return cells;
}
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

// ─────────────────────────────────────────────────────────────────────────────
// API CALLERS
// ─────────────────────────────────────────────────────────────────────────────
async function fetchCalendarEvents() {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4000,system:`Fetch calendar events for davidc@coastalplumbingswfl.com for March 9-15 2026 using outlook_calendar_search. Return ONLY a JSON array:\n[{"subject":"Title","start":"ISO","end":"ISO","location":"","showAs":"busy","isCancelled":false,"organizer":"email","attendeeCount":0}]\nJSON only.`,messages:[{role:"user",content:"Get David's calendar March 9-15 2026."}],mcp_servers:[{type:"url",url:"https://microsoft365.mcp.claude.com/mcp",name:"m365"}]})});
    const data = await res.json();
    const text = data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"";
    return JSON.parse(text.replace(/```json|```/g,"").trim());
  } catch { return []; }
}

async function scanBidEmails() {
  const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:8000,system:`You are the estimating assistant for Coastal Plumbing of SWFL LLC.
Search davidc@coastalplumbingswfl.com Outlook Inbox for Invitation to Bid / ITB emails using multiple queries:
1. outlook_email_search: folderName="Inbox", query="invitation to bid", limit=20
2. outlook_email_search: folderName="Inbox", query="bid date", limit=15
3. outlook_email_search: folderName="Inbox", query="ITB", limit=10
For each promising result use read_resource to read the full body.
Extract every Invitation to Bid / ITB email. For each return:
{"gcName":"GC company name","gcEmail":"bid submission email","gcPhone":"phone if present","rfiEmail":"RFI email if different","projectName":"full project name","projectAddress":"full address","scope":"sqft and project type","trades":"which trades needed","bidDue":"ISO 8601 UTC datetime","projectStart":"ISO date or empty","docsLink":"URL to bid docs or empty","emailSubject":"original subject","receivedDate":"YYYY-MM-DD","notes":"important notes"}
Return ONLY a JSON array. If none found return []. No markdown.`,messages:[{role:"user",content:"Scan inbox for all Invitation to Bid emails."}],mcp_servers:[{type:"url",url:"https://microsoft365.mcp.claude.com/mcp",name:"m365"}]})});
  const data = await res.json();
  const text = data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"";
  const arr = JSON.parse(text.replace(/```json|```/g,"").trim());
  return Array.isArray(arr)?arr:[];
}

async function scanTaskEmails() {
  const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:6000,system:`You are David's executive assistant at Coastal Plumbing of SWFL LLC. Search davidc@coastalplumbingswfl.com Inbox and Sent Items from last 48 hours. Exclude Invitation to Bid emails. Identify anything needing follow-up. Return ONLY JSON array:\n[{"icon":"emoji","title":"Short task (max 6 words)","subtitle":"one line context","domain":"Business|Personal|Family|Health","priority":1-10,"status":"ACTIVE|QUEUED|WAITING","owner":"David|Hannah|Britney|Assign →","deadline":"ASAP|This Week|Mar 12|TBD","nextAction":"exact next action","emailFrom":"sender","emailSubject":"subject","emailDate":"Mar 9"}]\nIf nothing return []. JSON only.`,messages:[{role:"user",content:"Scan inbox and sent items last 48 hours for tasks."}],mcp_servers:[{type:"url",url:"https://microsoft365.mcp.claude.com/mcp",name:"m365"}]})});
  const data = await res.json();
  const text = data.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||"";
  const arr = JSON.parse(text.replace(/```json|```/g,"").trim());
  return Array.isArray(arr)?arr:[];
}

// ─────────────────────────────────────────────────────────────────────────────
// BID DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
function BidDetailModal({ bid, onUpdate, onClose }) {
  const [local, setLocal] = useState({...bid});
  const days = daysUntil(local.bidDue);
  const uc   = urgColor(days);
  const bs   = BID_STATUS[local.status]||BID_STATUS.NEW;

  return (
    <div style={{position:"fixed",inset:0,background:"#060a12f8",backdropFilter:"blur(14px)",zIndex:2000,display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{background:"#0a0f1c",borderBottom:"1px solid #1e2d4a",padding:"14px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:8,color:"#F59E0B",letterSpacing:2.5,textTransform:"uppercase",marginBottom:2}}>{local.gcName}</div>
          <div style={{fontSize:14,fontWeight:800,lineHeight:1.3,color:"#F1F5F9",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{local.projectName}</div>
        </div>
        <button onClick={onClose} style={{width:32,height:32,borderRadius:"50%",background:"#131e30",border:"1px solid #1e2d4a",color:"#64748B",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>✕</button>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"16px 16px 80px"}}>
        {/* Countdown */}
        <div style={{display:"flex",gap:10,padding:"14px",background:"#0a0f1c",border:`1px solid ${uc}33`,borderRadius:12,marginBottom:14}}>
          <div style={{flex:1}}>
            <div style={{fontSize:8,color:"#475569",letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>Bid Due</div>
            <div style={{fontSize:14,fontWeight:800,color:uc,lineHeight:1.3}}>
              {local.bidDue ? new Date(local.bidDue).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",timeZone:"UTC"}) : "No deadline"}
            </div>
            {local.bidDue&&<div style={{fontSize:10,color:uc+"99",marginTop:2}}>{fmt12(local.bidDue)} ET</div>}
          </div>
          {days!==null&&(
            <div style={{textAlign:"center",background:uc+"18",border:`1px solid ${uc}44`,borderRadius:10,padding:"10px 16px",minWidth:64}}>
              <div style={{fontSize:30,fontWeight:900,color:uc,lineHeight:1}}>{days<0?"⚠":days}</div>
              <div style={{fontSize:7,color:uc,letterSpacing:1,marginTop:2}}>{days<0?"OVERDUE":days===0?"TODAY":"DAYS"}</div>
            </div>
          )}
        </div>

        {/* Status */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:8,color:"#475569",letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Bid Status</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {Object.entries(BID_STATUS).map(([k,v])=>(
              <button key={k} onClick={()=>setLocal(p=>({...p,status:k}))} style={{padding:"6px 10px",borderRadius:8,background:local.status===k?v.bg:"transparent",border:`1px solid ${local.status===k?v.color:"#1e2d4a"}`,color:local.status===k?v.color:"#374151",fontSize:10,cursor:"pointer",fontWeight:local.status===k?800:400}}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Info rows */}
        {[
          {label:"Address",  val:local.projectAddress, icon:"📍"},
          {label:"Scope",    val:local.scope,           icon:"📐"},
          {label:"Trades",   val:local.trades,          icon:"🔧"},
          {label:"GC Email", val:local.gcEmail,         icon:"📧"},
          {label:"GC Phone", val:local.gcPhone,         icon:"📞"},
          {label:"RFI To",   val:local.rfiEmail,        icon:"❓"},
          {label:"Docs",     val:local.docsLink,        icon:"📁"},
        ].filter(f=>f.val).map((f,i)=>(
          <div key={i} style={{marginBottom:8,padding:"10px 12px",background:"#0c1220",border:"1px solid #1e2d4a",borderRadius:8}}>
            <div style={{fontSize:7,color:"#475569",letterSpacing:1.5,textTransform:"uppercase",marginBottom:3}}>{f.label}</div>
            <div style={{fontSize:11,color:"#CBD5E1",wordBreak:"break-all",lineHeight:1.5}}>{f.icon} {f.val}</div>
          </div>
        ))}

        {/* Assign estimator */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:8,color:"#475569",letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Assigned Estimator</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["David","Hannah","Annie","Britney","Assign →"].map(p=>(
              <button key={p} onClick={()=>setLocal(prev=>({...prev,assignedTo:p}))} style={{padding:"5px 12px",borderRadius:8,background:local.assignedTo===p?"#1e3a5f88":"transparent",border:`1px solid ${local.assignedTo===p?"#3B82F6":"#1e2d4a"}`,color:local.assignedTo===p?"#93C5FD":"#374151",fontSize:10,cursor:"pointer",fontWeight:local.assignedTo===p?700:400}}>{p}</button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{marginBottom:20}}>
          <div style={{fontSize:8,color:"#475569",letterSpacing:1.5,textTransform:"uppercase",marginBottom:6}}>Notes</div>
          <textarea value={local.notes||""} onChange={e=>setLocal(p=>({...p,notes:e.target.value}))} placeholder="Scope notes, conditions, go/no-go decision..." rows={3}
            style={{width:"100%",background:"#0c1220",border:"1px solid #1e2d4a",borderRadius:8,padding:"10px 12px",color:"#F1F5F9",fontSize:12,outline:"none",fontFamily:"inherit",resize:"none",boxSizing:"border-box",lineHeight:1.6}}/>
        </div>

        <button onClick={()=>{onUpdate(local);onClose();}} style={{width:"100%",padding:"14px",borderRadius:10,background:"#3B82F6",border:"none",color:"#fff",fontSize:14,cursor:"pointer",fontWeight:900,letterSpacing:0.3}}>
          Save ✓
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BID SCAN MODAL
// ─────────────────────────────────────────────────────────────────────────────
function BidScanModal({ existingBids, onAddBids, onClose }) {
  const [phase,setSugg]      = useState("idle");
  const [suggs,setSuggestions]= useState([]);
  const [dismissed,setDism]  = useState(new Set());
  const [progress,setProg]   = useState("");

  const runScan = async () => {
    setSugg("scanning"); setProg("Searching for Invitation to Bid emails...");
    try {
      await new Promise(r=>setTimeout(r,600)); setProg("Reading bid details...");
      const bids = await scanBidEmails();
      if (!bids||!bids.length){setSugg("empty");return;}
      const have = new Set(existingBids.map(b=>b.projectName));
      const fresh = bids.filter(b=>!have.has(b.projectName));
      if (!fresh.length){setSugg("empty");return;}
      setSuggestions(fresh); setDism(new Set()); setSugg("review");
    } catch { setSugg("error"); }
  };

  const active = suggs.filter((_,i)=>!dismissed.has(i));
  const dismiss   = i => setDism(p=>new Set([...p,i]));
  const undismiss = i => setDism(p=>{const n=new Set(p);n.delete(i);return n;});

  return (
    <div style={{position:"fixed",inset:0,background:"#060a12f8",backdropFilter:"blur(14px)",zIndex:1500,display:"flex",flexDirection:"column"}}>
      <div style={{background:"#0a0f1c",borderBottom:"1px solid #1e2d4a",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div>
          <div style={{fontSize:8,color:"#F59E0B",letterSpacing:2.5,textTransform:"uppercase",marginBottom:2}}>Estimating Pipeline</div>
          <div style={{fontSize:17,fontWeight:900}}>🏗️ Scan for New Bids</div>
        </div>
        <button onClick={onClose} style={{padding:"6px 14px",borderRadius:8,background:"#131e30",border:"1px solid #1e2d4a",color:"#64748B",fontSize:12,cursor:"pointer"}}>✕ Close</button>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"24px 16px 80px"}}>
        {phase==="idle"&&(
          <div style={{textAlign:"center",paddingTop:48}}>
            <div style={{fontSize:56,marginBottom:20}}>📬</div>
            <div style={{fontSize:16,fontWeight:800,marginBottom:12}}>Scan for Bid Invitations</div>
            <div style={{fontSize:12,color:"#475569",lineHeight:1.8,marginBottom:36,maxWidth:260,margin:"0 auto 36px"}}>Searches your inbox for "Invitation to Bid", "ITB", "bid date" — reads the full details and drops them onto your Estimating Calendar.</div>
            <button onClick={runScan} style={{padding:"14px 32px",borderRadius:10,background:"#F59E0B",border:"none",color:"#000",fontSize:14,cursor:"pointer",fontWeight:900}}>Scan Inbox →</button>
          </div>
        )}
        {phase==="scanning"&&(
          <div style={{textAlign:"center",paddingTop:60}}>
            <div style={{fontSize:48,display:"inline-block",marginBottom:20,animation:"spin 2s linear infinite"}}>🔍</div>
            <div style={{fontSize:14,fontWeight:700,marginBottom:8}}>Scanning...</div>
            <div style={{fontSize:11,color:"#F59E0B"}}>{progress}</div>
          </div>
        )}
        {phase==="empty"&&(
          <div style={{textAlign:"center",paddingTop:60}}>
            <div style={{fontSize:48,marginBottom:16}}>📭</div>
            <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>No new bids found</div>
            <div style={{fontSize:11,color:"#475569",marginBottom:28,lineHeight:1.7}}>No new Invitation to Bid emails, or all already captured.</div>
            <button onClick={runScan} style={{padding:"12px 24px",borderRadius:8,background:"#131e30",border:"1px solid #1e2d4a",color:"#94A3B8",fontSize:12,cursor:"pointer"}}>Scan Again</button>
          </div>
        )}
        {phase==="error"&&(
          <div style={{textAlign:"center",paddingTop:60}}>
            <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
            <div style={{fontSize:14,fontWeight:700,color:"#EF4444",marginBottom:24}}>Scan Failed</div>
            <button onClick={runScan} style={{padding:"12px 24px",borderRadius:8,background:"#F59E0B",border:"none",color:"#000",fontSize:12,cursor:"pointer",fontWeight:700}}>Try Again</button>
          </div>
        )}
        {phase==="review"&&(
          <>
            <div style={{marginBottom:18,padding:"12px 14px",background:"#0f1724",border:"1px solid #F59E0B33",borderRadius:10}}>
              <div style={{fontSize:13,fontWeight:800,marginBottom:4}}>{active.length} new bid{active.length!==1?"s":""} found</div>
              <div style={{fontSize:10,color:"#475569"}}>Tap <span style={{color:"#10B981",fontWeight:700}}>Add</span> to put on the calendar · <span style={{color:"#EF4444",fontWeight:700}}>Skip</span> to dismiss</div>
            </div>
            {suggs.map((s,i)=>{
              const isDismissed=dismissed.has(i);
              const days=daysUntil(s.bidDue); const uc=urgColor(days);
              return(
                <div key={i} style={{marginBottom:10,opacity:isDismissed?0.3:1,transition:"opacity 0.2s"}}>
                  <div style={{background:"#0c1220",border:`1px solid ${isDismissed?"#1e2d4a":uc+"44"}`,borderLeft:`3px solid ${isDismissed?"#374151":uc}`,borderRadius:10,padding:"12px 12px 10px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <span style={{fontSize:9,color:"#F59E0B",fontWeight:700,background:"#1a0e0088",border:"1px solid #F59E0B33",borderRadius:4,padding:"2px 7px"}}>{s.gcName}</span>
                      {s.receivedDate&&<span style={{fontSize:8,color:"#374151"}}>{s.receivedDate}</span>}
                    </div>
                    <div style={{fontSize:14,fontWeight:800,color:"#F1F5F9",marginBottom:3,lineHeight:1.3}}>{s.projectName}</div>
                    {s.projectAddress&&<div style={{fontSize:9,color:"#475569",marginBottom:4}}>📍 {s.projectAddress}</div>}
                    {s.trades&&<div style={{fontSize:9,color:"#3B82F6",marginBottom:8}}>🔧 {s.trades}</div>}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#080d16",borderRadius:6,padding:"6px 10px",marginBottom:8}}>
                      <div>
                        <div style={{fontSize:7,color:"#475569",letterSpacing:1,marginBottom:1}}>BID DUE</div>
                        <div style={{fontSize:12,fontWeight:700,color:uc}}>
                          {s.bidDue?new Date(s.bidDue).toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"}):"TBD"}
                          {s.bidDue&&<span style={{fontSize:9,color:uc+"88",marginLeft:4}}>{fmt12(s.bidDue)} ET</span>}
                        </div>
                      </div>
                      {days!==null&&<div style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:900,color:uc,lineHeight:1}}>{days<0?"!":days}</div><div style={{fontSize:7,color:uc}}>{days<0?"OVERDUE":"days"}</div></div>}
                    </div>
                    {!isDismissed?(
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>{dismiss(i);onAddBids([s]);}} style={{flex:2,padding:"9px",borderRadius:8,background:"#052e16bb",border:"1px solid #10B98166",color:"#10B981",fontSize:12,cursor:"pointer",fontWeight:800}}>✓ Add to Calendar</button>
                        <button onClick={()=>dismiss(i)} style={{flex:1,padding:"9px",borderRadius:8,background:"#45090a55",border:"1px solid #EF444444",color:"#EF4444",fontSize:12,cursor:"pointer",fontWeight:700}}>✕ Skip</button>
                      </div>
                    ):(
                      <div style={{textAlign:"center",fontSize:10,color:"#374151"}}>Skipped · <span onClick={()=>undismiss(i)} style={{color:"#3B82F6",cursor:"pointer"}}>Undo</span></div>
                    )}
                  </div>
                </div>
              );
            })}
            {active.length>1&&(
              <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #1e2d4a"}}>
                <button onClick={()=>onAddBids(active)} style={{width:"100%",padding:"13px",borderRadius:10,background:"#F59E0B",border:"none",color:"#000",fontSize:14,cursor:"pointer",fontWeight:900}}>✓ Add All {active.length} to Calendar</button>
              </div>
            )}
            <div style={{textAlign:"center",marginTop:12}}><button onClick={runScan} style={{background:"transparent",border:"none",color:"#475569",fontSize:10,cursor:"pointer"}}>⟳ Rescan</button></div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESTIMATING CALENDAR TAB
// ─────────────────────────────────────────────────────────────────────────────
function EstimatingCalendar({ bids, onUpdateBid, onScanBids }) {
  const [viewMode,    setViewMode]    = useState("calendar"); // "calendar" | "list"
  const [calYear,     setCalYear]     = useState(2026);
  const [calMonth,    setCalMonth]    = useState(2); // 0-indexed; March = 2
  const [selectedDay, setSelectedDay] = useState(null); // {year, month, day} or null
  const [detailBid,   setDetailBid]   = useState(null);
  const [showScan,    setShowScan]    = useState(false);
  const [filterStatus,setFilterStatus]= useState("ALL");

  const activeBids = bids.filter(b=>!["WON","LOST","DECLINED"].includes(b.status));
  const urgentBids = activeBids.filter(b=>{const d=daysUntil(b.bidDue);return d!==null&&d<=7;});

  // Map bidDue → list of bids for that YYYY-MM-DD
  const bidsByDate = bids.reduce((acc, b) => {
    const ymd = isoToYMD(b.bidDue);
    if (!ymd) return acc;
    (acc[ymd]??=[]).push(b);
    return acc;
  }, {});

  const grid = buildMonthGrid(calYear, calMonth);

  const prevMonth = () => {
    if (calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}
    else setCalMonth(m=>m-1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}
    else setCalMonth(m=>m+1);
    setSelectedDay(null);
  };

  const dayKey = d => d ? `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}` : null;

  const selectedDayBids = selectedDay
    ? (bidsByDate[dayKey(selectedDay)]||[])
    : [];

  const filteredList = filterStatus==="ALL"
    ? [...bids]
    : bids.filter(b=>b.status===filterStatus);
  const sortedList = [...filteredList].sort((a,b)=>{
    if(!a.bidDue) return 1; if(!b.bidDue) return -1;
    return new Date(a.bidDue)-new Date(b.bidDue);
  });

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
      {showScan && <BidScanModal existingBids={bids} onAddBids={newBids=>{onScanBids(newBids);setShowScan(false);}} onClose={()=>setShowScan(false)}/>}
      {detailBid && <BidDetailModal bid={detailBid} onUpdate={b=>{onUpdateBid(b);setDetailBid(null);}} onClose={()=>setDetailBid(null)}/>}

      {/* ── HEADER ── */}
      <div style={{background:"#080d18",borderBottom:"1px solid #1e2d4a",padding:"12px 16px",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:8,color:"#F59E0B",letterSpacing:2.5,textTransform:"uppercase",marginBottom:2}}>Estimating Pipeline</div>
            <div style={{fontSize:20,fontWeight:900,letterSpacing:-0.5}}>Bid Calendar</div>
          </div>
          <button onClick={()=>setShowScan(true)} style={{padding:"7px 14px",borderRadius:8,background:"#1a0e0088",border:"1px solid #F59E0B55",color:"#F59E0B",fontSize:10,cursor:"pointer",fontWeight:700,whiteSpace:"nowrap"}}>🔍 Scan Emails</button>
        </div>

        {/* Stats strip */}
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          {[
            {v:activeBids.length,                                          c:"#F59E0B", l:"Active"},
            {v:urgentBids.length,                                          c:urgentBids.length>0?"#EF4444":"#374151", l:"Due Soon"},
            {v:bids.filter(b=>b.status==="SUBMITTED").length,              c:"#3B82F6", l:"Submitted"},
            {v:bids.filter(b=>b.status==="WON").length,                    c:"#10B981", l:"Won"},
          ].map(s=>(
            <div key={s.l} style={{flex:1,textAlign:"center",background:"#0c1422",border:"1px solid #1e2d4a",borderRadius:8,padding:"7px 2px"}}>
              <div style={{fontSize:18,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div>
              <div style={{fontSize:7,color:"#374151",letterSpacing:0.5,marginTop:1}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Urgent banner */}
        {urgentBids.length>0&&(
          <div style={{background:"#45090a22",border:"1px solid #EF444433",borderRadius:8,padding:"7px 10px",marginBottom:10}}>
            <div style={{fontSize:8,color:"#EF4444",letterSpacing:1.5,textTransform:"uppercase",marginBottom:3}}>⚠ {urgentBids.length} bid{urgentBids.length!==1?"s":""} due within 7 days</div>
            {urgentBids.slice(0,3).map(b=>{
              const d=daysUntil(b.bidDue);
              return <div key={b.id} onClick={()=>setDetailBid(b)} style={{fontSize:10,color:"#FCA5A5",marginTop:2,cursor:"pointer"}}>· {b.projectName} — {d<0?"OVERDUE":d===0?"TODAY":d+"d"}</div>;
            })}
          </div>
        )}

        {/* View toggle */}
        <div style={{display:"flex",gap:0,background:"#0c1422",border:"1px solid #1e2d4a",borderRadius:8,overflow:"hidden"}}>
          {[{id:"calendar",label:"📅 Calendar"},{id:"list",label:"☰ List"}].map(v=>(
            <button key={v.id} onClick={()=>{setViewMode(v.id);setSelectedDay(null);}} style={{flex:1,padding:"8px 0",background:viewMode===v.id?"#1e3a5f":"transparent",border:"none",color:viewMode===v.id?"#93C5FD":"#374151",fontSize:11,cursor:"pointer",fontWeight:viewMode===v.id?800:400,transition:"all 0.15s"}}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CALENDAR VIEW ── */}
      {viewMode==="calendar"&&(
        <div style={{flex:1,overflowY:"auto",padding:"0 0 100px"}}>
          {/* Month nav */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px 8px"}}>
            <button onClick={prevMonth} style={{width:34,height:34,borderRadius:"50%",background:"#0c1422",border:"1px solid #1e2d4a",color:"#94A3B8",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:900,letterSpacing:-0.3}}>{MONTH_NAMES[calMonth]}</div>
              <div style={{fontSize:10,color:"#475569"}}>{calYear}</div>
            </div>
            <button onClick={nextMonth} style={{width:34,height:34,borderRadius:"50%",background:"#0c1422",border:"1px solid #1e2d4a",color:"#94A3B8",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
          </div>

          {/* Day-of-week headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 10px",marginBottom:4}}>
            {CAL_DAYS.map(d=>(
              <div key={d} style={{textAlign:"center",fontSize:8,color:"#374151",fontWeight:700,letterSpacing:0.8,padding:"4px 0"}}>{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,padding:"0 10px"}}>
            {grid.map((day,i)=>{
              const ymd = dayKey(day);
              const dayBids = day ? (bidsByDate[ymd]||[]) : [];
              const isToday = ymd===TODAY_ISO;
              const isSelected = selectedDay===day;
              const hasUrgent = dayBids.some(b=>{const d=daysUntil(b.bidDue);return d!==null&&d<=2;});
              const hasActive = dayBids.some(b=>!["WON","LOST","DECLINED"].includes(b.status));

              return (
                <div key={i} onClick={()=>day&&setSelectedDay(isSelected?null:day)}
                  style={{
                    minHeight:52,padding:"4px 3px",borderRadius:8,
                    background: isSelected?"#1e3a5f":isToday?"#0d1628":"#0c1220",
                    border:`1px solid ${isSelected?"#3B82F6":isToday?"#3B82F633":dayBids.length>0?"#F59E0B22":"#1e2d4a"}`,
                    cursor:day?"pointer":"default",
                    opacity:day?1:0.1
                  }}>
                  {day&&(
                    <>
                      <div style={{fontSize:10,fontWeight:isToday?900:600,color:isToday?"#3B82F6":isSelected?"#93C5FD":"#94A3B8",textAlign:"center",marginBottom:3}}>{day}</div>
                      {dayBids.slice(0,3).map((b,bi)=>{
                        const d=daysUntil(b.bidDue);
                        const uc=urgColor(d);
                        const bs=BID_STATUS[b.status]||BID_STATUS.NEW;
                        const active=!["WON","LOST","DECLINED"].includes(b.status);
                        return(
                          <div key={bi} style={{background:uc+"22",border:`1px solid ${uc}44`,borderRadius:3,padding:"1px 3px",marginBottom:1}}>
                            <div style={{fontSize:7,fontWeight:700,color:uc,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.projectName.split("—")[0].split("-")[0].trim()}</div>
                          </div>
                        );
                      })}
                      {dayBids.length>3&&<div style={{fontSize:6,color:"#475569",textAlign:"center"}}>+{dayBids.length-3}</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected day panel */}
          {selectedDay&&(
            <div style={{margin:"12px 10px 0",padding:"14px",background:"#0a0f1c",border:"1px solid #1e2d4a",borderRadius:12}}>
              <div style={{fontSize:9,color:"#F59E0B",letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>
                {MONTH_NAMES[calMonth]} {selectedDay}, {calYear} · {selectedDayBids.length} bid{selectedDayBids.length!==1?"s":""}
              </div>
              {selectedDayBids.length===0?(
                <div style={{fontSize:11,color:"#374151",fontStyle:"italic"}}>No bids due on this date.</div>
              ):selectedDayBids.map(b=>{
                const d=daysUntil(b.bidDue); const uc=urgColor(d);
                const bs=BID_STATUS[b.status]||BID_STATUS.NEW;
                return(
                  <div key={b.id} onClick={()=>setDetailBid(b)}
                    style={{background:"#0c1220",border:`1px solid ${uc}44`,borderLeft:`3px solid ${uc}`,borderRadius:8,padding:"10px 12px",marginBottom:8,cursor:"pointer"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                      <span style={{fontSize:8,color:"#F59E0B",fontWeight:700}}>{b.gcName}</span>
                      <span style={{fontSize:8,padding:"2px 6px",borderRadius:3,background:bs.bg,color:bs.color,fontWeight:700}}>{bs.label}</span>
                    </div>
                    <div style={{fontSize:13,fontWeight:800,color:"#F1F5F9",marginBottom:2,lineHeight:1.3}}>{b.projectName}</div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{fontSize:9,color:"#475569"}}>{b.projectAddress?.split(",").slice(-2).join(",")||""}</div>
                      <div style={{fontSize:10,fontWeight:700,color:uc}}>{fmt12(b.bidDue)} ET</div>
                    </div>
                    {b.assignedTo&&b.assignedTo!=="Assign →"&&<div style={{fontSize:8,color:"#374151",marginTop:3}}>👤 {b.assignedTo}</div>}
                    <div style={{marginTop:6,fontSize:9,color:"#3B82F6"}}>Tap to open →</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div style={{margin:"12px 10px 0",display:"flex",gap:10,flexWrap:"wrap"}}>
            {[{c:"#EF4444",l:"≤2 days"},{c:"#F59E0B",l:"≤7 days"},{c:"#10B981",l:">7 days"}].map(x=>(
              <div key={x.l} style={{display:"flex",gap:5,alignItems:"center"}}>
                <div style={{width:10,height:10,borderRadius:2,background:x.c+"44",border:`1px solid ${x.c}66`}}/>
                <span style={{fontSize:8,color:"#374151"}}>{x.l}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode==="list"&&(
        <div style={{flex:1,overflowY:"auto",padding:"12px 16px 100px"}}>
          {/* Status filters */}
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}}>
            {["ALL","NEW","REVIEWING","BIDDING","SUBMITTED","WON","LOST","DECLINED"].map(s=>{
              const meta=BID_STATUS[s];
              return(
                <button key={s} onClick={()=>setFilterStatus(s)} style={{padding:"4px 10px",borderRadius:10,border:`1px solid ${filterStatus===s?(meta?.color||"#3B82F6"):"#1e2d4a"}`,background:filterStatus===s?(meta?.bg||"#1e3a5f22"):"transparent",color:filterStatus===s?(meta?.color||"#93C5FD"):"#374151",fontSize:9,cursor:"pointer",fontWeight:filterStatus===s?800:400}}>
                  {meta?.label||"All"}
                </button>
              );
            })}
          </div>

          {sortedList.length===0?(
            <div style={{textAlign:"center",paddingTop:40,color:"#1e2d4a",fontSize:12}}>
              {bids.length===0?"No bids yet — tap Scan Emails to pull from inbox":"Nothing in this filter"}
            </div>
          ):sortedList.map(bid=>{
            const days=daysUntil(bid.bidDue); const uc=urgColor(days);
            const bs=BID_STATUS[bid.status]||BID_STATUS.NEW;
            return(
              <div key={bid.id} onClick={()=>setDetailBid(bid)}
                style={{background:"#0c1220",border:`1px solid ${uc}33`,borderLeft:`3px solid ${uc}`,borderRadius:10,padding:"12px 13px",marginBottom:10,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                  <span style={{fontSize:9,color:"#F59E0B",fontWeight:700,background:"#1a0e0088",border:"1px solid #F59E0B33",borderRadius:4,padding:"2px 7px"}}>{bid.gcName}</span>
                  <span style={{fontSize:8,padding:"2px 8px",borderRadius:4,fontWeight:800,background:bs.bg,color:bs.color}}>{bs.label}</span>
                </div>
                <div style={{fontSize:14,fontWeight:800,color:"#F1F5F9",lineHeight:1.3,marginBottom:3}}>{bid.projectName}</div>
                {bid.projectAddress&&<div style={{fontSize:9,color:"#475569",marginBottom:5}}>📍 {bid.projectAddress}</div>}
                {bid.scope&&<div style={{fontSize:9,color:"#64748B",marginBottom:5}}>📐 {bid.scope}</div>}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 8px",background:"#080d16",borderRadius:6}}>
                  <div>
                    <div style={{fontSize:7,color:"#475569",letterSpacing:0.8,marginBottom:1}}>BID DUE</div>
                    <div style={{fontSize:12,fontWeight:700,color:uc}}>
                      {bid.bidDue?new Date(bid.bidDue).toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"}):"TBD"}
                      {bid.bidDue&&<span style={{fontSize:9,color:"#475569",marginLeft:4}}>{fmt12(bid.bidDue)} ET</span>}
                    </div>
                  </div>
                  {days!==null&&(
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:20,fontWeight:900,color:uc,lineHeight:1}}>{days<0?"⚠":days}</div>
                      <div style={{fontSize:7,color:uc}}>{days<0?"overdue":days===0?"today":"days"}</div>
                    </div>
                  )}
                </div>
                {bid.assignedTo&&bid.assignedTo!=="Assign →"&&<div style={{fontSize:8,color:"#475569",marginTop:5}}>👤 {bid.assignedTo}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS (collapsed for brevity)
// ─────────────────────────────────────────────────────────────────────────────
function QuickCapture({onAdd}){const[t,setT]=useState("");const[d,setD]=useState("Business");const icons={Business:"📌",Personal:"🔹",Family:"💙",Health:"💪"};const go=()=>{if(!t.trim())return;onAdd({id:Date.now(),icon:icons[d],title:t.trim(),subtitle:"Quick capture",domain:d,priority:99,status:"QUEUED",owner:"David",deadline:"TBD",day:null,progress:0,nextAction:"Fill in details",dateAdded:TODAY_ISO});setT("");};return(<div style={{background:"#080d18",borderBottom:"1px solid #1e2d4a",padding:"7px 12px"}}><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:12}}>⚡</span><input value={t} onChange={e=>setT(e.target.value)} onKeyDown={e=>e.key==="Enter"&&go()} placeholder="Quick capture..." style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#94A3B8",fontSize:12,fontFamily:"inherit"}}/>{t&&<button onClick={go} style={{padding:"3px 10px",borderRadius:5,background:"#3B82F6",border:"none",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:800}}>ADD</button>}</div>{t&&<div style={{display:"flex",gap:5,marginTop:6}}>{Object.keys(DOMAIN).map(dom=>(<button key={dom} onClick={()=>setD(dom)} style={{flex:1,padding:"4px 0",borderRadius:7,border:`1px solid ${d===dom?DOMAIN[dom].accent:"#1e2d4a"}`,background:d===dom?DOMAIN[dom].dim:"transparent",color:d===dom?DOMAIN[dom].label:"#374151",fontSize:9,cursor:"pointer",fontWeight:d===dom?700:400}}>{dom}</button>))}</div>}</div>);}

function CalChip({ev}){const[open,setOpen]=useState(false);const busy=ev.showAs==="busy";return(<div onClick={()=>setOpen(o=>!o)} style={{background:busy?"#0d1f3c":"#0a110d",border:`1px solid ${busy?"#3B82F644":"#10B98133"}`,borderLeft:`3px solid ${busy?"#3B82F6":"#10B981"}`,borderRadius:8,padding:"7px 10px",cursor:"pointer"}}><div style={{display:"flex",gap:7,alignItems:"center"}}><span style={{fontSize:11}}>📅</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:700,color:"#CBD5E1",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.subject}</div><div style={{fontSize:9,color:"#475569",marginTop:1}}>{fmt12(ev.start)} – {fmt12(ev.end)}{ev.location&&` · ${ev.location.slice(0,22)}`}</div></div><span style={{fontSize:7,color:busy?"#3B82F6":"#10B981",fontWeight:800,letterSpacing:0.5}}>{busy?"BUSY":"TENT"}</span></div>{open&&ev.organizer&&<div style={{marginTop:5,paddingTop:5,borderTop:"1px solid #1e2d4a",fontSize:9,color:"#475569"}}>👤 {ev.organizer}</div>}</div>);}

function TaskCard({task,onDone,onUnschedule,onSchedule}){const[open,setOpen]=useState(false);const d=DOMAIN[task.domain]||DOMAIN.Business;const s=STATUS_META[task.status]||STATUS_META.QUEUED;if(task.status==="DONE")return(<div style={{padding:"7px 10px",borderRadius:8,background:"#0a0f1a",border:"1px solid #1e2d4a",opacity:0.4}}><div style={{fontSize:11,color:"#374151",textDecoration:"line-through"}}>✓ {task.title}</div></div>);return(<div onClick={()=>setOpen(o=>!o)} style={{background:open?"#131c2e":"#0c1220",border:`1px solid ${open?d.accent+"66":"#1e2d4a"}`,borderLeft:`3px solid ${d.accent}`,borderRadius:8,padding:"10px 12px",cursor:"pointer",position:"relative"}}><div style={{position:"absolute",top:8,right:10,fontSize:8,fontWeight:800,color:task.priority<=2?"#EF4444":"#1e2d4a66"}}>#{task.priority}</div><div style={{display:"flex",gap:7,alignItems:"flex-start",paddingRight:18}}><span style={{fontSize:15,lineHeight:1.2,flexShrink:0}}>{task.icon}</span><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:"#F1F5F9",lineHeight:1.3}}>{task.title}</div><div style={{fontSize:9,color:"#475569",marginTop:2}}>{task.subtitle}</div></div></div>{task.progress>0&&<div style={{margin:"5px 0 2px",background:"#1e2d4a",borderRadius:2,height:2}}><div style={{width:`${task.progress}%`,height:"100%",background:d.accent,borderRadius:2}}/></div>}<div style={{display:"flex",gap:3,marginTop:5,flexWrap:"wrap"}}><span style={{fontSize:7,padding:"2px 5px",borderRadius:3,fontWeight:700,background:s.bg,color:s.color,letterSpacing:0.5}}>{task.status}</span><span style={{fontSize:7,padding:"2px 5px",borderRadius:3,background:d.dim,color:d.label}}>{task.domain}</span>{task.owner!=="David"&&<span style={{fontSize:7,padding:"2px 5px",borderRadius:3,background:"#11182799",color:"#6B7280"}}>👤 {task.owner}</span>}{task.deadline&&<span style={{fontSize:7,padding:"2px 5px",borderRadius:3,background:"#11182799",color:"#475569"}}>⏱ {task.deadline}</span>}</div>{open&&<div style={{marginTop:9,padding:"9px 10px",background:"#080d16",borderRadius:6,borderLeft:`2px solid ${d.accent}`}}><div style={{fontSize:8,color:"#475569",letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>Next Action</div><div style={{fontSize:11,color:"#10B981",lineHeight:1.6}}>→ {task.nextAction}</div><div style={{display:"flex",gap:7,marginTop:9,flexWrap:"wrap"}}>{onDone&&<button onClick={e=>{e.stopPropagation();onDone(task.id);}} style={{flex:1,padding:"7px",borderRadius:6,background:"#052e16aa",border:"1px solid #10B98155",color:"#10B981",fontSize:10,cursor:"pointer",fontWeight:700}}>✓ Done</button>}{onUnschedule&&task.day&&<button onClick={e=>{e.stopPropagation();onUnschedule(task.id);}} style={{flex:1,padding:"7px",borderRadius:6,background:"#45090a44",border:"1px solid #EF444433",color:"#EF4444",fontSize:10,cursor:"pointer",fontWeight:700}}>✕ Off board</button>}{onSchedule&&!task.day&&<button onClick={e=>{e.stopPropagation();onSchedule(task.id);}} style={{flex:1,padding:"7px",borderRadius:6,background:"#1e3a5f88",border:"1px solid #3B82F644",color:"#93C5FD",fontSize:10,cursor:"pointer",fontWeight:700}}>📅 Schedule</button>}</div></div>}</div>);}

function WeekStrip({activeDayIdx,tasks,calEvents,onSelect}){return(<div style={{display:"flex",borderBottom:"1px solid #1e2d4a",background:"#080d18",overflowX:"auto",flexShrink:0}}>{DAYS_SHORT.map((day,i)=>{const isToday=i===TODAY_IDX,isActive=i===activeDayIdx;const tc=tasks.filter(t=>t.day===day&&t.status!=="DONE").length;const ec=calEvents.filter(e=>calDayKey(e.start)===day&&!e.isCancelled).length;return(<div key={day} onClick={()=>onSelect(i)} style={{flex:1,minWidth:42,padding:"7px 3px",textAlign:"center",cursor:"pointer",borderBottom:`2px solid ${isActive?"#3B82F6":"transparent"}`,background:isActive?"#0d1628":"transparent"}}><div style={{fontSize:8,fontWeight:800,letterSpacing:0.8,color:isActive?"#3B82F6":isToday?"#64748B":"#374151"}}>{day}</div><div style={{fontSize:7,color:"#1e2d4a",marginBottom:3}}>{DAY_DATES[i].split(" ")[1]}</div><div style={{display:"flex",gap:2,justifyContent:"center"}}>{tc>0&&<div style={{width:4,height:4,borderRadius:"50%",background:"#3B82F6"}}/>}{ec>0&&<div style={{width:4,height:4,borderRadius:"50%",background:"#10B981"}}/>}</div></div>);})}</div>);}

function ScheduleModal({taskId,tasks,onSchedule,onClose}){const task=tasks.find(t=>t.id===taskId);if(!task)return null;return(<div style={{position:"fixed",inset:0,background:"#060a12ee",backdropFilter:"blur(8px)",zIndex:999,display:"flex",alignItems:"flex-end"}}><div style={{background:"#0c1220",border:"1px solid #1e2d4a",borderRadius:"16px 16px 0 0",padding:22,width:"100%",boxShadow:"0 -20px 60px #00000099"}}><div style={{fontSize:12,fontWeight:700,marginBottom:4}}>{task.icon} {task.title}</div><div style={{fontSize:9,color:"#475569",marginBottom:14}}>Pick a day:</div><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7,marginBottom:14}}>{DAYS_SHORT.map((day,i)=>(<button key={day} onClick={()=>onSchedule(taskId,day)} style={{padding:"9px 0",borderRadius:8,background:i===TODAY_IDX?"#1e3a5f":"#111827",border:`1px solid ${i===TODAY_IDX?"#3B82F6":"#1e2d4a"}`,color:i===TODAY_IDX?"#93C5FD":"#94A3B8",fontSize:10,cursor:"pointer",fontWeight:700}}><div>{day}</div><div style={{fontSize:7,color:"#475569",marginTop:1}}>{DAY_DATES[i].split(" ")[1]}</div></button>))}</div><button onClick={onClose} style={{width:"100%",padding:"11px",borderRadius:8,background:"transparent",border:"1px solid #1e2d4a",color:"#475569",fontSize:11,cursor:"pointer"}}>Cancel</button></div></div>);}

function AddModal({onAdd,onClose}){const[f,setF]=useState({title:"",subtitle:"",domain:"Business",priority:5,status:"QUEUED",owner:"David",deadline:"",day:null,nextAction:""});const inp=(k,v)=>setF(p=>({...p,[k]:v}));const icons={Business:"📌",Personal:"🔹",Family:"💙",Health:"💪"};const I={width:"100%",background:"#111827",border:"1px solid #1e2d4a",borderRadius:8,padding:"9px 11px",color:"#F1F5F9",fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box"};const L={fontSize:8,color:"#475569",letterSpacing:1.2,textTransform:"uppercase",marginBottom:4,display:"block"};const go=()=>{if(!f.title.trim())return;onAdd({...f,id:Date.now(),icon:icons[f.domain],progress:0,dateAdded:TODAY_ISO});onClose();};return(<div style={{position:"fixed",inset:0,background:"#060a12ee",backdropFilter:"blur(8px)",zIndex:999,display:"flex",alignItems:"flex-end"}}><div style={{background:"#0c1220",border:"1px solid #1e2d4a",borderRadius:"16px 16px 0 0",padding:22,width:"100%",maxHeight:"85vh",overflowY:"auto",boxShadow:"0 -20px 60px #00000099"}}><div style={{fontSize:16,fontWeight:800,marginBottom:16}}>+ New Task</div><div style={{display:"flex",flexDirection:"column",gap:12}}><div><label style={L}>Title *</label><input style={I} value={f.title} onChange={e=>inp("title",e.target.value)} placeholder="What needs to happen?"/></div><div><label style={L}>Details</label><input style={I} value={f.subtitle} onChange={e=>inp("subtitle",e.target.value)} placeholder="Context..."/></div><div><label style={L}>Next Action</label><input style={I} value={f.nextAction} onChange={e=>inp("nextAction",e.target.value)} placeholder="First physical step..."/></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><label style={L}>Domain</label><select style={I} value={f.domain} onChange={e=>inp("domain",e.target.value)}>{Object.keys(DOMAIN).map(d=><option key={d}>{d}</option>)}</select></div><div><label style={L}>Owner</label><select style={I} value={f.owner} onChange={e=>inp("owner",e.target.value)}>{PEOPLE.map(p=><option key={p}>{p}</option>)}</select></div><div><label style={L}>Status</label><select style={I} value={f.status} onChange={e=>inp("status",e.target.value)}>{["ACTIVE","QUEUED","WAITING","RECURRING"].map(s=><option key={s}>{s}</option>)}</select></div><div><label style={L}>Deadline</label><input style={I} value={f.deadline} onChange={e=>inp("deadline",e.target.value)} placeholder="Mar 13..."/></div></div></div><div style={{display:"flex",gap:9,marginTop:18}}><button onClick={onClose} style={{flex:1,padding:"11px",borderRadius:8,background:"transparent",border:"1px solid #1e2d4a",color:"#475569",fontSize:12,cursor:"pointer"}}>Cancel</button><button onClick={go} style={{flex:2,padding:"11px",borderRadius:8,background:"#3B82F6",border:"none",color:"#fff",fontSize:13,cursor:"pointer",fontWeight:800}}>Add →</button></div></div></div>);}

function DayView({dayIdx,tasks,calEvents,onDone,onUnschedule,onSchedule}){const day=DAYS_SHORT[dayIdx],isToday=dayIdx===TODAY_IDX;const dayTasks=tasks.filter(t=>t.day===day&&t.status!=="DONE");const doneTasks=tasks.filter(t=>t.day===day&&t.status==="DONE");const dayEvents=calEvents.filter(e=>calDayKey(e.start)===day&&!e.isCancelled).sort((a,b)=>new Date(a.start)-new Date(b.start));return(<div style={{padding:"0 14px 100px"}}><div style={{padding:"14px 0 10px",borderBottom:"1px solid #1e2d4a",marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}><div><div style={{fontSize:24,fontWeight:900,letterSpacing:-0.8,color:isToday?"#3B82F6":"#F1F5F9"}}>{DAY_FULL[dayIdx]}</div><div style={{fontSize:11,color:"#475569",marginTop:1}}>{DAY_DATES[dayIdx]}, 2026</div></div><div style={{textAlign:"right"}}>{isToday&&<div style={{fontSize:8,background:"#3B82F6",color:"#fff",padding:"2px 7px",borderRadius:4,fontWeight:800,letterSpacing:0.8,marginBottom:3}}>TODAY</div>}<div style={{fontSize:10,color:"#475569"}}>{dayTasks.length}t · {dayEvents.length}m</div></div></div></div>{dayTasks.length===0&&dayEvents.length===0&&<div style={{textAlign:"center",paddingTop:36,color:"#1e2d4a",fontSize:12}}>— Clear day —</div>}{dayEvents.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:8,color:"#3B82F6",letterSpacing:1.5,textTransform:"uppercase",marginBottom:7}}>📅 Calendar</div><div style={{display:"flex",flexDirection:"column",gap:5}}>{dayEvents.map((ev,i)=><CalChip key={i} ev={ev}/>)}</div></div>}{dayTasks.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:8,color:"#F59E0B",letterSpacing:1.5,textTransform:"uppercase",marginBottom:7}}>🎯 Tasks</div><div style={{display:"flex",flexDirection:"column",gap:7}}>{dayTasks.map(t=><TaskCard key={t.id} task={t} onDone={onDone} onUnschedule={onUnschedule}/>)}</div></div>}{doneTasks.length>0&&<div style={{opacity:0.45}}><div style={{fontSize:8,color:"#374151",letterSpacing:1.5,textTransform:"uppercase",marginBottom:5}}>✓ Done</div><div style={{display:"flex",flexDirection:"column",gap:4}}>{doneTasks.map(t=><TaskCard key={t.id} task={t}/>)}</div></div>}</div>);}

function QueueView({tasks,onDone,onScheduleRequest}){const unscheduled=tasks.filter(t=>!t.day&&t.status!=="DONE");const[filter,setFilter]=useState("ALL");const filtered=filter==="ALL"?unscheduled:unscheduled.filter(t=>t.domain===filter);return(<div style={{padding:"14px 14px 100px"}}><div style={{marginBottom:14}}><div style={{fontSize:8,color:unscheduled.length>2?"#EF4444":"#3B82F6",letterSpacing:2.5,textTransform:"uppercase",marginBottom:3}}>{unscheduled.length} unscheduled</div><div style={{fontSize:22,fontWeight:900,letterSpacing:-0.5}}>Mission Queue</div></div><div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap"}}>{["ALL",...Object.keys(DOMAIN)].map(d=>(<button key={d} onClick={()=>setFilter(d)} style={{padding:"4px 11px",borderRadius:10,border:`1px solid ${filter===d?(DOMAIN[d]?.accent||"#3B82F6"):"#1e2d4a"}`,background:filter===d?(DOMAIN[d]?.dim||"#1e3a5f22"):"transparent",color:filter===d?(DOMAIN[d]?.label||"#93C5FD"):"#374151",fontSize:10,cursor:"pointer",fontWeight:filter===d?700:400}}>{d}</button>))}</div>{filtered.length===0?<div style={{textAlign:"center",paddingTop:36,color:"#1e2d4a",fontSize:12}}>✓ Queue empty</div>:<div style={{display:"flex",flexDirection:"column",gap:8}}>{filtered.map(t=><TaskCard key={t.id} task={t} onDone={onDone} onSchedule={onScheduleRequest}/>)}</div>}</div>);}

function TeamView({tasks,onMarkDone,onMarkReturned}){const delegated=tasks.filter(t=>!["David","Assign →"].includes(t.owner)&&t.status!=="DONE");const byPerson=delegated.reduce((a,t)=>{(a[t.owner]??=[]).push(t);return a;},{});return(<div style={{padding:"14px 14px 100px"}}><div style={{marginBottom:18}}><div style={{fontSize:8,color:"#3B82F6",letterSpacing:2.5,textTransform:"uppercase",marginBottom:3}}>{delegated.length} open</div><div style={{fontSize:22,fontWeight:900,letterSpacing:-0.5}}>Delegation</div></div>{Object.keys(byPerson).length===0?<div style={{textAlign:"center",paddingTop:36,color:"#1e2d4a",fontSize:12}}>Nothing delegated</div>:Object.entries(byPerson).map(([person,pts])=>(<div key={person} style={{marginBottom:22}}><div style={{display:"flex",alignItems:"center",gap:9,marginBottom:9,paddingBottom:7,borderBottom:"1px solid #1e2d4a"}}><div style={{width:36,height:36,borderRadius:"50%",background:"#1e2d4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👤</div><div><div style={{fontSize:15,fontWeight:800}}>{person}</div><div style={{fontSize:9,color:"#475569"}}>{pts.length} open</div></div><div style={{marginLeft:"auto",fontSize:8,color:"#EF4444",fontWeight:800}}>FOLLOW UP</div></div>{pts.map(task=>(<div key={task.id} style={{background:"#0c1220",border:"1px solid #EF444433",borderLeft:"3px solid #EF4444",borderRadius:8,padding:"11px 12px",marginBottom:7}}><div style={{fontSize:12,fontWeight:700}}>{task.icon} {task.title}</div><div style={{fontSize:9,color:"#475569",marginTop:2}}>{task.subtitle}</div><div style={{fontSize:10,color:"#10B981",marginTop:5}}>→ {task.nextAction}</div><div style={{display:"flex",gap:7,marginTop:9}}><button onClick={()=>onMarkReturned(task.id)} style={{flex:1,padding:"7px",borderRadius:6,background:"#052e16aa",border:"1px solid #10B98155",color:"#10B981",fontSize:10,cursor:"pointer",fontWeight:700}}>✓ Back to Me</button><button onClick={()=>onMarkDone(task.id)} style={{flex:1,padding:"7px",borderRadius:6,background:"#11182788",border:"1px solid #37415133",color:"#6B7280",fontSize:10,cursor:"pointer",fontWeight:700}}>✕ Done</button></div></div>))}</div>))}</div>);}

function EmailScanModal({onAddTasks,onClose}){const[phase,setPhase]=useState("idle");const[suggs,setSuggs]=useState([]);const[dism,setDism]=useState(new Set());const[prog,setProg]=useState("");const run=async()=>{setPhase("scanning");setProg("Connecting...");try{await new Promise(r=>setTimeout(r,500));setProg("Reading Inbox + Sent...");await new Promise(r=>setTimeout(r,400));setProg("AI analysis...");const t=await scanTaskEmails();if(!t||!t.length){setPhase("empty");return;}const prev=await stGet(SCAN_KEY,[]);const have=new Set(prev.map(x=>x.title));const fresh=t.filter(x=>!have.has(x.title));if(!fresh.length){setPhase("empty");return;}setSuggs(fresh);setDism(new Set());setPhase("review");}catch{setPhase("error");}};const active=suggs.filter((_,i)=>!dism.has(i));const dismiss=i=>setDism(p=>new Set([...p,i]));const undismiss=i=>setDism(p=>{const n=new Set(p);n.delete(i);return n;});return(<div style={{position:"fixed",inset:0,background:"#060a12f8",backdropFilter:"blur(14px)",zIndex:1500,display:"flex",flexDirection:"column"}}><div style={{background:"#0a0f1c",borderBottom:"1px solid #1e2d4a",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}><div><div style={{fontSize:8,color:"#3B82F6",letterSpacing:2.5,textTransform:"uppercase",marginBottom:2}}>Inbox + Sent · 48hrs</div><div style={{fontSize:17,fontWeight:900}}>📧 Email Scan</div></div><button onClick={onClose} style={{padding:"6px 14px",borderRadius:8,background:"#131e30",border:"1px solid #1e2d4a",color:"#64748B",fontSize:12,cursor:"pointer"}}>✕ Close</button></div><div style={{flex:1,overflowY:"auto",padding:"22px 16px 80px"}}>{phase==="idle"&&<div style={{textAlign:"center",paddingTop:44}}><div style={{fontSize:52,marginBottom:16}}>📬</div><div style={{fontSize:15,fontWeight:800,marginBottom:10}}>Ready to Scan</div><div style={{fontSize:11,color:"#475569",lineHeight:1.8,marginBottom:32,maxWidth:250,margin:"0 auto 32px"}}>Reads Inbox + Sent last 48hrs. Excludes bid emails — those go to the Estimating Calendar.</div><button onClick={run} style={{padding:"13px 30px",borderRadius:10,background:"#3B82F6",border:"none",color:"#fff",fontSize:14,cursor:"pointer",fontWeight:900}}>Scan Now →</button></div>}{phase==="scanning"&&<div style={{textAlign:"center",paddingTop:56}}><div style={{fontSize:44,display:"inline-block",marginBottom:18,animation:"spin 2s linear infinite"}}>🔍</div><div style={{fontSize:13,fontWeight:700,marginBottom:7}}>Scanning...</div><div style={{fontSize:11,color:"#3B82F6"}}>{prog}</div></div>}{phase==="empty"&&<div style={{textAlign:"center",paddingTop:56}}><div style={{fontSize:44,marginBottom:14}}>✨</div><div style={{fontSize:15,fontWeight:700,marginBottom:7}}>All clear</div><div style={{fontSize:11,color:"#475569",marginBottom:28}}>No new actionable emails found.</div><button onClick={run} style={{padding:"11px 22px",borderRadius:8,background:"#131e30",border:"1px solid #1e2d4a",color:"#94A3B8",fontSize:12,cursor:"pointer"}}>Scan Again</button></div>}{phase==="error"&&<div style={{textAlign:"center",paddingTop:56}}><div style={{fontSize:44,marginBottom:14}}>⚠️</div><div style={{fontSize:13,fontWeight:700,color:"#EF4444",marginBottom:22}}>Scan Failed</div><button onClick={run} style={{padding:"11px 22px",borderRadius:8,background:"#3B82F6",border:"none",color:"#fff",fontSize:12,cursor:"pointer",fontWeight:700}}>Try Again</button></div>}{phase==="review"&&<><div style={{marginBottom:16,padding:"11px 13px",borderRadius:10,background:"#0d1628",border:"1px solid #3B82F644"}}><div style={{fontSize:13,fontWeight:800,marginBottom:3}}>{active.length} suggested task{active.length!==1?"s":""}</div><div style={{fontSize:10,color:"#475569"}}>Tap <span style={{color:"#10B981",fontWeight:700}}>Add</span> · <span style={{color:"#EF4444",fontWeight:700}}>Skip</span> to dismiss</div></div>{suggs.map((s,i)=>{const isDismissed=dism.has(i);const dom=DOMAIN[s.domain]||DOMAIN.Business;return(<div key={i} style={{marginBottom:10,opacity:isDismissed?0.3:1,transition:"opacity 0.2s"}}><div style={{background:"#0c1220",border:`1px solid ${isDismissed?"#1e2d4a":dom.accent+"55"}`,borderLeft:`3px solid ${isDismissed?"#374151":dom.accent}`,borderRadius:10,padding:"12px 12px 10px"}}><div style={{display:"flex",gap:5,marginBottom:7}}><span style={{fontSize:8,color:"#3B82F6",background:"#1e3a5f44",border:"1px solid #3B82F633",borderRadius:4,padding:"2px 7px",maxWidth:180,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>📧 {s.emailFrom}</span>{s.emailDate&&<span style={{fontSize:7,color:"#374151"}}>{s.emailDate}</span>}</div>{s.emailSubject&&<div style={{fontSize:8,color:"#374151",marginBottom:7,fontStyle:"italic",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>"{s.emailSubject}"</div>}<div style={{fontSize:13,fontWeight:700,color:"#F1F5F9",marginBottom:3,lineHeight:1.3}}>{s.icon} {s.title}</div><div style={{fontSize:10,color:"#64748B",marginBottom:5,lineHeight:1.4}}>{s.subtitle}</div><div style={{fontSize:10,color:"#10B981",marginBottom:9}}>→ {s.nextAction}</div><div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:9}}><span style={{fontSize:7,padding:"2px 5px",borderRadius:3,background:dom.dim,color:dom.label}}>{s.domain}</span><span style={{fontSize:7,padding:"2px 5px",borderRadius:3,background:"#11182799",color:"#475569"}}>⏱ {s.deadline}</span>{s.owner!=="David"&&<span style={{fontSize:7,padding:"2px 5px",borderRadius:3,background:"#11182799",color:"#6B7280"}}>👤 {s.owner}</span>}</div>{!isDismissed?<div style={{display:"flex",gap:7}}><button onClick={()=>{dismiss(i);onAddTasks([s]);}} style={{flex:2,padding:"9px",borderRadius:7,background:"#052e16bb",border:"1px solid #10B98166",color:"#10B981",fontSize:12,cursor:"pointer",fontWeight:800}}>✓ Add</button><button onClick={()=>dismiss(i)} style={{flex:1,padding:"9px",borderRadius:7,background:"#45090a55",border:"1px solid #EF444444",color:"#EF4444",fontSize:12,cursor:"pointer",fontWeight:700}}>✕</button></div>:<div style={{textAlign:"center",fontSize:10,color:"#374151"}}>Skipped · <span onClick={()=>undismiss(i)} style={{color:"#3B82F6",cursor:"pointer"}}>Undo</span></div>}</div></div>);})}
{active.length>1&&<div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #1e2d4a"}}><button onClick={()=>{stSet(SCAN_KEY,suggs);onAddTasks(active);}} style={{width:"100%",padding:"13px",borderRadius:10,background:"#3B82F6",border:"none",color:"#fff",fontSize:14,cursor:"pointer",fontWeight:900}}>✓ Add All {active.length}</button></div>}<div style={{textAlign:"center",marginTop:12}}><button onClick={run} style={{background:"transparent",border:"none",color:"#475569",fontSize:10,cursor:"pointer"}}>⟳ Rescan</button></div></>}</div></div>);}

function Briefing({tasks,calEvents,stepsLog,onLogSteps,onClose}){const[steps,setSteps]=useState("");const logged=stepsLog[TODAY_DATE];const[didLog,setDidLog]=useState(false);const top3=tasks.filter(t=>t.day==="MON"&&t.status!=="DONE").slice(0,3);const meetings=calEvents.filter(e=>calDayKey(e.start)==="MON"&&!e.isCancelled).sort((a,b)=>new Date(a.start)-new Date(b.start));const waiting=tasks.filter(t=>!["David","Claude","Assign →"].includes(t.owner)&&t.status!=="DONE");const stepCount=logged??(didLog?parseInt(steps)||null:null);const log=()=>{if(!steps)return;onLogSteps(TODAY_DATE,parseInt(steps));setDidLog(true);};return(<div style={{position:"fixed",inset:0,background:"#060a12f8",backdropFilter:"blur(16px)",zIndex:1000,overflowY:"auto",padding:"22px 18px 40px"}}><div style={{maxWidth:480,margin:"0 auto"}}><div style={{marginBottom:22}}><div style={{fontSize:8,letterSpacing:2.5,color:"#3B82F6",textTransform:"uppercase",marginBottom:5}}>{TODAY_DATE} · Morning Briefing</div><div style={{fontSize:30,fontWeight:900,letterSpacing:-1,lineHeight:1.1}}>Good morning,<br/><span style={{color:"#3B82F6"}}>David.</span></div></div>{meetings.length>0&&<div style={{marginBottom:18}}><div style={{fontSize:8,color:"#3B82F6",letterSpacing:1.5,textTransform:"uppercase",marginBottom:9}}>📅 Today's Meetings ({meetings.length})</div><div style={{display:"flex",flexDirection:"column",gap:5}}>{meetings.map((ev,i)=><CalChip key={i} ev={ev}/>)}</div></div>}<div style={{marginBottom:18}}><div style={{fontSize:8,color:"#374151",letterSpacing:1.5,textTransform:"uppercase",marginBottom:9}}>🎯 Top {top3.length} Today</div>{top3.length===0&&<div style={{fontSize:11,color:"#374151",fontStyle:"italic"}}>Nothing on board today.</div>}{top3.map((t,i)=>(<div key={t.id} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"9px 0",borderBottom:i<top3.length-1?"1px solid #1e2d4a":"none"}}><div style={{width:24,height:24,borderRadius:"50%",background:i===0?"#EF4444":i===1?"#F59E0B":"#1e2d4a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:"#fff",flexShrink:0}}>{i+1}</div><div><div style={{fontSize:13,fontWeight:700}}>{t.icon} {t.title}</div><div style={{fontSize:10,color:"#10B981",marginTop:2}}>→ {t.nextAction}</div></div></div>))}</div>{waiting.length>0&&<div style={{background:"#1c100322",border:"1px solid #F59E0B33",borderRadius:10,padding:"9px 12px",marginBottom:14}}><div style={{fontSize:8,color:"#F59E0B",letterSpacing:1.5,textTransform:"uppercase",marginBottom:3}}>👤 {waiting.length} Waiting on Others</div>{waiting.slice(0,3).map(t=><div key={t.id} style={{fontSize:10,color:"#FCD34D",marginTop:2}}>· {t.title} → {t.owner}</div>)}</div>}<div style={{background:"#0a0f1a",border:"1px solid #1e2d4a",borderRadius:10,padding:13,marginBottom:22}}><div style={{fontSize:8,color:"#F59E0B",letterSpacing:1.5,textTransform:"uppercase",marginBottom:9}}>👟 Yesterday's Steps</div>{stepCount!=null?<div style={{display:"flex",alignItems:"baseline",gap:10}}><span style={{fontSize:30,fontWeight:900,color:stepCount>=10000?"#10B981":stepCount>=5000?"#F59E0B":"#EF4444"}}>{stepCount.toLocaleString()}</span><span style={{fontSize:11,color:"#475569"}}>{stepCount>=10000?"✓ Goal hit!":stepCount>=5000?"Halfway.":"Way under."}</span></div>:<div style={{display:"flex",gap:9}}><input type="number" value={steps} onChange={e=>setSteps(e.target.value)} onKeyDown={e=>e.key==="Enter"&&log()} placeholder="Enter steps..." style={{flex:1,background:"#111827",border:"1px solid #1e2d4a",borderRadius:7,padding:"9px 11px",color:"#F1F5F9",fontSize:13,outline:"none",fontFamily:"inherit"}}/><button onClick={log} style={{padding:"9px 16px",borderRadius:7,background:"#F59E0B",border:"none",color:"#000",fontSize:12,cursor:"pointer",fontWeight:800}}>LOG</button></div>}</div><button onClick={onClose} style={{width:"100%",background:"#3B82F6",border:"none",color:"#fff",padding:"15px",borderRadius:10,fontSize:14,cursor:"pointer",fontWeight:900}}>Let's go →</button></div></div>);}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [tasks,         setTasks]         = useState(SEED_TASKS);
  const [bids,          setBids]          = useState(SEED_BIDS);
  const [calEvents,     setCalEvents]     = useState([]);
  const [calLoading,    setCalLoading]    = useState(true);
  const [stepsLog,      setStepsLog]      = useState({});
  const [loaded,        setLoaded]        = useState(false);
  const [tab,           setTab]           = useState("today");
  const [activeDayIdx,  setActiveDayIdx]  = useState(TODAY_IDX);
  const [showBriefing,  setShowBriefing]  = useState(false);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [showEmailScan, setShowEmailScan] = useState(false);
  const [schedulingId,  setSchedulingId]  = useState(null);

  useEffect(()=>{
    (async()=>{
      // 1. Load tasks — Firebase is source of truth, local storage is fallback
      const fbTasks = await fbFetchTasks();
      if (fbTasks && fbTasks.length > 0) {
        setTasks(fbTasks);
      } else {
        const localTasks = await stGet(STORAGE_KEY, null);
        if (localTasks) setTasks(localTasks);
        // else SEED_TASKS stay as fallback
      }

      const b = await stGet(BIDS_KEY, null);    if (b) setBids(b);
      const s = await stGet(STEPS_KEY, {});     setStepsLog(s);
      const cached = await stGet(CAL_KEY, null);
      if (cached?.events && cached.ts > Date.now()-15*60*1000) {
        setCalEvents(cached.events); setCalLoading(false);
      } else {
        const evs = await fetchCalendarEvents();
        if (evs.length>0){ setCalEvents(evs); await stSet(CAL_KEY,{events:evs,ts:Date.now()}); }
        setCalLoading(false);
      }
      setLoaded(true);
    })();
  },[]);

  useEffect(()=>{ if (loaded) { stSet(STORAGE_KEY, tasks); fbWriteTasks(tasks); } }, [tasks, loaded]);
  useEffect(()=>{ if (loaded) stSet(BIDS_KEY, bids);  }, [bids,  loaded]);

  const update       = (id, patch) => setTasks(p=>p.map(t=>t.id===id?{...t,...patch}:t));
  const addTask      = task => setTasks(p=>[...p, task]);
  const addTasks     = newTasks => {
    setTasks(p=>[...p,...newTasks.map(t=>({...t,id:Date.now()+Math.random()*999|0,dateAdded:TODAY_ISO,progress:0,day:null,status:t.status||"QUEUED"}))]);
    setShowEmailScan(false);
  };
  const markDone     = id => update(id,{status:"DONE",day:null});
  const unschedule   = id => update(id,{day:null});
  const scheduleTask = (tid,day) => { update(tid,{day}); setSchedulingId(null); };
  const logSteps     = async (date,val) => { const n={...stepsLog,[date]:val}; setStepsLog(n); await stSet(STEPS_KEY,n); };
  const refreshCal   = async () => {
    setCalLoading(true);
    const evs = await fetchCalendarEvents();
    if (evs.length>0){ setCalEvents(evs); await stSet(CAL_KEY,{events:evs,ts:Date.now()}); }
    setCalLoading(false);
  };
  const addBids = newBids => {
    setBids(p=>[...p,...newBids.map(b=>({...b,id:"bid-"+Date.now()+Math.random()*999|0,status:b.status||"NEW",assignedTo:b.assignedTo||"Assign →",notes:b.notes||""}))]);
  };
  const updateBid = updated => setBids(p=>p.map(b=>b.id===updated.id?updated:b));

  const [fbStatus, setFbStatus] = useState("synced"); // "synced" | "syncing" | "error"

  const refreshFromFirebase = async () => {
    setFbStatus("syncing");
    const fbTasks = await fbFetchTasks();
    if (fbTasks && fbTasks.length > 0) {
      setTasks(fbTasks);
      setFbStatus("synced");
    } else {
      setFbStatus("error");
      setTimeout(() => setFbStatus("synced"), 3000);
    }
  };
  const unscheduled = tasks.filter(t=>!t.day&&t.status!=="DONE");
  const activeBids  = bids.filter(b=>!["WON","LOST","DECLINED"].includes(b.status));
  const urgentBids  = activeBids.filter(b=>{const d=daysUntil(b.bidDue);return d!==null&&d<=7;});

  if (!loaded) return (
    <div style={{background:"#060a12",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:12}}>🌊</div>
        <div style={{fontSize:10,color:"#1e2d4a",letterSpacing:3}}>LOADING...</div>
      </div>
    </div>
  );

  return (
    <div style={{fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",background:"#060a12",height:"100vh",display:"flex",flexDirection:"column",color:"#F1F5F9",overflow:"hidden"}}>

      {showBriefing  && <Briefing tasks={tasks} calEvents={calEvents} stepsLog={stepsLog} onLogSteps={logSteps} onClose={()=>setShowBriefing(false)}/>}
      {showAddModal  && <AddModal onAdd={addTask} onClose={()=>setShowAddModal(false)}/>}
      {showEmailScan && <EmailScanModal onAddTasks={addTasks} onClose={()=>setShowEmailScan(false)}/>}
      {schedulingId  && <ScheduleModal taskId={schedulingId} tasks={tasks} onSchedule={scheduleTask} onClose={()=>setSchedulingId(null)}/>}

      {/* ── TOP NAV ── */}
      <div style={{background:"#080d18",borderBottom:"1px solid #1e2d4a",padding:"9px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div>
          <div style={{fontSize:7,letterSpacing:2.5,color:"#3B82F6",textTransform:"uppercase"}}>Coastal Plumbing · SWFL</div>
          <div style={{fontSize:15,fontWeight:900,letterSpacing:-0.5}}>OPS CENTER</div>
        </div>
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
          <div style={{fontSize:8,color:calLoading?"#F59E0B":calEvents.length>0?"#10B981":"#EF4444"}}>{calLoading?"⏳":calEvents.length>0?`📅${calEvents.length}`:"📅0"}</div>
          <div onClick={refreshFromFirebase} title="Firebase sync" style={{fontSize:8,cursor:"pointer",color:fbStatus==="synced"?"#10B981":fbStatus==="syncing"?"#F59E0B":"#EF4444",background:fbStatus==="synced"?"#052e1644":fbStatus==="syncing"?"#1c100344":"#45090a44",border:`1px solid ${fbStatus==="synced"?"#10B98133":fbStatus==="syncing"?"#F59E0B33":"#EF444433"}`,borderRadius:4,padding:"2px 6px",fontWeight:700}}>
            {fbStatus==="synced"?"🔥 LIVE":fbStatus==="syncing"?"⏳ SYNC…":"⚠ FB ERR"}
          </div>
          <button onClick={refreshCal} style={{padding:"4px 7px",borderRadius:5,background:"#111827",border:"1px solid #1e2d4a",color:"#475569",fontSize:10,cursor:"pointer"}}>⟳</button>
          <button onClick={()=>setShowBriefing(true)} style={{padding:"5px 9px",borderRadius:5,background:"#0d2818",border:"1px solid #10B98133",color:"#10B981",fontSize:10,cursor:"pointer",fontWeight:700}}>☀</button>
          {tab!=="bids"&&<button onClick={()=>setShowEmailScan(true)} style={{padding:"5px 9px",borderRadius:5,background:"#0d1628",border:"1px solid #3B82F644",color:"#93C5FD",fontSize:9,cursor:"pointer",fontWeight:700}}>📧</button>}
          <button onClick={()=>setShowAddModal(true)} style={{padding:"5px 11px",borderRadius:5,background:"#3B82F6",border:"none",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:800}}>+</button>
        </div>
      </div>

      {/* Stats bar — hide on bids tab (has its own) */}
      {tab!=="bids"&&(
        <div style={{background:"#080d18",borderBottom:"1px solid #1e2d4a",padding:"5px 14px",display:"flex",gap:14,alignItems:"center",flexShrink:0}}>
          {[
            {v:tasks.filter(t=>t.status==="ACTIVE").length,            c:"#10B981",                           l:"Active"},
            {v:unscheduled.length,                                      c:unscheduled.length>2?"#EF4444":"#475569", l:"Queued"},
            {v:delegated.length,                                        c:delegated.length>0?"#F59E0B":"#475569",  l:"Delegated"},
            {v:activeBids.length,                                       c:urgentBids.length>0?"#EF4444":"#F59E0B",  l:"Bids"},
          ].map(s=>(
            <div key={s.l} style={{textAlign:"center"}}>
              <div style={{fontSize:17,fontWeight:900,color:s.c,lineHeight:1}}>{s.v}</div>
              <div style={{fontSize:6,color:"#374151",letterSpacing:0.5}}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Capture — hide on bids tab */}
      {tab!=="bids"&&<QuickCapture onAdd={addTask}/>}

      {/* Week strip — today only */}
      {tab==="today"&&<WeekStrip activeDayIdx={activeDayIdx} tasks={tasks} calEvents={calEvents} onSelect={i=>setActiveDayIdx(i)}/>}

      {/* Content */}
      <div style={{flex:1,overflowY:tab==="bids"?"hidden":"auto",display:"flex",flexDirection:"column"}}>
        {tab==="today"      && <DayView dayIdx={activeDayIdx} tasks={tasks} calEvents={calEvents} onDone={markDone} onUnschedule={unschedule} onSchedule={id=>setSchedulingId(id)}/>}
        {tab==="queue"      && <QueueView tasks={tasks} onDone={markDone} onScheduleRequest={id=>setSchedulingId(id)}/>}
        {tab==="bids"       && <EstimatingCalendar bids={bids} onUpdateBid={updateBid} onScanBids={addBids}/>}
        {tab==="delegation" && <TeamView tasks={tasks} onMarkDone={markDone} onMarkReturned={id=>update(id,{owner:"David",status:"ACTIVE"})}/>}
      </div>

      {/* Bottom nav */}
      <div style={{background:"#080d18",borderTop:"1px solid #1e2d4a",display:"flex",padding:"7px 0 env(safe-area-inset-bottom,7px)",flexShrink:0}}>
        {[
          {id:"today",      icon:"📅", label:"Today"},
          {id:"queue",      icon:"⚡", label:"Queue",  badge:unscheduled.length},
          {id:"bids",       icon:"🏗️", label:"Bids",   badge:urgentBids.length, badgeColor:"#F59E0B", badgeText:"#000"},
          {id:"delegation", icon:"👤", label:"Team",   badge:delegated.length},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,background:"transparent",border:"none",cursor:"pointer",padding:"5px 0",display:"flex",flexDirection:"column",alignItems:"center",gap:1,position:"relative"}}>
            <span style={{fontSize:19}}>{t.icon}</span>
            <span style={{fontSize:8,letterSpacing:0.3,fontWeight:700,color:tab===t.id?"#3B82F6":"#374151"}}>{t.label}</span>
            {t.badge>0&&<div style={{position:"absolute",top:1,right:"calc(50% - 16px)",background:t.badgeColor||"#EF4444",color:t.badgeText||"#fff",borderRadius:10,padding:"0 4px",fontSize:7,fontWeight:900,lineHeight:"14px"}}>{t.badge}</div>}
            {tab===t.id&&<div style={{position:"absolute",bottom:0,width:22,height:2,background:"#3B82F6",borderRadius:1}}/>}
          </button>
        ))}
      </div>

      <style>{`
        * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        ::-webkit-scrollbar { display:none; }
        select option { background:#111827; color:#F1F5F9; }
        input::placeholder,textarea::placeholder { color:#374151; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
