// Life Admin — mobile screens, part 2: Task Detail (HERO), Pomodoro, Progress, Calendar, Review, Add, Inbox

/* ─────────────── Task Detail (HERO with live Pomodoro) ─────────────── */
const TaskDetail = ({ t, state, onClose, intensity }) => {
  const [task, setTask] = React.useState(t);
  React.useEffect(() => setTask(state.tasks.find(x => x.id === t.id) || t), [state.tasks, t.id]);
  const cat = CATEGORIES.find(c => c.id === task.cat) || CATEGORIES[0];
  const I = Icons[cat.icon] || Icons.sparkle;

  // Pomodoro (adjustable)
  const effMins = EFFORT[task.effort] ? EFFORT[task.effort].mins : 25;
  const defaultPom = task.pomodoroMins || Math.min(effMins, 50) || 25;
  const [pomMins, setPomMins] = React.useState(defaultPom);
  const total = pomMins * 60;
  const [secs, setSecs] = React.useState(total);
  const [running, setRunning] = React.useState(false);
  React.useEffect(() => { setSecs(pomMins*60); setRunning(false); }, [pomMins, task.id]);
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);
  React.useEffect(() => { if (secs === 0) setRunning(false); }, [secs]);
  const pct = ((total - secs) / total) * 100;
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  // Journal
  const [journal, setJournal] = React.useState('');
  // Sub
  const [sub, setSub] = React.useState(task.sub);
  React.useEffect(() => setSub(task.sub), [task.sub]);
  const toggleSub = (i) => setSub(sub.map((s, idx) => idx === i ? { ...s, d: !s.d } : s));
  const subDone = sub.filter(s => s.d).length;

  return (
    <div style={{ height:'100%', background:'var(--paper)', display:'flex', flexDirection:'column' }}>
      {/* Top bar */}
      <div style={{ padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <button onClick={onClose} style={{ color:'var(--ink-2)', display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
          <Icons.back size={14} /> {cat.name}
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:14, color:'var(--ink-3)' }}>
          <Icons.edit size={16} /> <Icons.more size={16} />
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto' }} className="no-scrollbar">
        {/* Title block */}
        <div style={{ padding:'8px 22px 0' }}>
          <div className="eyebrow" style={{ display:'flex', alignItems:'center', gap:8 }}>
            <I size={11} /><span>{cat.name}</span><span style={{ opacity:0.5 }}>·</span><span>{task.recurring || 'one-off'}</span>
          </div>
          <div className="t-display" style={{ fontSize:36, marginTop:10, lineHeight:1.05 }}>
            {task.title}
          </div>
          {/* Meta strip */}
          <div style={{ marginTop:14, display:'flex', flexWrap:'wrap', gap:8 }}>
            <Chip>{task.ctx}</Chip>
            <Chip>{(EFFORT[task.effort]||EFFORT.m).label} · {(EFFORT[task.effort]||EFFORT.m).range}</Chip>
            <Chip warn={task.quad === 'q1'}>Due {task.due}</Chip>
            {task.streak > 0 && <Chip accent><Icons.flame size={10}/> {task.streak}-day streak</Chip>}
          </div>
        </div>

        {/* POMODORO — hero */}
        <div style={{ margin:'24px 18px 0', padding:22, borderRadius:20,
          background:'var(--ink)', color:'var(--paper)', position:'relative', overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:10, opacity:0.6, letterSpacing:0.14, textTransform:'uppercase' }}>
              Focus session
            </div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:10, opacity:0.6 }}>
              {Math.round((total-secs)/60)} / {total/60} min
            </div>
          </div>

          {/* Ring */}
          <div style={{ display:'flex', justifyContent:'center', margin:'18px 0 14px' }}>
            <PomodoroRing pct={pct} mm={mm} ss={ss} running={running} />
          </div>

          {/* Controls */}
          <div style={{ display:'flex', justifyContent:'center', gap:12 }}>
            <button onClick={() => { setSecs(total); setRunning(false); }} style={ringBtn(false)}>
              <Icons.reset size={16} />
            </button>
            <button onClick={() => setRunning(r => !r)} style={ringBtn(true)}>
              {running ? <Icons.pause size={20} /> : <Icons.play size={20} />}
              <span style={{ fontSize:13, fontWeight:500 }}>{running ? 'Pause' : (secs === total ? 'Start focus' : 'Resume')}</span>
            </button>
          </div>

          <div style={{ marginTop:14, display:'flex', justifyContent:'space-between',
            fontFamily:'var(--font-mono)', fontSize:10, opacity:0.6, letterSpacing:0.1 }}>
            <span>SESSION 1 OF 1</span>
            <span>+{(EFFORT[task.effort]||EFFORT.m).xp} XP ON COMPLETE</span>
          </div>

          {/* Adjustable pomodoro duration */}
          <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.08)',
            display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:10, opacity:0.6, letterSpacing:0.12 }}>DURATION</span>
            {[15, 25, 45, 60, 90].map(m => {
              const on = pomMins === m;
              return (
                <button key={m} onClick={() => setPomMins(m)} style={{
                  padding:'4px 9px', borderRadius:6, fontFamily:'var(--font-mono)', fontSize:10,
                  background: on ? 'var(--paper)' : 'transparent',
                  color: on ? 'var(--ink)' : 'rgba(255,255,255,0.65)',
                  border:'1px solid rgba(255,255,255,0.18)',
                }}>{m}m</button>
              );
            })}
          </div>
        </div>

        {/* Subtasks */}
        {sub.length > 0 && (
          <Section title="Steps" sub={`${subDone} of ${sub.length} done`}>
            <div style={{ marginTop:10 }}>
              {sub.map((s, i) => (
                <div key={i} onClick={() => toggleSub(i)} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'12px 0',
                  borderBottom:'1px solid var(--rule)', cursor:'pointer',
                }}>
                  <div style={{
                    width:18, height:18, borderRadius:4, flexShrink:0,
                    border:`1.5px solid ${s.d ? 'var(--accent)' : 'var(--ink-3)'}`,
                    background: s.d ? 'var(--accent)' : 'transparent',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    {s.d && <Icons.check size={11} sw={2.5} stroke="var(--paper)" />}
                  </div>
                  <div style={{ fontSize:14, color: s.d ? 'var(--ink-3)' : 'var(--ink)',
                    textDecoration: s.d ? 'line-through' : 'none' }}>{s.t}</div>
                </div>
              ))}
              <button style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 0',
                color:'var(--ink-3)', fontSize:13 }}>
                <Icons.plus size={14}/> Add step
              </button>
            </div>
          </Section>
        )}

        {/* Eisenhower matrix */}
        <Section title="Priority" sub="7 Habits matrix">
          <EisenhowerMatrix quad={task.quad} onChange={(q) => setTask({ ...task, quad: q })} />
        </Section>

        {/* Win journal */}
        <Section title="Win journal" sub="Optional — grounds the task in meaning">
          <div style={{ marginTop:12, padding:14, borderRadius:12, background:'var(--paper-2)',
            border:'1px solid var(--rule)' }}>
            <div style={{ fontSize:12, color:'var(--ink-3)', marginBottom:8 }}>What will go well when this is done?</div>
            <textarea value={journal} onChange={e => setJournal(e.target.value)}
              placeholder="A clean kitchen makes Sunday breakfast better…"
              style={{ width:'100%', minHeight:64, border:'none', background:'transparent',
                fontSize:14, color:'var(--ink)', resize:'none', outline:'none', fontFamily:'var(--font-display)',
                fontStyle:'italic', lineHeight:1.4 }} />
          </div>
          {intensity !== 'subtle' && (
            <div style={{ marginTop:10, padding:'10px 14px', borderRadius:10,
              background:'var(--accent-soft)', display:'flex', gap:10, alignItems:'center' }}>
              <Icons.sparkle size={14} stroke="var(--accent)"/>
              <div style={{ fontSize:12, color:'var(--ink)' }}>
                Two reflections this week. <b>Keep it up.</b>
              </div>
            </div>
          )}
        </Section>

        <div style={{ height:90 }} />
      </div>

      {/* Bottom action bar */}
      <div style={{ padding:'12px 18px 16px', borderTop:'1px solid var(--rule)',
        background:'var(--paper)', display:'flex', gap:10 }}>
        <button style={{
          padding:'14px 18px', borderRadius:14, border:'1px solid var(--rule)',
          color:'var(--ink-2)', fontSize:13,
        }}>
          Snooze
        </button>
        <button onClick={(e) => { state.completeTask(task.id, e); setTimeout(onClose, 800); }} style={{
          flex:1, padding:'14px', borderRadius:14, background:'var(--accent)',
          color:'var(--paper)', fontSize:14, fontWeight:500,
          display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
        }}>
          <Icons.check size={16} sw={2}/> Mark complete · +{(EFFORT[task.effort]||EFFORT.m).xp} XP
        </button>
      </div>
    </div>
  );
};

const ringBtn = (primary) => ({
  display:'inline-flex', alignItems:'center', gap:8, padding: primary ? '12px 22px' : '12px',
  borderRadius:999, background: primary ? 'var(--paper)' : 'transparent',
  color: primary ? 'var(--ink)' : 'var(--paper)',
  border: primary ? 'none' : '1px solid rgba(255,255,255,0.18)',
});

const PomodoroRing = ({ pct, mm, ss, running }) => {
  const R = 88, C = 2 * Math.PI * R;
  return (
    <div style={{ position:'relative', width:220, height:220 }}>
      <svg width="220" height="220" style={{ transform:'rotate(-90deg)' }}>
        <circle cx="110" cy="110" r={R} stroke="rgba(255,255,255,0.12)" strokeWidth="2" fill="none" />
        <circle cx="110" cy="110" r={R} stroke="var(--accent-soft)" strokeWidth="3" fill="none"
          strokeDasharray={C} strokeDashoffset={C - (pct/100)*C}
          style={{ transition:'stroke-dashoffset 1s linear' }} strokeLinecap="round" />
        {/* tick marks */}
        {Array.from({ length: 60 }).map((_, i) => {
          const a = (i / 60) * Math.PI * 2;
          const x1 = 110 + Math.cos(a) * (R + 6);
          const y1 = 110 + Math.sin(a) * (R + 6);
          const x2 = 110 + Math.cos(a) * (R + (i % 5 === 0 ? 12 : 9));
          const y2 = 110 + Math.sin(a) * (R + (i % 5 === 0 ? 12 : 9));
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={i % 5 === 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.18)'} strokeWidth="1" />;
        })}
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center' }}>
        <div className="t-display" style={{ fontSize:56, lineHeight:1, fontFeatureSettings:"'tnum'" }}>
          {mm}<span style={{ opacity:0.4 }}>:</span>{ss}
        </div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:10, opacity:0.6, marginTop:6,
          letterSpacing:0.14, textTransform:'uppercase' }}>
          {running ? 'In focus' : (pct === 0 ? 'Ready' : 'Paused')}
        </div>
      </div>
    </div>
  );
};

const Chip = ({ children, accent, warn }) => (
  <span style={{
    display:'inline-flex', alignItems:'center', gap:5,
    padding:'5px 10px', borderRadius:999, fontSize:11,
    fontFamily:'var(--font-mono)', letterSpacing:0.04,
    border:'1px solid var(--rule)',
    background: accent ? 'var(--accent-soft)' : warn ? 'var(--warn-soft)' : 'var(--paper-2)',
    color: accent ? 'var(--ink)' : warn ? 'var(--warn)' : 'var(--ink-2)',
    borderColor: warn ? 'var(--warn-soft)' : 'var(--rule)',
  }}>{children}</span>
);

const Section = ({ title, sub, children }) => (
  <div style={{ padding:'28px 22px 0' }}>
    <SectionHeader title={title} sub={sub} />
    {children}
  </div>
);

/* ─────────────── Eisenhower matrix ─────────────── */
const EisenhowerMatrix = ({ quad, onChange }) => {
  const cells = [
    { id:'q1', label:'Do', sub:'Urgent · Important' },
    { id:'q2', label:'Schedule', sub:'Important' },
    { id:'q3', label:'Delegate', sub:'Urgent' },
    { id:'q4', label:'Drop', sub:'Neither' },
  ];
  return (
    <div style={{ marginTop:14, position:'relative' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
        {cells.map(c => {
          const active = c.id === quad;
          return (
            <button key={c.id} onClick={() => onChange(c.id)} style={{
              padding:14, borderRadius:10, textAlign:'left',
              background: active ? 'var(--ink)' : 'var(--paper-2)',
              color: active ? 'var(--paper)' : 'var(--ink)',
              border:'1px solid', borderColor: active ? 'var(--ink)' : 'var(--rule)',
              minHeight:84,
            }}>
              <div style={{ fontFamily:'var(--font-display)', fontSize:18, fontStyle:'italic' }}>{c.label}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:10, opacity:0.7, marginTop:6,
                letterSpacing:0.06, textTransform:'uppercase' }}>{c.sub}</div>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop:8, display:'flex', justifyContent:'space-between',
        fontFamily:'var(--font-mono)', fontSize:9, color:'var(--ink-3)', letterSpacing:0.1, textTransform:'uppercase' }}>
        <span>← Less urgent</span><span>More urgent →</span>
      </div>
    </div>
  );
};

/* ─────────────── Progress ─────────────── */
const ProgressScreen = ({ state }) => {
  const days = ['M','T','W','T','F','S','S'];
  const week = [60, 40, 80, 100, 70, 30, 50]; // % completion
  const total = state.tasks.length;
  const done = state.tasks.filter(t => t.done).length;

  return (
    <div style={{ background:'var(--paper)', minHeight:'100%', paddingBottom:32 }}>
      <div style={{ padding:'18px 22px 0' }}>
        <div className="eyebrow">Progress</div>
        <div className="t-display" style={{ fontSize:36, marginTop:6 }}>
          A <em>steady</em> month.
        </div>
      </div>

      {/* Big stats */}
      <div style={{ padding:'24px 22px 0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <BigStat label="DAY STREAK" value={state.streak} sub="best 41" icon="flame" />
        <BigStat label="LIFETIME XP" value={state.xp.toLocaleString()} sub="LVL 12" icon="bolt" />
        <BigStat label="THIS WEEK" value={`${done}/${total}`} sub="tasks done" icon="check" />
        <BigStat label="FOCUS TIME" value="6h 20m" sub="this week" icon="timer" />
      </div>

      {/* Week bar chart */}
      <div style={{ padding:'28px 22px 0' }}>
        <SectionHeader title="Last 7 days" sub="completion rate" />
        <div style={{ marginTop:18, display:'flex', alignItems:'flex-end', gap:10, height:140 }}>
          {week.map((v, i) => (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <div style={{ flex:1, width:'100%', display:'flex', alignItems:'flex-end' }}>
                <div style={{ width:'100%', height:`${v}%`,
                  background: i === 6 ? 'var(--accent)' : 'var(--ink)',
                  borderRadius:'4px 4px 0 0', opacity: i === 6 ? 1 : 0.85 }} />
              </div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)' }}>{days[i]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Streak grid */}
      <div style={{ padding:'28px 22px 0' }}>
        <SectionHeader title="Habit chains" sub="last 12 weeks" />
        <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'repeat(12, 1fr)', gap:4 }}>
          {Array.from({ length: 84 }).map((_, i) => {
            const intensity = Math.random();
            const v = intensity > 0.85 ? 1 : intensity > 0.55 ? 0.6 : intensity > 0.3 ? 0.3 : 0.1;
            return <div key={i} style={{ aspectRatio:'1', borderRadius:2,
              background: `color-mix(in oklch, var(--accent) ${v*100}%, var(--paper-3))` }} />;
          })}
        </div>
        <div style={{ marginTop:8, display:'flex', justifyContent:'space-between',
          fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)' }}>
          <span>Jan</span><span>Apr</span>
        </div>
      </div>

      {/* Categories breakdown */}
      <div style={{ padding:'28px 22px 0' }}>
        <SectionHeader title="By area" sub="this month" />
        <div style={{ marginTop:12 }}>
          {CATEGORIES.map((c, i) => {
            const pct = [82, 64, 90, 70, 55, 78][i];
            const I = Icons[c.icon];
            return (
              <div key={c.id} style={{ padding:'12px 0', borderBottom:'1px solid var(--rule)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <I size={14} />
                  <div style={{ flex:1, fontSize:13, color:'var(--ink)' }}>{c.name}</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-3)' }}>{pct}%</div>
                </div>
                <div style={{ marginTop:8, height:3, background:'var(--paper-3)', borderRadius:2 }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:'var(--ink)', borderRadius:2 }}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const BigStat = ({ label, value, sub, icon }) => {
  const I = Icons[icon];
  return (
    <div style={{ padding:16, borderRadius:14, background:'var(--paper-2)', border:'1px solid var(--rule)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div className="eyebrow" style={{ fontSize:9 }}>{label}</div>
        <I size={14} stroke="var(--ink-3)" />
      </div>
      <div className="t-display" style={{ fontSize:32, marginTop:8, lineHeight:1 }}>{value}</div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)', marginTop:6, letterSpacing:0.06 }}>{sub}</div>
    </div>
  );
};

/* ─────────────── Calendar ─────────────── */
const CalendarScreen = ({ state, openTask }) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dates = [19,20,21,22,23,24,25];
  const [selDay, setSelDay] = React.useState(0);
  const events = CAL_EVENTS.filter(e => e.day === selDay);

  return (
    <div style={{ background:'var(--paper)', minHeight:'100%', paddingBottom:32 }}>
      <div style={{ padding:'18px 22px 0' }}>
        <div className="eyebrow">April 2026</div>
        <div className="t-display" style={{ fontSize:36, marginTop:6 }}>
          This <em>week</em>.
        </div>
      </div>

      {/* Week strip */}
      <div style={{ padding:'24px 22px 0', display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
        {days.map((d, i) => {
          const active = i === selDay;
          const has = CAL_EVENTS.some(e => e.day === i);
          return (
            <button key={i} onClick={() => setSelDay(i)} style={{
              padding:'10px 0', borderRadius:10,
              background: active ? 'var(--ink)' : 'var(--paper-2)',
              color: active ? 'var(--paper)' : 'var(--ink)',
              border:'1px solid', borderColor: active ? 'var(--ink)' : 'var(--rule)',
              display:'flex', flexDirection:'column', alignItems:'center', gap:4,
            }}>
              <div style={{ fontSize:9, fontFamily:'var(--font-mono)', opacity:0.7, letterSpacing:0.1 }}>
                {d.toUpperCase()}
              </div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:18 }}>{dates[i]}</div>
              {has && <div style={{ width:4, height:4, borderRadius:'50%',
                background: active ? 'var(--paper)' : 'var(--accent)' }}/>}
            </button>
          );
        })}
      </div>

      {/* Day timeline */}
      <div style={{ padding:'24px 22px 0' }}>
        <SectionHeader title={days[selDay] + ' · ' + dates[selDay]} sub={`${events.length} item${events.length===1?'':'s'}`} />
        <div style={{ marginTop:14 }}>
          {events.length === 0 && (
            <div style={{ padding:'40px 0', textAlign:'center', color:'var(--ink-3)', fontStyle:'italic',
              fontFamily:'var(--font-display)', fontSize:18 }}>
              A clear day. ✓
            </div>
          )}
          {events.map((e, i) => {
            const cat = CATEGORIES.find(c => c.id === e.cat);
            const I = Icons[cat.icon];
            return (
              <div key={i} style={{ display:'flex', gap:14, padding:'14px 0', borderBottom:'1px solid var(--rule)' }}>
                <div style={{ width:54, fontFamily:'var(--font-mono)', fontSize:13, color:'var(--ink-2)' }}>
                  {e.time}
                </div>
                <div style={{ width:1, background:'var(--rule)' }} />
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:10 }}>
                  <I size={14} stroke="var(--ink-3)"/>
                  <div>
                    <div style={{ fontSize:14, color:'var(--ink)' }}>{e.title}</div>
                    <div style={{ fontSize:11, color:'var(--ink-3)', fontFamily:'var(--font-mono)', marginTop:2 }}>
                      {cat.name}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Month mini-grid */}
      <div style={{ padding:'28px 22px 0' }}>
        <SectionHeader title="April overview" sub="density" />
        <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <div key={i} style={{ textAlign:'center', fontSize:9, color:'var(--ink-3)',
              fontFamily:'var(--font-mono)', padding:'4px 0' }}>{d}</div>
          ))}
          {Array.from({ length:30 }).map((_, i) => {
            const v = Math.random();
            const today = i === 18;
            return (
              <div key={i} style={{
                aspectRatio:'1', borderRadius:6, display:'flex',
                alignItems:'center', justifyContent:'center',
                fontSize:11, fontFamily:'var(--font-mono)',
                background: today ? 'var(--ink)' : `color-mix(in oklch, var(--accent) ${v*60}%, var(--paper-2))`,
                color: today ? 'var(--paper)' : 'var(--ink-2)',
                border: today ? '1px solid var(--ink)' : '1px solid var(--rule)',
              }}>{i+1}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ─────────────── Weekly Review ─────────────── */
const ReviewScreen = ({ state }) => (
  <div style={{ background:'var(--paper)', minHeight:'100%', paddingBottom:32 }}>
    <div style={{ padding:'18px 22px 0' }}>
      <div className="eyebrow">Sunday review · Week 16</div>
      <div className="t-display" style={{ fontSize:36, marginTop:6 }}>
        Begin with the <em>end</em> in mind.
      </div>
    </div>

    {/* Numbers */}
    <div style={{ margin:'24px 22px 0', padding:20, borderRadius:16,
      background:'var(--ink)', color:'var(--paper)' }}>
      <div style={{ display:'flex', justifyContent:'space-around', textAlign:'center' }}>
        {[
          { v:'42', l:'COMPLETED' },
          { v:'8', l:'CARRIED OVER' },
          { v:'6h', l:'IN FOCUS' },
        ].map((x,i) => (
          <div key={i}>
            <div className="t-display" style={{ fontSize:36 }}>{x.v}</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:9, opacity:0.7, letterSpacing:0.1, marginTop:4 }}>{x.l}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Wins */}
    <div style={{ padding:'24px 22px 0' }}>
      <SectionHeader title="Three wins" sub="What went well?" />
      <div style={{ marginTop:14 }}>
        {[
          'Held the 21-day Spanish streak.',
          'Filed the Q1 expense report a week early.',
          'Finally booked the GP appointment.',
        ].map((w, i) => (
          <div key={i} style={{ display:'flex', gap:14, padding:'14px 0', borderBottom:'1px solid var(--rule)' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:24, color:'var(--accent)', fontStyle:'italic',
              width:24, textAlign:'right' }}>{i+1}</div>
            <div className="t-display" style={{ fontSize:18, lineHeight:1.3 }}>{w}</div>
          </div>
        ))}
        <button style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 0',
          color:'var(--ink-3)', fontSize:13 }}>
          <Icons.plus size={14}/> Add a win
        </button>
      </div>
    </div>

    {/* Reflection */}
    <div style={{ padding:'24px 22px 0' }}>
      <SectionHeader title="One reflection" sub="In your words" />
      <div style={{ marginTop:14, padding:18, borderRadius:14,
        background:'var(--paper-2)', border:'1px solid var(--rule)' }}>
        <div className="t-display t-italic" style={{ fontSize:18, lineHeight:1.4, color:'var(--ink-2)' }}>
          “Smaller, more frequent reviews seem to be working — the Sunday hour is becoming sacred.”
        </div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)', marginTop:10, letterSpacing:0.08 }}>
          — APR 12 · LAST WEEK
        </div>
      </div>
    </div>

    {/* Carry-over */}
    <div style={{ padding:'24px 22px 0' }}>
      <SectionHeader title="Carry into next week" sub="3 unfinished — keep, drop, or schedule?" />
      <div style={{ marginTop:8 }}>
        {state.tasks.filter(t => !t.done).slice(0, 3).map(t => (
          <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 0', borderBottom:'1px solid var(--rule)' }}>
            <div style={{ flex:1, fontSize:14 }}>{t.title}</div>
            <button style={pillBtn()}>Keep</button>
            <button style={pillBtn()}>Drop</button>
          </div>
        ))}
      </div>
    </div>

    {/* Quote */}
    <div style={{ margin:'28px 22px 0', padding:18, borderRadius:14,
      background:'var(--accent-soft)' }}>
      <div className="eyebrow" style={{ color:'var(--ink-2)' }}>For next week</div>
      <div className="t-display t-italic" style={{ fontSize:20, marginTop:8, lineHeight:1.3 }}>
        “Things which matter most must never be at the mercy of things which matter least.”
      </div>
      <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-2)', marginTop:8 }}>— GOETHE</div>
    </div>
  </div>
);

const pillBtn = () => ({
  padding:'6px 12px', borderRadius:999, border:'1px solid var(--rule)',
  fontSize:11, color:'var(--ink-2)', fontFamily:'var(--font-mono)', letterSpacing:0.04,
  background:'var(--paper)',
});

/* ─────────────── Add (capture) ─────────────── */
const AddScreen = ({ onClose, onAdd }) => {
  const [text, setText] = React.useState('');
  const [parsed, setParsed] = React.useState(null);

  React.useEffect(() => {
    if (!text.trim()) { setParsed(null); return; }
    // naive NL parse
    const eff = /gargantuan|all.?week|week.?long/i.test(text) ? 'xxl'
      : /mammoth|all.?day|full.?day|8.?hour/i.test(text) ? 'xl'
      : /large|long|hour|deep.?clean|project/i.test(text) ? 'l'
      : /quick|short|small|min|micro|tiny/i.test(text) ? 's'
      : 'm';
    const cat = /gym|walk|run|health|workout/i.test(text) ? 'health'
      : /pay|bill|tax|budget|invoice/i.test(text) ? 'finance'
      : /work|email|meeting|okr|deck/i.test(text) ? 'work'
      : /read|learn|course|study/i.test(text) ? 'learning'
      : /mum|dad|family|kids/i.test(text) ? 'family'
      : 'home';
    const due = /weekly|every week/i.test(text) ? 'Weekly'
      : /daily|every day/i.test(text) ? 'Daily'
      : /tomorrow/i.test(text) ? 'Tomorrow'
      : /today/i.test(text) ? 'Today' : 'Today';
    setParsed({ eff, cat, due });
  }, [text]);

  return (
    <div style={{ height:'100%', background:'var(--paper)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <button onClick={onClose} style={{ color:'var(--ink-2)', fontSize:13 }}>Cancel</button>
        <div className="eyebrow">Capture</div>
        <button onClick={() => { onAdd(text, parsed); onClose(); }} disabled={!text.trim()}
          style={{ color: text.trim() ? 'var(--accent)' : 'var(--ink-3)', fontSize:13, fontWeight:600 }}>
          Save
        </button>
      </div>

      <div style={{ padding:'24px 22px 0', flex:1 }}>
        <div className="t-display" style={{ fontSize:30, lineHeight:1.1 }}>
          What's on your mind?
        </div>
        <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:8 }}>
          Type naturally — “weekly gym, medium” works.
        </div>

        <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
          placeholder="e.g. Pay the council rates by Friday"
          style={{ width:'100%', marginTop:24, minHeight:90, border:'none', background:'transparent',
            outline:'none', resize:'none', fontFamily:'var(--font-display)', fontSize:24,
            color:'var(--ink)', lineHeight:1.3 }} />

        {parsed && (
          <div style={{ marginTop:18, padding:14, borderRadius:12, background:'var(--paper-2)', border:'1px solid var(--rule)' }}>
            <div className="eyebrow" style={{ marginBottom:10 }}>I read this as</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <Chip>{CATEGORIES.find(c=>c.id===parsed.cat).name}</Chip>
              <Chip>{(EFFORT[parsed.eff]||EFFORT.m).label} · {(EFFORT[parsed.eff]||EFFORT.m).range}</Chip>
              <Chip warn>Due {parsed.due}</Chip>
            </div>
            <div style={{ marginTop:10, fontSize:11, color:'var(--ink-3)', fontStyle:'italic',
              fontFamily:'var(--font-display)' }}>
              tap any chip to change
            </div>
          </div>
        )}
      </div>

      {/* Voice */}
      <div style={{ padding:'18px', display:'flex', justifyContent:'center' }}>
        <button style={{
          width:64, height:64, borderRadius:'50%', background:'var(--ink)', color:'var(--paper)',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'var(--shadow-pop)',
        }}>
          <Icons.mic size={26} />
        </button>
      </div>
      <div style={{ textAlign:'center', fontSize:10, color:'var(--ink-3)',
        fontFamily:'var(--font-mono)', letterSpacing:0.1, paddingBottom:14 }}>
        TAP TO DICTATE
      </div>
    </div>
  );
};

/* ─────────────── Inbox (incl. RSS) ─────────────── */
const InboxScreen = ({ onClose }) => (
  <div style={{ height:'100%', background:'var(--paper)', display:'flex', flexDirection:'column' }}>
    <div style={{ padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <button onClick={onClose} style={{ color:'var(--ink-2)', fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
        <Icons.back size={14}/> Back
      </button>
      <div className="eyebrow">Inbox · GTD capture</div>
      <Icons.settings size={16} stroke="var(--ink-3)"/>
    </div>
    <div style={{ padding:'8px 22px 0' }}>
      <div className="t-display" style={{ fontSize:34, marginTop:8 }}>
        Five things to <em>process</em>.
      </div>
    </div>

    <div style={{ flex:1, padding:'18px 22px 0', overflowY:'auto' }}>
      {INBOX_ITEMS.map(item => (
        <div key={item.id} style={{ padding:'16px 0', borderBottom:'1px solid var(--rule)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            {item.kind === 'rss' && <Icons.rss size={11} stroke="var(--accent)"/>}
            {item.kind === 'capture' && <Icons.edit size={11} stroke="var(--ink-3)"/>}
            {item.kind === 'email' && <Icons.inbox size={11} stroke="var(--ink-3)"/>}
            <span className="eyebrow">{item.kind === 'rss' ? item.source : item.kind}</span>
            <span style={{ flex:1 }}/>
            <span style={{ fontSize:10, color:'var(--ink-3)', fontFamily:'var(--font-mono)' }}>{item.when}</span>
          </div>
          <div style={{ fontSize:14, color:'var(--ink)', lineHeight:1.4 }}>{item.text}</div>
          <div style={{ marginTop:10, display:'flex', gap:6 }}>
            <button style={pillBtn()}>→ Task</button>
            <button style={pillBtn()}>Read later</button>
            <button style={pillBtn()}>Archive</button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

Object.assign(window, {
  TaskDetail, ProgressScreen, CalendarScreen, ReviewScreen, AddScreen, InboxScreen,
  PomodoroRing, EisenhowerMatrix, BigStat, Chip, Section,
});
