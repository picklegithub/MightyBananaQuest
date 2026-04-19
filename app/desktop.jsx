// Life Admin — Desktop web (browser frame contents)

const DesktopApp = ({ state, intensity }) => {
  const [tab, setTab] = React.useState('today');
  const [selTaskId, setSelTaskId] = React.useState('t7'); // OKR proposal — has subtasks
  const sel = state.tasks.find(t => t.id === selTaskId);

  const sidebarItems = [
    { id:'today', label:'Today', icon:'home' },
    { id:'inbox', label:'Inbox', icon:'inbox', badge:5 },
    { id:'calendar', label:'Calendar', icon:'calendar' },
    { id:'progress', label:'Progress', icon:'chart' },
    { id:'review', label:'Review', icon:'sparkle' },
  ];

  return (
    <div style={{ display:'flex', height:'100%', background:'var(--paper)', color:'var(--ink)',
      fontFamily:'var(--font-ui)' }}>

      {/* SIDEBAR */}
      <div style={{ width:240, borderRight:'1px solid var(--rule)', display:'flex', flexDirection:'column',
        background:'var(--paper-2)' }}>
        <div style={{ padding:'22px 22px 14px' }}>
          <div className="t-display" style={{ fontSize:24 }}>
            Life <em style={{ color:'var(--accent)' }}>Admin</em>
          </div>
          <div className="eyebrow" style={{ marginTop:4 }}>v 1.0 · Sun 19 Apr</div>
        </div>

        <div style={{ padding:'4px 12px', flex:1 }}>
          {sidebarItems.map(it => {
            const I = Icons[it.icon];
            const active = tab === it.id;
            return (
              <button key={it.id} onClick={() => setTab(it.id)} style={{
                width:'100%', display:'flex', alignItems:'center', gap:10,
                padding:'9px 12px', borderRadius:8, marginBottom:2,
                background: active ? 'var(--paper)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--ink-2)',
                boxShadow: active ? 'var(--shadow-1)' : 'none',
              }}>
                <I size={15} />
                <span style={{ flex:1, textAlign:'left', fontSize:13, fontWeight: active ? 500 : 400 }}>{it.label}</span>
                {it.badge && <span style={{ fontSize:10, fontFamily:'var(--font-mono)',
                  padding:'1px 6px', borderRadius:6, background:'var(--accent-soft)', color:'var(--ink)' }}>{it.badge}</span>}
              </button>
            );
          })}

          <div className="eyebrow" style={{ padding:'18px 12px 8px' }}>Areas</div>
          {CATEGORIES.map(c => {
            const I = Icons[c.icon];
            const open = state.tasks.filter(t => t.cat === c.id && !t.done).length;
            return (
              <button key={c.id} onClick={() => setTab(`cat:${c.id}`)} style={{
                width:'100%', display:'flex', alignItems:'center', gap:10,
                padding:'8px 12px', borderRadius:8, color:'var(--ink-2)',
                background: tab === `cat:${c.id}` ? 'var(--paper)' : 'transparent',
              }}>
                <I size={14}/>
                <span style={{ flex:1, textAlign:'left', fontSize:13 }}>{c.name}</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)' }}>{open}</span>
              </button>
            );
          })}
        </div>

        <div style={{ padding:14, borderTop:'1px solid var(--rule)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--paper-3)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'var(--font-display)', fontSize:14 }}>A</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:500 }}>Alex</div>
              <div style={{ fontSize:10, color:'var(--ink-3)', fontFamily:'var(--font-mono)' }}>LVL 12 · {state.xp.toLocaleString()} XP</div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        {/* topbar */}
        <div style={{ height:54, borderBottom:'1px solid var(--rule)', display:'flex', alignItems:'center',
          padding:'0 22px', gap:14 }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8,
            padding:'7px 12px', borderRadius:8, background:'var(--paper-2)', maxWidth:360 }}>
            <Icons.search size={13} stroke="var(--ink-3)"/>
            <input placeholder="Search or capture (try: weekly gym, medium)"
              style={{ border:'none', outline:'none', background:'transparent', flex:1, fontSize:12 }} />
            <span style={{ fontFamily:'var(--font-mono)', fontSize:9, color:'var(--ink-3)',
              padding:'2px 5px', border:'1px solid var(--rule)', borderRadius:4 }}>⌘K</span>
          </div>
          <div style={{ flex:1 }} />
          {intensity !== 'subtle' && (
            <div style={{ display:'flex', gap:14 }}>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, color:'var(--ink-2)' }}>
                <Icons.flame size={13}/> {state.streak} days
              </span>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, color:'var(--ink-2)' }}>
                <Icons.bolt size={13}/> {state.xp.toLocaleString()} XP
              </span>
            </div>
          )}
          <button style={{ padding:'7px 14px', borderRadius:8, background:'var(--ink)', color:'var(--paper)',
            fontSize:12, fontWeight:500, display:'inline-flex', alignItems:'center', gap:6 }}>
            <Icons.plus size={13}/> New
          </button>
        </div>

        {/* content: Today view */}
        <div style={{ flex:1, display:'flex', minHeight:0 }}>
          {/* List column */}
          <div style={{ flex:1, padding:'24px 28px', overflowY:'auto', borderRight:'1px solid var(--rule)' }}>
            <div className="eyebrow">Sunday · 19 April</div>
            <div className="t-display" style={{ fontSize:38, marginTop:6, lineHeight:1.05 }}>
              Good morning, Alex.
            </div>
            <div style={{ marginTop:6, fontSize:13, color:'var(--ink-2)' }}>
              {state.tasks.filter(t => t.due==='Today' && !t.done).length} open today · 6h focus planned
            </div>

            {/* progress strip */}
            <div style={{ marginTop:22, padding:18, borderRadius:14, background:'var(--ink)', color:'var(--paper)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div className="eyebrow" style={{ color:'rgba(255,255,255,0.5)' }}>Today</div>
                  <div className="t-display" style={{ fontSize:36, marginTop:4 }}>
                    {state.tasks.filter(t => t.due==='Today' && t.done).length}
                    <span style={{ opacity:0.5, fontSize:22 }}> / {state.tasks.filter(t=>t.due==='Today').length}</span>
                  </div>
                </div>
                {intensity !== 'subtle' && (
                  <div style={{ display:'flex', gap:24 }}>
                    {[
                      { l:'STREAK', v:state.streak, i:'flame' },
                      { l:'LVL', v:'12', i:'sparkle' },
                      { l:'NEXT LVL', v:`${1000-(state.xp%1000)} XP`, i:'bolt' },
                    ].map((x,i) => {
                      const I = Icons[x.i];
                      return (
                        <div key={i} style={{ textAlign:'right' }}>
                          <div style={{ display:'inline-flex', alignItems:'center', gap:4,
                            fontFamily:'var(--font-mono)', fontSize:14 }}>
                            <I size={12}/> {x.v}
                          </div>
                          <div style={{ fontFamily:'var(--font-mono)', fontSize:9, opacity:0.6, marginTop:3, letterSpacing:0.1 }}>{x.l}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ marginTop:14, height:3, background:'rgba(255,255,255,0.12)', borderRadius:2 }}>
                <div style={{ width:'42%', height:'100%', background:'var(--accent-soft)' }}/>
              </div>
            </div>

            {/* Section: today */}
            <div style={{ marginTop:28 }}>
              <SectionHeader title="Today" sub="up next" />
              <div>
                {state.tasks.filter(t => t.due === 'Today').map(t => (
                  <DesktopRow key={t.id} t={t} sel={selTaskId === t.id}
                    onSel={() => setSelTaskId(t.id)}
                    onComplete={(e) => state.completeTask(t.id, e)} />
                ))}
              </div>
            </div>

            <div style={{ marginTop:28 }}>
              <SectionHeader title="Tomorrow" sub="" />
              <div>
                {state.tasks.filter(t => t.due === 'Tomorrow').map(t => (
                  <DesktopRow key={t.id} t={t} sel={selTaskId === t.id}
                    onSel={() => setSelTaskId(t.id)}
                    onComplete={(e) => state.completeTask(t.id, e)} />
                ))}
              </div>
            </div>

            <div style={{ marginTop:28 }}>
              <SectionHeader title="This week" sub="" />
              <div>
                {state.tasks.filter(t => !['Today','Tomorrow'].includes(t.due)).slice(0, 6).map(t => (
                  <DesktopRow key={t.id} t={t} sel={selTaskId === t.id}
                    onSel={() => setSelTaskId(t.id)}
                    onComplete={(e) => state.completeTask(t.id, e)} />
                ))}
              </div>
            </div>
          </div>

          {/* Detail column */}
          {sel && (
            <div style={{ width:380, padding:'24px 24px', overflowY:'auto', background:'var(--paper-2)' }}>
              <DesktopDetail t={sel} state={state} intensity={intensity}/>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DesktopRow = ({ t, sel, onSel, onComplete }) => {
  const cat = CATEGORIES.find(c => c.id === t.cat);
  const I = Icons[cat.icon];
  return (
    <div onClick={onSel} style={{
      display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
      borderRadius:8, cursor:'pointer', marginTop:2,
      background: sel ? 'var(--paper-3)' : 'transparent',
      opacity: t.done ? 0.5 : 1,
    }}>
      <button onClick={(e) => { e.stopPropagation(); onComplete(e); }} style={{
        width:18, height:18, borderRadius:'50%', flexShrink:0,
        border:`1.5px solid ${t.done ? 'var(--accent)' : 'var(--ink-3)'}`,
        background: t.done ? 'var(--accent)' : 'transparent',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>{t.done && <Icons.check size={10} sw={2.5} stroke="var(--paper)" />}</button>

      <I size={13} stroke="var(--ink-3)" />

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:500,
          textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</div>
      </div>

      <span style={{ fontSize:10, color:'var(--ink-3)', fontFamily:'var(--font-mono)' }}>{t.ctx}</span>
      <EffortPip effort={t.effort} mono />
      {t.streak > 0 && (
        <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, color:'var(--accent)',
          fontFamily:'var(--font-mono)' }}>
          <Icons.flame size={10}/>{t.streak}
        </span>
      )}
      <span style={{ fontSize:10, color: t.quad === 'q1' ? 'var(--warn)' : 'var(--ink-3)',
        fontFamily:'var(--font-mono)', width:62, textAlign:'right' }}>{t.due}</span>
    </div>
  );
};

const DesktopDetail = ({ t, state, intensity }) => {
  const cat = CATEGORIES.find(c => c.id === t.cat);
  const I = Icons[cat.icon];
  const total = EFFORT[t.effort].mins * 60;
  const [secs, setSecs] = React.useState(total);
  const [running, setRunning] = React.useState(false);
  React.useEffect(() => { setSecs(EFFORT[t.effort].mins*60); setRunning(false); }, [t.id, t.effort]);
  React.useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecs(s => Math.max(0, s-1)), 1000);
    return () => clearInterval(id);
  }, [running]);
  const pct = ((total - secs) / total) * 100;
  const mm = String(Math.floor(secs/60)).padStart(2,'0');
  const ss = String(secs%60).padStart(2,'0');
  const subDone = t.sub.filter(s => s.d).length;

  return (
    <div>
      <div className="eyebrow" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
        <I size={11}/> {cat.name} · {t.recurring || 'one-off'}
      </div>
      <div className="t-display" style={{ fontSize:26, marginTop:8, lineHeight:1.15 }}>{t.title}</div>

      <div style={{ marginTop:14, display:'flex', flexWrap:'wrap', gap:6 }}>
        <Chip>{t.ctx}</Chip>
        <Chip>{EFFORT[t.effort].label}</Chip>
        <Chip warn={t.quad==='q1'}>{t.due}</Chip>
        {t.streak > 0 && <Chip accent><Icons.flame size={10}/>{t.streak}d</Chip>}
      </div>

      {/* Pomodoro compact */}
      <div style={{ marginTop:18, padding:18, borderRadius:14, background:'var(--ink)', color:'var(--paper)',
        display:'flex', alignItems:'center', gap:18 }}>
        <div style={{ position:'relative', width:90, height:90 }}>
          <svg width="90" height="90" style={{ transform:'rotate(-90deg)' }}>
            <circle cx="45" cy="45" r="38" stroke="rgba(255,255,255,0.12)" strokeWidth="2" fill="none"/>
            <circle cx="45" cy="45" r="38" stroke="var(--accent-soft)" strokeWidth="2.5" fill="none"
              strokeDasharray={2*Math.PI*38} strokeDashoffset={(2*Math.PI*38)*(1 - pct/100)}
              strokeLinecap="round" style={{ transition:'stroke-dashoffset 1s linear' }}/>
          </svg>
          <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'var(--font-display)', fontSize:22, fontFeatureSettings:"'tnum'" }}>
            {mm}:{ss}
          </div>
        </div>
        <div style={{ flex:1 }}>
          <div className="eyebrow" style={{ color:'rgba(255,255,255,0.55)' }}>Focus</div>
          <div style={{ fontSize:13, marginTop:6, opacity:0.8 }}>
            {EFFORT[t.effort].mins}-min Pomodoro · +{EFFORT[t.effort].xp} XP
          </div>
          <div style={{ marginTop:10, display:'flex', gap:8 }}>
            <button onClick={() => setRunning(r => !r)} style={{
              padding:'7px 14px', borderRadius:999, background:'var(--paper)', color:'var(--ink)',
              fontSize:12, fontWeight:500, display:'inline-flex', alignItems:'center', gap:6,
            }}>
              {running ? <Icons.pause size={12}/> : <Icons.play size={12}/>}
              {running ? 'Pause' : 'Start'}
            </button>
            <button onClick={() => { setSecs(total); setRunning(false); }} style={{
              padding:'7px 12px', borderRadius:999, color:'var(--paper)',
              border:'1px solid rgba(255,255,255,0.2)', fontSize:12,
            }}>
              <Icons.reset size={12}/>
            </button>
          </div>
        </div>
      </div>

      {/* Steps */}
      {t.sub.length > 0 && (
        <div style={{ marginTop:18 }}>
          <SectionHeader title="Steps" sub={`${subDone}/${t.sub.length}`}/>
          <div style={{ marginTop:6 }}>
            {t.sub.map((s, i) => (
              <div key={i} onClick={() => state.toggleSub(t.id, i)} style={{
                display:'flex', alignItems:'center', gap:10, padding:'9px 0',
                borderBottom:'1px solid var(--rule)', cursor:'pointer'
              }}>
                <div style={{ width:14, height:14, borderRadius:4, flexShrink:0,
                  border:`1.5px solid ${s.d ? 'var(--accent)' : 'var(--ink-3)'}`,
                  background: s.d ? 'var(--accent)' : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {s.d && <Icons.check size={9} sw={2.5} stroke="var(--paper)" />}
                </div>
                <div style={{ fontSize:13, color: s.d ? 'var(--ink-3)' : 'var(--ink)',
                  textDecoration: s.d ? 'line-through' : 'none' }}>{s.t}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini matrix */}
      <div style={{ marginTop:18 }}>
        <SectionHeader title="Priority" sub="7 Habits matrix"/>
        <div style={{ marginTop:10, display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
          {['q1','q2','q3','q4'].map(q => {
            const labels = { q1:'Do', q2:'Schedule', q3:'Delegate', q4:'Drop' };
            const active = q === t.quad;
            return (
              <div key={q} style={{
                padding:'10px 12px', borderRadius:8,
                background: active ? 'var(--ink)' : 'var(--paper)',
                color: active ? 'var(--paper)' : 'var(--ink-2)',
                border:'1px solid', borderColor: active ? 'var(--ink)' : 'var(--rule)',
                fontFamily:'var(--font-display)', fontSize:14, fontStyle:'italic',
              }}>{labels[q]}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { DesktopApp });
