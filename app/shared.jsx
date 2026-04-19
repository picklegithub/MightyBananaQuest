// Life Admin — shared primitives, icons, mock data, app state.
// Loaded before screens.

/* ─────────────── Icons (1.5px stroke, minimal) ─────────────── */
const Icon = ({ d, size = 18, fill = 'none', stroke, sw = 1.5, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
    stroke={stroke || 'currentColor'} strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" style={style}>
    {typeof d === 'string' ? <path d={d} /> : d}
  </svg>
);

const Icons = {
  plus:    (p) => <Icon {...p} d="M12 5v14M5 12h14" />,
  check:   (p) => <Icon {...p} d="M5 12.5l4.5 4.5L19 7.5" />,
  arrow:   (p) => <Icon {...p} d="M5 12h14M13 6l6 6-6 6" />,
  back:    (p) => <Icon {...p} d="M19 12H5M11 6l-6 6 6 6" />,
  more:    (p) => <Icon {...p} d={<><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></>} fill="currentColor" stroke="none" />,
  mic:     (p) => <Icon {...p} d={<><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></>} />,
  flame:   (p) => <Icon {...p} d="M12 3c.5 3 3 4 3 7a3 3 0 11-6 0c0-1 .5-1.5 1-2-.5 4-3 5-3 8a5 5 0 0010 0c0-5-5-7-5-13z" />,
  bolt:    (p) => <Icon {...p} d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />,
  timer:   (p) => <Icon {...p} d={<><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 3h6"/></>} />,
  play:    (p) => <Icon {...p} d="M7 5l11 7-11 7V5z" fill="currentColor" stroke="none" />,
  pause:   (p) => <Icon {...p} d={<><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>} fill="currentColor" stroke="none" />,
  reset:   (p) => <Icon {...p} d="M4 4v6h6M20 14a8 8 0 11-3-7" />,
  calendar:(p) => <Icon {...p} d={<><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>} />,
  list:    (p) => <Icon {...p} d="M4 6h16M4 12h16M4 18h10" />,
  inbox:   (p) => <Icon {...p} d="M3 13l3-8h12l3 8v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6zM3 13h5l1 3h6l1-3h5" />,
  chart:   (p) => <Icon {...p} d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  user:    (p) => <Icon {...p} d={<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></>} />,
  search:  (p) => <Icon {...p} d={<><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></>} />,
  settings:(p) => <Icon {...p} d={<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3h.1a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8v.1a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" sw={1.2}/></>} />,
  close:   (p) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />,
  tag:     (p) => <Icon {...p} d={<><path d="M3 12V3h9l9 9-9 9-9-9z"/><circle cx="7.5" cy="7.5" r="1" fill="currentColor"/></>} />,
  rss:     (p) => <Icon {...p} d={<><path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16"/><circle cx="5" cy="19" r="1.5" fill="currentColor"/></>} />,
  edit:    (p) => <Icon {...p} d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4" />,
  sparkle: (p) => <Icon {...p} d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />,
  leaf:    (p) => <Icon {...p} d="M5 19c8 0 14-6 14-14-6 0-14 4-14 12v2zM5 19c2-4 5-7 9-9" />,
  drop:    (p) => <Icon {...p} d="M12 3l5 7a6 6 0 11-10 0l5-7z" />,
  dollar:  (p) => <Icon {...p} d="M12 3v18M16 7H10a3 3 0 000 6h4a3 3 0 010 6H8" />,
  briefcase:(p)=> <Icon {...p} d={<><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/></>} />,
  book:    (p) => <Icon {...p} d="M4 5a2 2 0 012-2h6v18H6a2 2 0 01-2-2V5zM12 3h6a2 2 0 012 2v14a2 2 0 01-2 2h-6V3z" />,
  heart:   (p) => <Icon {...p} d="M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z" />,
  home:    (p) => <Icon {...p} d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-9z" />,
  family:  (p) => <Icon {...p} d={<><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20a5 5 0 0110 0M11 20a5 5 0 0110 0"/></>} />,
  target:  (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>} />,
  journal: (p) => <Icon {...p} d="M5 4h12a2 2 0 012 2v14l-3-2-3 2-3-2-3 2-3-2V6a2 2 0 012-2zM9 8h6M9 12h6M9 16h4" />,
  sun:     (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></>} />,
  moon:    (p) => <Icon {...p} d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />,
  bell:    (p) => <Icon {...p} d="M6 16V11a6 6 0 1112 0v5l1.5 2h-15L6 16zM10 21a2 2 0 004 0" />,
  download:(p) => <Icon {...p} d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />,
  layers:  (p) => <Icon {...p} d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5" />,
};

/* ─────────────── Categories ─────────────── */
const CATEGORIES = [
  { id: 'home',     name: 'Home',     icon: 'home',      hue: 35 },
  { id: 'work',     name: 'Work',     icon: 'briefcase', hue: 240 },
  { id: 'health',   name: 'Health',   icon: 'heart',     hue: 145 },
  { id: 'finance',  name: 'Finance',  icon: 'dollar',    hue: 90 },
  { id: 'learning', name: 'Learning', icon: 'book',      hue: 280 },
  { id: 'family',   name: 'Family',   icon: 'family',    hue: 15 },
];

/* ─────────────── Tasks (mock) ─────────────── */
// effort: 's' (~5min, 5xp), 'm' (~20min, 15xp), 'l' (~60min, 40xp)
// quad: 'q1' urgent+important, 'q2' important, 'q3' urgent, 'q4' neither
const TASKS = [
  // Home
  { id:'t1', cat:'home', title:'Empty the dishwasher', effort:'s', due:'Today', streak:6, ctx:'@home', quad:'q3', recurring:'Daily', done:false, sub:[] },
  { id:'t2', cat:'home', title:'Water the indoor plants', effort:'s', due:'Today', streak:12, ctx:'@home', quad:'q2', recurring:'Every 3d', done:true, sub:[] },
  { id:'t3', cat:'home', title:'Replace smoke alarm batteries', effort:'m', due:'Sat', streak:0, ctx:'@home', quad:'q2', recurring:'Yearly', done:false,
    sub:[ { t:'Buy 9V batteries', d:false }, { t:'Test each detector', d:false }, { t:'Log replacement date', d:false } ] },
  { id:'t4', cat:'home', title:'Deep clean the kitchen', effort:'l', due:'Sun', streak:0, ctx:'@home', quad:'q4', recurring:null, done:false,
    sub:[ { t:'Wipe cabinets', d:true }, { t:'Clean oven', d:false }, { t:'Mop floor', d:false }, { t:'Empty fridge & wipe', d:false } ] },
  { id:'t5', cat:'home', title:'Take out recycling', effort:'s', due:'Tomorrow', streak:9, ctx:'@home', quad:'q3', recurring:'Weekly', done:false, sub:[] },
  { id:'t6', cat:'home', title:'Schedule annual HVAC service', effort:'m', due:'Apr 28', streak:0, ctx:'@phone', quad:'q2', recurring:'Yearly', done:false, sub:[] },

  // Work
  { id:'t7', cat:'work', title:'Draft Q2 OKR proposal', effort:'l', due:'Fri', streak:0, ctx:'@laptop', quad:'q1', recurring:null, done:false,
    sub:[ { t:'Pull Q1 metrics', d:true }, { t:'Outline 3 objectives', d:false }, { t:'Share with manager', d:false } ] },
  { id:'t8', cat:'work', title:'Reply to recruiter email', effort:'s', due:'Today', streak:0, ctx:'@email', quad:'q1', recurring:null, done:false, sub:[] },
  { id:'t9', cat:'work', title:'Prep 1:1 talking points', effort:'m', due:'Mon', streak:4, ctx:'@laptop', quad:'q2', recurring:'Weekly', done:false, sub:[] },

  // Health
  { id:'t10', cat:'health', title:'30-min walk', effort:'m', due:'Today', streak:18, ctx:'@anywhere', quad:'q2', recurring:'Daily', done:true, sub:[] },
  { id:'t11', cat:'health', title:'Strength session', effort:'l', due:'Today', streak:7, ctx:'@gym', quad:'q2', recurring:'3x/week', done:false, sub:[] },
  { id:'t12', cat:'health', title:'Refill prescription', effort:'s', due:'Wed', streak:0, ctx:'@phone', quad:'q1', recurring:'Monthly', done:false, sub:[] },
  { id:'t13', cat:'health', title:'Book GP check-in', effort:'s', due:'This week', streak:0, ctx:'@phone', quad:'q2', recurring:null, done:false, sub:[] },

  // Finance
  { id:'t14', cat:'finance', title:'Pay electricity bill', effort:'s', due:'Apr 22', streak:0, ctx:'@laptop', quad:'q1', recurring:'Monthly', done:false, sub:[] },
  { id:'t15', cat:'finance', title:'Review monthly budget', effort:'m', due:'Sun', streak:3, ctx:'@laptop', quad:'q2', recurring:'Monthly', done:false, sub:[] },
  { id:'t16', cat:'finance', title:'File quarterly tax return', effort:'l', due:'Apr 30', streak:0, ctx:'@laptop', quad:'q1', recurring:'Quarterly', done:false,
    sub:[ { t:'Export bank statements', d:false }, { t:'Categorise expenses', d:false }, { t:'Submit', d:false } ] },

  // Learning
  { id:'t17', cat:'learning', title:'Finish chapter 4 — Atomic Habits', effort:'m', due:'Today', streak:5, ctx:'@anywhere', quad:'q2', recurring:'Daily', done:false, sub:[] },
  { id:'t18', cat:'learning', title:'Spanish — 15 min Duolingo', effort:'s', due:'Today', streak:21, ctx:'@phone', quad:'q2', recurring:'Daily', done:true, sub:[] },
  { id:'t19', cat:'learning', title:'Watch Compose course module', effort:'m', due:'Wed', streak:0, ctx:'@laptop', quad:'q2', recurring:null, done:false, sub:[] },

  // Family
  { id:'t20', cat:'family', title:'Call Mum', effort:'s', due:'Sun', streak:11, ctx:'@phone', quad:'q2', recurring:'Weekly', done:false, sub:[] },
  { id:'t21', cat:'family', title:'Plan weekend outing', effort:'m', due:'Fri', streak:0, ctx:'@anywhere', quad:'q2', recurring:null, done:false, sub:[] },

  // Mammoth + Gargantuan examples
  { id:'t22', cat:'work', title:'Annual performance review prep', effort:'xl', due:'Apr 30', streak:0, ctx:'@laptop', quad:'q1', recurring:'Yearly', done:false,
    sub:[ { t:'Gather peer feedback', d:false }, { t:'Draft self-assessment', d:false }, { t:'Review goals vs actuals', d:false }, { t:'Final write-up', d:false } ] },
  { id:'t23', cat:'home', title:'Spring whole-home clean', effort:'xxl', due:'This week', streak:0, ctx:'@home', quad:'q4', recurring:'Yearly', done:false,
    sub:[ { t:'Bedrooms deep clean', d:false }, { t:'Kitchen & appliances', d:false }, { t:'Bathroom refresh', d:false }, { t:'Garage sort-out', d:false }, { t:'Garden prep', d:false } ] },
];

const EFFORT = {
  xs: { label: 'Micro',     mins: 3,    xp: 3,   glyph: '●',       range:'1–5 min',    bar: 1 },
  s:  { label: 'Small',     mins: 15,   xp: 8,   glyph: '●●',      range:'6–30 min',   bar: 2 },
  m:  { label: 'Medium',    mins: 45,   xp: 18,  glyph: '●●●',     range:'31–60 min',  bar: 3 },
  l:  { label: 'Long',      mins: 150,  xp: 45,  glyph: '●●●●',    range:'1–4 hours',  bar: 4 },
  xl: { label: 'Mammoth',   mins: 360,  xp: 90,  glyph: '●●●●●',   range:'4–8+ hrs',   bar: 5 },
  xxl:{ label: 'Gargantuan',mins: 1440, xp: 220, glyph: '●●●●●●',  range:'1+ days',    bar: 6 },
};
const EFFORT_ORDER = ['xs','s','m','l','xl','xxl'];

const QUAD = {
  q1: { label: 'Urgent · Important', short: 'Do' },
  q2: { label: 'Important · Not urgent', short: 'Schedule' },
  q3: { label: 'Urgent · Not important', short: 'Delegate' },
  q4: { label: 'Neither', short: 'Drop' },
};

/* ─────────────── Inbox / RSS / Calendar mock ─────────────── */
const INBOX_ITEMS = [
  { id:'i1', kind:'capture', text:'Idea: batch errands on Saturday morning', when:'9:14 AM' },
  { id:'i2', kind:'rss', source:'AFR — Personal Finance', text:'2026 super contribution caps explained', when:'8:02 AM' },
  { id:'i3', kind:'capture', text:'Voice memo: \u201Cbook dentist for May\u201D', when:'Yesterday' },
  { id:'i4', kind:'rss', source:'NYT — Well', text:'A 4-minute breathing routine for desk workers', when:'Yesterday' },
  { id:'i5', kind:'email', text:'Energy bill arriving \u2014 due Apr 22', when:'Mon' },
];

const CAL_EVENTS = [
  { day: 0, title: 'Strength session', time: '7:00', cat:'health' },
  { day: 0, title: 'Pay electricity', time: '12:00', cat:'finance' },
  { day: 1, title: 'Take out recycling', time: '8:00', cat:'home' },
  { day: 2, title: 'Refill prescription', time: '9:30', cat:'health' },
  { day: 3, title: 'Compose course', time: '20:00', cat:'learning' },
  { day: 4, title: 'OKR proposal due', time: 'EOD', cat:'work' },
  { day: 5, title: 'Smoke alarms', time: '10:00', cat:'home' },
  { day: 6, title: 'Call Mum', time: '11:00', cat:'family' },
  { day: 6, title: 'Review budget', time: '15:00', cat:'finance' },
];

/* ─────────────── Goals (mock) ─────────────── */
const GOALS = [
  { id:'g1', title:'Run a 10km in under 50 min', area:'health', horizon:'12 weeks', progress:0.62, why:'Energy for the year ahead.', linked:['t10','t11'] },
  { id:'g2', title:'Save $8,000 emergency buffer', area:'finance', horizon:'6 months', progress:0.45, why:'Quiet mind, fewer decisions.', linked:['t15','t16'] },
  { id:'g3', title:'Read 12 books this year', area:'learning', horizon:'2026', progress:0.33, why:'Stay curious. Stay humble.', linked:['t17'] },
  { id:'g4', title:'Sunday evenings phone-free', area:'family', horizon:'Ongoing', progress:0.78, why:'Be where my feet are.', linked:['t20'] },
];

/* ─────────────── Journal entries (mock) ─────────────── */
const JOURNAL_ENTRIES = [
  { id:'j1', date:'Apr 18', kind:'evening', win:'Finished the OKR draft a day early.', diff:'Started the gym session earlier.', lesson:'Mornings are for hard things.', tomorrow:'Walk before breakfast.' },
  { id:'j2', date:'Apr 18', kind:'morning', gratitude:['warm coffee','a quiet flat','last week\u2019s long walk'], intention:'Move with patience, not urgency.', priorities:['OKR draft','30-min walk','Call Mum'] },
  { id:'j3', date:'Apr 17', kind:'evening', win:'Held the breath practice through a tough call.', diff:'Less screen after 9pm.', lesson:'Pauses are productive.', tomorrow:'Finish chapter 4.' },
];

/* ─────────────── App state ─────────────── */
const useAppState = () => {
  const [tasks, setTasks] = React.useState(TASKS);
  const [categories, setCategories] = React.useState(CATEGORIES);
  const [goals, setGoals] = React.useState(GOALS);
  const [journal, setJournal] = React.useState(JOURNAL_ENTRIES);
  const [xp, setXp] = React.useState(2840);
  const [streak, setStreak] = React.useState(34);
  const [confetti, setConfetti] = React.useState(null);

  const addCategory = (c) => setCategories(cs => [...cs, c]);
  const addGoal = (g) => setGoals(gs => [...gs, g]);
  const addJournal = (e) => setJournal(js => [e, ...js]);

  const completeTask = (id, evt) => {
    const t = tasks.find(x => x.id === id);
    if (!t || t.done) return;
    setTasks(tasks.map(x => x.id === id ? { ...x, done: true } : x));
    const gained = EFFORT[t.effort].xp;
    setXp(v => v + gained);
    if (evt) {
      const r = evt.currentTarget.getBoundingClientRect();
      setConfetti({ x: r.left + r.width/2, y: r.top + r.height/2, xp: gained, ts: Date.now() });
      setTimeout(() => setConfetti(null), 1400);
    }
  };
  const toggleSub = (taskId, idx) => {
    setTasks(tasks.map(t => t.id !== taskId ? t : ({
      ...t, sub: t.sub.map((s,i) => i===idx ? { ...s, d: !s.d } : s)
    })));
  };

  return { tasks, setTasks, xp, streak, completeTask, toggleSub, confetti,
    categories, addCategory, goals, addGoal, journal, addJournal };
};

/* ─────────────── Bottom nav ─────────────── */
const BottomNav = ({ tab, setTab, intensity }) => {
  const items = [
    { id:'dashboard', label:'Today',    icon:'home' },
    { id:'journal',   label:'Journal',  icon:'journal' },
    { id:'add',       label:'',         icon:'plus', big:true },
    { id:'goals',     label:'Goals',    icon:'target' },
    { id:'calendar',  label:'Calendar', icon:'calendar' },
  ];
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'10px 14px 8px', borderTop:'1px solid var(--rule)',
      background:'var(--paper)',
    }}>
      {items.map(it => {
        const I = Icons[it.icon];
        if (it.big) {
          return (
            <button key={it.id} onClick={() => setTab(it.id)} style={{
              width:54, height:54, borderRadius:'50%',
              background:'var(--ink)', color:'var(--paper)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'var(--shadow-2)', marginTop:-22,
            }}>
              <I size={22} />
            </button>
          );
        }
        const active = tab === it.id;
        return (
          <button key={it.id} onClick={() => setTab(it.id)} style={{
            display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            color: active ? 'var(--ink)' : 'var(--ink-3)', width:56, padding:'4px 0',
          }}>
            <I size={20} />
            <span style={{ fontSize:10, letterSpacing:0.04, fontWeight: active ? 600 : 400 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
};

/* ─────────────── Effort pip ─────────────── */
const EffortPip = ({ effort, mono }) => {
  const e = EFFORT[effort] || EFFORT.m;
  const bars = e.bar || 3;
  const label = bars >= 5 ? (e.mins >= 1440 ? Math.round(e.mins/1440)+'d' : Math.round(e.mins/60)+'h')
              : (e.mins >= 60 ? (e.mins/60)+'h' : e.mins+'m');
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:6,
      fontFamily:'var(--font-mono)', fontSize:10, color: mono ? 'var(--ink-3)' : 'var(--ink-2)',
      letterSpacing:0.06,
    }}>
      <span style={{ display:'inline-flex', gap:2 }}>
        {[1,2,3,4,5,6].map(i => (
          <span key={i} style={{
            width:5, height:5, borderRadius:'50%',
            background: i <= bars ? 'currentColor' : 'transparent',
            border: '1px solid currentColor', opacity: i <= bars ? 1 : 0.35,
          }}/>
        ))}
      </span>
      <span>{label}</span>
    </span>
  );
};

/* ─────────────── Confetti (tasteful) ─────────────── */
const ConfettiBurst = ({ x, y, xp }) => {
  const pieces = React.useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    a: (i / 14) * Math.PI * 2 + Math.random()*0.4,
    d: 30 + Math.random()*40,
    r: -20 + Math.random()*40,
    s: 0.7 + Math.random()*0.6,
  })), []);
  return (
    <div style={{ position:'fixed', left:x, top:y, pointerEvents:'none', zIndex:9999 }}>
      {pieces.map((p, i) => (
        <span key={i} style={{
          position:'absolute', left:0, top:0, width:6, height:8,
          background: i % 3 === 0 ? 'var(--accent)' : i % 3 === 1 ? 'var(--ink)' : 'var(--warn)',
          transform: `translate(${Math.cos(p.a)*p.d}px, ${Math.sin(p.a)*p.d}px) rotate(${p.r}deg) scale(${p.s})`,
          opacity: 0, animation: `cf 1.2s ease-out forwards`,
          animationDelay: `${i*0.01}s`,
        }} />
      ))}
      <span style={{
        position:'absolute', left:-30, top:-40, width:60, textAlign:'center',
        fontFamily:'var(--font-mono)', fontSize:12, color:'var(--accent)', fontWeight:600,
        animation:'xpFloat 1.2s ease-out forwards',
      }}>+{xp} XP</span>
      <style>{`
        @keyframes cf { 0%{opacity:1;transform:translate(0,0)} 100%{opacity:0} }
        @keyframes xpFloat { 0%{opacity:0;transform:translateY(0)} 20%{opacity:1} 100%{opacity:0;transform:translateY(-30px)} }
      `}</style>
    </div>
  );
};

Object.assign(window, {
  Icon, Icons, CATEGORIES, TASKS, EFFORT, QUAD,
  INBOX_ITEMS, CAL_EVENTS, useAppState, BottomNav, EffortPip, ConfettiBurst, EFFORT_ORDER,
});
