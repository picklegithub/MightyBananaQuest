// Life Admin — mobile screens, part 1: Splash, Onboarding, Dashboard, Category, TaskList

/* ─────────────── Splash ─────────────── */
const SplashScreen = ({ onContinue }) => (
  <div style={{
    height:'100%', background:'var(--paper)', color:'var(--ink)',
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    padding:'0 32px', position:'relative',
  }}>
    <div style={{ position:'absolute', top:24, left:24, right:24,
      display:'flex', justifyContent:'space-between', fontFamily:'var(--font-mono)',
      fontSize:10, letterSpacing:0.14, textTransform:'uppercase', color:'var(--ink-3)' }}>
      <span>Life Admin</span>
      <span>v 1.0</span>
    </div>
    <div className="t-display" style={{ fontSize:64, textAlign:'center', lineHeight:0.95 }}>
      The small things,<br/>
      <em style={{ fontStyle:'italic', color:'var(--accent)' }}>handled.</em>
    </div>
    <div style={{ marginTop:24, fontSize:14, color:'var(--ink-2)', textAlign:'center', maxWidth:280 }}>
      A quiet place for chores, bills, habits, and the rest of life's quiet logistics.
    </div>
    <button onClick={onContinue} style={{
      marginTop:48, padding:'14px 28px', borderRadius:999,
      background:'var(--ink)', color:'var(--paper)', fontSize:14, fontWeight:500,
      letterSpacing:0.02, display:'inline-flex', alignItems:'center', gap:10,
    }}>
      Begin <Icons.arrow size={16} />
    </button>
    <div style={{ position:'absolute', bottom:32, fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)', letterSpacing:0.12 }}>
      MMXXVI · MADE FOR CALM
    </div>
  </div>
);

/* ─────────────── Onboarding (3 categories) ─────────────── */
const OnboardingScreen = ({ onDone, state }) => {
  const cats = (state && state.categories) || CATEGORIES;
  const [picked, setPicked] = React.useState(['home', 'health', 'finance']);
  const [adding, setAdding] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newIcon, setNewIcon] = React.useState('sparkle');
  const toggle = (id) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const iconChoices = ['sparkle','leaf','drop','book','heart','target','journal','sun','moon'];
  const submitNew = () => {
    if (!newName.trim()) return;
    const id = 'c_' + newName.toLowerCase().replace(/\s+/g, '_');
    if (state && state.addCategory) state.addCategory({ id, name: newName.trim(), icon: newIcon, hue: 60 });
    setPicked(p => [...p, id]);
    setNewName(''); setAdding(false);
  };
  return (
    <div style={{ height:'100%', background:'var(--paper)', display:'flex', flexDirection:'column', padding:'24px 24px 16px' }}>
      <div className="eyebrow">Step 02 / 03</div>
      <div className="t-display" style={{ fontSize:30, marginTop:8, lineHeight:1.1 }}>
        Choose the <em>parts of life</em> you want here.
      </div>
      <div style={{ fontSize:13, color:'var(--ink-2)', marginTop:10, lineHeight:1.5 }}>
        Pick 3 to start. Add your own or remove any time.
      </div>

      <div style={{ marginTop:18, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, overflowY:'auto' }} className="no-scrollbar">
        {cats.map(c => {
          const I = Icons[c.icon] || Icons.sparkle;
          const active = picked.includes(c.id);
          return (
            <button key={c.id} onClick={() => toggle(c.id)} style={{
              padding:'16px 14px', textAlign:'left', borderRadius:14,
              background: active ? 'var(--ink)' : 'var(--paper-2)',
              color: active ? 'var(--paper)' : 'var(--ink)',
              border: '1px solid', borderColor: active ? 'var(--ink)' : 'var(--rule)',
              transition:'all .2s',
              display:'flex', flexDirection:'column', gap:14, height:96,
            }}>
              <I size={20} />
              <div>
                <div style={{ fontSize:14, fontWeight:500 }}>{c.name}</div>
                <div style={{ fontSize:10, opacity:0.7, fontFamily:'var(--font-mono)', marginTop:2 }}>
                  {active ? 'SELECTED' : 'TAP TO ADD'}
                </div>
              </div>
            </button>
          );
        })}

        {/* + create your own */}
        {!adding && (
          <button onClick={() => setAdding(true)} style={{
            padding:'16px 14px', borderRadius:14, height:96,
            background:'transparent', border:'1px dashed var(--rule)',
            color:'var(--ink-2)',
            display:'flex', flexDirection:'column', alignItems:'flex-start', justifyContent:'space-between',
          }}>
            <Icons.plus size={20} />
            <div>
              <div style={{ fontSize:14, fontWeight:500, fontFamily:'var(--font-display)', fontStyle:'italic' }}>
                Your own
              </div>
              <div style={{ fontSize:10, fontFamily:'var(--font-mono)', marginTop:2, color:'var(--ink-3)' }}>
                CREATE AREA
              </div>
            </div>
          </button>
        )}

        {adding && (
          <div style={{
            gridColumn:'1 / -1', padding:14, borderRadius:14,
            background:'var(--paper-2)', border:'1px solid var(--ink)',
          }}>
            <div className="eyebrow" style={{ marginBottom:10 }}>New area</div>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Mindfulness"
              style={{ width:'100%', border:'none', outline:'none', background:'transparent',
                fontFamily:'var(--font-display)', fontSize:22, color:'var(--ink)' }}/>
            <div style={{ marginTop:10, display:'flex', gap:6, flexWrap:'wrap' }}>
              {iconChoices.map(ic => {
                const I = Icons[ic];
                const on = newIcon === ic;
                return (
                  <button key={ic} onClick={() => setNewIcon(ic)} style={{
                    width:34, height:34, borderRadius:8,
                    background: on ? 'var(--ink)' : 'transparent',
                    color: on ? 'var(--paper)' : 'var(--ink-2)',
                    border:'1px solid', borderColor: on ? 'var(--ink)' : 'var(--rule)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}><I size={14}/></button>
                );
              })}
            </div>
            <div style={{ marginTop:12, display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => { setAdding(false); setNewName(''); }} style={{
                padding:'8px 14px', fontSize:12, color:'var(--ink-3)' }}>Cancel</button>
              <button onClick={submitNew} disabled={!newName.trim()} style={{
                padding:'8px 14px', borderRadius:999, background:'var(--ink)', color:'var(--paper)',
                fontSize:12, opacity: newName.trim() ? 1 : 0.4 }}>Create</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:14 }}>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-3)' }}>
          {picked.length} selected
        </div>
        <button onClick={onDone} disabled={picked.length < 1} style={{
          padding:'12px 22px', borderRadius:999, background:'var(--ink)',
          color:'var(--paper)', fontSize:14, fontWeight:500,
          display:'inline-flex', alignItems:'center', gap:8,
          opacity: picked.length < 1 ? 0.4 : 1,
        }}>
          Continue <Icons.arrow size={14} />
        </button>
      </div>

      <div style={{ display:'flex', gap:4, marginTop:16, justifyContent:'center' }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: i===1 ? 18 : 6, height:6, borderRadius:3,
            background: i <= 1 ? 'var(--ink)' : 'var(--rule)', transition:'all .3s' }} />
        ))}
      </div>
    </div>
  );
};

/* ─────────────── Dashboard ("Today") ─────────────── */
const DashboardScreen = ({ state, openCategory, openTask, intensity }) => {
  const today = state.tasks.filter(t => t.due === 'Today');
  const doneToday = today.filter(t => t.done).length;
  const totalToday = today.length;
  const pct = totalToday ? Math.round((doneToday/totalToday) * 100) : 0;
  const xpToNext = 3000;
  const xpProgress = (state.xp % 1000) / 10; // % into level

  return (
    <div style={{ background:'var(--paper)', minHeight:'100%', paddingBottom:32 }}>
      {/* Status row */}
      <div style={{ padding:'18px 22px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div className="eyebrow">Sunday · 19 April</div>
          <div className="t-display" style={{ fontSize:32, marginTop:6 }}>
            Good morning, Alex.
          </div>
        </div>
        <div style={{
          width:38, height:38, borderRadius:'50%', background:'var(--paper-3)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'var(--font-display)', fontSize:18,
        }}>A</div>
      </div>

      {/* Hero card: today's progress */}
      <div style={{ margin:'20px 22px 0', padding:'20px', borderRadius:18,
        background:'var(--ink)', color:'var(--paper)', position:'relative', overflow:'hidden' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:10, opacity:0.6, letterSpacing:0.14, textTransform:'uppercase' }}>
              Today's progress
            </div>
            <div className="t-display" style={{ fontSize:48, marginTop:6, lineHeight:1 }}>
              {doneToday}<span style={{ opacity:0.45, fontSize:28 }}> / {totalToday}</span>
            </div>
            <div style={{ fontSize:12, opacity:0.7, marginTop:6 }}>
              tasks complete &middot; {pct}%
            </div>
          </div>
          {intensity !== 'subtle' && (
            <div style={{ display:'flex', gap:14 }}>
              <Stat icon="flame" value={state.streak} label="day streak" inv />
              <Stat icon="bolt" value={state.xp.toLocaleString()} label="XP" inv />
            </div>
          )}
        </div>
        {/* progress bar */}
        <div style={{ marginTop:18, height:4, background:'rgba(255,255,255,0.12)', borderRadius:2, overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', background:'var(--accent-soft)', transition:'width .4s' }} />
        </div>
        {/* level chip */}
        {intensity !== 'subtle' && (
          <div style={{ marginTop:14, display:'flex', justifyContent:'space-between', alignItems:'center',
            fontFamily:'var(--font-mono)', fontSize:10, opacity:0.7 }}>
            <span>LVL 12 · STEADY</span>
            <span>{xpToNext - (state.xp % 1000)} XP TO LVL 13</span>
          </div>
        )}
      </div>

      {/* Today's tasks (mixed) */}
      <div style={{ padding:'24px 22px 0' }}>
        <SectionHeader title="Up next" sub={`${totalToday - doneToday} remaining today`} />
        <div style={{ marginTop:10, display:'flex', flexDirection:'column' }}>
          {today.slice(0, 4).map(t => (
            <TaskRow key={t.id} t={t} onClick={() => openTask(t)}
              onComplete={(e) => state.completeTask(t.id, e)} />
          ))}
        </div>
      </div>

      {/* Categories grid (preview) */}
      <div style={{ padding:'28px 22px 0' }}>
        <SectionHeader title="Areas of life" sub="Swipe through" />
        <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {CATEGORIES.slice(0,4).map(c => {
            const ts = state.tasks.filter(x => x.cat === c.id);
            const open = ts.filter(x => !x.done).length;
            const I = Icons[c.icon];
            return (
              <button key={c.id} onClick={() => openCategory(c.id)} style={{
                padding:16, borderRadius:14, background:'var(--paper-2)',
                border:'1px solid var(--rule)', textAlign:'left',
                display:'flex', flexDirection:'column', gap:14, color:'var(--ink)',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <I size={18} />
                  <span style={{ fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-3)' }}>
                    {String(open).padStart(2,'0')}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:500 }}>{c.name}</div>
                  <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>
                    {open === 0 ? 'all clear' : `${open} open`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <button onClick={() => openCategory('home')} style={{
          width:'100%', marginTop:10, padding:'12px', borderRadius:14,
          background:'transparent', border:'1px dashed var(--rule)', color:'var(--ink-2)',
          fontSize:12, display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
        }}>
          See all <Icons.arrow size={14} />
        </button>
      </div>

      {/* A quiet thought */}
      <div style={{ margin:'24px 22px 0', padding:18, borderRadius:14,
        background:'var(--paper-2)', border:'1px solid var(--rule)' }}>
        <div className="eyebrow">A quiet thought</div>
        <div className="t-display t-italic" style={{ fontSize:20, marginTop:8, lineHeight:1.3, color:'var(--ink)' }}>
          “You do not rise to the level of your goals. You fall to the level of your systems.”
        </div>
        <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:8, fontFamily:'var(--font-mono)' }}>— J. CLEAR</div>
      </div>
    </div>
  );
};

const Stat = ({ icon, value, label, inv }) => {
  const I = Icons[icon];
  return (
    <div style={{ textAlign:'right' }}>
      <div style={{ display:'inline-flex', alignItems:'center', gap:5,
        fontFamily:'var(--font-mono)', fontSize:14, fontWeight:500,
        color: inv ? 'var(--paper)' : 'var(--ink)', }}>
        <I size={13} />{value}
      </div>
      <div style={{ fontSize:9, opacity:0.6, marginTop:2,
        fontFamily:'var(--font-mono)', textTransform:'uppercase', letterSpacing:0.1 }}>{label}</div>
    </div>
  );
};

const SectionHeader = ({ title, sub, action }) => (
  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', borderBottom:'1px solid var(--rule)', paddingBottom:8 }}>
    <div>
      <div className="t-display" style={{ fontSize:22 }}>{title}</div>
      {sub && <div style={{ fontSize:11, color:'var(--ink-3)', fontFamily:'var(--font-mono)', marginTop:2, letterSpacing:0.06 }}>{sub}</div>}
    </div>
    {action}
  </div>
);

/* ─────────────── Task row (compact) ─────────────── */
const TaskRow = ({ t, onClick, onComplete }) => {
  const cat = CATEGORIES.find(c => c.id === t.cat);
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'14px 0',
      borderBottom:'1px solid var(--rule)', cursor:'pointer',
      opacity: t.done ? 0.45 : 1,
    }}>
      <button onClick={(e) => { e.stopPropagation(); onComplete(e); }} style={{
        width:22, height:22, borderRadius:'50%', flexShrink:0,
        border:`1.5px solid ${t.done ? 'var(--accent)' : 'var(--ink-3)'}`,
        background: t.done ? 'var(--accent)' : 'transparent',
        color: t.done ? 'var(--paper)' : 'transparent',
        display:'flex', alignItems:'center', justifyContent:'center',
        transition:'all .2s',
      }}>
        {t.done && <Icons.check size={12} sw={2} />}
      </button>

      <div onClick={onClick} style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:500, color:'var(--ink)',
          textDecoration: t.done ? 'line-through' : 'none', textDecorationColor:'var(--ink-3)' }}>
          {t.title}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:4,
          fontSize:11, color:'var(--ink-3)', fontFamily:'var(--font-mono)' }}>
          <span>{cat?.name}</span>
          <span style={{ opacity:0.5 }}>·</span>
          <EffortPip effort={t.effort} />
          {t.streak > 0 && (<>
            <span style={{ opacity:0.5 }}>·</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>
              <Icons.flame size={10}/> {t.streak}
            </span>
          </>)}
        </div>
      </div>

      <div style={{ fontSize:11, color:'var(--ink-3)', fontFamily:'var(--font-mono)' }}>
        {t.due}
      </div>
    </div>
  );
};

/* ─────────────── Category Carousel ─────────────── */
const CategoryCarousel = ({ state, startCat = 'home', openTask, onClose, intensity }) => {
  const idx = CATEGORIES.findIndex(c => c.id === startCat);
  const [cur, setCur] = React.useState(idx >= 0 ? idx : 0);
  const cat = CATEGORIES[cur];
  const tasks = state.tasks.filter(t => t.cat === cat.id);
  const open = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  const I = Icons[cat.icon];

  // swipe
  const startX = React.useRef(null);
  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (dx > 60 && cur > 0) setCur(cur - 1);
    if (dx < -60 && cur < CATEGORIES.length - 1) setCur(cur + 1);
    startX.current = null;
  };

  return (
    <div style={{ height:'100%', background:'var(--paper)', display:'flex', flexDirection:'column' }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* header w/ tabs */}
      <div style={{ padding:'18px 22px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button onClick={onClose} style={{ color:'var(--ink-2)', display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
            <Icons.back size={14} /> Today
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:14, color:'var(--ink-3)' }}>
            <Icons.search size={16} />
            <Icons.more size={16} />
          </div>
        </div>

        {/* category tabs */}
        <div className="no-scrollbar" style={{ display:'flex', gap:18, marginTop:18, overflowX:'auto' }}>
          {CATEGORIES.map((c, i) => (
            <button key={c.id} onClick={() => setCur(i)} style={{
              fontFamily:'var(--font-display)', fontSize: i === cur ? 24 : 18,
              color: i === cur ? 'var(--ink)' : 'var(--ink-3)', whiteSpace:'nowrap',
              fontStyle: i === cur ? 'italic' : 'normal',
              transition:'all .2s', paddingBottom:6,
              borderBottom: i === cur ? '1.5px solid var(--ink)' : '1.5px solid transparent',
            }}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto' }} className="no-scrollbar">
        {/* category hero */}
        <div style={{ padding:'24px 22px 0' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
            <div>
              <div className="eyebrow">{String(cur+1).padStart(2,'0')} of {String(CATEGORIES.length).padStart(2,'0')}</div>
              <div className="t-display" style={{ fontSize:56, marginTop:4, lineHeight:1 }}>
                {cat.name}<span style={{ color:'var(--accent)' }}>.</span>
              </div>
              <div style={{ marginTop:12, display:'flex', gap:16, fontFamily:'var(--font-mono)', fontSize:11, color:'var(--ink-2)' }}>
                <span><b style={{ color:'var(--ink)', fontSize:14 }}>{open.length}</b> open</span>
                <span><b style={{ color:'var(--ink)', fontSize:14 }}>{done.length}</b> done today</span>
              </div>
            </div>
            <div style={{
              width:60, height:60, borderRadius:18, background:'var(--paper-2)',
              border:'1px solid var(--rule)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <I size={24} />
            </div>
          </div>
        </div>

        {/* task list */}
        <div style={{ padding:'22px 22px 0' }}>
          <SectionHeader title="Open" sub={`${open.length} task${open.length===1?'':'s'}`} />
          <div style={{ marginTop:8 }}>
            {open.map(t => (
              <TaskCard key={t.id} t={t} onClick={() => openTask(t)} onComplete={(e) => state.completeTask(t.id, e)} />
            ))}
          </div>
        </div>

        {done.length > 0 && (
          <div style={{ padding:'20px 22px 0' }}>
            <SectionHeader title="Done" sub={`${done.length} complete`} />
            <div style={{ marginTop:6 }}>
              {done.map(t => (
                <TaskCard key={t.id} t={t} onClick={() => openTask(t)} onComplete={(e) => state.completeTask(t.id, e)} />
              ))}
            </div>
          </div>
        )}

        <div style={{ height:32 }} />
      </div>

      {/* dots */}
      <div style={{ display:'flex', justifyContent:'center', gap:5, padding:'8px 0 12px' }}>
        {CATEGORIES.map((_, i) => (
          <div key={i} style={{
            width: i === cur ? 16 : 5, height:5, borderRadius:3,
            background: i === cur ? 'var(--ink)' : 'var(--rule)', transition:'all .3s'
          }} />
        ))}
      </div>
    </div>
  );
};

/* ─────────────── Task card (richer — for category list) ─────────────── */
const TaskCard = ({ t, onClick, onComplete }) => {
  const cat = CATEGORIES.find(c => c.id === t.cat);
  const subDone = t.sub.filter(s => s.d).length;
  const hasSub = t.sub.length > 0;
  const isUrgent = t.quad === 'q1' || t.quad === 'q3';
  return (
    <div style={{
      display:'flex', gap:14, padding:'16px 0', borderBottom:'1px solid var(--rule)',
      cursor:'pointer', opacity: t.done ? 0.5 : 1,
    }}>
      <button onClick={(e) => { e.stopPropagation(); onComplete(e); }} style={{
        width:22, height:22, borderRadius:'50%', flexShrink:0, marginTop:2,
        border:`1.5px solid ${t.done ? 'var(--accent)' : 'var(--ink-3)'}`,
        background: t.done ? 'var(--accent)' : 'transparent',
        color: t.done ? 'var(--paper)' : 'transparent',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        {t.done && <Icons.check size={12} sw={2} />}
      </button>
      <div style={{ flex:1, minWidth:0 }} onClick={onClick}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:10 }}>
          <div style={{ fontSize:15, fontWeight:500, color:'var(--ink)',
            textDecoration: t.done ? 'line-through' : 'none', textDecorationColor:'var(--ink-3)' }}>
            {t.title}
          </div>
          <div style={{ fontSize:11, color: isUrgent ? 'var(--warn)' : 'var(--ink-3)', fontFamily:'var(--font-mono)', whiteSpace:'nowrap' }}>
            {t.due}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:6,
          fontSize:11, color:'var(--ink-3)', fontFamily:'var(--font-mono)' }}>
          <EffortPip effort={t.effort} />
          <span style={{ opacity:0.5 }}>·</span>
          <span>{t.ctx}</span>
          {t.recurring && <>
            <span style={{ opacity:0.5 }}>·</span>
            <span>{t.recurring}</span>
          </>}
          {t.streak > 0 && <>
            <span style={{ opacity:0.5 }}>·</span>
            <span style={{ display:'inline-flex', alignItems:'center', gap:3, color:'var(--accent)' }}>
              <Icons.flame size={10}/> {t.streak}d
            </span>
          </>}
        </div>
        {hasSub && (
          <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ flex:1, height:3, background:'var(--paper-3)', borderRadius:2 }}>
              <div style={{ width:`${(subDone/t.sub.length)*100}%`, height:'100%', background:'var(--ink)', borderRadius:2 }} />
            </div>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)' }}>
              {subDone}/{t.sub.length}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, {
  SplashScreen, OnboardingScreen, DashboardScreen, CategoryCarousel,
  Stat, SectionHeader, TaskRow, TaskCard,
});
