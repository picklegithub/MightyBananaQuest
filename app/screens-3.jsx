// Life Admin — extra screens: Goals, Journal (5-min), All Tasks

/* ─────────────── Goals ─────────────── */
const GoalsScreen = ({ state, openTask, intensity }) => {
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState({ title:'', area:'health', horizon:'12 weeks', why:'' });
  const submit = () => {
    if (!draft.title.trim()) return;
    state.addGoal({ id:'g_'+Date.now(), title:draft.title, area:draft.area, horizon:draft.horizon, why:draft.why, progress:0, linked:[] });
    setDraft({ title:'', area:'health', horizon:'12 weeks', why:'' });
    setAdding(false);
  };
  return (
    <div style={{ background:'var(--paper)', minHeight:'100%', paddingBottom:32 }}>
      <div style={{ padding:'18px 22px 0' }}>
        <div className="eyebrow">Goals · begin with the end in mind</div>
        <div className="t-display" style={{ fontSize:36, marginTop:6 }}>
          What you're <em>aiming</em> at.
        </div>
        <div style={{ fontSize:13, color:'var(--ink-2)', marginTop:8, lineHeight:1.5 }}>
          A goal lives above the tasks. Link any task to one — your daily work compounds toward something.
        </div>
      </div>

      <div style={{ padding:'24px 22px 0' }}>
        <SectionHeader title="In motion" sub={`${state.goals.length} active`}/>
        <div style={{ marginTop:12 }}>
          {state.goals.map(g => {
            const cat = state.categories.find(c => c.id === g.area) || CATEGORIES[0];
            const I = Icons[cat.icon] || Icons.sparkle;
            const linked = state.tasks.filter(t => g.linked.includes(t.id));
            return (
              <div key={g.id} style={{ padding:'18px 0', borderBottom:'1px solid var(--rule)' }}>
                <div className="eyebrow" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                  <I size={11}/> {cat.name} · {g.horizon}
                </div>
                <div className="t-display" style={{ fontSize:22, marginTop:6, lineHeight:1.2 }}>
                  {g.title}
                </div>
                {g.why && (
                  <div className="t-display t-italic" style={{ fontSize:14, color:'var(--ink-2)', marginTop:6, lineHeight:1.4 }}>
                    “{g.why}”
                  </div>
                )}
                <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ flex:1, height:4, background:'var(--paper-3)', borderRadius:2 }}>
                    <div style={{ width:`${g.progress*100}%`, height:'100%', background:'var(--accent)', borderRadius:2 }}/>
                  </div>
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-2)' }}>
                    {Math.round(g.progress*100)}%
                  </span>
                </div>
                {linked.length > 0 && (
                  <div style={{ marginTop:12, paddingLeft:10, borderLeft:'2px solid var(--rule)' }}>
                    <div className="eyebrow" style={{ marginBottom:6 }}>Linked tasks · {linked.length}</div>
                    {linked.map(t => (
                      <div key={t.id} onClick={() => openTask && openTask(t)} style={{
                        display:'flex', alignItems:'center', gap:8, padding:'6px 0', cursor:'pointer',
                        fontSize:13, color: t.done ? 'var(--ink-3)' : 'var(--ink)',
                        textDecoration: t.done ? 'line-through' : 'none',
                      }}>
                        <span style={{ width:5, height:5, borderRadius:'50%',
                          background: t.done ? 'var(--accent)' : 'var(--ink-3)' }}/>
                        <span style={{ flex:1 }}>{t.title}</span>
                        <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)' }}>{t.due}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!adding && (
          <button onClick={() => setAdding(true)} style={{
            width:'100%', marginTop:16, padding:'14px', borderRadius:14,
            background:'transparent', border:'1px dashed var(--rule)', color:'var(--ink-2)',
            fontSize:13, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
          }}>
            <Icons.plus size={14}/> Set a new goal
          </button>
        )}

        {adding && (
          <div style={{ marginTop:16, padding:16, borderRadius:14,
            background:'var(--paper-2)', border:'1px solid var(--ink)' }}>
            <div className="eyebrow" style={{ marginBottom:8 }}>New goal</div>
            <input autoFocus value={draft.title} onChange={e => setDraft({...draft, title:e.target.value})}
              placeholder="What does success look like?"
              style={{ width:'100%', border:'none', outline:'none', background:'transparent',
                fontFamily:'var(--font-display)', fontSize:22, color:'var(--ink)' }}/>
            <input value={draft.why} onChange={e => setDraft({...draft, why:e.target.value})}
              placeholder="Why does this matter?"
              style={{ width:'100%', marginTop:8, border:'none', outline:'none', background:'transparent',
                fontFamily:'var(--font-display)', fontStyle:'italic', fontSize:14, color:'var(--ink-2)' }}/>

            <div style={{ marginTop:14, display:'flex', gap:6, flexWrap:'wrap' }}>
              {state.categories.map(c => {
                const on = draft.area === c.id;
                return (
                  <button key={c.id} onClick={() => setDraft({...draft, area:c.id})} style={{
                    padding:'6px 10px', borderRadius:999, fontSize:11,
                    background: on ? 'var(--ink)' : 'transparent',
                    color: on ? 'var(--paper)' : 'var(--ink-2)',
                    border:'1px solid', borderColor: on ? 'var(--ink)' : 'var(--rule)',
                  }}>{c.name}</button>
                );
              })}
            </div>

            <div style={{ marginTop:10, display:'flex', gap:6 }}>
              {['4 weeks','12 weeks','6 months','2026','Ongoing'].map(h => {
                const on = draft.horizon === h;
                return (
                  <button key={h} onClick={() => setDraft({...draft, horizon:h})} style={{
                    padding:'6px 10px', borderRadius:6, fontSize:10, fontFamily:'var(--font-mono)',
                    background: on ? 'var(--paper-3)' : 'transparent',
                    color: on ? 'var(--ink)' : 'var(--ink-3)',
                    border:'1px solid var(--rule)',
                  }}>{h}</button>
                );
              })}
            </div>

            <div style={{ marginTop:14, display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={() => setAdding(false)} style={{ padding:'8px 14px', fontSize:12, color:'var(--ink-3)' }}>Cancel</button>
              <button onClick={submit} disabled={!draft.title.trim()} style={{
                padding:'8px 16px', borderRadius:999, background:'var(--accent)', color:'var(--paper)',
                fontSize:12, fontWeight:500, opacity: draft.title.trim() ? 1 : 0.4,
              }}>Set goal</button>
            </div>
          </div>
        )}
      </div>

      {/* Quote */}
      <div style={{ margin:'28px 22px 0', padding:18, borderRadius:14,
        background:'var(--accent-soft)' }}>
        <div className="t-display t-italic" style={{ fontSize:18, lineHeight:1.4 }}>
          “People don't decide their futures, they decide their habits. Their habits decide their futures.”
        </div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-2)', marginTop:8 }}>— F. M. ALEXANDER</div>
      </div>
    </div>
  );
};

/* ─────────────── Journal (5-min, AM/PM) ─────────────── */
const JournalScreen = ({ state, intensity, initialPhase = 'morning' }) => {
  const [phase, setPhase] = React.useState(initialPhase); // morning | evening | history
  const [m, setM] = React.useState({ g1:'', g2:'', g3:'', intention:'', p1:'', p2:'', p3:'' });
  const [e, setE] = React.useState({ win:'', diff:'', lesson:'', tomorrow:'' });

  return (
    <div style={{ background:'var(--paper)', minHeight:'100%', paddingBottom:32, display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'18px 22px 0' }}>
        <div className="eyebrow">Journal · five minutes</div>
        <div className="t-display" style={{ fontSize:36, marginTop:6, lineHeight:1.05 }}>
          {phase === 'morning' && <>A <em>quiet</em> beginning.</>}
          {phase === 'evening' && <>Today, <em>reviewed</em>.</>}
          {phase === 'history' && <>Pages <em>written</em>.</>}
        </div>
        <div style={{ fontSize:13, color:'var(--ink-2)', marginTop:8, lineHeight:1.5 }}>
          Two short rituals — morning sets direction, evening locks in learning.
        </div>
      </div>

      {/* phase switch */}
      <div style={{ padding:'18px 22px 0' }}>
        <div style={{ display:'flex', background:'var(--paper-2)', borderRadius:10, padding:3, gap:2 }}>
          {[
            { id:'morning', label:'Morning', icon:'sun' },
            { id:'evening', label:'Evening', icon:'moon' },
            { id:'history', label:'Past', icon:'journal' },
          ].map(it => {
            const I = Icons[it.icon];
            const on = phase === it.id;
            return (
              <button key={it.id} onClick={() => setPhase(it.id)} style={{
                flex:1, padding:'10px 8px', borderRadius:8, fontSize:12, fontWeight: on ? 600 : 400,
                background: on ? 'var(--paper)' : 'transparent',
                color: on ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: on ? 'var(--shadow-1)' : 'none',
                display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
              }}>
                <I size={13}/> {it.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* MORNING */}
      {phase === 'morning' && (
        <div style={{ padding:'24px 22px 0' }}>
          <Prompt num="01" label="Three things I'm grateful for"
            help="Small or large. Specific lands deeper.">
            {[1,2,3].map(i => (
              <PromptInput key={i} value={m['g'+i]} onChange={v => setM({...m, ['g'+i]:v})}
                placeholder={[
                  'a warm coffee, a quiet flat…',
                  'last week\u2019s long walk',
                  'someone who answered quickly'
                ][i-1]}
                inline number={i}/>
            ))}
          </Prompt>

          <Prompt num="02" label="Today's intention"
            help="One sentence. How will I show up?">
            <PromptInput value={m.intention} onChange={v => setM({...m, intention:v})}
              placeholder="Move with patience, not urgency." big/>
          </Prompt>

          <Prompt num="03" label="The three priorities"
            help="If only these three, the day was good.">
            {[1,2,3].map(i => (
              <PromptInput key={i} value={m['p'+i]} onChange={v => setM({...m, ['p'+i]:v})}
                placeholder={['First thing','Second thing','Third thing'][i-1]}
                inline number={i} mono/>
            ))}
          </Prompt>

          <button style={saveBtn()}>
            <Icons.sun size={14}/> Save morning entry
          </button>
        </div>
      )}

      {/* EVENING */}
      {phase === 'evening' && (
        <div style={{ padding:'24px 22px 0' }}>
          <Prompt num="01" label="Today's win"
            help="The one moment to celebrate, however small.">
            <PromptInput value={e.win} onChange={v => setE({...e, win:v})}
              placeholder="Held the breath practice through the call." big/>
          </Prompt>

          <Prompt num="02" label="What would I do differently?"
            help="Without judgement. Just notice.">
            <PromptInput value={e.diff} onChange={v => setE({...e, diff:v})}
              placeholder="Started the gym session earlier." big/>
          </Prompt>

          <Prompt num="03" label="Key lesson learnt"
            help="One thread to carry forward.">
            <PromptInput value={e.lesson} onChange={v => setE({...e, lesson:v})}
              placeholder="Pauses are productive." big/>
          </Prompt>

          <Prompt num="04" label="What I'm excited about tomorrow"
            help="Anticipation primes the morning.">
            <PromptInput value={e.tomorrow} onChange={v => setE({...e, tomorrow:v})}
              placeholder="Walk before breakfast." big/>
          </Prompt>

          <button style={saveBtn()}>
            <Icons.moon size={14}/> Save evening entry
          </button>
        </div>
      )}

      {/* HISTORY */}
      {phase === 'history' && (
        <div style={{ padding:'18px 22px 0' }}>
          {state.journal.map(j => (
            <div key={j.id} style={{ padding:'18px 0', borderBottom:'1px solid var(--rule)' }}>
              <div className="eyebrow" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                {j.kind === 'morning' ? <Icons.sun size={11}/> : <Icons.moon size={11}/>}
                {j.date} · {j.kind}
              </div>
              {j.kind === 'morning' ? (
                <div style={{ marginTop:10 }}>
                  <div className="t-display t-italic" style={{ fontSize:18, lineHeight:1.4 }}>
                    “{j.intention}”
                  </div>
                  <div style={{ marginTop:10, fontSize:12, color:'var(--ink-2)', fontFamily:'var(--font-mono)' }}>
                    GRATITUDE: {j.gratitude.join(' · ')}
                  </div>
                </div>
              ) : (
                <div style={{ marginTop:10 }}>
                  <div className="t-display" style={{ fontSize:16, lineHeight:1.4 }}>
                    Win: <em>{j.win}</em>
                  </div>
                  <div style={{ marginTop:6, fontSize:13, color:'var(--ink-2)', lineHeight:1.5 }}>
                    Lesson: {j.lesson}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Streak strip */}
      <div style={{ margin:'24px 22px 0', padding:14, borderRadius:12,
        background:'var(--paper-2)', border:'1px solid var(--rule)',
        display:'flex', alignItems:'center', gap:14 }}>
        <Icons.flame size={18} stroke="var(--accent)"/>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:500 }}>12-day journal streak</div>
          <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>Both rituals, most days.</div>
        </div>
        <div style={{ display:'flex', gap:3 }}>
          {Array.from({ length:14 }).map((_, i) => (
            <div key={i} style={{ width:5, height:18, borderRadius:1,
              background: i < 12 ? 'var(--accent)' : 'var(--paper-3)' }}/>
          ))}
        </div>
      </div>
    </div>
  );
};

const Prompt = ({ num, label, help, children }) => (
  <div style={{ marginBottom:22, paddingBottom:18, borderBottom:'1px solid var(--rule)' }}>
    <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
      <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--accent)', letterSpacing:0.14 }}>{num}</span>
      <span className="t-display" style={{ fontSize:18, lineHeight:1.3 }}>{label}</span>
    </div>
    <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:4, fontStyle:'italic',
      fontFamily:'var(--font-display)', marginLeft:24 }}>{help}</div>
    <div style={{ marginTop:10, marginLeft:24 }}>{children}</div>
  </div>
);

const PromptInput = ({ value, onChange, placeholder, big, inline, number, mono }) => (
  <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:6 }}>
    {inline && (
      <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-3)', width:14, paddingTop:6 }}>
        {number}.
      </span>
    )}
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{
        flex:1, border:'none', outline:'none', background:'transparent',
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
        fontStyle: mono ? 'normal' : 'italic',
        fontSize: big ? 18 : 15,
        color:'var(--ink)',
        padding:'6px 0',
        borderBottom:'1px solid var(--rule)',
      }}/>
  </div>
);

const saveBtn = () => ({
  width:'100%', marginTop:8, padding:'14px', borderRadius:14,
  background:'var(--ink)', color:'var(--paper)', fontSize:14, fontWeight:500,
  display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
});

/* ─────────────── All Tasks (cross-area) ─────────────── */
const AllTasksScreen = ({ state, openTask, intensity }) => {
  const [filter, setFilter] = React.useState('all'); // all | open | done
  const [groupBy, setGroupBy] = React.useState('area'); // area | due | effort
  const [search, setSearch] = React.useState('');

  let filtered = state.tasks.filter(t => {
    if (filter === 'open' && t.done) return false;
    if (filter === 'done' && !t.done) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  let groups;
  if (groupBy === 'area') {
    groups = state.categories.map(c => ({
      key: c.id, label: c.name, icon: c.icon,
      items: filtered.filter(t => t.cat === c.id),
    })).filter(g => g.items.length > 0);
  } else if (groupBy === 'due') {
    const buckets = { 'Today':[], 'Tomorrow':[], 'This week':[], 'Later':[] };
    filtered.forEach(t => {
      if (t.due === 'Today') buckets['Today'].push(t);
      else if (t.due === 'Tomorrow') buckets['Tomorrow'].push(t);
      else if (['Mon','Tue','Wed','Thu','Fri','Sat','Sun','This week'].includes(t.due)) buckets['This week'].push(t);
      else buckets['Later'].push(t);
    });
    groups = Object.entries(buckets).map(([k,v]) => ({ key:k, label:k, items:v })).filter(g => g.items.length > 0);
  } else {
    groups = EFFORT_ORDER.map(eff => ({
      key:eff, label: EFFORT[eff].label + ' · ' + EFFORT[eff].range,
      items: filtered.filter(t => t.effort === eff),
    })).filter(g => g.items.length > 0);
  }

  return (
    <div style={{ background:'var(--paper)', minHeight:'100%', paddingBottom:32 }}>
      <div style={{ padding:'18px 22px 0' }}>
        <div className="eyebrow">All tasks · everything in one place</div>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:12 }}>
          <div className="t-display" style={{ fontSize:36, marginTop:6 }}>
            <em>Everything</em>.
          </div>
          <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:'var(--ink-3)' }}>
            {filtered.length} of {state.tasks.length}
          </div>
        </div>
      </div>

      {/* search + filters */}
      <div style={{ padding:'18px 22px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8,
          padding:'10px 12px', borderRadius:10, background:'var(--paper-2)', border:'1px solid var(--rule)' }}>
          <Icons.search size={14} stroke="var(--ink-3)"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search across all areas"
            style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:13 }}/>
        </div>

        <div style={{ marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
          <Seg value={filter} setValue={setFilter} options={[{v:'all',l:'All'},{v:'open',l:'Open'},{v:'done',l:'Done'}]}/>
          <Seg value={groupBy} setValue={setGroupBy} options={[{v:'area',l:'By area'},{v:'due',l:'By due'},{v:'effort',l:'By effort'}]}/>
        </div>
      </div>

      {/* Groups */}
      <div style={{ padding:'20px 22px 0' }}>
        {groups.map(g => {
          const I = g.icon ? Icons[g.icon] : null;
          return (
            <div key={g.key} style={{ marginBottom:24 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, paddingBottom:6, borderBottom:'1px solid var(--rule)' }}>
                {I && <I size={13} stroke="var(--ink-2)"/>}
                <div className="t-display" style={{ fontSize:18 }}>{g.label}</div>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)', marginLeft:'auto' }}>
                  {g.items.length}
                </span>
              </div>
              {g.items.map(t => (
                <CompactTaskRow key={t.id} t={t} state={state}
                  onClick={() => openTask && openTask(t)}
                  onComplete={(e) => state.completeTask(t.id, e)}/>
              ))}
            </div>
          );
        })}
        {groups.length === 0 && (
          <div style={{ padding:'40px 0', textAlign:'center', fontFamily:'var(--font-display)', fontStyle:'italic',
            fontSize:18, color:'var(--ink-3)' }}>
            Nothing matches.
          </div>
        )}
      </div>
    </div>
  );
};

const Seg = ({ value, setValue, options }) => (
  <div style={{ display:'flex', background:'var(--paper-2)', borderRadius:8, padding:2, gap:2,
    border:'1px solid var(--rule)' }}>
    {options.map(o => (
      <button key={o.v} onClick={() => setValue(o.v)} style={{
        padding:'6px 10px', borderRadius:6, fontSize:11,
        fontFamily:'var(--font-mono)', letterSpacing:0.04,
        background: value === o.v ? 'var(--ink)' : 'transparent',
        color: value === o.v ? 'var(--paper)' : 'var(--ink-2)',
      }}>{o.l}</button>
    ))}
  </div>
);

const CompactTaskRow = ({ t, state, onClick, onComplete }) => {
  const cat = state.categories.find(c => c.id === t.cat) || CATEGORIES[0];
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:10, padding:'10px 0',
      borderBottom:'1px solid var(--rule)', cursor:'pointer',
      opacity: t.done ? 0.45 : 1,
    }}>
      <button onClick={(ev) => { ev.stopPropagation(); onComplete(ev); }} style={{
        width:18, height:18, borderRadius:'50%', flexShrink:0,
        border:`1.5px solid ${t.done ? 'var(--accent)' : 'var(--ink-3)'}`,
        background: t.done ? 'var(--accent)' : 'transparent',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>{t.done && <Icons.check size={10} sw={2.5} stroke="var(--paper)"/>}</button>
      <div onClick={onClick} style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:500, color:'var(--ink)',
          textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</div>
        <div style={{ display:'flex', gap:8, marginTop:2,
          fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)' }}>
          <span>{cat.name}</span>
          <span style={{ opacity:0.5 }}>·</span>
          <span>{(EFFORT[t.effort]||EFFORT.m).label}</span>
          {t.streak > 0 && <><span style={{ opacity:0.5 }}>·</span>
            <span style={{ color:'var(--accent)' }}>{t.streak}d</span></>}
        </div>
      </div>
      <span style={{ fontFamily:'var(--font-mono)', fontSize:10,
        color: t.quad === 'q1' ? 'var(--warn)' : 'var(--ink-3)' }}>{t.due}</span>
    </div>
  );
};

Object.assign(window, { GoalsScreen, JournalScreen, AllTasksScreen, Prompt, PromptInput, Seg, CompactTaskRow });
