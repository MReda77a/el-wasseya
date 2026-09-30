/* ==========================================================
   El Wasseya — game engine (shared by the server and the browser)
   In the browser it defines globals; in Node it is required().
   ========================================================== */
const SPEED = (typeof location!=='undefined' && location.hash==='#fast') ? 0.08
            : (typeof process!=='undefined' && process.env && process.env.WSY_FAST) ? 0.08 : 1;
const D = {INTRO:8, WILL:75, TURN:40, REVEAL:15, ANS:10, ACCUSE:25, RESULTS:14, TALK:30, VOTE:20, WILLS:6, WILLEACH:10};
const dur = k => D[k]*1000*SPEED;
const TURNS = 6, MAXP = 10, MINP = 4;

/* ============ helpers ============ */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rid = (n=6) => Array.from({length:n},()=> 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random()*31)]).join('');
const shuffle = a => { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const pick = a => a[Math.floor(Math.random()*a.length)];
const cCol = c => Math.floor(c/9), cNum = c => c%9+1, CK = ['r','b','g'];
const valid3 = g => Array.isArray(g) && g.length===3 && new Set(g).size===3 && g.every(x=>Number.isInteger(x)&&x>=0&&x<27);
const nCorrect = (g, vault) => Array.isArray(g) ? [...new Set(g)].filter(x=>vault.includes(x)).length : 0;
const rankPts = (pos, N) => (N>1 && pos===N-1) ? 0 : ([10,7,5,3,2][pos] ?? 1);
const GIVE = ['give','asker','above','first','revive'];
const WTYPES = ['give','asker','above','first','revive','minus','skip','take','swap','expose','cancel'];
const ABIL = ['mo7','sa2r','nadara','talmee7','dar3','kashf','ekhras','fakh','tabdeel','hamsa','so2al'];
const ABNEED = {mo7:'T', sa2r:'I', kashf:'T', ekhras:'T', tabdeel:'H'};
function ansOptions(q, nmax, hs){ if(q===0){ const o=[]; for(let x=hs; x<=nmax*hs; x++) o.push(x); return o; } if(q===6){ const o=[]; for(let x=1;x<=nmax;x++) o.push(x); return o; } return [1,0]; }
const EVENTS = ['dark','truth','liars','fast','fakehint','double','silence','kareem','fadee7a','memory'];
const LEVELS = { easy:{tb:3, init:2, gold:2}, normal:{tb:8, init:1, gold:1}, hard:{tb:9, init:1, gold:0} };
const NEEDT = {give:1,minus:1,skip:1,take:1,swap:2,expose:1,cancel:1};
const DAREN = 10;   // number of ready-made real-life dares (texts live in the translations: dares)

function answer(hand, q, th){
  const n = hand.map(cNum), c = hand.map(cCol);
  switch(q){
    case 0: return n.reduce((a,b)=>a+b,0);
    case 1: return +c.includes(0); case 2: return +c.includes(1); case 3: return +c.includes(2);
    case 4: return +n.some(x=>x>th); case 5: return +(new Set(c).size===1);
    case 6: return Math.max(...n); case 7: return +n.some(x=>x%2===0);
  }
}
function lieAnswer(q, truth, nmax, hs){
  if(q===0){ const o=[]; for(let x=hs; x<=nmax*hs; x++) if(x!==truth) o.push(x); return pick(o); }
  if(q===6){ const o=[]; for(let x=1; x<=nmax; x++) if(x!==truth) o.push(x); return pick(o); }
  return truth ? 0 : 1;
}
function hintVal(ty, v, p){
  const n=v.map(cNum), c=v.map(cCol), s=n.reduce((a,b)=>a+b,0);
  switch(ty){ case 0: return s; case 2: return c.filter(x=>x===p).length; case 3: return Math.max(...n); case 4: return n.filter(x=>x%2===0).length;
    case 5: return +n.some(x=>x>p); case 6: return Math.min(...n); case 7: return +(new Set(c).size===3); case 8: return +n.includes(p); case 9: return +v.includes(p); }
}
function hintHolds(h, v){ if(h[0]===0){ const s=hintVal(0,v); return s>=h[1] && s<=h[2]; } return hintVal(h[0], v, h[1])===h[2]; }
function makeHint(vault, used, nmax, th){
  const c = [];
  if(!used.some(u=>u[0]===0)){ const s=hintVal(0,vault); const lo=Math.max(3, s-Math.floor(Math.random()*4)); c.push([0,lo,lo+3]); }
  for(const col of [0,1,2]) c.push([2,col,hintVal(2,vault,col)]);
  c.push([3,0,hintVal(3,vault)],[4,0,hintVal(4,vault)],[5,th,hintVal(5,vault,th)],[6,0,hintVal(6,vault)],[7,0,hintVal(7,vault)]);
  for(let k=1;k<=nmax;k++) c.push([8,k,hintVal(8,vault,k)]);
  const fresh = c.filter(h=>!used.some(u=>u[0]===h[0] && u[1]===h[1]));
  return pick(fresh.length ? fresh : c);
}
function deckFor(nmax){ const d=[]; for(const col of [0,1,2]) for(let n=0;n<nmax;n++) d.push(col*9+n); return d; }
function consistentTriples(pool, hints){
  const out=[]; for(let i=0;i<pool.length;i++) for(let j=i+1;j<pool.length;j++) for(let k=j+1;k<pool.length;k++){ const v=[pool[i],pool[j],pool[k]]; if(hints.every(h=>hintHolds(h,v))) out.push(v); } return out;
}
function bestGuess(tr){
  if(!tr.length) return null;
  const f={}; for(const v of tr) for(const x of v) f[x]=(f[x]||0)+1;
  let best=tr[0], bs=-1; for(const v of tr){ const s=v.reduce((a,x)=>a+f[x],0); if(s>bs){bs=s;best=v;} } return best;
}

/* ============ HOST ENGINE ============ */
class Host {
  constructor(code, myId, solo){
    this.code = code; this.me = myId; this.solo = solo;
    this.P = []; this.ph = 'lobby'; this.v = 0; this.r = 0; this.R = 1; this.tn = 0; this.fin = false;
    this.peersPids = new Set(); this.peerInputs = {}; this.myInput = {}; this.lvl = 'normal'; this.simple = false;
    this.resetGame();
  }
  resetGame(){
    this.r=0; this.tn=0; this.fin=false; this.vault=[]; this.hands={}; this.table=[]; this.hints=[]; this.lg=[]; this.ev=[]; this.peeks={};
    this.paused=false; this.acts=[]; this.res=null; this.court=null; this.el=null; this.win=null; this.revCount=0; this.evk=null; this.elimOrder=[]; this.pending=[]; this.courtNo=0; this.opens=0; this.dl=0;
    this.st={}; this.bestW=null; this.bo=[]; this.whs=[];
    for(const p of this.P) Object.assign(p, {pts:0, alive:true, rp:0, open:null, lieUsed:false, liedTo:[], caught:false, skip:false, skipNext:false, will:null, willUsed:false, cancelled:false, askedBy:{}, acted:false, outPts:0});
  }
  add(id, name, bot){
    if(this.P.find(p=>p.id===id) || this.P.length>=MAXP) return;
    this.P.push({id, name:String(name).slice(0,14), bot:!!bot, pts:0, alive:true, rp:0, open:null, lieUsed:false, liedTo:[], caught:false, skip:false, skipNext:false, will:null, willUsed:false, cancelled:false, askedBy:{}, acted:false, outPts:0});
  }
  p(id){ return this.P.find(x=>x.id===id); }
  /** end-of-game stats for the awards */
  stat(id, k, n){ if(!id) return; const s = this.st[id] || (this.st[id] = {}); s[k] = (s[k]||0) + (n==null ? 1 : n); }
  alive(){ return this.P.filter(p=>p.alive); }
  conn(p){ return p.bot || this.solo || this.peersPids.has(p.id); }
  inputs(){ const I = {...this.peerInputs}; if(this.solo) I[this.me] = this.myInput; for(const p of this.P) if(p.bot) I[p.id] = p.bi || {}; return I; }
  eligible(){ return this.P.filter(p=>p.alive && !p.skip && !p.open && this.conn(p)); }
  allOk(I){ const k = this.key(); const hs = this.P.filter(p=>!p.bot && this.conn(p)); return hs.length>0 && hs.every(p=>I[p.id]?.rk===k); }
  pause(){ if(this.paused || this.ph==='lobby' || this.ph==='over') return; this.paused = true; this.pauseAt = Date.now(); }
  resume(){ if(!this.paused) return; this.dl += Date.now() - this.pauseAt; this.paused = false; }
  key(){ return `${this.ph}-${this.r}-${this.tn}-${this.courtNo}`; }
  set(ph, k){ this.ph = ph; this.dl = Date.now() + (k ? dur(k) : 0); }

  start(){
    if(this.P.length < 2) return;
    this.resetGame();
    this.R = Math.min(4, this.P.length-1);
    this.set('will','WILL');
  }
  tick(){
    const now = Date.now(), I = this.inputs();
    if(this.ph==='lobby' || this.ph==='over') return;
    if(this.paused) return;
    this.bots(I, now);
    const hx = I[this.me]?.nx === this.key();
    switch(this.ph){
      case 'will': {
        for(const p of this.P){ const w = I[p.id]?.w; if(w) p.will = this.cleanWill(w, p.id); p.wd = !!I[p.id]?.wd || p.bot; }
        const humans = this.P.filter(p=>!p.bot && this.conn(p));
        if(now > this.dl || humans.every(p=>p.wd)) { for(const p of this.P.filter(p=>p.bot)) if(!p.will) p.will = p.bi?.w ? this.cleanWill(p.bi.w,p.id) : null; this.startRound(); }
        break; }
      case 'intro': if(now > this.dl || hx) this.nextTurn(); break;
      case 'turn': {
        this.processGhosts(I);
        this.processAbilities(I);
        this.processOpens(I);
        if(this.ph!=='turn') break;
        const cp = this.p(this.cur);
        if(!cp || !cp.alive || cp.skip || cp.open || !this.conn(cp)){ this.resolveTurn(I, null); break; }
        const a = I[cp.id]?.a;
        if(a && a.r===this.r && a.tn===this.tn){ const bad = a.k==='q' && (this.evk==='silence' || cp.muted); this.resolveTurn(I, bad ? {id:cp.id, k:'n'} : {id:cp.id, k:a.k, i:a.i, t:a.t, q:a.q}); break; }
        if(now > this.dl) this.resolveTurn(I, null);
        break; }
      case 'ans': {
        this.processGhosts(I); this.processAbilities(I); this.processOpens(I); if(this.ph!=='ans') break;
        const pd = this.pend, T = this.p(pd.t), v = I[pd.t]?.ans;
        if(v && v.k===pd.k) this.finishAns(v.v);
        else if(!T || !this.conn(T) || now > this.dl) this.finishAns(pd.truth);
        break; }
      case 'reveal':
        this.processGhosts(I);
        this.processAbilities(I);
        this.processOpens(I);
        if(this.ph==='reveal' && (now > this.dl || this.allOk(I))) this.afterReveal();
        break;
      case 'accuse': {
        const humans = this.alive().filter(p=>!p.bot && !p.open && this.conn(p));
        if(now > this.dl || humans.every(p=>I[p.id]?.dn===this.r)) this.scoreRound(I);
        break; }
      case 'results': if(now > this.dl || hx) this.afterResults(); break;
      case 'talk': if(now > this.dl || hx) this.set('vote','VOTE'); break;
      case 'vote': {
        const voters = this.voters();
        const ck = this.courtKey();
        const all = voters.every(p=>{ const v=I[p.id]?.vt; return v && v.k===ck && this.court.d.includes(v.t); });
        if(now > this.dl || all) this.resolveCourt(I);
        break; }
      case 'wills': if(now > this.dl || hx || this.allOk(I)) this.afterWills(); break;
    }
  }
  cleanWill(w, selfId){
    const types = new Set(), people = new Set(); let give = false;
    const c = (Array.isArray(w.c)?w.c:[]).filter(x=>Array.isArray(x) && WTYPES.includes(x[0])).map(x=>[x[0], x[1]||null, x[2]||null])
      .filter(x=>{ const n=NEEDT[x[0]]||0; if(n>=1 && (!this.p(x[1]) || x[1]===selfId)) return false; if(n===2 && (!this.p(x[2]) || x[2]===selfId || x[2]===x[1])) return false;
        if(types.has(x[0])) return false; if(GIVE.includes(x[0])){ if(give) return false; give = true; }
        const ps = [x[1], x[2]].filter(Boolean); if(ps.some(p=>people.has(p))) return false;
        types.add(x[0]); ps.forEach(p=>people.add(p)); return true; }).slice(0,2);
    let d = null; const wd = w.d;
    if(wd && typeof wd==='object'){
      const i = Number.isInteger(wd.i) && wd.i>=0 && wd.i<DAREN ? wd.i : -1;
      const x = String(wd.x||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,40);
      const t = wd.t==='all' ? 'all' : (this.p(wd.t) && wd.t!==selfId ? wd.t : null);
      if(t && (i>=0 || x)) d = {i, x: i>=0 ? '' : x, t};
    }
    return {c, x: String(w.x||'').slice(0,80), d};
  }
  startRound(){
    this.r++; this.tn = 0; this.hints = []; this.lg = []; this.ev = []; this.peeks = {}; this.opens = 0; this.res = null; this.el = null; this.court = null; this.pkp = []; this.mutes = []; this.pkl = []; this.whs = []; this.bo = [];
    this.revs = [];
    for(const p of this.P){ if(!p.alive && p.reviveNext){ const mins = this.alive().map(x=>x.pts); p.alive = true; p.pts = mins.length ? Math.min(...mins) : 0; p.reviveNext = false; this.revCount = (this.revCount||0)+1; p.revived = true; this.revs.push(p.id); } }
    const prevEv = this.evk;
    this.evk = (!this.simple && this.r>=2 && Math.random()<0.6) ? pick(EVENTS.filter(x=>x!==prevEv)) : null;
    const al = this.alive(); this.fin = al.length === 2;
    const n = al.length;
    this.hs = n>=5 ? 1 : 2;
    const LV = LEVELS[this.lvl] || LEVELS.normal; this.nmax = Math.min(9, Math.max(4, Math.ceil((3 + this.hs*n + LV.tb)/3)));
    this.th = Math.ceil(this.nmax/2);
    const deck = shuffle(deckFor(this.nmax));
    this.vault = deck.splice(0,3); this.hands = {};
    for(const p of al){ this.hands[p.id] = deck.splice(0,this.hs); p.known = [...this.hands[p.id]]; p.pkIdx = []; }
    this.table = deck;
    this.fakeAt = this.evk==='fakehint' ? pick([1,2,4,5]) : -1; this.fk = null;
    if(this.evk!=='dark'){ for(let q=0; q<LV.init; q++) this.addHint(0); }
    for(const p of this.P){ p.rp=0; p.open=null; p.lieUsed=false; p.lies=0; p.liedTo=[]; p.caught=false; p.acted=false; p.skip = p.alive && p.skipNext; p.skipNext=false;
      p.ab=[]; p.abUsed=[]; p.ar=[]; p.shield=0; p.trap=0; p.whisper=0; p.muted=0; p.privHints=[]; p.ghH=[]; p.whS=null; }
    const pool = ABIL.filter(k=>!(this.evk==='silence' && k==='so2al') && !(this.evk==='truth' && ['fakh','dar3','kashf'].includes(k)) && !(k==='tabdeel' && !this.table.length) && !(k==='sa2r' && !this.table.length));
    for(const p of al) p.ab = this.simple ? [] : shuffle([...pool]).slice(0, this.evk==='kareem' ? 2 : 1);
    const ghosts = this.P.filter(x=>!x.alive && !x.revived);
    if(!this.simple && !this.revCount && al.length>=4 && this.r < this.R-1 && ghosts.length && Math.random()<.4) pick(ghosts).ab = ['rog3a'];
    const ord = al.map(p=>p.id); const sh = (this.r-1) % Math.max(1, ord.length);
    this.order = [...ord.slice(sh), ...ord.slice(0, sh)];
    this.LAPS = al.length<=4 ? 3 : 2; this.lap = 1; this.ti = -1; this.cur = null; this.la = null;
    this.set('intro','INTRO');
  }
  canTurn(id){ const p = this.p(id); return p && p.alive && !p.skip && !p.open && this.conn(p); }
  lapEnd(){
    const gold = (LEVELS[this.lvl]||LEVELS.normal).gold; if((gold>=1 && this.lap===1) || (gold>=2 && this.lap===2 && this.alive().length>=8)){ const left = this.vault.filter(c=>!this.hints.some(h=>h[0]===9 && h[1]===c)); if(left.length) this.hints.push([9, pick(left), 1]); }
  }
  nextTurn(){
    if(!this.order.some(id=>this.canTurn(id))) return this.endTurns();
    for(let guard=0; guard<40; guard++){
      this.ti++;
      if(this.ti >= this.order.length){ this.ti = 0; this.lapEnd(); this.lap++; if(this.lap > this.LAPS) return this.endTurns(); }
      if(this.canTurn(this.order[this.ti])) break;
    }
    if(this.tn>0 && this.evk!=='dark' && this.tn % Math.max(2, Math.ceil(this.order.length/2)) === 0) this.addHint(this.tn);
    this.cur = this.order[this.ti]; this.tn++; this.la = null;
    for(const p of this.P) p.acted = p.id===this.cur ? false : p.acted;
    this.set('turn','TURN'); if(this.evk==='fast') this.dl = Date.now() + 20000*SPEED;
  }
  endTurns(){
    this.cur = null;
    if(this.fin) return this.finalCourt();
    if(this.alive().every(p=>p.open)) return this.scoreRound(this.inputs());
    this.set('accuse','ACCUSE');
  }
  lieMax(){ return this.evk==='truth' ? 0 : this.evk==='liars' ? 2 : 1; }
  addHint(slot){
    if(this.fakeAt>=0 && this.hints.length===this.fakeAt){
      for(let k=0;k<60;k++){ const fv = shuffle(deckFor(this.nmax)).slice(0,3); const h = makeHint(fv, this.hints, this.nmax, this.th); if(h[0]!==9 && !hintHolds(h, this.vault)){ this.fk = this.hints.length; this.hints.push(h); return; } }
    }
    this.hints.push(makeHint(this.vault, this.hints, this.nmax, this.th));
  }
  askQ(A, T, q, I, tag){
    if(!T || !T.alive || T.id===A.id || !this.hands[T.id] || !(q>=0 && q<8) || (this.hs===1 && [0,5,6].includes(q))) return false;
    let ans = answer(this.hands[T.id], q, this.th), lied = false;
    const shield = A.shield===this.r, L = I[T.id]?.lie;
    if(!shield && this.evk!=='truth' && T.trap===this.r){ ans = lieAnswer(q, ans, this.nmax, this.hs); T.trap = -1; lied = true; }
    else if(!shield && L && L.r===this.r && L.n===T.lies && T.lies < this.lieMax()){ ans = lieAnswer(q, ans, this.nmax, this.hs); T.lies++; T.lieUsed = T.lies>=this.lieMax(); lied = true; }
    if(lied) T.liedTo.push(A.id);
    T.askedBy[A.id] = (T.askedBy[A.id]||0)+1;
    this.lg.push([this.tn, A.id, T.id, q, ans, T.whisper===this.r?1:0, tag||0]);
    return true;
  }
  processAbilities(I){
    for(const p of this.P){
      const u = I[p.id]?.au; if(!u || u.r!==this.r || !p.ab) continue;
      for(const k of p.ab){ if(p.abUsed.includes(k) || !u[k]) continue; if(this.useAbility(p, k, u[k], I)){ p.abUsed.push(k); this.stat(p.id,'ab'); } }
    }
  }
  useAbility(p, k, x, I){
    if(k==='rog3a'){ if(p.alive || this.alive().length<3) return false; p.reviveNext = true; p.ar.push(['rog3a']); return true; }
    if(!p.alive) return false;
    const T = x.t ? this.p(x.t) : null;
    switch(k){
      case 'mo7': if(!T || !T.alive || T===p || !this.hands[T.id]) return false; this.lg.push([this.tn, p.id, T.id, 8, this.hands[T.id].map(cNum).join(' · '), 0, 1]); p.ar.push(['mo7', T.id]); return true;
      case 'sa2r': { const i = x.i; if(!Number.isInteger(i) || i<0 || i>=this.table.length) return false; const c = this.table[i]; p.known = p.known||[]; if(!p.known.includes(c)) p.known.push(c); p.ar.push(['sa2r', i, c]); if(this.evk==='fadee7a') this.pkp.push([this.tn, p.id, c]); return true; }
      case 'nadara': p.ar.push(['nadara', cCol(pick(this.vault))]); return true;
      case 'talmee7': { const h = makeHint(this.vault, [...this.hints, ...p.privHints], this.nmax, this.th); p.privHints.push(h); p.ar.push(['talmee7', h]); return true; }
      case 'dar3': p.shield = this.r; p.ar.push(['dar3']); return true;
      case 'kashf': if(!T || T===p) return false; p.ar.push(['kashf', T.id, T.liedTo.length?1:0]); return true;
      case 'ekhras': if(!T || !T.alive || T===p) return false; T.muted = true; this.mutes.push([this.tn, T.id]); p.ar.push(['ekhras', T.id]); return true;
      case 'fakh': if(this.evk==='truth') return false; p.trap = this.r; p.lieUsed = false; p.ar.push(['fakh']); return true;
      case 'tabdeel': { const hand = this.hands[p.id]; const i = Number.isInteger(x.i) ? x.i : 0; if(!hand || i<0 || i>=hand.length || !this.table.length) return false; const j = Math.floor(Math.random()*this.table.length); const old = hand[i], nw = this.table[j]; hand[i] = nw; this.table[j] = old; p.known = p.known||[]; if(!p.known.includes(nw)) p.known.push(nw); p.ar.push(['tabdeel', old, nw]); return true; }
      case 'hamsa': p.whisper = this.r; p.ar.push(['hamsa']); return true;
      case 'so2al': if(this.evk==='silence') return false; p.extraQ = this.r; p.ar.push(['so2al']); return true;
    }
    return false;
  }
  /** A ghost can whisper one hint per round to a living player. They choose if it's true or a lie. */
  processGhosts(I){
    for(const g of this.P){
      if(g.alive) continue; const w = I[g.id]?.wh;
      if(!w || w.r!==this.r || g.whR===this.r) continue;
      const T = this.p(w.t); if(!T || !T.alive || !this.hands[T.id]) continue;
      let h = null;
      if(w.s) h = makeHint(this.vault, [...this.hints, ...(T.privHints||[]), ...(T.ghH||[]).map(x=>x[1])], this.nmax, this.th);
      else for(let k=0; k<60 && !h; k++){ const c = makeHint(shuffle(deckFor(this.nmax)).slice(0,3), this.hints, this.nmax, this.th); if(c[0]!==9 && !hintHolds(c, this.vault)) h = c; }
      if(!h) continue;
      g.whR = this.r; g.whS = [this.r, T.id, h, w.s?1:0];
      (T.ghH = T.ghH || []).push([g.id, h]);
      this.whs.push([this.tn, g.id, T.id]); this.stat(g.id,'wh');
    }
  }
  processOpens(I){
    for(const p of this.P){
      if(!p.alive || p.skip || p.open) continue;
      const o = I[p.id]?.o;
      if(!o || o.r!==this.r || !valid3(o.g)) continue;
      const c = nCorrect(o.g, this.vault), ok = c===3;
      p.open = ok ? {ok:true, ord:++this.opens} : c===2 ? {half:true, ord:++this.opens} : {ok:false};
      this.ev.push([p.id, ok?1:c===2?2:0, this.tn]); this.stat(p.id, ok?'ok':c===2?'hf':'bad');
      if(ok && this.fin){ this.win = p.id; this.set('over'); return; }
    }

  }
  resolveTurn(I, a){
    const cp = this.p(this.cur); if(cp){ cp.acted = true; }
    if(cp && cp.muted){ cp.muted = false; }
    if(!a || a.k==='n'){ this.la = [this.cur, 'n']; this.set('reveal'); this.dl = Date.now() + 3000*SPEED; return; }
    if(a.k==='p' && Number.isInteger(a.i) && a.i>=0 && a.i<this.table.length){
      this.peeks[a.id] = [a.i, this.table[a.i], this.tn]; this.stat(a.id,'pk'); (this.pkl = this.pkl || []).push([this.tn, a.id, a.i]); if(this.evk==='fadee7a') this.pkp.push([this.tn, a.id, this.table[a.i]]);
      const pp=this.p(a.id); if(pp){ pp.known=pp.known||[]; if(!pp.known.includes(this.table[a.i])) pp.known.push(this.table[a.i]); pp.pkIdx=(pp.pkIdx||[]); pp.pkIdx.push(a.i); }
      this.la = [a.id, 'p', a.i]; this.set('reveal'); this.dl = Date.now() + 8000*SPEED; return;
    }
    if(a.k==='q'){ const A = this.p(a.id), T = this.p(a.t), q = a.q;
      if(A && T && T.alive && T.id!==A.id && this.hands[T.id] && q>=0 && q<8 && !(this.hs===1 && [0,5,6].includes(q))){
        this.pend = {a:A.id, t:T.id, q, truth:answer(this.hands[T.id], q, this.th), k:this.r+'-'+this.tn};
        this.set('ans','ANS'); return; } }
    this.la = [this.cur, 'n']; this.set('reveal'); this.dl = Date.now() + 3000*SPEED;
  }
  canLie(T, A){ return this.evk!=='truth' && A && A.shield!==this.r && (T.lies||0) < this.lieMax() + (T.trap===this.r ? 1 : 0); }
  finishAns(v){
    const pd = this.pend, A = this.p(pd.a), T = this.p(pd.t);
    let ans = pd.truth;
    if(T && v!==pd.truth && ansOptions(pd.q, this.nmax, this.hs).includes(v) && this.canLie(T, A)){ ans = v; T.lies = (T.lies||0)+1; T.lieUsed = T.lies >= this.lieMax() + (T.trap===this.r?1:0); T.liedTo.push(pd.a); }
    if(T){ T.askedBy[pd.a] = (T.askedBy[pd.a]||0)+1; }
    this.stat(pd.a,'q'); this.stat(pd.t,'a'); if(ans!==pd.truth) this.stat(pd.t,'l');
    this.lg.push([this.tn, pd.a, pd.t, pd.q, ans, T && T.whisper===this.r ? 1 : 0, 0]);
    this.la = [pd.a, 'q', pd.t, pd.q]; this.pend = null;
    this.set('reveal','REVEAL');
  }
  afterReveal(){
    const cp = this.p(this.cur);
    if(cp && cp.extraQ===this.r && this.la && this.la[1]!=='n' && this.canTurn(cp.id)){ cp.extraQ = -1; cp.acted = false; this.tn++; this.la = null; this.set('turn','TURN'); if(this.evk==='fast') this.dl = Date.now() + 20000*SPEED; return; }
    this.nextTurn();
  }
  scoreRound(I){
    const al = this.alive(), N = al.length, D = {};
    const okO = al.filter(p=>p.open?.ok).sort((a,b)=>a.open.ord-b.open.ord);
    const halfO = al.filter(p=>p.open?.half).sort((a,b)=>a.open.ord-b.open.ord);
    const wrong = al.filter(p=>p.open && !p.open.ok && !p.open.half);
    const rest = al.filter(p=>!p.open).map(p=>({p, c:nCorrect(I[p.id]?.g, this.vault)})).sort((a,b)=>b.c-a.c);
    okO.forEach((p,i)=>{ p.rp = rankPts(i,N); D[p.id] = {rank:i+1, c:3, base:p.rp}; });
    let i = okO.length;
    for(const p of halfO){ p.rp = rankPts(i,N); D[p.id] = {rank:i+1, c:2, base:p.rp}; i++; }
    while(rest.length){ const c = rest[0].c; const grp = []; while(rest.length && rest[0].c===c) grp.push(rest.shift()); let pts = 0; if(c>0){ let sum=0; for(let j=0;j<grp.length;j++) sum+=rankPts(i+j,N); pts=Math.floor(sum/grp.length); } for(const g of grp){ g.p.rp = pts; D[g.p.id] = {rank:i+1, c, base:pts}; } i += grp.length; }
    for(const p of wrong){ p.rp = -5; D[p.id] = {rank:N, c:nCorrect(I[p.id]?.o?.g, this.vault), base:-5}; }
    if(this.evk==='double') for(const p of al) p.rp *= 2;
    for(const g of this.P.filter(p=>!p.alive)){
      const gh = I[g.id]?.gh; if(!gh || gh.r!==this.r) continue; const T = this.p(gh.t); if(!T || !T.alive) continue;
      const d = gh.s>0?2:-2; T.rp += d; D[T.id].gh = (D[T.id].gh||0)+d;
    }
    if(this.pending.length){ const f = okO[0]; if(f){ const amt = this.pending.reduce((s,x)=>s+x,0); f.pts += amt; D[f.id].beq = amt; } this.pending = []; }
    for(const p of al) p.pts += p.rp;
    const order = [...okO, ...halfO, ...al.filter(p=>!p.open).sort((a,b)=>D[a.id].rank-D[b.id].rank), ...wrong];
    this.res = order.map(p=>{ const d=D[p.id]; return [p.id, p.rp, d.rank, d.c, d.acc||0, d.liar||0, d.gh||0, d.beq||0]; });
    this.lastVault = this.vault.slice();
    this.set('results','RESULTS');
  }
  afterResults(){
    const al = this.alive().sort((a,b)=>a.pts-b.pts);
    if(al.length <= 2){ return this.startRound(); }
    let k = this.r >= this.R-1 ? al.length-2 : Math.ceil((al.length-2)/Math.max(1,this.R-this.r));
    k = Math.max(1, Math.min(k, al.length-2));
    const b = al[k-1].pts, below = al.filter(p=>p.pts<b), tied = al.filter(p=>p.pts===b);
    if(below.length + tied.length === k) return this.eliminate([...below, ...tied]);
    this.courtNo++;
    this.court = {d: tied.map(p=>p.id), m: k-below.length, sure: below.map(p=>p.id), win:false};
    this.set('talk'); this.dl = Date.now() + Math.min(D.TALK*tied.length, 120)*1000*SPEED;
  }
  finalCourt(){
    const al = this.alive();
    this.courtNo++;
    this.court = {d: al.map(p=>p.id), m:1, sure:[], win:true};
    if(this.voters().length===0){ const w = al.sort((a,b)=>b.pts-a.pts)[0]; this.win = w?.id; return this.set('over'); }
    this.set('talk'); this.dl = Date.now() + Math.min(D.TALK*al.length, 120)*1000*SPEED;
  }
  courtKey(){ return this.r+'-'+this.courtNo; }
  voters(){ return this.court ? this.P.filter(p=>!this.court.d.includes(p.id) && this.conn(p) && (this.court.win ? !p.alive : true)) : []; }
  resolveCourt(I){
    const ck = this.courtKey(), cnt = {}; for(const id of this.court.d) cnt[id]=0;
    for(const v of this.voters()){ const x = I[v.id]?.vt; if(x && x.k===ck && x.t in cnt) cnt[x.t]++; }
    const rnd = {}; for(const id of this.court.d) rnd[id]=Math.random();
    if(this.court.win){
      const w = [...this.court.d].sort((a,b)=> cnt[b]-cnt[a] || this.p(b).pts-this.p(a).pts || rnd[a]-rnd[b])[0];
      this.court.cnt = cnt; this.win = w; return this.set('over');
    }
    const sorted = [...this.court.d].sort((a,b)=> cnt[b]-cnt[a] || this.p(a).rp-this.p(b).rp || rnd[a]-rnd[b]);
    const out = sorted.slice(0, this.court.m);
    this.court.cnt = cnt;
    this.eliminate([...this.court.sure, ...out].map(id=>this.p(id)));
  }
  eliminate(list){
    const standing = this.alive().sort((a,b)=>a.pts-b.pts).map(p=>p.id);
    const queue = [...list].sort((a,b)=>a.pts-b.pts), ann = [], before = this.elimOrder.length;
    while(queue.length){ const E = queue.shift(); if(!E.alive) continue; E.alive = false; this.elimOrder.push(E.id); this.execWill(E, queue, ann, standing); }
    const outNow = this.elimOrder.slice(before), I = this.inputs(); this.bo = [];
    for(const g of this.P){ if(g.alive || outNow.includes(g.id)) continue; const b = I[g.id]?.bt; if(b && b.r===this.r && outNow.includes(b.t)){ this.bo.push([g.id, b.t]); this.stat(g.id,'bet'); } }
    this.el = ann;
    this.set('wills'); this.dl = Date.now() + (D.WILLS + D.WILLEACH*ann.length)*1000*SPEED;
  }
  execWill(E, queue, ann, standing){
    const item = {id:E.id, pts:E.pts, cl:[], x:''};
    ann.push(item);
    E.outPts = E.pts; this.stat(E.id,'out',0); this.st[E.id].out = this.r;
    const P0 = Math.max(0, E.pts); E.pts = 0;
    if(!E.will || E.willUsed){ item.none = 1; return; }
    E.willUsed = true;
    item.x = E.will.x || '';
    if(E.cancelled){ item.cancelled = 1; this.stat(E.id,'hit'); return; }
    if(E.will.d) item.d = E.will.d;
    const cl = E.will.c, share = P0;
    const aliveCount = () => this.alive().length - queue.filter(q=>q.alive).length;
    for(const [k, t1, t2] of cl){
      const r = {k, t:t1, t2, ok:0, a:0}; const T1 = this.p(t1), T2 = this.p(t2);
      switch(k){
        case 'give': if(T1?.alive){ T1.pts += share; r.ok=1; r.a=share; } break;
        case 'asker': { const ids = Object.keys(E.askedBy).filter(id=>this.p(id)?.alive).sort((a,b)=>E.askedBy[b]-E.askedBy[a]); if(ids[0]){ this.p(ids[0]).pts += share; r.t=ids[0]; r.ok=1; r.a=share; } break; }
        case 'above': { const idx = standing.indexOf(E.id); const up = standing.slice(idx+1).map(id=>this.p(id)).find(p=>p?.alive); if(up){ up.pts += share; r.t=up.id; r.ok=1; r.a=share; } break; }
        case 'first': if(share>0 || true){ this.pending.push(share); r.ok=1; r.a=share; } break;
        case 'revive': { const prev = [...this.elimOrder].reverse().map(id=>this.p(id)).find(p=>p && p.id!==E.id && !p.alive && !p.revived); if(prev){ prev.alive=true; prev.revived=true; prev.pts=share; prev.skip=false; r.t=prev.id; r.ok=1; r.a=share; } break; }
        case 'minus': if(T1?.alive){ T1.pts -= 5; r.ok=1; } break;
        case 'skip': if(T1?.alive){ T1.skipNext = true; r.ok=1; } break;
        case 'take': { if(T1?.alive && !queue.includes(T1)){ const bottom = this.alive().filter(p=>!queue.includes(p)).sort((a,b)=>a.pts-b.pts).slice(0,3); if(bottom.includes(T1) && aliveCount()-1 >= 2){ queue.push(T1); r.ok=1; } } break; }
        case 'swap': if(T1?.alive && T2?.alive){ this.stat(T1.pts>T2.pts?T1.id:T2.id,'hit'); [T1.pts, T2.pts] = [T2.pts, T1.pts]; r.ok=1; } break;
        case 'expose': if(T1){ r.ok=1; r.exp = T1.will && !T1.willUsed ? T1.will.c : []; r.expx = T1.will && !T1.willUsed ? T1.will.x : ''; } break;
        case 'cancel': if(T1 && T1.will && !T1.willUsed){ T1.cancelled = true; r.ok=1; } break;
      }
      if(r.ok && ['minus','skip','take','expose','cancel'].includes(k)) this.stat(r.t,'hit');
      if(r.ok && r.a>0 && ['give','asker','above','revive'].includes(k)) this.stat(r.t,'gv',r.a);
      item.cl.push([r.k, r.t, r.t2, r.ok, r.a, r.exp||null, r.expx||'']);
    }
    const sc = item.cl.filter(c=>c[3]).length*2 + (item.d?2:0) + (item.x?1:0);
    if(sc>0 && (!this.bestW || sc > this.bestW.sc)) this.bestW = JSON.parse(JSON.stringify({...item, sc}));
  }
  afterWills(){
    const al = this.alive();
    if(al.length <= 1){ this.win = al[0]?.id || this.elimOrder[this.elimOrder.length-1]; return this.set('over'); }
    if(this.r >= this.R && al.length > 2) this.R = this.r + 1;
    this.startRound();
  }
  bots(I, now){
    for(const b of this.P.filter(p=>p.bot)){
      b.bi = b.bi || {}; const bi = b.bi;
      if(!b.next) b.next = now + (500 + Math.random()*2500)*SPEED*3;
      if(now < b.next) continue;
      b.next = now + (800 + Math.random()*3000)*SPEED*3;
      const others = this.P.filter(p=>p.id!==b.id);
      if(this.ph==='will' && !bi.w){ const ty = pick(WTYPES); const t1 = pick(others)?.id; const t2 = pick(others.filter(o=>o.id!==t1))?.id; bi.w = {c:[[ty,t1,t2]], x:'', d: Math.random()<.25 ? {i:Math.floor(Math.random()*DAREN), t:pick([...others.map(o=>o.id),'all'])} : null}; }
      if(!b.alive && b.ab && b.ab[0]==='rog3a' && !b.abUsed.length && ['turn','reveal'].includes(this.ph) && Math.random()<.5) bi.au = {r:this.r, rog3a:{}};
      if(!b.alive){ if(['turn','reveal','accuse'].includes(this.ph) && bi.gh?.r!==this.r){ const T = pick(this.alive()); if(T) bi.gh = {r:this.r, t:T.id, s:pick([1,-1])}; }
        if(['turn','reveal','accuse'].includes(this.ph) && bi.bt?.r!==this.r){ const T = pick(this.alive()); if(T) bi.bt = {r:this.r, t:T.id}; }
        if(['turn','reveal'].includes(this.ph) && bi.wh?.r!==this.r && Math.random()<.3){ const T = pick(this.alive()); if(T) bi.wh = {r:this.r, t:T.id, s:pick([0,1])}; } }
      if(['turn','reveal'].includes(this.ph) && b.alive && !b.skip && !b.open){
        const tr0 = consistentTriples(deckFor(this.nmax).filter(c=>!(b.known||[]).includes(c)), this.hints), g0 = bestGuess(tr0);
        const myLeft = this.order.slice(this.ti+1).filter(id=>id===b.id).length + (this.LAPS-this.lap);
        if(g0 && (tr0.length===1 || (this.lap>=2 && tr0.length<=2) || (myLeft<=0 && tr0.length<=6))) bi.o = {r:this.r, g:g0};
      }
      if(this.ph==='turn' && this.cur===b.id && b.alive && !b.skip && !b.open && !b.acted){
        
        if(b.ab && b.ab.length && Math.random()<.35){ const k = b.ab.find(x=>!b.abUsed.includes(x)); if(k){ const T = pick(this.alive().filter(p=>p.id!==b.id)); bi.au = {...(bi.au&&bi.au.r===this.r?bi.au:{r:this.r}), [k]:{t:T?.id, i:k==='tabdeel'?0:Math.floor(Math.random()*Math.max(1,this.table.length)), q:pick([1,2,3,4,7])}}; } }
        const pool = deckFor(this.nmax).filter(c=>!(b.known||[]).includes(c));
        const tr = consistentTriples(pool, this.hints);
        const g = bestGuess(tr);
        {
          const idx = [...Array(this.table.length).keys()].filter(i=>!(b.pkIdx||[]).includes(i));
          if(idx.length && Math.random()<.75) bi.a = {r:this.r, tn:this.tn, k:'p', i:pick(idx)};
          else { const T = pick(this.alive().filter(p=>p.id!==b.id)); bi.a = (T && this.evk!=='silence' && !b.muted) ? {r:this.r, tn:this.tn, k:'q', t:T.id, q:pick(this.hs===1?[1,2,3,4,7]:[0,1,2,3,4,5,6,7])} : {r:this.r,tn:this.tn,k:'n'}; }
        }
      }
      if(this.ph==='accuse' && b.alive && bi.dn!==this.r){ bi.g = bestGuess(consistentTriples(deckFor(this.nmax).filter(c=>!(b.known||[]).includes(c)), this.hints)) || []; if(Math.random()<.5){ const T=pick(this.alive().filter(p=>p.id!==b.id)); if(T) bi.ac={r:this.r,t:T.id}; } bi.dn=this.r; }
      if(this.ph==='ans' && this.pend && this.pend.t===b.id && !(bi.ans && bi.ans.k===this.pend.k)){
        const opts = ansOptions(this.pend.q, this.nmax, this.hs).filter(x=>x!==this.pend.truth);
        const lie = this.canLie(b, this.p(this.pend.a)) && Math.random()<.3 && opts.length;
        bi.ans = {k:this.pend.k, v: lie ? pick(opts) : this.pend.truth};
      }
      if(this.ph==='vote' && this.court){ bi.vt = {k:this.courtKey(), t:pick(this.court.d)}; }
    }
  }
  pub(){
    const now = Date.now(), round = ['turn','reveal','accuse','ans'].includes(this.ph);
    const pv = {};
    const lm = this.lieMax();
    if(round || this.ph==='intro') for(const p of this.P){
      if(this.hands[p.id] && p.alive){ const wa = []; this.lg.forEach((l,ix)=>{ if(l[5] && (l[1]===p.id || l[2]===p.id)) wa.push([ix, l[4]]); });
        const lmx = lm + (p.trap===this.r?1:0);
        pv[p.id] = {h:this.hands[p.id], pk:this.peeks[p.id]||null, lu:(p.lies||0)>=lmx?1:0, lc:p.lies||0, lm:lmx, tr:(this.pend && this.pend.t===p.id)?this.pend.truth:null, cl:(this.pend && this.pend.t===p.id)?(this.canLie(p, this.p(this.pend.a))?1:0):0, ab:p.ab||[], au:p.abUsed||[], ar:p.ar||[], ph:p.privHints||[], mu:p.muted?1:0, wa, gw:p.ghH||[]}; }
      else if(!p.alive) pv[p.id] = {ab:p.ab||[], au:p.abUsed||[], ar:p.ar||[], ws:(p.whS && p.whS[0]===this.r) ? p.whS.slice(1) : null};
    }
    const lgPub = this.lg.map(l=> l[5] ? [l[0],l[1],l[2],l[3],null,1,l[6]] : l);
    const S = {
      c:this.code, h:this.me, ph:this.ph, r:this.r, R:this.R, tn:this.tn, TT:this.LAPS||2, lap:this.lap||1, cur:this.cur||null, pend:this.pend?{a:this.pend.a,t:this.pend.t,q:this.pend.q,k:this.pend.k}:null, la:this.la||null, ord:this.order||[], fin:this.fin?1:0, k:this.key(),
      P:this.P.map(p=>[p.id, p.name, p.alive?p.pts:(p.outPts||0), (p.alive?1:0)|(p.open?.ok?2:0)|(p.open&&!p.open.ok&&!p.open.half?4:0)|(p.open?.half?512:0)|(p.skip?8:0)|(p.bot?16:0)|(p.id===this.cur?32:0)|(this.conn(p)?64:0)|(p.wd?128:0), p.rp]),
      tc:this.table.length, pz:this.paused?1:0, lvl:this.lvl, pkl:this.pkl||[], nm:this.nmax||5, hs:this.hs||2, th:this.th||3, hi:this.hints, lg:lgPub, ev:this.ev, pv, evk:this.evk||null, pkp:this.pkp||[], revs:this.revs||[], mutes:this.mutes||[], fk:(this.ph==='results'&&this.fk!=null)?this.hints[this.fk]:null, fki:this.ph==='results'?this.fk:null,
      res:this.ph==='results'?this.res:null, lv:this.ph==='results'||this.ph==='over'?(this.lastVault||this.vault):null,
      ct:this.court&&['talk','vote','over'].includes(this.ph)?{d:this.court.d, m:this.court.m, w:this.court.win?1:0, k:this.courtKey(), cnt:this.court.cnt||null}:null,
      el:this.ph==='wills'?this.el:null, win:this.win, sm:this.simple?1:0, whs:this.whs||[], bo:this.ph==='wills'?this.bo:null,
      st:this.ph==='over'?this.st:null, bw:this.ph==='over'?this.bestW:null
    };
    const body = JSON.stringify(S);
    if(body !== this._last){ this._last = body; this.v++; }
    S.v = this.v; S.rem = Math.max(0, this.dl - (this.paused ? this.pauseAt : now));
    return S;
  }
}


const WasseyaEngine = { Host, D, SPEED, MAXP, MINP, rid, esc, WTYPES, NEEDT, GIVE, ABIL, EVENTS };
if(typeof globalThis!=='undefined') globalThis.WasseyaEngine = WasseyaEngine;
if(typeof module!=='undefined' && module.exports) module.exports = WasseyaEngine;
