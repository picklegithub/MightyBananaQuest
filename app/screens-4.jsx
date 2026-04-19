// Life Admin — Settings screen + Schedule editor + notif mock

const SettingsScreen = ({ theme, setTheme, notif, setNotif, defPom, setDefPom, onClose }) => {
  return (
    <div style={{ height:'100%', background:'var(--paper)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <button onClick={onClose} style={{ color:'var(--ink-2)', display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
          <Icons.back size={14}/> Back
        </button>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)', letterSpacing:0.12 }}>SETTINGS</div>
        <div style={{ width:20 }}/>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'8px 22px 32px' }}>
        <div className="eyebrow">Preferences</div>
        <div className="t-display" style={{ fontSize:32, marginTop:6, lineHeight:1.1 }}>
          Make it <em>yours</em>.
        </div>

        {/* Theme */}
        <div style={{ marginTop:28, paddingBottom:22, borderBottom:'1px solid var(--rule)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ flex:1 }}>
              <div className="t-display" style={{ fontSize:18 }}>Appearance</div>
              <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:4 }}>
                Dark mode is easier on the eyes after sunset.
              </div>
            </div>
          </div>
          <div style={{ marginTop:14, display:'flex', gap:8 }}>
            {[
              { id:'light', label:'Light', icon:'sun' },
              { id:'dark',  label:'Dark',  icon:'moon' },
              { id:'auto',  label:'System', icon:'settings' },
            ].map(o => {
              const I = Icons[o.icon];
              const on = theme === o.id;
              return (
                <button key={o.id} onClick={() => setTheme(o.id)} style={{
                  flex:1, padding:'14px 10px', borderRadius:12,
                  background: on ? 'var(--ink)' : 'var(--paper-2)',
                  color: on ? 'var(--paper)' : 'var(--ink)',
                  border:'1px solid', borderColor: on ? 'var(--ink)' : 'var(--rule)',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                }}>
                  <I size={18}/>
                  <span style={{ fontSize:12, fontWeight:500 }}>{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Notifications */}
        <div style={{ marginTop:22, paddingBottom:22, borderBottom:'1px solid var(--rule)' }}>
          <div className="t-display" style={{ fontSize:18 }}>Notifications</div>
          <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:4, lineHeight:1.5 }}>
            Choose what breaks your focus. Everything else stays silent.
          </div>

          <div style={{ marginTop:16 }}>
            {[
              { k:'due', label:'Tasks due today', sub:'7:30am summary' },
              { k:'overdue', label:'Overdue nudge', sub:'One per task, once' },
              { k:'pom', label:'End of Pomodoro', sub:'Light chime' },
              { k:'journal', label:'Journal reminders', sub:'Morning & evening' },
              { k:'streak', label:'Streak at risk', sub:'8pm if not done' },
              { k:'weekly', label:'Weekly review', sub:'Sunday 6pm' },
            ].map(n => (
              <div key={n.k} style={{ display:'flex', alignItems:'center', gap:12,
                padding:'14px 0', borderBottom:'1px solid var(--rule)' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:500 }}>{n.label}</div>
                  <div style={{ fontSize:11, color:'var(--ink-3)', marginTop:2 }}>{n.sub}</div>
                </div>
                <Toggle on={!!notif[n.k]} onChange={v => setNotif({...notif, [n.k]: v})}/>
              </div>
            ))}
          </div>

          <div style={{ marginTop:14, padding:12, borderRadius:10, background:'var(--paper-2)',
            border:'1px solid var(--rule)' }}>
            <div className="eyebrow" style={{ marginBottom:8 }}>Quiet hours</div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <Icons.moon size={14} stroke="var(--ink-2)"/>
              <span style={{ fontSize:13, color:'var(--ink-2)' }}>22:00 — 07:00</span>
              <span style={{ flex:1 }}/>
              <Toggle on={!!notif.quiet} onChange={v => setNotif({...notif, quiet:v})}/>
            </div>
          </div>
        </div>

        {/* Pomodoro default */}
        <div style={{ marginTop:22, paddingBottom:22, borderBottom:'1px solid var(--rule)' }}>
          <div className="t-display" style={{ fontSize:18 }}>Pomodoro</div>
          <div style={{ fontSize:12, color:'var(--ink-3)', marginTop:4 }}>
            Default focus length. Override per-task in Task Detail.
          </div>
          <div style={{ marginTop:14, display:'flex', gap:6, flexWrap:'wrap' }}>
            {[15, 20, 25, 30, 45, 50, 60, 90].map(m => {
              const on = defPom === m;
              return (
                <button key={m} onClick={() => setDefPom(m)} style={{
                  padding:'10px 14px', borderRadius:10, fontFamily:'var(--font-mono)', fontSize:12,
                  background: on ? 'var(--ink)' : 'var(--paper-2)',
                  color: on ? 'var(--paper)' : 'var(--ink-2)',
                  border:'1px solid', borderColor: on ? 'var(--ink)' : 'var(--rule)',
                }}>{m}<span style={{ opacity:0.6, marginLeft:2 }}>m</span></button>
              );
            })}
          </div>
          <div style={{ marginTop:12, fontSize:12, color:'var(--ink-3)' }}>
            Break length: <b style={{ color:'var(--ink)' }}>{Math.max(5, Math.round(defPom/5))} min</b> · Long break every 4 sessions
          </div>
        </div>

        {/* Account-ish row */}
        <div style={{ marginTop:22 }}>
          <div className="t-display" style={{ fontSize:18 }}>Data</div>
          <div style={{ marginTop:10 }}>
            {[
              { icon:'download', label:'Export data (.csv)' },
              { icon:'rss',      label:'RSS feed sources' },
              { icon:'settings', label:'Widget & shortcuts' },
            ].map((r, i) => {
              const I = Icons[r.icon] || Icons.settings;
              return (
                <div key={i} style={{ padding:'14px 0', display:'flex', alignItems:'center',
                  borderBottom:'1px solid var(--rule)', gap:12 }}>
                  <I size={16} stroke="var(--ink-2)"/>
                  <span style={{ flex:1, fontSize:14 }}>{r.label}</span>
                  <Icons.arrow size={14} stroke="var(--ink-3)"/>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const Toggle = ({ on, onChange }) => (
  <button onClick={() => onChange(!on)} style={{
    width:44, height:26, borderRadius:13, padding:2,
    background: on ? 'var(--accent)' : 'var(--paper-3)',
    border:'1px solid', borderColor: on ? 'var(--accent)' : 'var(--rule)',
    transition:'all .2s', display:'flex', alignItems:'center',
    justifyContent: on ? 'flex-end' : 'flex-start',
  }}>
    <span style={{ width:20, height:20, borderRadius:'50%', background:'var(--paper)',
      boxShadow:'var(--shadow-1)' }}/>
  </button>
);

/* ─────────────── Schedule sheet (scheduling + recurring) ─────────────── */
const ScheduleSheet = ({ task, onClose, onSave }) => {
  const [due, setDue] = React.useState(task.due || 'Today');
  const [time, setTime] = React.useState(task.time || '');
  const [rec, setRec] = React.useState(task.recurring || null);
  const [custom, setCustom] = React.useState(false);

  const days = ['Today','Tomorrow','Wed','Thu','Fri','Sat','Sun','Next week','Someday'];
  const recs = [
    { v:null, l:'One-off' },
    { v:'Daily', l:'Daily' },
    { v:'Weekdays', l:'Weekdays' },
    { v:'Weekly', l:'Weekly' },
    { v:'Every 2 weeks', l:'Bi-weekly' },
    { v:'Monthly', l:'Monthly' },
    { v:'Quarterly', l:'Quarterly' },
    { v:'Yearly', l:'Yearly' },
    { v:'3x/week', l:'3x / week' },
    { v:'Custom…', l:'Custom…' },
  ];

  return (
    <div style={{ height:'100%', background:'var(--paper)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <button onClick={onClose} style={{ color:'var(--ink-2)', fontSize:12 }}>Cancel</button>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)', letterSpacing:0.12 }}>SCHEDULE</div>
        <button onClick={() => { onSave({ due, time, recurring: rec }); }} style={{ fontSize:12, color:'var(--accent)', fontWeight:600 }}>Save</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'8px 22px 24px' }}>
        <div className="eyebrow">Schedule</div>
        <div className="t-display" style={{ fontSize:24, marginTop:6, lineHeight:1.15 }}>
          When will <em>“{task.title}”</em> happen?
        </div>

        {/* Mini month */}
        <div style={{ marginTop:20, padding:16, borderRadius:14, background:'var(--paper-2)', border:'1px solid var(--rule)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div className="t-display" style={{ fontSize:16 }}>April 2026</div>
            <div style={{ display:'flex', gap:8 }}>
              <button style={{ color:'var(--ink-3)' }}><Icons.back size={14}/></button>
              <button style={{ color:'var(--ink-3)' }}><Icons.arrow size={14}/></button>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2,
            fontFamily:'var(--font-mono)', fontSize:10, color:'var(--ink-3)', marginBottom:4 }}>
            {['M','T','W','T','F','S','S'].map((d,i) => (
              <div key={i} style={{ textAlign:'center', padding:'4px 0' }}>{d}</div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2 }}>
            {Array.from({ length:35 }).map((_, i) => {
              const day = i - 2; // leading offset
              const valid = day > 0 && day <= 30;
              const isToday = day === 19;
              const isSel = day === 22;
              return (
                <div key={i} style={{
                  aspectRatio:'1/1', display:'flex', alignItems:'center', justifyContent:'center',
                  borderRadius:8, fontSize:12,
                  color: !valid ? 'transparent' : isSel ? 'var(--paper)' : isToday ? 'var(--accent)' : 'var(--ink)',
                  background: isSel ? 'var(--ink)' : 'transparent',
                  fontWeight: isToday || isSel ? 600 : 400,
                  border: isToday && !isSel ? '1px solid var(--accent)' : 'none',
                }}>{valid ? day : ''}</div>
              );
            })}
          </div>
        </div>

        {/* Quick chips */}
        <div style={{ marginTop:16 }}>
          <div className="eyebrow" style={{ marginBottom:8 }}>Quick pick</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {days.map(d => {
              const on = due === d;
              return (
                <button key={d} onClick={() => setDue(d)} style={{
                  padding:'8px 14px', borderRadius:999, fontSize:12,
                  background: on ? 'var(--ink)' : 'var(--paper-2)',
                  color: on ? 'var(--paper)' : 'var(--ink-2)',
                  border:'1px solid', borderColor: on ? 'var(--ink)' : 'var(--rule)',
                }}>{d}</button>
              );
            })}
          </div>
        </div>

        {/* Time */}
        <div style={{ marginTop:20 }}>
          <div className="eyebrow" style={{ marginBottom:8 }}>Time (optional)</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['Morning','Noon','Afternoon','Evening','7:00','9:30','14:00','20:00'].map(tm => {
              const on = time === tm;
              return (
                <button key={tm} onClick={() => setTime(time === tm ? '' : tm)} style={{
                  padding:'8px 12px', borderRadius:8, fontFamily:'var(--font-mono)', fontSize:11,
                  background: on ? 'var(--ink)' : 'transparent',
                  color: on ? 'var(--paper)' : 'var(--ink-2)',
                  border:'1px solid', borderColor: on ? 'var(--ink)' : 'var(--rule)',
                }}>{tm}</button>
              );
            })}
          </div>
        </div>

        {/* Recurring */}
        <div style={{ marginTop:22 }}>
          <div className="eyebrow" style={{ marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
            <Icons.reset size={11}/> Recurrence
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {recs.map(r => {
              const on = rec === r.v || (r.v === 'Custom…' && custom);
              return (
                <button key={r.l} onClick={() => {
                  if (r.v === 'Custom…') setCustom(true);
                  else { setRec(r.v); setCustom(false); }
                }} style={{
                  padding:'8px 12px', borderRadius:8, fontSize:12,
                  background: on ? 'var(--accent-soft)' : 'transparent',
                  color: on ? 'var(--ink)' : 'var(--ink-2)',
                  border:'1px solid', borderColor: on ? 'var(--accent)' : 'var(--rule)',
                  fontWeight: on ? 600 : 400,
                }}>{r.l}</button>
              );
            })}
          </div>

          {custom && (
            <div style={{ marginTop:12, padding:14, borderRadius:10, background:'var(--paper-2)', border:'1px solid var(--rule)' }}>
              <div className="eyebrow" style={{ marginBottom:8 }}>Every</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="number" defaultValue={2} min={1} style={{
                  width:60, padding:'8px 10px', borderRadius:8, border:'1px solid var(--rule)',
                  background:'var(--paper)', fontSize:14, outline:'none',
                }}/>
                <select style={{
                  padding:'8px 10px', borderRadius:8, border:'1px solid var(--rule)',
                  background:'var(--paper)', fontSize:14, outline:'none', fontFamily:'inherit',
                }}>
                  <option>days</option><option>weeks</option><option>months</option><option>years</option>
                </select>
              </div>
              <div style={{ marginTop:12 }} className="eyebrow">On</div>
              <div style={{ marginTop:6, display:'flex', gap:4 }}>
                {['M','T','W','T','F','S','S'].map((d,i) => {
                  const on = [0,2,4].includes(i);
                  return (
                    <span key={i} style={{
                      width:30, height:30, borderRadius:'50%', fontSize:11, fontWeight:600,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      background: on ? 'var(--ink)' : 'transparent',
                      color: on ? 'var(--paper)' : 'var(--ink-3)',
                      border:'1px solid', borderColor: on ? 'var(--ink)' : 'var(--rule)',
                    }}>{d}</span>
                  );
                })}
              </div>
              <div style={{ marginTop:12 }} className="eyebrow">Ends</div>
              <div style={{ marginTop:6, display:'flex', gap:6 }}>
                {['Never','After 10','On date'].map((e, i) => (
                  <button key={e} style={{
                    padding:'6px 10px', borderRadius:6, fontSize:11,
                    background: i === 0 ? 'var(--paper-3)' : 'transparent',
                    border:'1px solid var(--rule)', color:'var(--ink-2)',
                  }}>{e}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─────────────── Notifications toast preview (for canvas) ─────────────── */
const NotifPreview = () => {
  const notifs = [
    { app:'Life Admin', icon:'flame', title:'Streak at risk', body:'30-min walk — 18 days. Still time.', when:'now' },
    { app:'Life Admin', icon:'bell',  title:'Energy bill due Wed', body:'Tap to mark paid · $124.80', when:'7:30am' },
    { app:'Life Admin', icon:'timer', title:'Focus complete', body:'Pay electricity bill · +8 XP', when:'9:52am' },
    { app:'Life Admin', icon:'journal', title:'Evening reflection', body:'2 minutes. Today\u2019s win?', when:'8:00pm' },
  ];
  return (
    <div style={{ height:'100%', background:'linear-gradient(180deg, #0d0f14 0%, #1a1f28 100%)',
      display:'flex', flexDirection:'column', padding:'44px 14px 14px', gap:8 }}>
      <div style={{ textAlign:'center', color:'rgba(255,255,255,0.85)', marginBottom:8 }}>
        <div className="t-display" style={{ fontSize:54, fontWeight:200, lineHeight:1 }}>9:52</div>
        <div style={{ fontFamily:'var(--font-mono)', fontSize:11, opacity:0.7, marginTop:2,
          letterSpacing:0.06, textTransform:'uppercase' }}>Sunday, April 19</div>
      </div>
      {notifs.map((n, i) => {
        const I = Icons[n.icon] || Icons.bell;
        return (
          <div key={i} style={{
            padding:'12px 14px', borderRadius:14,
            background:'rgba(28,33,44,0.92)', border:'1px solid rgba(255,255,255,0.08)',
            backdropFilter:'blur(20px)', color:'#fff',
            display:'flex', gap:10, alignItems:'flex-start',
          }}>
            <div style={{ width:30, height:30, borderRadius:8, flexShrink:0,
              background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <I size={15} stroke="#fff"/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:8 }}>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:9, opacity:0.55, letterSpacing:0.12, textTransform:'uppercase' }}>{n.app}</span>
                <span style={{ fontFamily:'var(--font-mono)', fontSize:9, opacity:0.55 }}>{n.when}</span>
              </div>
              <div style={{ fontSize:13, fontWeight:600, marginTop:2 }}>{n.title}</div>
              <div style={{ fontSize:12, opacity:0.75, marginTop:2, lineHeight:1.35 }}>{n.body}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

Object.assign(window, { SettingsScreen, ScheduleSheet, NotifPreview, Toggle });
