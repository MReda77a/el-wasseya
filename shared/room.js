/* ==========================================================
   El Wasseya — one room on the server.
   Used by BOTH servers: server/index.js (Node) and cloudflare/worker.js (Cloudflare).
   A "conn" is anything with send(obj) and close(), plus a pid field we set.

   Messages from a player:
     {t:'create', pid, name, pub}   {t:'join', pid, name}
     {t:'input', d:{...}}           {t:'cmd', c:'start'|'addbot'|'newgame'|'pub', v}
     {t:'leave'}
   Messages to a player:
     {t:'ok', code}  {t:'err', e}  {t:'state', S}  {t:'kicked'}
   ========================================================== */
(function(){
  const cleanName = n => String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14) || '?';
  const cleanPid = p => (typeof p === 'string' && /^[a-z0-9]{4,16}$/.test(p)) ? p : null;
  const BOT_NAMES = { ar: ['منى','عمر','كريم','سلمى','حسن','ندى','يوسف','ليلى','طارق'], en: ['Mona','Omar','Karim','Salma','Hassan','Nada','Youssef','Laila','Tarek'] };

  class RoomCore {
    constructor(code, E, hooks){
      this.code = code; this.E = E; this.hooks = hooks || {};
      this.host = null; this.owner = null; this.pub = true;
      this.conns = new Map();   // pid -> conn
      this.lastV = -1; this.lastN = -1; this.emptySince = null;
      this.chat = []; this.chatSeq = 0; this.rate = {};
    }
    /** What the "open rooms" list shows. */
    summary(){
      const h = this.host; if(!h) return { c:this.code, open:false };
      const o = h.p(this.owner);
      return { c:this.code, h:o ? o.name : '?', n:h.P.length, m:this.E.MAXP, open: !!(this.pub && h.ph==='lobby' && h.P.length < this.E.MAXP && this.conns.size > 0) };
    }
    changed(){ this.hooks.changed && this.hooks.changed(); }

    handle(conn, msg){
      if(!msg || typeof msg !== 'object') return;
      switch(msg.t){
        case 'create': return this.create(conn, msg);
        case 'join':   return this.join(conn, msg);
        case 'input':  return this.input(conn, msg.d);
        case 'cmd':    return this.cmd(conn, msg);
        case 'leave':  return this.close(conn, true);
        case 'chat':   return this.chatMsg(conn, msg.m);
      }
    }
    create(conn, msg){
      const pid = cleanPid(msg.pid);
      if(!pid) return conn.send({t:'err', e:'bad'});
      if(this.host && this.conns.size > 0) return conn.send({t:'err', e:'exists'});
      const h = new this.E.Host(this.code, pid, false);
      h.add(pid, cleanName(msg.name), false);
      this.host = h; this.owner = pid; this.pub = msg.pub !== false; this.lastV = -1;
      conn.send({t:'ok', code:this.code});
      this.attach(conn, pid);
    }
    join(conn, msg){
      const pid = cleanPid(msg.pid), h = this.host;
      if(!pid || !h) return conn.send({t:'err', e:'notfound'});
      if(!h.p(pid)){
        if(h.ph !== 'lobby') return conn.send({t:'err', e:'started'});
        if(h.P.length >= this.E.MAXP) return conn.send({t:'err', e:'full'});
        h.add(pid, cleanName(msg.name), false);
      }
      if(!this.conns.size && !(this.owner && h.p(this.owner))) this.setOwner(pid);
      conn.send({t:'ok', code:this.code});
      this.attach(conn, pid);
    }
    setOwner(pid){ this.owner = pid; if(this.host) this.host.me = pid; }
    attach(conn, pid){
      const old = this.conns.get(pid);
      if(old && old !== conn){ old.pid = null; old.send({t:'kicked'}); try{ old.close(); }catch(e){} }
      this.conns.set(pid, conn); conn.pid = pid;
      this.host.peersPids.add(pid);
      this.emptySince = null;
      conn.send({t:'chatlog', c:this.chat.slice(-30)});
      this.sendState(true); this.changed();
    }
    close(conn, explicit){
      const pid = conn.pid; if(!pid) return;
      conn.pid = null;
      if(this.conns.get(pid) !== conn) return;
      this.conns.delete(pid);
      const h = this.host; if(!h) return;
      h.peersPids.delete(pid); delete h.peerInputs[pid];
      // In the lobby a player who leaves is removed; during a game they keep their seat and can reconnect.
      if(h.ph === 'lobby' || (explicit && h.ph === 'over')) h.P = h.P.filter(p => p.bot || p.id !== pid);
      if(this.owner === pid){ const next = [...this.conns.keys()][0]; if(next) this.setOwner(next); }
      if(this.conns.size === 0) this.emptySince = Date.now();
      this.sendState(true); this.changed();
    }
    input(conn, d){
      const pid = conn.pid, h = this.host;
      if(!pid || !h || !d || typeof d !== 'object') return;
      let size = 0; try{ size = JSON.stringify(d).length; }catch(e){ return; }
      if(size > 8000) return;
      h.peerInputs[pid] = d;
      const p = h.p(pid);
      if(p && h.ph === 'lobby' && d.n){ const nm = cleanName(d.n); if(nm !== p.name){ p.name = nm; this.changed(); } }
    }
    cmd(conn, d){
      const h = this.host;
      if(!h || !conn.pid || conn.pid !== this.owner) return;
      switch(d.c){
        case 'start': if(h.ph === 'lobby' && h.P.length >= this.E.MINP) h.start(); break;
        case 'addbot': if(h.ph === 'lobby' && h.P.length < this.E.MAXP){
          const names = BOT_NAMES[d.v === 'en' ? 'en' : 'ar'], used = h.P.map(p => p.name);
          const n = names.find(x => !used.includes(x + ' 🤖')) || 'Bot';
          h.add('bot' + this.E.rid(4), n + ' 🤖', true);
        } break;
        case 'newgame': if(h.ph === 'over'){
          h.P = h.P.filter(p => p.bot || this.conns.has(p.id));
          h.resetGame(); h.ph = 'lobby';
          for(const k in h.peerInputs) h.peerInputs[k] = { n: h.peerInputs[k].n };
        } break;
        case 'pub': this.pub = !!d.v; break;
        case 'pause': h.pause(); break;
        case 'resume': h.resume(); break;
        case 'lvl': if(h.ph === 'lobby' && ['easy','normal','hard'].includes(d.v)) h.lvl = d.v; break;
      }
      this.sendState(true); this.changed();
    }
    chatMsg(conn, m){
      const pid = conn.pid, h = this.host; if(!pid || !h) return;
      m = String(m || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 100); if(!m) return;
      const now = Date.now(), recent = (this.rate[pid] || []).filter(x => now - x < 10000);
      if(recent.length >= 8) return;
      recent.push(now); this.rate[pid] = recent;
      const p = h.p(pid), c = { id:'s' + (++this.chatSeq), pid, n: p ? p.name : '?', m };
      this.chat.push(c); if(this.chat.length > 50) this.chat.shift();
      for(const cn of this.conns.values()) cn.send({t:'chat', c});
    }
    /** Called every 200 ms while someone is connected. */
    tick(){
      const h = this.host; if(!h) return;
      h.tick(); this.sendState(false);
      if(h.ph === 'lobby' && h.P.length !== this.lastN){ this.lastN = h.P.length; this.changed(); }
    }
    sendState(force){
      const h = this.host; if(!h) return;
      const S = h.pub();
      if(!force && S.v === this.lastV) return;
      this.lastV = S.v;
      for(const [pid, conn] of this.conns){
        const pv = S.pv && S.pv[pid] ? { [pid]: S.pv[pid] } : {};   // only YOUR private info
        conn.send({t:'state', S:{ ...S, pv }});
      }
    }
  }

  const WasseyaRoom = { RoomCore };
  if(typeof globalThis !== 'undefined') globalThis.WasseyaRoom = WasseyaRoom;
  if(typeof module !== 'undefined' && module.exports) module.exports = WasseyaRoom;
})();
