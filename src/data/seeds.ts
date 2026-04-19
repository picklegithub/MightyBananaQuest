import type { Task, Goal, JournalEntry, InboxItem } from '../types'

export const SEED_TASKS: Task[] = [
  // Home
  { id:'t1',  cat:'home',     title:'Empty the dishwasher',           effort:'s',  due:'Today',     streak:6,  ctx:'@home',    quad:'q3', recurring:'Daily',     done:false, sub:[] },
  { id:'t2',  cat:'home',     title:'Water the indoor plants',        effort:'s',  due:'Today',     streak:12, ctx:'@home',    quad:'q2', recurring:'Every 3d',  done:true,  sub:[] },
  { id:'t3',  cat:'home',     title:'Replace smoke alarm batteries',  effort:'m',  due:'Sat',       streak:0,  ctx:'@home',    quad:'q2', recurring:'Yearly',    done:false,
    sub:[ { t:'Buy 9V batteries', d:false }, { t:'Test each detector', d:false }, { t:'Log replacement date', d:false } ] },
  { id:'t4',  cat:'home',     title:'Deep clean the kitchen',         effort:'l',  due:'Sun',       streak:0,  ctx:'@home',    quad:'q4', recurring:null,        done:false,
    sub:[ { t:'Wipe cabinets', d:true }, { t:'Clean oven', d:false }, { t:'Mop floor', d:false }, { t:'Empty fridge & wipe', d:false } ] },
  { id:'t5',  cat:'home',     title:'Take out recycling',             effort:'s',  due:'Tomorrow',  streak:9,  ctx:'@home',    quad:'q3', recurring:'Weekly',    done:false, sub:[] },
  { id:'t6',  cat:'home',     title:'Schedule annual HVAC service',   effort:'m',  due:'Apr 28',    streak:0,  ctx:'@phone',   quad:'q2', recurring:'Yearly',    done:false, sub:[] },
  // Work
  { id:'t7',  cat:'work',     title:'Draft Q2 OKR proposal',          effort:'l',  due:'Fri',       streak:0,  ctx:'@laptop',  quad:'q1', recurring:null,        done:false,
    sub:[ { t:'Pull Q1 metrics', d:true }, { t:'Outline 3 objectives', d:false }, { t:'Share with manager', d:false } ] },
  { id:'t8',  cat:'work',     title:'Reply to recruiter email',        effort:'s',  due:'Today',     streak:0,  ctx:'@email',   quad:'q1', recurring:null,        done:false, sub:[] },
  { id:'t9',  cat:'work',     title:'Prep 1:1 talking points',         effort:'m',  due:'Mon',       streak:4,  ctx:'@laptop',  quad:'q2', recurring:'Weekly',    done:false, sub:[] },
  // Health
  { id:'t10', cat:'health',   title:'30-min walk',                    effort:'m',  due:'Today',     streak:18, ctx:'@anywhere',quad:'q2', recurring:'Daily',     done:true,  sub:[] },
  { id:'t11', cat:'health',   title:'Strength session',               effort:'l',  due:'Today',     streak:7,  ctx:'@gym',     quad:'q2', recurring:'3x/week',   done:false, sub:[] },
  { id:'t12', cat:'health',   title:'Refill prescription',            effort:'s',  due:'Wed',       streak:0,  ctx:'@phone',   quad:'q1', recurring:'Monthly',   done:false, sub:[] },
  { id:'t13', cat:'health',   title:'Book GP check-in',               effort:'s',  due:'This week', streak:0,  ctx:'@phone',   quad:'q2', recurring:null,        done:false, sub:[] },
  // Finance
  { id:'t14', cat:'finance',  title:'Pay electricity bill',           effort:'s',  due:'Apr 22',    streak:0,  ctx:'@laptop',  quad:'q1', recurring:'Monthly',   done:false, sub:[] },
  { id:'t15', cat:'finance',  title:'Review monthly budget',          effort:'m',  due:'Sun',       streak:3,  ctx:'@laptop',  quad:'q2', recurring:'Monthly',   done:false, sub:[] },
  { id:'t16', cat:'finance',  title:'File quarterly tax return',      effort:'l',  due:'Apr 30',    streak:0,  ctx:'@laptop',  quad:'q1', recurring:'Quarterly', done:false,
    sub:[ { t:'Export bank statements', d:false }, { t:'Categorise expenses', d:false }, { t:'Submit', d:false } ] },
  // Learning
  { id:'t17', cat:'learning', title:'Finish chapter 4 — Atomic Habits',effort:'m', due:'Today',    streak:5,  ctx:'@anywhere',quad:'q2', recurring:'Daily',     done:false, sub:[] },
  { id:'t18', cat:'learning', title:'Spanish — 15 min Duolingo',      effort:'s',  due:'Today',     streak:21, ctx:'@phone',   quad:'q2', recurring:'Daily',     done:true,  sub:[] },
  { id:'t19', cat:'learning', title:'Watch Compose course module',    effort:'m',  due:'Wed',       streak:0,  ctx:'@laptop',  quad:'q2', recurring:null,        done:false, sub:[] },
  // Family
  { id:'t20', cat:'family',   title:'Call Mum',                       effort:'s',  due:'Sun',       streak:11, ctx:'@phone',   quad:'q2', recurring:'Weekly',    done:false, sub:[] },
  { id:'t21', cat:'family',   title:'Plan weekend outing',            effort:'m',  due:'Fri',       streak:0,  ctx:'@anywhere',quad:'q2', recurring:null,        done:false, sub:[] },
  // Mammoth + Gargantuan examples
  { id:'t22', cat:'work',     title:'Annual performance review prep', effort:'xl', due:'Apr 30',    streak:0,  ctx:'@laptop',  quad:'q1', recurring:'Yearly',    done:false,
    sub:[ { t:'Gather peer feedback', d:false }, { t:'Draft self-assessment', d:false }, { t:'Review goals vs actuals', d:false }, { t:'Final write-up', d:false } ] },
  { id:'t23', cat:'home',     title:'Spring whole-home clean',        effort:'xxl',due:'This week', streak:0,  ctx:'@home',    quad:'q4', recurring:'Yearly',    done:false,
    sub:[ { t:'Bedrooms deep clean', d:false }, { t:'Kitchen & appliances', d:false }, { t:'Bathroom refresh', d:false }, { t:'Garage sort-out', d:false }, { t:'Garden prep', d:false } ] },
]

export const SEED_GOALS: Goal[] = [
  { id:'g1', title:'Run a 10km in under 50 min',   area:'health',   horizon:'12 weeks', progress:0.62, why:'Energy for the year ahead.',       linked:['t10','t11'] },
  { id:'g2', title:'Save $8,000 emergency buffer', area:'finance',  horizon:'6 months', progress:0.45, why:'Quiet mind, fewer decisions.',       linked:['t15','t16'] },
  { id:'g3', title:'Read 12 books this year',       area:'learning', horizon:'2026',     progress:0.33, why:'Stay curious. Stay humble.',         linked:['t17'] },
  { id:'g4', title:'Sunday evenings phone-free',    area:'family',   horizon:'Ongoing',  progress:0.78, why:"Be where my feet are.",              linked:['t20'] },
]

export const SEED_JOURNAL: JournalEntry[] = [
  { id:'j1', date:'Apr 18', kind:'evening',
    win:'Finished the OKR draft a day early.',
    diff:'Started the gym session earlier.',
    lesson:'Mornings are for hard things.',
    tomorrow:'Walk before breakfast.' },
  { id:'j2', date:'Apr 18', kind:'morning',
    gratitude:['warm coffee','a quiet flat','last week\'s long walk'],
    intention:'Move with patience, not urgency.',
    priorities:['OKR draft','30-min walk','Call Mum'] },
  { id:'j3', date:'Apr 17', kind:'evening',
    win:'Held the breath practice through a tough call.',
    diff:'Less screen after 9pm.',
    lesson:'Pauses are productive.',
    tomorrow:'Finish chapter 4.' },
]

export const SEED_INBOX: InboxItem[] = [
  { id:'i1', kind:'capture', text:'Idea: batch errands on Saturday morning',        when:'9:14 AM',   processed:false },
  { id:'i2', kind:'rss',     source:'AFR — Personal Finance', text:'2026 super contribution caps explained', when:'8:02 AM', processed:false },
  { id:'i3', kind:'capture', text:'Voice memo: \u201Cbook dentist for May\u201D',   when:'Yesterday', processed:false },
  { id:'i4', kind:'rss',     source:'NYT — Well', text:'A 4-minute breathing routine for desk workers', when:'Yesterday', processed:false },
  { id:'i5', kind:'email',   text:'Energy bill arriving \u2014 due Apr 22',         when:'Mon',       processed:false },
]
