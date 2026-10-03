// ============ IRGXYMODS EMULATOR TERMINAL v3.0 ULTIMATE ============
// 115+ commands · VFS · Themes · Multi-Shell · Split · Record · WebCrypto
// 100% client-side
(function(){
'use strict';

/* ═══════════ HELPERS ═══════════ */
const $  = (s,c=document)=>c.querySelector(s);
const $$ = (s,c=document)=>Array.from(c.querySelectorAll(s));
const esc = s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmtBytes = n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(2)+' MB';
const pad = (n,w=2)=>String(n).padStart(w,'0');
const sleep = ms=>new Promise(r=>setTimeout(r,ms));
const uid = ()=>Math.random().toString(36).slice(2,10);
const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
const htmlSafe = esc;
const isDataURL = s=>typeof s==='string' && s.startsWith('data:');
const copyText = async txt=>{
  try{ if(navigator.clipboard && window.isSecureContext){ await navigator.clipboard.writeText(txt); return true; } }catch(_){}
  try{
    const ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.left='-9999px';
    document.body.appendChild(ta); ta.select(); const ok=document.execCommand('copy'); ta.remove(); return ok;
  }catch(_){ return false; }
};

/* ═══════════ STORAGE KEYS ═══════════ */
const KEY = {
  VFS:'irgxy_term_vfs_v3',
  VFS_OLD:'irgxy_term_vfs_v2',
  VFS_BACKUP:'irgxy_term_vfs_v3_backup',
  SETTINGS:'irgxy_term_settings_v3',
  BOOKMARKS:'irgxy_term_bookmarks_v3',
  RECENT:'irgxy_term_recent_v3',
  HISTORY:'irgxy_term_history_v3',
  ALIAS:'irgxy_term_alias_v3',
  ENV:'irgxy_term_env_v3',
  PKGS:'irgxy_pkgs_v3',
  PKGS_OLD:'irgxy_pkgs_v2',
  CAST:'irgxy_term_cast_v3'
};
const VFS_MAX = 5*1024*1024;
const SCHEMA = 3;

function lsGet(k,def){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch(_){ return def; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(_){ return false; } }

/* ═══════════ SETTINGS ═══════════ */
const Settings = {
  defaults:{
    fontSize:14, fontFamily:"'JetBrains Mono',monospace",
    theme:'dark', shell:'bash', cursor:'bar',
    blink:true, sound:false, autoCopy:false,
    scrollback:2000, prompt:'{user}@{host}:{cwd}$'
  },
  data:null,
  load(){ this.data = Object.assign({},this.defaults, lsGet(KEY.SETTINGS,{})); },
  save(){ lsSet(KEY.SETTINGS,this.data); },
  set(k,v){ this.data[k]=v; this.save(); this.apply(); },
  reset(){ this.data={...this.defaults}; this.save(); this.apply(); this.syncUI(); },
  apply(){
    const d=this.data;
    document.documentElement.style.setProperty('--et-fs',d.fontSize+'px');
    document.documentElement.style.setProperty('--et-mono',d.fontFamily);
    document.body.setAttribute('data-theme',d.theme);
    document.body.setAttribute('data-cursor',d.cursor);
    if(Renderer.screen){ Renderer.maxLines=d.scrollback; }
    if($('#etShellBadge')) $('#etShellBadge').innerHTML = `<i class="fas fa-terminal"></i> ${esc(d.shell)}`;
  },
  syncUI(){
    const d=this.data;
    if(!$('#etSetFontSize')) return;
    $('#etSetFontSize').value=d.fontSize;
    $('#etSetFontFamily').value=d.fontFamily;
    $('#etSetTheme').value=d.theme;
    $('#etSetShell').value=d.shell;
    $('#etSetCursor').value=d.cursor;
    $('#etSetBlink').checked=d.blink;
    $('#etSetSound').checked=d.sound;
    $('#etSetAutoCopy').checked=d.autoCopy;
    $('#etSetScrollback').value=d.scrollback;
    $('#etSetPrompt').value=d.prompt;
  }
};

/* ═══════════ VFS ═══════════ */
const VFS = {
  data:null, MAX_DEPTH:64,
  init(){
    const raw = lsGet(KEY.VFS,null) || lsGet(KEY.VFS_OLD,null);
    if(raw && raw['/']){ this.data=raw; return; }
    this.data=this._default(); this.save();
  },
  _default(){
    const now=Date.now();
    return {
      '/':{type:'dir',children:{}},
      '/home':{type:'dir',children:{}},
      '/home/irgxymods':{type:'dir',children:{
        'README.md':{type:'file',modified:now,content:
`# IRGXYMODS Terminal v3.0

Selamat datang di v3 ULTIMATE.

- 115+ command
- Ketik \`help\` untuk daftar
- \`theme dracula\` untuk ganti tema
- \`split h\` untuk split screen
- \`script-library\` untuk script siap pakai
- \`passwd-gen 20\` untuk password kuat
- \`qrcode https://irgxymods.dev\` untuk QR ASCII
- \`md README.md\` untuk preview markdown ini
`},
        'hello.js':{type:'file',modified:now,content:
`console.log("Hello v3!");
const sum=(a,b)=>a+b;
console.log("2+3=",sum(2,3));
`},
        'hello.py':{type:'file',modified:now,content:
`print("Hello from Python v3")
def t(a,b): return a+b
print("2+3=",t(2,3))
`},
        'contoh.json':{type:'file',modified:now,content:
'{"name":"IRGXYMODS","version":"3.0","features":["terminal","vfs","115+commands","6 themes"],"active":true,"nested":{"a":[1,2,3],"b":{"c":"deep"}}}'},
        'data.csv':{type:'file',modified:now,content:
'name,age,city\nAlice,30,Jakarta\nBob,25,Bandung\nCharlie,35,Surabaya'},
        'contoh.sql':{type:'file',modified:now,content:
`CREATE TABLE users (id INT, name TEXT);
INSERT INTO users VALUES (1,'Alice');
INSERT INTO users VALUES (2,'Bob');
SELECT * FROM users;
`},
        'script.sh':{type:'file',modified:now,content:`#!/bin/bash\necho "Hello v3"\n`},
        '.bashrc':{type:'file',modified:now,content:`export EDITOR=nano\nalias ll="ls -l"\n`},
        'projects':{type:'dir',children:{}},
        'docs':{type:'dir',children:{
          'notes.txt':{type:'file',modified:now,content:'Catatan v3.\nLine 2.\nLine 3.\n'}
        }}
      }},
      '/tmp':{type:'dir',children:{}},
      '/usr':{type:'dir',children:{
        'bin':{type:'dir',children:{}},
        'share':{type:'dir',children:{}},
        'local':{type:'dir',children:{'bin':{type:'dir',children:{}}}}
      }},
      '/var':{type:'dir',children:{'log':{type:'dir',children:{}}}}
    };
  },
  save(){
    const json = JSON.stringify(this.data);
    lsSet(KEY.VFS,this.data);
    if(json.length>VFS_MAX){ lsSet(KEY.VFS_BACKUP,this.data); }
  },
  reset(){ this.data=this._default(); this.save(); },
  normalize(p,cwd){
    cwd = cwd || State.cwd || '/home/irgxymods';
    if(!p) return cwd;
    p=String(p).trim();
    if(p==='~') p='/home/irgxymods';
    else if(p.startsWith('~/')) p='/home/irgxymods/'+p.slice(2);
    else if(!p.startsWith('/')) p=(cwd==='/'?'':cwd)+'/'+p;
    const parts=p.split('/').filter(s=>s&&s!=='.');
    const out=[];
    for(const seg of parts){ if(seg==='..') out.pop(); else out.push(seg); }
    return '/'+out.join('/');
  },
  node(path){
    if(path==='/') return this.data['/'];
    const parts=path.split('/').filter(Boolean);
    let cur=this.data['/'];
    for(const seg of parts){
      if(!cur||cur.type!=='dir'||!cur.children) return null;
      cur=cur.children[seg];
      if(!cur) return null;
    }
    return cur;
  },
  parent(p){ if(p==='/') return null; const parts=p.split('/').filter(Boolean); parts.pop(); return '/'+parts.join('/'); },
  basename(p){ if(p==='/') return '/'; const parts=p.split('/').filter(Boolean); return parts[parts.length-1]||'/'; },
  mkdir(path,recursive){
    const norm=this.normalize(path);
    if(this.node(norm)) throw new Error(`mkdir: tidak dapat membuat '${path}': File exists`);
    if(recursive){
      const segs=norm.split('/').filter(Boolean);
      let cur='/';
      for(const seg of segs){
        cur = cur==='/'?'/'+seg:cur+'/'+seg;
        if(!this.node(cur)){
          const p=this.parent(cur);
          const pn=this.node(p);
          if(!pn) throw new Error('mkdir: parent tidak ditemukan');
          pn.children[this.basename(cur)]={type:'dir',children:{}};
        }
      }
      this.save(); return;
    }
    const p=this.parent(norm);
    const pn=this.node(p);
    if(!pn||pn.type!=='dir') throw new Error(`mkdir: tidak dapat membuat '${path}': No such file or directory`);
    pn.children[this.basename(norm)]={type:'dir',children:{}};
    this.save();
  },
  touch(path){
    const norm=this.normalize(path);
    if(this.node(norm)) return;
    const p=this.parent(norm); const pn=this.node(p);
    if(!pn||pn.type!=='dir') throw new Error(`touch: tidak dapat membuat '${path}'`);
    pn.children[this.basename(norm)]={type:'file',content:'',modified:Date.now()};
    this.save();
  },
  write(path,content){
    const norm=this.normalize(path);
    const node=this.node(norm);
    if(node&&node.type==='file'){ node.content=content; node.modified=Date.now(); }
    else if(node&&node.type==='dir'){ throw new Error('write: adalah direktori'); }
    else{
      const p=this.parent(norm); const pn=this.node(p);
      if(!pn||pn.type!=='dir') throw new Error('write: direktori tidak ditemukan');
      pn.children[this.basename(norm)]={type:'file',content,modified:Date.now()};
    }
    this.save();
  },
  append(path,content){
    const norm=this.normalize(path);
    const node=this.node(norm);
    if(node&&node.type==='file'){ node.content=(node.content||'')+content; node.modified=Date.now(); this.save(); }
    else this.write(path,content);
  },
  read(path){
    const norm=this.normalize(path);
    const node=this.node(norm);
    if(!node) throw new Error(`cat: ${path}: No such file or directory`);
    if(node.type==='dir') throw new Error(`cat: ${path}: Is a directory`);
    return node.content||'';
  },
  rm(path,recursive,force){
    const norm=this.normalize(path);
    if(norm==='/') throw new Error('rm: tidak dapat menghapus root');
    const node=this.node(norm);
    if(!node){ if(force) return; throw new Error(`rm: tidak dapat menghapus '${path}': No such file or directory`); }
    if(node.type==='dir'&&!recursive) throw new Error(`rm: tidak dapat menghapus '${path}': Is a directory`);
    const p=this.parent(norm); const pn=this.node(p);
    if(!pn||!pn.children) throw new Error('rm: parent tidak ditemukan');
    delete pn.children[this.basename(norm)];
    this.save();
  },
  cp(src,dst){
    const sNorm=this.normalize(src);
    const sNode=this.node(sNorm);
    if(!sNode) throw new Error(`cp: tidak dapat mengakses '${src}'`);
    const dNorm=this.normalize(dst);
    const dNode=this.node(dNorm);
    let targetPath=dNorm;
    if(dNode&&dNode.type==='dir') targetPath=dNorm+'/'+this.basename(sNorm);
    const clone=JSON.parse(JSON.stringify(sNode));
    const p=this.parent(targetPath); const pn=this.node(p);
    if(!pn||pn.type!=='dir') throw new Error('cp: target direktori tidak ditemukan');
    pn.children[this.basename(targetPath)]=clone;
    this.save();
  },
  mv(src,dst){ this.cp(src,dst); this.rm(src,true,true); },
  list(path){
    const norm=this.normalize(path||'.');
    const node=this.node(norm);
    if(!node) throw new Error(`ls: tidak dapat mengakses '${path}': No such file or directory`);
    if(node.type==='file') return [{name:this.basename(norm),type:'file',node}];
    return Object.keys(node.children||{}).map(name=>({name,type:node.children[name].type,node:node.children[name]}));
  },
  size(node,depth=0){
    if(!node||depth>this.MAX_DEPTH) return 0;
    if(node.type==='file') return (node.content||'').length;
    let s=0;
    for(const k in node.children) s+=this.size(node.children[k],depth+1);
    return s;
  },
  du(path){ return this.size(this.node(this.normalize(path||'.'))); },
  find(startPath,pattern,isRegex){
    const norm=this.normalize(startPath||'.');
    let re;
    if(isRegex) re=new RegExp(pattern);
    else re=new RegExp('^'+String(pattern).replace(/[.+^${}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*').replace(/\?/g,'.')+'$');
    const out=[];
    const walk=(path,node,depth)=>{
      if(!node||depth>this.MAX_DEPTH) return;
      if(node.type==='file'){ if(re.test(this.basename(path))) out.push(path); }
      else if(node.children) for(const k in node.children){
        const cp = path==='/'?'/'+k:path+'/'+k;
        walk(cp,node.children[k],depth+1);
      }
    };
    walk(norm,this.node(norm),0);
    return out;
  }
};

/* ═══════════ STATE ═══════════ */
const State = {
  user:'irgxymods', host:'irgxy-terminal',
  cwd:'/home/irgxymods', prevCwd:null,
  tabs:[], activeTab:0,
  history:[], histIdx:-1,
  env:{
    HOME:'/home/irgxymods', USER:'irgxymods',
    SHELL:'/bin/irgxy-sh',
    PATH:'/usr/local/bin:/usr/bin:/bin',
    PWD:'/home/irgxymods',
    LANG:'id_ID.UTF-8', TERM:'xterm-256color'
  },
  packages:{pkg:[],npm:[],pip:[]},
  bootTime:Date.now(), cancelFlag:false,
  alias:{}, bookmarks:[], recentFiles:[],
  jobs:[], jobCounter:1,
  recording:false, recordStart:0, recordEvents:[], recordInterval:null,
  gitRepo:false
};
function newTabState(){ return {cwd:'/home/irgxymods',history:[],lines:[]}; }

/* ═══════════ RENDERER ═══════════ */
const Renderer = {
  screen:null, maxLines:2000,
  init(){ this.screen=$('#etScreen'); this.maxLines=Settings.data.scrollback; },
  print(text,cls){
    if(text===undefined||text===null) text='';
    const parts=String(text).split('\n');
    for(const p of parts) this._appendLine(p,cls);
    this.scrollBottom();
  },
  printHTML(html){
    if(!this.screen) return;
    const el=document.createElement('div'); el.className='et-line'; el.innerHTML=html;
    this.screen.appendChild(el); this._trim(); this.scrollBottom();
  },
  _appendLine(text,cls){
    if(!this.screen) return;
    const el=document.createElement('div');
    el.className='et-line'+(cls?' '+cls:''); el.textContent=text;
    this.screen.appendChild(el); this._trim();
  },
  _trim(){
    if(!this.screen) return;
    const lines=this.screen.children;
    while(lines.length>this.maxLines) this.screen.removeChild(lines[0]);
  },
  clear(){ if(this.screen) this.screen.innerHTML=''; },
  scrollBottom(){ if(!this.screen) return; requestAnimationFrame(()=>{ this.screen.scrollTop=this.screen.scrollHeight; }); },
  echoPrompt(text){
    this.printHTML(
      `<span style="color:#43e97b">${esc(State.user)}</span>`+
      `<span style="color:#8888aa">@</span>`+
      `<span style="color:#25F4EE">${esc(State.host)}</span>`+
      `<span style="color:#8888aa">:</span>`+
      `<span style="color:#d4a745">${esc(this.shortCwd())}</span>`+
      `<span style="color:#d946ef">$</span> <span style="color:#fff">${esc(text)}</span>`
    );
  },
  shortCwd(){
    if(State.cwd==='/home/irgxymods') return '~';
    if(State.cwd.startsWith('/home/irgxymods/')) return '~/'+State.cwd.slice(16);
    return State.cwd;
  }
};

/* ═══════════ LOADING ═══════════ */
const Loading = {
  el:null,text:null,bar:null,
  init(){ this.el=$('#etLoading'); this.text=$('#etLoadingText'); this.bar=$('#etProgressFill'); },
  show(m){ if(this.el) this.el.classList.add('visible'); if(this.text) this.text.textContent=m||'Loading...'; if(this.bar) this.bar.style.width='0%'; },
  hide(){ if(this.el) this.el.classList.remove('visible'); },
  setProgress(p,m){ if(this.bar) this.bar.style.width=clamp(p,0,100)+'%'; if(m&&this.text) this.text.textContent=m; }
};

/* ═══════════ NANO ═══════════ */
const Nano = {
  el:null,ta:null,fileEl:null,currentFile:'',
  init(){
    this.el=$('#etNano'); this.ta=$('#etNanoText'); this.fileEl=$('#etNanoFile');
    $('#etNanoClose').addEventListener('click',()=>this.close());
    $('#etNanoSave').addEventListener('click',()=>this.save());
    document.addEventListener('keydown',e=>{
      if(!this.el.classList.contains('visible')) return;
      if(e.key==='Escape'){ e.preventDefault(); this.close(); }
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){ e.preventDefault(); this.save(); }
    });
  },
  open(f,c){ this.currentFile=f; this.ta.value=c; this.fileEl.textContent=f; this.el.classList.add('visible'); setTimeout(()=>this.ta.focus(),50); },
  save(){
    try{ VFS.write(this.currentFile,this.ta.value); Renderer.print(`Saved: ${this.currentFile}`,'green'); Sidebar.refresh(); }
    catch(e){ Renderer.print('Save error: '+e.message,'red'); }
    this.close();
  },
  close(){ this.el.classList.remove('visible'); }
};

/* ═══════════ EXECUTOR ═══════════ */
let _consoleLock=0;
const Executor = {
  execJS(code){
    const logs=[];
    const fmt=v=>{
      if(v===undefined) return 'undefined';
      if(v===null) return 'null';
      if(typeof v==='string') return v;
      if(typeof v==='number'||typeof v==='boolean') return String(v);
      if(v instanceof Error) return v.stack||v.message;
      try{ return JSON.stringify(v,null,2); }catch(_){ return String(v); }
    };
    const ol=console.log,oe=console.error,ow=console.warn,oi=console.info;
    if(_consoleLock++===0){
      console.log=(...a)=>logs.push(a.map(fmt).join(' '));
      console.error=(...a)=>logs.push('⚠ '+a.map(fmt).join(' '));
      console.warn=(...a)=>logs.push('⚠ '+a.map(fmt).join(' '));
      console.info=(...a)=>logs.push(a.map(fmt).join(' '));
    }
    const start=performance.now();
    try{ new Function('"use strict";'+code)(); }
    catch(e){ logs.push('Error: '+(e.stack||e.message)); }
    finally{ if(--_consoleLock===0){ console.log=ol; console.error=oe; console.warn=ow; console.info=oi; } }
    const el=(performance.now()-start).toFixed(1);
    const out=logs.join('\n');
    return (out?out+'\n':'')+`[node: selesai dalam ${el}ms]`;
  },
  async execPython(code){
    if(!window.PYODIDE_READY){
      Loading.show('Memuat Python (Pyodide)...');
      Loading.setProgress(20,'Mengunduh Pyodide...');
      try{ await this._loadPyodide(); }catch(e){ Loading.hide(); throw new Error('Gagal memuat Pyodide: '+e.message); }
      Loading.setProgress(100,'Siap!'); await sleep(300); Loading.hide();
    }
    try{
      const py=window.pyodide; let out='';
      py.setStdout({batched:s=>{out+=s+'\n';}});
      py.setStderr({batched:s=>{out+=s+'\n';}});
      const r=await py.runPythonAsync(code);
      if(r!=null) out+=String(r)+'\n';
      return out||'[python: no output]';
    }catch(e){ return 'Traceback:\n  '+(e.message||String(e)); }
  },
  _loadPyodide(){
    return new Promise((res,rej)=>{
      if(window.pyodide) return res();
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
      s.onload=async()=>{ try{ window.pyodide=await window.loadPyodide({indexURL:'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/'}); window.PYODIDE_READY=true; res(); }catch(e){ rej(e);} };
      s.onerror=()=>rej(new Error('CDN unreachable'));
      document.head.appendChild(s);
    });
  },
  async pkgInstall(pkgs,mgr,opts){
    opts=opts||{};
    if(!pkgs.length) throw new Error(`${mgr}: missing package name`);
    const stages=['Reading package lists','Building dependency tree','Fetching archives','Unpacking','Setting up','Complete'];
    for(const p of pkgs){
      const db=mgr==='npm'?NPM_DB:mgr==='pip'?PIP_DB:PKG_DB;
      const version=db[p]||'1.0.0';
      Renderer.print(`Preparing to install ${p}...`,'dim');
      for(let i=0;i<stages.length;i++){ await sleep(120); Renderer.print(`  [${Math.round((i+1)/stages.length*100)}%] ${stages[i]}...`,'dim'); }
      const scope = opts.global ? 'global' : 'local';
      State.packages[mgr].push({name:p,version,scope});
      Renderer.print(`✓ ${p}@${version} installed (${scope}) via ${mgr}`,'green');
    }
    lsSet(KEY.PKGS,State.packages);
    // npm init/save support
    if(mgr==='npm'&&opts.save){
      try{
        const pkgPath='/home/irgxymods/package.json';
        let pkg={ name:'irgxy-app', version:'1.0.0', dependencies:{} };
        const existing=VFS.node(VFS.normalize(pkgPath));
        if(existing&&existing.type==='file'){ try{ pkg=JSON.parse(existing.content); }catch(_){} }
        for(const p of pkgs) pkg.dependencies[p]=(mgr==='npm'?NPM_DB:PIP_DB)[p]||'1.0.0';
        VFS.write(pkgPath,JSON.stringify(pkg,null,2));
        Renderer.print('✓ package.json diperbarui','green');
      }catch(_){}
    }
    return null;
  },
  async pkgRemove(pkgs,mgr){
    if(!pkgs.length) throw new Error(`${mgr}: missing package name`);
    for(const p of pkgs){
      const idx=State.packages[mgr].findIndex(x=>x.name===p);
      if(idx<0){ Renderer.print(`Package '${p}' tidak terinstal`,'warn'); continue; }
      await sleep(300);
      State.packages[mgr].splice(idx,1);
      Renderer.print(`✓ ${p} dihapus`,'green');
    }
    lsSet(KEY.PKGS,State.packages);
    return null;
  },
  pkgList(mgr){
    const list=State.packages[mgr];
    if(!list.length) return `(${mgr}: tidak ada paket terinstal)`;
    return list.map(p=>`${p.name}@${p.version}${p.scope==='global'?' [g]':''}`).join('\n');
  },
  pkgSearch(q,db){
    if(!q) throw new Error('search: missing query');
    const res=Object.keys(db).filter(k=>k.includes(q));
    return res.length ? res.map(k=>`${k.padEnd(20)} ${db[k]}`).join('\n') : `(tidak ada hasil "${q}")`;
  },
  async pkgUpgrade(mgr){
    if(!State.packages[mgr].length) return 'Semua paket sudah terbaru.';
    for(const p of State.packages[mgr]){ await sleep(120); Renderer.print(`Upgrading ${p.name}...`,'dim'); }
    Renderer.print('✓ Semua paket sudah terbaru','green');
    return null;
  },
  async hashSha256(text){
    try{
      const enc=new TextEncoder().encode(text);
      const buf=await crypto.subtle.digest('SHA-256',enc);
      return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }catch(_){ return Commands._md5(text)+Commands._md5(text.split('').reverse().join('')); }
  },
  async hashText(algo,text){
    const map={md5:'MD5',sha1:'SHA-1',sha256:'SHA-256',sha512:'SHA-512'};
    const a=map[String(algo).toLowerCase()];
    if(!a) throw new Error('hash: algoritma tidak didukung (md5/sha1/sha256/sha512)');
    if(a==='MD5') return Commands._md5(text);
    try{
      const enc=new TextEncoder().encode(text);
      const buf=await crypto.subtle.digest(a,enc);
      return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }catch(_){ return Commands._md5(text); }
  },
  async runString(str,opts){
    opts=opts||{};
    const segs=Parser.splitPipeline(str);
    if(segs.length>1) return await this.runPipeline(segs,opts);
    return await this.runSingle(str,opts);
  },
  async runPipeline(segs,opts){
    let stdin=null;
    for(let i=0;i<segs.length;i++){
      const out=await this.runSingle(segs[i],{...opts,stdin,silent:i<segs.length-1});
      stdin = (out&&typeof out==='string')?out:'';
    }
    if(stdin&&!opts.silent) Renderer.print(stdin);
    return stdin;
  },
  async runSingle(line,opts){
    opts=opts||{};
    const parsed=Parser.parse(line);
    if(!parsed) return null;
    const {cmd,args,redirect}=parsed;
    if(State.alias[cmd]) return await this.runString(State.alias[cmd]+' '+args.join(' '));
    const fn=Commands[cmd];
    if(!fn){ Renderer.print(`${cmd}: command not found`,'red'); return null; }
    State.cancelFlag=false;
    Recorder.log('input',line);
    try{
      const result=await fn(args,{raw:line,stdin:opts.stdin});
      if(result!=null){
        if(redirect){
          if(redirect.op==='>') VFS.write(redirect.file,String(result)+'\n');
          else VFS.append(redirect.file,String(result)+'\n');
        } else if(!opts.silent) Renderer.print(String(result));
        Recorder.log('output',String(result));
      }
      return result;
    }catch(e){
      Renderer.print(e.message||String(e),'red');
      Recorder.log('error',e.message);
      return null;
    }
  }
};

/* ═══════════ PARSER ═══════════ */
const Parser = {
  splitPipeline(s){ return s.split('|').map(x=>x.trim()).filter(Boolean); },
  parse(line){
    line=line.trim(); if(!line) return null;
    let redirect=null;
    const rm=line.match(/^(.*?)\s*(>>?)\s*([^\s>]+)\s*$/);
    if(rm && !line.includes('|')){ redirect={op:rm[2],file:rm[3]}; line=rm[1]; }
    const tokens=this.tokenize(line);
    if(!tokens.length) return null;
    return {cmd:tokens[0],args:tokens.slice(1),redirect};
  },
  tokenize(s){
    const out=[]; let cur='',q=null;
    for(let i=0;i<s.length;i++){
      const ch=s[i];
      if(q){ if(ch===q) q=null; else cur+=ch; }
      else if(ch==='"'||ch==="'") q=ch;
      else if(ch===' '||ch==='\t'){ if(cur){out.push(cur);cur='';} }
      else cur+=ch;
    }
    if(cur) out.push(cur);
    return out;
  }
};

/* ═══════════ PACKAGE DBs ═══════════ */
const PKG_DB={cowsay:'3.7.0',figlet:'2.2.5',git:'2.39.0',node:'18.16.0',python:'3.11.0',nano:'7.2',curl:'8.0.1',wget:'1.21.3',htop:'3.2.2',vim:'9.0',tree:'2.1.0',jq:'1.6',ncdu:'1.18',tmux:'3.3a',bash:'5.2',zsh:'5.9',ripgrep:'13.0'};
const NPM_DB={lodash:'4.17.21',express:'4.18.2',react:'18.2.0',axios:'1.4.0',chalk:'5.3.0',moment:'2.29.4',dotenv:'16.3.1',typescript:'5.3.0',vite:'5.0.0',esbuild:'0.19.0',prettier:'3.1.0',eslint:'8.55.0'};
const PIP_DB={numpy:'1.26.0',pandas:'2.1.0',requests:'2.31.0',flask:'3.0.0',django:'5.0.0',matplotlib:'3.8.0',scipy:'1.11.0',pytest:'7.4.0',click:'8.1.7',rich:'13.7.0',black:'23.12.0'};

/* ═══════════ COMMANDS ═══════════ */
const Commands = {};

/* ─── File System ─── */
Commands.ls=(args)=>{
  const flags=args.filter(a=>a.startsWith('-'));
  const paths=args.filter(a=>!a.startsWith('-'));
  const long=flags.some(f=>f.includes('l'));
  const all=flags.some(f=>f.includes('a'));
  const target=paths[0]||'.';
  const items=VFS.list(target);
  const filtered=all?items:items.filter(i=>!i.name.startsWith('.'));
  if(!filtered.length) return '(kosong)';
  if(long) return filtered.map(it=>{
    const t=it.type==='dir'?'d':'-';
    const size=it.type==='dir'?4096:(it.node.content||'').length;
    const mod=new Date(it.node.modified||Date.now()).toISOString().slice(0,16).replace('T',' ');
    return `${t}rw-r--r--  1 ${State.user} ${State.user} ${String(size).padStart(8)} ${mod} ${it.name}${it.type==='dir'?'/':''}`;
  }).join('\n');
  const cols=filtered.map(it=>it.type==='dir'?it.name+'/':it.name);
  const mlen=Math.max(...cols.map(c=>c.length),1)+2;
  const per=Math.max(1,Math.floor(78/mlen));
  const rows=[];
  for(let i=0;i<cols.length;i+=per) rows.push(cols.slice(i,i+per).map(c=>c.padEnd(mlen)).join(''));
  return rows.join('\n');
};
Commands.cd=(args)=>{
  const t=args[0]||'~';
  if(t==='-'&&State.prevCwd){ const tmp=State.cwd; State.cwd=State.prevCwd; State.prevCwd=tmp; return null; }
  const norm=VFS.normalize(t); const node=VFS.node(norm);
  if(!node) throw new Error(`cd: ${t}: No such file or directory`);
  if(node.type!=='dir') throw new Error(`cd: ${t}: Not a directory`);
  State.prevCwd=State.cwd; State.cwd=norm; return null;
};
Commands.pwd=()=>State.cwd;
Commands.mkdir=(args)=>{
  const flags=args.filter(a=>a.startsWith('-'));
  const paths=args.filter(a=>!a.startsWith('-'));
  if(!paths.length) throw new Error('mkdir: missing operand');
  const r=flags.some(f=>f.includes('p'));
  for(const p of paths) VFS.mkdir(p,r);
  return null;
};
Commands.rmdir=(args)=>{
  if(!args.length) throw new Error('rmdir: missing operand');
  for(const p of args){
    const n=VFS.node(VFS.normalize(p));
    if(!n) throw new Error(`rmdir: failed to remove '${p}': No such file or directory`);
    if(n.type!=='dir') throw new Error(`rmdir: '${p}': Not a directory`);
    if(Object.keys(n.children||{}).length) throw new Error(`rmdir: '${p}': Directory not empty`);
    VFS.rm(p,false,false);
  }
  return null;
};
Commands.touch=(args)=>{ if(!args.length) throw new Error('touch: missing operand'); for(const p of args) VFS.touch(p); return null; };
Commands.cat=(args)=>{ if(!args.length) return ''; return args.map(p=>VFS.read(p)).join(''); };
Commands.rm=(args)=>{
  const flags=args.filter(a=>a.startsWith('-'));
  const paths=args.filter(a=>!a.startsWith('-'));
  if(!paths.length) throw new Error('rm: missing operand');
  const r=flags.some(f=>f.includes('r')||f.includes('R'));
  const f=flags.some(f=>f.includes('f'));
  for(const p of paths) VFS.rm(p,r,f);
  return null;
};
Commands.cp=(args)=>{ if(args.length<2) throw new Error('cp: missing operand'); VFS.cp(args[0],args[1]); return null; };
Commands.mv=(args)=>{ if(args.length<2) throw new Error('mv: missing operand'); VFS.mv(args[0],args[1]); return null; };
Commands.tree=(args)=>{
  const paths=args.filter(a=>!a.startsWith('-'));
  const li=args.indexOf('-L');
  const maxDepth = li>=0 ? parseInt(args[li+1],10)||Infinity : Infinity;
  const start=paths[0]||'.';
  const norm=VFS.normalize(start);
  const root=VFS.node(norm);
  if(!root) throw new Error(`tree: ${start}: No such file or directory`);
  const lines=[norm]; let dirs=0,files=0;
  const walk=(node,prefix,depth)=>{
    if(depth>maxDepth) return;
    const keys=Object.keys(node.children||{}).sort();
    keys.forEach((k,i)=>{
      const isLast=i===keys.length-1;
      const child=node.children[k];
      const branch=isLast?'└── ':'├── ';
      lines.push(prefix+branch+k+(child.type==='dir'?'/':''));
      if(child.type==='dir'){ dirs++; walk(child,prefix+(isLast?'    ':'│   '),depth+1); }
      else files++;
    });
  };
  walk(root,'',1);
  lines.push(''); lines.push(`${dirs} directories, ${files} files`);
  return lines.join('\n');
};
Commands.find=(args)=>{
  let start='.',pattern=null,isRegex=false;
  for(let i=0;i<args.length;i++){
    if(args[i]==='-name'&&args[i+1]){ pattern=args[i+1]; i++; }
    else if(args[i]==='-regex'&&args[i+1]){ pattern=args[i+1]; isRegex=true; i++; }
    else if(!args[i].startsWith('-')) start=args[i];
  }
  if(!pattern) throw new Error('find: missing -name/-regex pattern');
  const r=VFS.find(start,pattern,isRegex);
  return r.length?r.join('\n'):null;
};
Commands.stat=(args)=>{
  if(!args.length) throw new Error('stat: missing operand');
  const p=args[0]; const n=VFS.node(VFS.normalize(p));
  if(!n) throw new Error(`stat: cannot stat '${p}': No such file or directory`);
  return [
    `  File: ${VFS.normalize(p)}`,
    `  Size: ${n.type==='dir'?'4096':(n.content||'').length}\tType: ${n.type==='dir'?'directory':'regular file'}`,
    `Access: (0644/-rw-r--r--)  Uid: (1000/${State.user})   Gid: (1000/${State.user})`,
    `Modify: ${new Date(n.modified||Date.now()).toISOString()}`
  ].join('\n');
};
Commands.du=(args)=>{
  const flags=args.filter(a=>a.startsWith('-'));
  const paths=args.filter(a=>!a.startsWith('-'));
  const human=flags.some(f=>f.includes('h'));
  const start=paths[0]||'.';
  const norm=VFS.normalize(start);
  const node=VFS.node(norm);
  if(!node) throw new Error(`du: cannot access '${start}'`);
  const lines=[];
  const walk=(path,n)=>{
    if(n.type==='dir'){
      let s=0;
      for(const k in n.children){ const cp=path==='/'?'/'+k:path+'/'+k; s+=walk(cp,n.children[k]); }
      lines.push((human?fmtBytes(s):String(s)).padStart(8)+'  '+path);
      return s;
    }
    return (n.content||'').length;
  };
  walk(norm,node); lines.reverse();
  return lines.join('\n');
};
Commands.ln=(args)=>{
  const idx=args.indexOf('-s'); if(idx>=0) args.splice(idx,1);
  if(args.length<2) throw new Error('ln: missing operand');
  VFS.write(args[1],`[symlink -> ${args[0]}]`);
  return `created symlink '${args[1]}' -> '${args[0]}'`;
};
Commands.head=(args)=>{
  let n=10; const ni=args.indexOf('-n');
  let f; if(ni>=0){ n=parseInt(args[ni+1],10)||10; f=args[ni+2]; } else f=args[0];
  if(!f) throw new Error('head: missing file operand');
  return VFS.read(f).split('\n').slice(0,n).join('\n');
};
Commands.tail=(args)=>{
  let n=10; const ni=args.indexOf('-n');
  let f; if(ni>=0){ n=parseInt(args[ni+1],10)||10; f=args[ni+2]; } else f=args[0];
  if(!f) throw new Error('tail: missing file operand');
  return VFS.read(f).split('\n').slice(-n).join('\n');
};

/* ─── Text ─── */
Commands.echo=(args)=>{
  const nn=args[0]==='-n'; if(nn) args=args.slice(1);
  return args.join(' ');
};
Commands.grep=(args,ctx)=>{
  const flags=args.filter(a=>a.startsWith('-'));
  const rest=args.filter(a=>!a.startsWith('-'));
  const ci=flags.some(f=>f.includes('i'));
  const sn=flags.some(f=>f.includes('n'));
  const r=flags.some(f=>f.includes('r'));
  const pat=rest[0];
  if(!pat) throw new Error('grep: missing pattern');
  const re=new RegExp(pat,ci?'gi':'g');
  let content=''; let fromFile=false;
  if(rest[1]){ fromFile=true; content=VFS.read(rest[1]); }
  else content=ctx.stdin!=null?ctx.stdin:'';
  if(!r){
    const out=[];
    content.split('\n').forEach((line,i)=>{
      if(re.test(line)){ re.lastIndex=0; out.push((sn?(i+1)+':':'')+line); }
    });
    return out.length?out.join('\n'):null;
  }
  // Recursive
  const start=rest[1]||'.';
  const files=VFS.find(start,'*');
  const out=[];
  for(const fp of files){
    try{
      const c=VFS.read(fp);
      c.split('\n').forEach((line,i)=>{
        if(re.test(line)){ re.lastIndex=0; out.push(`${fp}:${i+1}:${line}`); }
      });
    }catch(_){}
  }
  return out.length?out.join('\n'):null;
};
Commands.sed=(args,ctx)=>{
  const script=args[0];
  if(!script||!script.startsWith('s')) throw new Error('sed: only s/old/new/[g] supported');
  const m=script.match(/^s\/(.*?)\/(.*?)\/(g?)$/);
  if(!m) throw new Error('sed: invalid substitution');
  const re=new RegExp(m[1],m[3]||'');
  let content = args[1]?VFS.read(args[1]):(ctx.stdin||'');
  return content.replace(re,m[2]);
};
Commands.awk=(args,ctx)=>{
  const prog=args[0];
  if(!prog) throw new Error('awk: missing program');
  const m=prog.match(/\{\s*print\s+\$(\d+)\s*\}/);
  if(!m) throw new Error('awk: only {print $N} supported');
  const idx=parseInt(m[1],10)-1;
  const content=args[1]?VFS.read(args[1]):(ctx.stdin||'');
  return content.split('\n').map(l=>{
    const f=l.trim().split(/\s+/); return f[idx]!=null?f[idx]:'';
  }).join('\n');
};
Commands.wc=(args,ctx)=>{
  const flags=args.filter(a=>a.startsWith('-'));
  const rest=args.filter(a=>!a.startsWith('-'));
  const content = rest[0]?VFS.read(rest[0]):(ctx.stdin||'');
  const lines=content.split('\n').length-(content.endsWith('\n')?1:0);
  const words=content.trim()?content.trim().split(/\s+/).length:0;
  if(flags.includes('-l')) return String(lines);
  if(flags.includes('-w')) return String(words);
  if(flags.includes('-c')) return String(content.length);
  return `${lines} ${words} ${content.length}`;
};
Commands.sort=(args,ctx)=>{
  const flags=args.filter(a=>a.startsWith('-'));
  const rest=args.filter(a=>!a.startsWith('-'));
  const content=rest[0]?VFS.read(rest[0]):(ctx.stdin||'');
  let lines=content.split('\n').filter(l=>l.length);
  const r=flags.includes('-r'); const n=flags.includes('-n');
  lines.sort((a,b)=>n?(parseFloat(a)-parseFloat(b)):a.localeCompare(b));
  if(r) lines.reverse();
  return lines.join('\n');
};
Commands.uniq=(args,ctx)=>{
  const content=args[0]?VFS.read(args[0]):(ctx.stdin||'');
  const out=[]; let prev=null;
  for(const l of content.split('\n')){ if(l!==prev){out.push(l);prev=l;} }
  return out.join('\n');
};
Commands.cut=(args,ctx)=>{
  const di=args.indexOf('-d'),fi=args.indexOf('-f');
  if(di<0||fi<0) throw new Error('cut: perlu -d dan -f');
  const d=args[di+1], f=parseInt(args[fi+1],10)-1;
  const file=args.slice(fi+2).find(a=>!a.startsWith('-'));
  const content = file?VFS.read(file):(ctx.stdin||'');
  return content.split('\n').map(l=>{ const p=l.split(d); return p[f]!=null?p[f]:''; }).join('\n');
};
Commands.tr=(args,ctx)=>{
  const from=args[0],to=args[1];
  if(!from||!to) throw new Error('tr: missing operand');
  let content = ctx.stdin||'';
  if(from==='a-z'&&to==='A-Z') return content.toUpperCase();
  if(from==='A-Z'&&to==='a-z') return content.toLowerCase();
  let out='';
  for(const ch of content){ const i=from.indexOf(ch); out+=i>=0&&i<to.length?to[i]:ch; }
  return out;
};
Commands.rev=(args,ctx)=>{
  const content = args[0]?VFS.read(args[0]):(ctx.stdin||'');
  return content.split('\n').map(l=>l.split('').reverse().join('')).join('\n');
};
Commands.tac=(args,ctx)=>{
  const content = args[0]?VFS.read(args[0]):(ctx.stdin||'');
  return content.split('\n').reverse().join('\n');
};
Commands.nl=(args,ctx)=>{
  const content = args[0]?VFS.read(args[0]):(ctx.stdin||'');
  return content.split('\n').map((l,i)=>`${String(i+1).padStart(6)}\t${l}`).join('\n');
};
Commands.column=(args,ctx)=>{
  const content = args[0]?VFS.read(args[0]):(ctx.stdin||'');
  const lines=content.split('\n').filter(Boolean);
  const rows=lines.map(l=>l.trim().split(/\s+/));
  const cols=Math.max(...rows.map(r=>r.length));
  const widths=Array(cols).fill(0);
  rows.forEach(r=>r.forEach((c,i)=>{ widths[i]=Math.max(widths[i],c.length); }));
  return rows.map(r=>r.map((c,i)=>c.padEnd(widths[i]+2)).join('')).join('\n');
};
Commands.fold=(args,ctx)=>{
  const w=parseInt(args[0],10)||80;
  const content = args[1]?VFS.read(args[1]):(ctx.stdin||'');
  return content.split('\n').map(l=>{
    if(l.length<=w) return l;
    const chunks=[]; for(let i=0;i<l.length;i+=w) chunks.push(l.slice(i,i+w));
    return chunks.join('\n');
  }).join('\n');
};
Commands.paste=(args,ctx)=>{
  if(args.length<2) throw new Error('paste: butuh 2 file');
  const a=VFS.read(args[0]).split('\n');
  const b=VFS.read(args[1]).split('\n');
  const max=Math.max(a.length,b.length);
  const out=[]; for(let i=0;i<max;i++) out.push(`${a[i]||''}\t${b[i]||''}`);
  return out.join('\n');
};
Commands.split=(args)=>{
  if(!args[0]) throw new Error('split: missing file');
  const n=parseInt(args[1],10)||100;
  const content=VFS.read(args[0]);
  const lines=content.split('\n');
  for(let i=0,idx=0;i<lines.length;i+=n,idx++){
    VFS.write(`${args[0]}.part${idx}`,lines.slice(i,i+n).join('\n'));
  }
  return `Split into ${Math.ceil(lines.length/n)} parts`;
};
Commands.base32=(args)=>{
  const dec=args[0]==='-d';
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  if(dec){
    const s=args.slice(1).join('').replace(/=+$/,'');
    let bits=''; for(const c of s) bits+=alphabet.indexOf(c.toUpperCase()).toString(2).padStart(5,'0');
    let out=''; for(let i=0;i+8<=bits.length;i+=8) out+=String.fromCharCode(parseInt(bits.slice(i,i+8),2));
    return out;
  }
  const text=args.join(' ');
  let bits=''; for(const c of text) bits+=c.charCodeAt(0).toString(2).padStart(8,'0');
  while(bits.length%5) bits+='0';
  let out=''; for(let i=0;i<bits.length;i+=5) out+=alphabet[parseInt(bits.slice(i,i+5),2)];
  while(out.length%8) out+='=';
  return out;
};

/* ─── Editor ─── */
Commands.nano=(args)=>{
  if(!args[0]) throw new Error('nano: missing file operand');
  const norm=VFS.normalize(args[0]);
  const n=VFS.node(norm);
  const content=n&&n.type==='file'?n.content:'';
  Nano.open(norm,content);
  return null;
};
Commands.edit=Commands.nano;
Commands.vi=Commands.nano;

/* ─── Runtime ─── */
Commands.node=(args)=>{
  if(args[0]==='-e'&&args[1]) return Executor.execJS(args[1]);
  if(!args[0]) throw new Error('node: missing file');
  return Executor.execJS(VFS.read(args[0]));
};
Commands.js=Commands.node; Commands.deno=Commands.node; Commands.bun=Commands.node;
Commands.python=async(args)=>{
  let code;
  if(args[0]==='-c'&&args[1]) code=args[1];
  else if(args[0]) code=VFS.read(args[0]);
  else throw new Error('python: missing file or -c code');
  return await Executor.execPython(code);
};
Commands.python3=Commands.python;

Commands.shell=(args)=>{
  if(!args[0]) return `Shell aktif: ${Settings.data.shell}`;
  const sh=args[0].toLowerCase();
  if(!['bash','zsh','fish','sh','powershell'].includes(sh)) throw new Error(`shell: '${sh}' tidak didukung`);
  Settings.set('shell',sh);
  return `Shell diubah ke: ${sh}`;
};
Commands.theme=(args)=>{
  if(!args[0]) return `Tema: ${Settings.data.theme}`;
  const t=args[0].toLowerCase();
  if(!['dark','light','dracula','monokai','solarized','nord'].includes(t)) throw new Error(`theme: '${t}' tidak ada`);
  Settings.set('theme',t);
  return `Tema diubah: ${t}`;
};
Commands.prompt=(args)=>{
  if(!args[0]) return `Prompt: ${Settings.data.prompt}`;
  Settings.set('prompt',args.join(' '));
  return `Prompt diubah.`;
};
Commands.settings=()=>{ SettingsPanel.open(); return null; };
Commands.presentation=()=>{
  const w=$('#etWindow');
  w.classList.toggle('presentation');
  if(!w.classList.contains('terminal-fullscreen')) w.classList.add('terminal-fullscreen');
  return w.classList.contains('presentation') ? 'Presentation mode: ON' : 'Presentation mode: OFF';
};
Commands.split=(args)=>{
  const mode=(args[0]||'h').toLowerCase();
  if(mode==='off'){ SplitManager.unsplit(); return 'Split dimatikan.'; }
  if(mode==='h'){ SplitManager.splitH(); return 'Split horizontal.'; }
  if(mode==='v'){ SplitManager.splitV(); return 'Split vertical.'; }
  throw new Error('split: mode harus h/v/off');
};

/* ─── Package Managers ─── */
function parsePkgArgs(args){ return args.filter(a=>!a.startsWith('-')); }
Commands.pkg=async(args)=>{
  const sub=args[0];
  const flags=args.filter(a=>a.startsWith('-'));
  const pkgs=parsePkgArgs(args.slice(1));
  const opts={ global:flags.includes('-g'), save:flags.includes('--save')||flags.includes('-S') };
  if(sub==='install') return await Executor.pkgInstall(pkgs,'pkg',opts);
  if(sub==='remove'||sub==='uninstall') return await Executor.pkgRemove(pkgs,'pkg');
  if(sub==='list') return Executor.pkgList('pkg');
  if(sub==='search') return Executor.pkgSearch(pkgs[0]||'',PKG_DB);
  if(sub==='update') return 'Hit:1 http://irgxy.repo/termux stable InRelease\nReading package lists... Done';
  if(sub==='upgrade') return await Executor.pkgUpgrade('pkg');
  if(sub==='browse'){ PackageBrowser.open('pkg'); return null; }
  throw new Error(`pkg: sub-command '${sub}' tidak dikenal`);
};
Commands.apt=Commands.pkg;
Commands.npm=async(args)=>{
  const sub=args[0];
  const flags=args.filter(a=>a.startsWith('-'));
  const pkgs=parsePkgArgs(args.slice(1));
  const opts={ global:flags.includes('-g'), save:flags.includes('--save')||flags.includes('-S') };
  if(sub==='install'||sub==='i'||sub==='add') return await Executor.pkgInstall(pkgs,'npm',opts);
  if(sub==='uninstall'||sub==='remove') return await Executor.pkgRemove(pkgs,'npm');
  if(sub==='list'||sub==='ls') return Executor.pkgList('npm');
  if(sub==='init'){
    const pkg={name:'irgxy-app',version:'1.0.0',description:'IRGXYMODS project',dependencies:{}};
    VFS.write('/home/irgxymods/package.json',JSON.stringify(pkg,null,2));
    return 'Wrote to /home/irgxymods/package.json';
  }
  if(sub==='run') return `> npm run ${pkgs[0]||'start'}\n> node index.js\n\n(run simulation)`;
  if(sub==='browse'){ PackageBrowser.open('npm'); return null; }
  throw new Error(`npm: '${sub}' tidak dikenal`);
};
Commands.pip=async(args)=>{
  const sub=args[0];
  const pkgs=parsePkgArgs(args.slice(1));
  if(sub==='install') return await Executor.pkgInstall(pkgs,'pip',{});
  if(sub==='uninstall') return await Executor.pkgRemove(pkgs,'pip');
  if(sub==='list') return Executor.pkgList('pip');
  if(sub==='freeze') return State.packages.pip.map(p=>`${p.name}==${p.version}`).join('\n');
  if(sub==='browse'){ PackageBrowser.open('pip'); return null; }
  throw new Error(`pip: '${sub}' tidak dikenal`);
};

/* ─── Network ─── */
Commands.curl=async(args)=>{
  const urls=args.filter(a=>a.startsWith('http'));
  if(!urls[0]) throw new Error('curl: missing URL');
  try{
    const ctrl=new AbortController();
    const to=setTimeout(()=>ctrl.abort(),12000);
    const res=await fetch(urls[0],{signal:ctrl.signal});
    clearTimeout(to);
    const text=await res.text();
    return `HTTP ${res.status} ${res.statusText}\nContent-Type: ${res.headers.get('content-type')||'-'}\nLength: ${text.length}\n\n${text.slice(0,2000)}${text.length>2000?'\n...(truncated)':''}`;
  }catch(e){ return `curl: (7) Failed: ${e.message}`; }
};
Commands.wget=Commands.curl;
Commands.ping=async(args)=>{
  const h=args[0]; if(!h) throw new Error('ping: usage: ping <host>');
  Renderer.print(`PING ${h} (127.0.0.1) 56(84) bytes of data.`);
  for(let i=1;i<=4;i++){
    await sleep(400);
    Renderer.print(`64 bytes from ${h}: icmp_seq=${i} ttl=64 time=${(Math.random()*40+8).toFixed(2)} ms`);
  }
  Renderer.print(`\n--- ${h} ping statistics ---`);
  Renderer.print('4 packets transmitted, 4 received, 0% packet loss');
  return null;
};
Commands.dig=(args)=>{
  const d=args[0]; if(!d) throw new Error('dig: usage: dig <domain>');
  return `;; ANSWER SECTION:\n${d}.  300  IN  A  93.184.216.34\n${d}.  300  IN  AAAA  2606:2800:220:1::1`;
};
Commands.ip=(args)=>{
  const sub=args[0]||'addr';
  if(sub==='addr'||sub==='a')
    return `1: lo: <LOOPBACK,UP> inet 127.0.0.1/8\n2: eth0: inet 192.168.1.${Math.floor(Math.random()*200)+20}/24\nonline: ${navigator.onLine?'yes':'no'}`;
  if(sub==='route'||sub==='r') return 'default via 192.168.1.1 dev eth0';
  return 'ip: usage: ip [addr|route]';
};
Commands.nc=async(args)=>{
  const [h,p]=args; if(!h||!p) throw new Error('nc: usage: nc <host> <port>');
  await sleep(400); return `${h} ${p} (tcp) open`;
};
Commands.whois=(args)=>{
  const d=args[0]; if(!d) throw new Error('whois: missing domain');
  return `Domain Name: ${d.toUpperCase()}\nRegistrar: IRGXYMODS Registrar\nCreation Date: 2020-01-01`;
};
Commands.nslookup=(args)=>{
  const d=args[0]; if(!d) throw new Error('nslookup: missing domain');
  return `Server: 8.8.8.8\nAddress: 8.8.8.8#53\n\nName: ${d}\nAddress: 93.184.216.34`;
};
Commands.traceroute=async(args)=>{
  const h=args[0]; if(!h) throw new Error('traceroute: missing host');
  Renderer.print(`traceroute to ${h}, 30 hops max`);
  for(let i=1;i<=5;i++){ await sleep(300); Renderer.print(`${String(i).padStart(2)}  ${(Math.random()*30+5).toFixed(1)} ms  192.168.1.${i}  (${h})`); }
  return null;
};
Commands.headers=async(args)=>{
  const u=args[0]; if(!u) throw new Error('headers: missing URL');
  try{
    const r=await fetch(u,{method:'HEAD'});
    const out=[`HTTP ${r.status} ${r.statusText}`];
    r.headers.forEach((v,k)=>out.push(`${k}: ${v}`));
    return out.join('\n');
  }catch(e){ return `headers: ${e.message}`; }
};
Commands.http=()=>{ HTTPClient.open(); return null; };
Commands.netdiag=()=>{ NetDiag.open(); return null; };
Commands.speedtest=async()=>{
  Renderer.print('Speed test starting...','dim');
  const start=performance.now();
  try{
    const r=await fetch('https://raw.githubusercontent.com/torvalds/linux/master/README',{cache:'no-store'});
    const t=await r.text();
    const sec=(performance.now()-start)/1000;
    const mbps=(t.length*8/1000000)/sec;
    return `Downloaded ${fmtBytes(t.length)} in ${sec.toFixed(2)}s\n≈ ${mbps.toFixed(2)} Mbps`;
  }catch(e){ return 'speedtest: offline / gagal: '+e.message; }
};

/* ─── System Info ─── */
Commands.whoami=()=>State.user;
Commands.hostname=()=>State.host;
Commands.uname=(args)=>{
  const ua=navigator.userAgent;
  let os='Linux';
  if(/Android/i.test(ua)) os='Android';
  else if(/iPhone|iPad|iPod/i.test(ua)) os='iOS';
  else if(/Mac/i.test(ua)) os='Darwin';
  else if(/Win/i.test(ua)) os='Windows_NT';
  if(args.includes('-a')) return `${os} ${State.host} 5.15.0-irgxy #1 SMP x86_64 GNU/Linux`;
  return os;
};
Commands.date=()=>new Date().toString();
Commands.uptime=()=>{
  const s=Math.floor((Date.now()-State.bootTime)/1000);
  const h=Math.floor(s/3600), m=Math.floor((s%3600)/60);
  return ` ${new Date().toTimeString().slice(0,8)} up ${h}:${pad(m)}, 1 user, load average: 0.12, 0.18, 0.15`;
};
Commands.neofetch=()=>{
  const ua=navigator.userAgent;
  let os='Linux',icon='🐧';
  if(/Android/i.test(ua)){os='Android';icon='🤖';}
  else if(/iPhone|iPad/i.test(ua)){os='iOS';icon='🍎';}
  else if(/Mac/i.test(ua)){os='macOS';icon='🍎';}
  else if(/Win/i.test(ua)){os='Windows';icon='🪟';}
  const upMin=Math.floor((Date.now()-State.bootTime)/60000);
  const used=VFS.size(VFS.data['/']);
  const pkgCount=State.packages.pkg.length+State.packages.npm.length+State.packages.pip.length;
  const L=[
    '        ╔══════════════════════╗        '+`${State.user}@${State.host}`,
    '        ║     ██╗██████╗  ██████╗║        '+'-----------------',
    '        ║     ██║██╔══██╗██╔════╝║        '+`OS: ${icon} ${os}`,
    '        ║     ██║██████╔╝██║  ███╗        '+'Kernel: 5.15.0-irgxy',
    '        ║     ██║██╔══██╗██║   ██║        '+`Shell: ${Settings.data.shell}`,
    '        ║     ██║██║  ██║╚██████╔╝        '+`Theme: ${Settings.data.theme}`,
    '        ║     ╚═╝╚═╝  ╚═╝ ╚═════╝         '+`Uptime: ${upMin} min`,
    '        ╚══════════════════════╝        '+`Storage: ${fmtBytes(used)} / 5.0 MB`,
    '                                        '+`Packages: ${pkgCount}`,
    '                                        '+`Resolution: ${screen.width}x${screen.height}`,
    '                                        ',
    '        ██ ██ ██ ██ ██ ██ ██ ██         '+'⚫ ⚫ ⚫ ⚫ ⚫ ⚫ ⚫ ⚫'
  ];
  return L.join('\n');
};
Commands.df=()=>{
  const used=VFS.size(VFS.data['/']);
  const pct=Math.round(used/VFS_MAX*100);
  return ['Filesystem      Size  Used Avail Use% Mounted on',
    `vfs              5M  ${fmtBytes(used).padStart(4)}  ${fmtBytes(VFS_MAX-used).padStart(5)} ${String(pct).padStart(3)}% /`].join('\n');
};
Commands.free=()=>{
  let heap='';
  if(performance.memory){
    heap=`\nJS Heap:   ${(performance.memory.usedJSHeapSize/1048576).toFixed(1)} MB / ${(performance.memory.totalJSHeapSize/1048576).toFixed(1)} MB`;
  }
  return `              total        used        free\nMem:        ${(navigator.hardwareConcurrency||4)*512} MB       ---          ---${heap}`;
};
Commands.ps=()=>[
  '  PID TTY      TIME     CMD',
  `    1 ?        00:00:00 irgxy-init`,
  `   42 ?        00:00:01 terminal-ui`,
  `   88 ?        00:00:00 vfs-daemon`,
  `  120 ?        00:00:${String(Math.floor((Date.now()-State.bootTime)/1000)).padStart(2,'0')} irgxy-shell`
].join('\n');
Commands.top=()=>{
  Renderer.print('top - '+new Date().toTimeString().slice(0,8),'gold');
  Renderer.print('  PID  USER      %CPU  %MEM  COMMAND','dim');
  const p=[['  1','root',(Math.random()*2).toFixed(1),'0.3','irgxy-init'],
           [' 42','irgxymods',(Math.random()*8).toFixed(1),'2.1','terminal-ui'],
           [' 88','irgxymods',(Math.random()*3).toFixed(1),'0.8','vfs-daemon'],
           ['120','irgxymods',(Math.random()*5).toFixed(1),'1.5','irgxy-shell']];
  for(const r of p) Renderer.print(r.map((x,i)=>String(x).padEnd([6,10,6,6,20][i])).join(' '));
  return null;
};
Commands['top-live']=Commands.htop=()=>{ ProcessMonitor.open(); return null; };
Commands.env=()=>Object.keys({...State.env,PWD:State.cwd}).map(k=>`${k}=${State.env[k]!==undefined?State.env[k]:State.cwd}`).join('\n');
Commands.lsof=()=>'COMMAND    PID  USER  FD  TYPE  NAME\nirgxy     120  user  4u  REG   /home/irgxymods/README.md';
Commands.ss=Commands.netstat=()=>'State  Recv-Q  Send-Q  Local Address:Port  Peer Address:Port\nLISTEN 0       128     0.0.0.0:8080        0.0.0.0:*';
Commands.dmesg=()=>'[    0.000000] IRGXYMODS kernel v3 booting...\n[    0.120000] VFS mounted\n[    0.350000] Pyodide lazy-loader ready';
Commands.journalctl=()=>'-- Logs begin --\nirgxy-shell[120]: Terminal v3 ready';

/* ─── Utility ─── */
Commands.clear=()=>{ Renderer.clear(); return null; };
Commands.help=(args)=>{
  if(args[0]){
    if(Commands[args[0]]) return `Command: ${args[0]}\nTersedia. Gunakan man ${args[0]} untuk detail.`;
    throw new Error(`help: command '${args[0]}' tidak ditemukan`);
  }
  const groups={
    'File System':['ls','cd','pwd','mkdir','rmdir','touch','cat','rm','cp','mv','tree','find','stat','du','ln','head','tail'],
    'Text':['echo','grep','sed','awk','wc','sort','uniq','cut','tr','rev','tac','nl','column','fold','paste','split','base32'],
    'Editor':['nano','edit','vi'],
    'Runtime':['node','js','deno','bun','python','python3','shell'],
    'Package':['pkg','apt','npm','pip'],
    'Network':['curl','wget','ping','dig','ip','nc','whois','nslookup','traceroute','headers','http','netdiag','speedtest'],
    'System':['whoami','hostname','uname','date','uptime','neofetch','df','free','ps','top','top-live','htop','env','lsof','ss','netstat','dmesg','journalctl'],
    'Utility':['clear','help','exit','sleep','seq','yes','bc','cal','cowsay','figlet','uuid','history','man','which','whereis','alias','export','source','time','watch'],
    'Git':['git'],
    'Coding':['json','json-tui','sql','regex','jwt','url','hex','rot13','diff','diff-tui','format','minify','lint','beautify','init','run','csv','md','regex-tui','pipe-builder','script-library'],
    'Compress':['gzip','gunzip','zip','unzip'],
    'Crypto':['base64','md5sum','sha1sum','sha256sum','sha512sum','hash-all','hash','openssl','encrypt','decrypt','passwd-gen','qrcode','barcode'],
    'Process':['jobs','bg','fg','kill','pkill','killall'],
    'Meta':['tutorial','examples','changelog','settings','theme','prompt','bookmark','alias-tui','env-tui','history-search','record','transcript','presentation','split','search-tui','banner','library']
  };
  let total=0; const lines=['','═ IRGXYMODS TERMINAL v3 — COMMAND REFERENCE ═',''];
  for(const [g,cmds] of Object.entries(groups)){
    total+=cmds.length;
    lines.push(`▸ ${g}`); lines.push('  '+cmds.join('  ')); lines.push('');
  }
  lines.push(`Total: ${total} commands`);
  return lines.join('\n');
};
Commands.exit=()=>{ Renderer.print('logout: simulated','dim'); return null; };
Commands.sleep=async(args)=>{
  const s=parseFloat(args[0]);
  if(isNaN(s)) throw new Error('sleep: missing operand');
  const end=Date.now()+s*1000;
  while(Date.now()<end && !State.cancelFlag){ await sleep(100); }
  return null;
};
Commands.seq=(args)=>{
  const n=args.map(Number).filter(x=>!isNaN(x));
  if(n.length<2) throw new Error('seq: butuh 2 angka');
  const [a,b]=n; const step=n[2]||1; const out=[];
  if(a<=b) for(let i=a;i<=b;i+=step) out.push(i);
  else for(let i=a;i>=b;i-=step) out.push(i);
  return out.join('\n');
};
Commands.yes=(args)=>Array(100).fill(args.join(' ')||'y').join('\n')+'\n(yes: 100 kali)';
Commands.bc=(args)=>{
  const e=args.join(' ');
  if(!e) return 'bc 1.07 — Kalkulator\nGunakan + - * / % ^';
  if(!/^[0-9+\-*/%^().\s]+$/.test(e)) throw new Error('bc: ekspresi tidak valid');
  try{ return String(Function('"use strict";return ('+e.replace(/\^/g,'**')+')')()); }
  catch(err){ throw new Error('bc: '+err.message); }
};
Commands.cal=(args)=>{
  const now=new Date();
  const month=args[0]?parseInt(args[0],10)-1:now.getMonth();
  const year=args[1]?parseInt(args[1],10):now.getFullYear();
  return Commands._calStr(month,year);
};
Commands._calStr=(m,y)=>{
  const names=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const first=new Date(y,m,1); const dow=first.getDay();
  const days=new Date(y,m+1,0).getDate();
  const lines=[`${names[m]} ${y}`.padStart(20),'Mg Sn Sl Rb Km Jm Sb'];
  let row='   '.repeat(dow);
  for(let d=1;d<=days;d++){
    row+=String(d).padStart(2)+' ';
    if((dow+d)%7===0){ lines.push(row.trimEnd()); row=''; }
  }
  if(row.trim()) lines.push(row.trimEnd());
  return lines.join('\n');
};
Commands.cowsay=(args)=>{
  const t=args.join(' ')||'Hello IRGXYMODS!';
  const top=' '+'_'.repeat(t.length+2), bot=' '+'-'.repeat(t.length+2);
  return [top,`< ${t} >`,bot,'        \\   ^__^','         \\  (oo)\\_______','            (__)\\       )\\/\\','                ||----w |','                ||     ||'].join('\n');
};
Commands.figlet=(args)=>{
  const text=(args.join(' ')||'IRGXY').toUpperCase();
  const font={
    A:'  █████  \n ██   ██ \n ███████ \n ██   ██ \n ██   ██ ',
    B:' ██████  \n ██   ██ \n ██████  \n ██   ██ \n ██████  ',
    C:'  ██████ \n ██      \n ██      \n ██      \n  ██████ ',
    D:' ██████  \n ██   ██ \n ██   ██ \n ██   ██ \n ██████  ',
    E:' ███████ \n ██      \n █████   \n ██      \n ███████ ',
    F:' ███████ \n ██      \n █████   \n ██      \n ██      ',
    G:'  ██████ \n ██      \n ██  ███ \n ██   ██ \n  ██████ ',
    H:' ██   ██ \n ██   ██ \n ███████ \n ██   ██ \n ██   ██ ',
    I:' ███ \n  █  \n  █  \n  █  \n ███ ',
    J:'    ███ \n     █  \n     █  \n ██  █  \n  ███   ',
    K:' ██   ██ \n ██  ██  \n █████   \n ██  ██  \n ██   ██ ',
    L:' ██      \n ██      \n ██      \n ██      \n ███████ ',
    M:' ██     ██ \n ███   ███ \n ██ ███ ██ \n ██  █  ██ \n ██     ██ ',
    N:' ██    ██ \n ███   ██ \n ██ ██ ██ \n ██  ████ \n ██    ██ ',
    O:'  ██████  \n ██    ██ \n ██    ██ \n ██    ██ \n  ██████  ',
    P:' ██████  \n ██   ██ \n ██████  \n ██      \n ██      ',
    Q:'  ██████  \n ██    ██ \n ██ ██ ██ \n ██  ███  \n  █████ ██',
    R:' ██████  \n ██   ██ \n ██████  \n ██   ██ \n ██   ██ ',
    S:'  ██████ \n ██      \n  █████  \n      ██ \n ██████  ',
    T:' ███████ \n    ██   \n    ██   \n    ██   \n    ██   ',
    U:' ██   ██ \n ██   ██ \n ██   ██ \n ██   ██ \n  █████  ',
    V:' ██   ██ \n ██   ██ \n ██   ██ \n  ██ ██  \n   ███   ',
    W:' ██     ██ \n ██     ██ \n ██  █  ██ \n ██ ███ ██ \n  ███ ███  ',
    X:' ██   ██ \n  ██ ██  \n   ███   \n  ██ ██  \n ██   ██ ',
    Y:' ██   ██ \n  ██ ██  \n   ███   \n    ██   \n    ██   ',
    Z:' ███████ \n     ██  \n    ██   \n   ██    \n ███████ ',
    ' ':'    \n    \n    \n    \n    '
  };
  const rows=Array(5).fill('');
  for(const ch of text){ const g=font[ch]||font[' ']; const l=g.split('\n'); for(let i=0;i<5;i++) rows[i]+=(l[i]||'')+'  '; }
  return rows.join('\n');
};
Commands.base64=(args,ctx)=>{
  const dec=args[0]==='-d'||args[0]==='--decode';
  const input=dec?args.slice(1).join(' '):(args.join(' ')||ctx.stdin||'');
  if(!input) throw new Error('base64: missing input');
  try{
    if(dec) return decodeURIComponent(escape(atob(input)));
    return btoa(unescape(encodeURIComponent(input)));
  }catch(e){ throw new Error('base64: '+e.message); }
};
Commands.md5sum=(args)=>{ if(!args[0]) throw new Error('md5sum: missing file'); return Commands._md5(VFS.read(args[0]))+'  '+args[0]; };
Commands._md5=(str)=>{
  let h=0x811c9dc5; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; }
  let h2=0x12345678; for(let i=str.length-1;i>=0;i--){ h2^=str.charCodeAt(i); h2=Math.imul(h2,0x85ebca6b)>>>0; }
  const hex=(h>>>0).toString(16).padStart(8,'0')+(h2>>>0).toString(16).padStart(8,'0');
  return (hex+hex.split('').reverse().join('')).slice(0,32);
};
Commands.sha1sum=async(args)=>{ if(!args[0]) throw new Error('sha1sum: missing file'); return await Executor.hashText('sha1',VFS.read(args[0]))+'  '+args[0]; };
Commands.sha256sum=async(args)=>{ if(!args[0]) throw new Error('sha256sum: missing file'); return await Executor.hashSha256(VFS.read(args[0]))+'  '+args[0]; };
Commands.sha512sum=async(args)=>{ if(!args[0]) throw new Error('sha512sum: missing file'); return await Executor.hashText('sha512',VFS.read(args[0]))+'  '+args[0]; };
Commands['hash-all']=async(args)=>{
  if(!args[0]) throw new Error('hash-all: missing file');
  const c=VFS.read(args[0]);
  const md5=Commands._md5(c);
  const sha1=await Executor.hashText('sha1',c);
  const sha256=await Executor.hashSha256(c);
  const sha512=await Executor.hashText('sha512',c);
  return `MD5:    ${md5}\nSHA1:   ${sha1}\nSHA256: ${sha256}\nSHA512: ${sha512}`;
};
Commands.uuid=()=>crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
Commands.time=async(args)=>{
  if(!args.length) throw new Error('time: usage: time <command>');
  const st=performance.now();
  await Executor.runString(args.join(' '),{silent:true});
  const el=performance.now()-st;
  Renderer.print('','dim');
  Renderer.print(`real\t${(el/1000).toFixed(3)}s`,'dim');
  return null;
};
Commands.watch=async(args)=>{
  let n=2; const ni=args.indexOf('-n');
  if(ni>=0){ n=parseInt(args[ni+1],10)||2; args=args.slice(ni+2); }
  if(!args.length) throw new Error('watch: missing command');
  Renderer.print(`Every ${n}.0s: ${args.join(' ')}\n(Ctrl+C untuk berhenti)`,'dim');
  for(let i=0;i<3;i++){ await sleep(n*1000); if(State.cancelFlag) break; await Executor.runString(args.join(' '),{silent:false}); }
  return null;
};
Commands.history=(args)=>{
  if(args[0]==='-c'){ State.history=[]; lsSet(KEY.HISTORY,[]); return 'history cleared'; }
  return State.history.slice(-30).map((h,i)=>String(i+1).padStart(4)+'  '+h).join('\n');
};
Commands.man=(args)=>{
  const c=args[0];
  if(!c) throw new Error('man: what manual page do you want?');
  if(!Commands[c]) throw new Error(`man: no manual entry for ${c}`);
  return `NAME\n    ${c} — IRGXYMODS terminal command\n\nSYNOPSIS\n    ${c} [options] [args]\n\nDESCRIPTION\n    Command '${c}' tersedia di emulator terminal IRGXYMODS v3.\n    Ketik 'help ${c}' untuk info singkat.`;
};
Commands.which=(args)=>{ if(!args[0]) throw new Error('which: missing argument'); return Commands[args[0]]?`/usr/bin/${args[0]}`:null; };
Commands.whereis=Commands.which;
Commands.alias=(args)=>{
  if(args[0]==='--tui'){ AliasEnvUI.openAlias(); return null; }
  if(!args.length){
    const k=Object.keys(State.alias);
    return k.length?k.map(x=>`alias ${x}='${State.alias[x]}'`).join('\n'):'(belum ada alias)';
  }
  const m=args.join(' ').match(/^(\S+)=['"]?(.*?)['"]?$/);
  if(!m) throw new Error('alias: format: alias name=value');
  State.alias[m[1]]=m[2]; lsSet(KEY.ALIAS,State.alias); return null;
};
Commands['alias-tui']=()=>{ AliasEnvUI.openAlias(); return null; };
Commands.export=(args)=>{
  const m=args.join(' ').match(/^(\w+)=(.*)$/);
  if(!m) throw new Error('export: format: export KEY=VALUE');
  State.env[m[1]]=m[2]; lsSet(KEY.ENV,State.env); return null;
};
Commands['env-tui']=()=>{ AliasEnvUI.openEnv(); return null; };
Commands.source=(args)=>{
  if(!args[0]) throw new Error('source: missing file');
  const c=VFS.read(args[0]);
  const lines=c.split('\n').filter(l=>l.trim()&&!l.trim().startsWith('#'));
  return `sourced ${lines.length} lines from ${args[0]}`;
};

/* ─── Git ─── */
Commands.git=async(args)=>{
  const sub=args[0];
  const gitDir=VFS.normalize('.git');
  if(sub==='init'){
    if(!VFS.node(gitDir)) VFS.mkdir(gitDir,true);
    VFS.write(VFS.normalize('.git/HEAD'),'ref: refs/heads/main\n');
    VFS.write(VFS.normalize('.git/config'),'[core]\n\tfilemode = true\n');
    State.gitRepo=true;
    return `Initialized empty Git repository in ${gitDir}/`;
  }
  if(!VFS.node(gitDir)) throw new Error('fatal: not a git repository');
  if(sub==='status') return 'On branch main\n\nNo commits yet\n\nnothing to commit';
  if(sub==='add') return null;
  if(sub==='commit'){
    const mi=args.indexOf('-m');
    const msg=mi>=0?args[mi+1]:'no message';
    return `[main ${Math.random().toString(16).slice(2,9)}] ${msg}\n 1 file changed`;
  }
  if(sub==='log') return `commit ${Math.random().toString(16).slice(2,40)}\nAuthor: ${State.user}\nDate: ${new Date()}\n\n    initial commit`;
  if(sub==='clone') return `Cloning into '${args[1]||'repo'}'... done.`;
  if(sub==='branch') return '* main';
  if(sub==='checkout') return `Switched to branch '${args[1]||'main'}'`;
  if(sub==='diff') return '';
  throw new Error(`git: '${sub}' bukan git command`);
};

/* ─── Coding Utilities ─── */
Commands.json=(args)=>{ if(!args[0]) throw new Error('json: missing file'); return JSON.stringify(JSON.parse(VFS.read(args[0])),null,2); };
Commands['json-tui']=(args)=>{ if(!args[0]) throw new Error('json-tui: missing file'); JSONViewer.open(args[0]); return null; };
Commands.csv=(args)=>{ if(!args[0]) throw new Error('csv: missing file'); CSVViewer.open(args[0]); return null; };
Commands.sql=(args)=>{
  const q=args.join(' ');
  if(/create\s+table/i.test(q)) return 'Table created.';
  if(/insert/i.test(q)) return '1 row inserted.';
  if(/select/i.test(q)) return 'id | name\n---+------\n1  | Alice\n2  | Bob\n(2 rows)';
  if(/drop/i.test(q)) return 'Table dropped.';
  return 'Query executed.';
};
Commands.regex=(args)=>{
  if(args.length<2) throw new Error('regex: usage: regex <pattern> <text>');
  const [pat,...rest]=args; const text=rest.join(' ');
  try{
    const re=new RegExp(pat,'g'); const ms=[...text.matchAll(re)];
    if(!ms.length) return 'Tidak ada match.';
    return [`Match: ${ms.length}`,...ms.map((m,i)=>`  [${i}] "${m[0]}" @ ${m.index}`)].join('\n');
  }catch(e){ throw new Error('regex: '+e.message); }
};
Commands['regex-tui']=()=>{ RegexTester.open(); return null; };
Commands.jwt=(args)=>{
  const sub=args[0]||'decode';
  if(sub==='decode'){
    if(!args[1]) throw new Error('jwt: missing token');
    const p=args[1].split('.');
    if(p.length!==3) throw new Error('jwt: invalid');
    try{
      const d=s=>JSON.parse(atob(s.replace(/-/g,'+').replace(/_/g,'/')));
      return `HEADER:\n${JSON.stringify(d(p[0]),null,2)}\n\nPAYLOAD:\n${JSON.stringify(d(p[1]),null,2)}`;
    }catch(e){ throw new Error('jwt: '+e.message); }
  }
  if(sub==='sign'){
    const [payload,secret]=args.slice(1);
    if(!payload) throw new Error('jwt sign <payload-json> <secret>');
    const enc=s=>btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/=+$/,'').replace(/\+/g,'-').replace(/\//g,'_');
    const h=enc({alg:'HS256',typ:'JWT'});
    let p; try{ p=enc(JSON.parse(payload)); }catch(_){ p=enc({data:payload}); }
    const sig=Commands._md5(h+'.'+p+(secret||''));
    return `${h}.${p}.${sig}`;
  }
  throw new Error('jwt: sub-command decode/sign');
};
Commands.url=(args)=>{
  const dec=args[0]==='-d'||args[0]==='--decode';
  const t=args.slice(dec?1:0).join(' ');
  if(!t) throw new Error('url: missing input');
  try{ return dec?decodeURIComponent(t):encodeURIComponent(t); }catch(e){ throw new Error('url: '+e.message); }
};
Commands.hex=(args)=>{
  const dec=args[0]==='-d';
  if(dec){
    const h=args.slice(1).join('').replace(/\s/g,''); let out='';
    for(let i=0;i<h.length;i+=2) out+=String.fromCharCode(parseInt(h.substr(i,2),16));
    return out;
  }
  return args.slice(1).join(' ').split('').map(c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join(' ');
};
Commands.rot13=(args)=>args.join(' ').replace(/[a-zA-Z]/g,c=>{const b=c<='Z'?65:97;return String.fromCharCode(((c.charCodeAt(0)-b+13)%26)+b);});
Commands.diff=(args)=>{
  if(args[0]==='--tui'){ if(args.length<3) throw new Error('diff --tui a b'); DiffViewer.open(args[1],args[2]); return null; }
  if(args.length<2) throw new Error('diff: butuh 2 file');
  const a=VFS.read(args[0]).split('\n'); const b=VFS.read(args[1]).split('\n');
  const out=[];
  for(let i=0;i<Math.max(a.length,b.length);i++){
    if(a[i]!==b[i]){ if(a[i]!=null) out.push(`< ${a[i]}`); if(b[i]!=null) out.push(`> ${b[i]}`); }
  }
  return out.length?out.join('\n'):'(tidak ada perbedaan)';
};
Commands['diff-tui']=(args)=>{
  if(args.length<2) throw new Error('diff-tui: butuh 2 file');
  DiffViewer.open(args[0],args[1]); return null;
};
Commands.format=(args)=>{
  const [lang,file]=args;
  if(!file) throw new Error('format: format <lang> <file>');
  const c=VFS.read(file);
  const f=lang.toLowerCase();
  if(f==='json') return JSON.stringify(JSON.parse(c),null,2);
  if(f==='js'||f==='javascript'||f==='css'||f==='html'){
    let d=0,out='';
    for(const ch of c.replace(/\s+/g,' ')){
      if(ch==='{'||ch==='['){ out+=ch+'\n'+'  '.repeat(++d); }
      else if(ch==='}'||ch===']'){ out+='\n'+'  '.repeat(--d)+ch; }
      else if(ch===';'){ out+=ch+'\n'+'  '.repeat(d); }
      else out+=ch;
    }
    return out.trim();
  }
  if(f==='md'||f==='markdown') return c.split('\n').map(l=>l.trimEnd()).join('\n');
  return c;
};
Commands.minify=(args)=>{
  const [lang,file]=args;
  if(!file) throw new Error('minify: usage: minify <lang> <file>');
  let c=VFS.read(file);
  c=c.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'');
  if(lang==='json') return JSON.stringify(JSON.parse(c));
  return c.replace(/\s+/g,' ').replace(/\s*([{}();,:=<>])\s*/g,'$1').trim();
};
Commands.beautify=Commands.format;
Commands.lint=(args)=>{
  if(!args[0]) throw new Error('lint: missing file');
  const code=VFS.read(args[0]);
  if(args[0].endsWith('.json')){ try{ JSON.parse(code); return '✓ Valid JSON'; }catch(e){ throw new Error('lint: '+e.message); } }
  try{ new Function(code); return '✓ Syntax OK'; }catch(e){ throw new Error('lint: '+e.message); }
};
Commands.run=async(args)=>{
  if(!args[0]) throw new Error('run: missing file');
  const f=args[0];
  if(f.endsWith('.js')) return await Executor.runString('node '+f);
  if(f.endsWith('.py')) return await Executor.runString('python3 '+f);
  throw new Error('run: ekstensi .js/.py saja');
};
Commands.init=(args)=>{
  const name=args[0]||'myproject';
  VFS.mkdir('/home/irgxymods/'+name,true);
  VFS.write(`/home/irgxymods/${name}/package.json`,JSON.stringify({name,version:'1.0.0',scripts:{start:'node index.js'}},null,2));
  VFS.write(`/home/irgxymods/${name}/index.js`,'console.log("Hello from "+__filename);\n');
  VFS.write(`/home/irgxymods/${name}/README.md`,`# ${name}\n\nGenerated by IRGXYMODS Terminal v3.\n`);
  return `Project '${name}' initialized di /home/irgxymods/${name}`;
};
Commands.test=(args)=>{
  return `Running tests...\n  ✓ test 1\n  ✓ test 2\n\n2 passed (${Math.random()*500+50|0}ms)`;
};
Commands.md=(args)=>{
  if(!args[0]) throw new Error('md: missing file');
  MarkdownPreview.open(args[0]);
  return null;
};

/* ─── Compress ─── */
Commands.gzip=(args)=>{
  if(!args[0]) throw new Error('gzip: missing file');
  const c=VFS.read(args[0]);
  VFS.write(args[0]+'.gz','[GZIP]'+encodeURIComponent(c));
  VFS.rm(args[0],false,true);
  return null;
};
Commands.gunzip=(args)=>{
  if(!args[0]) throw new Error('gunzip: missing file');
  const c=VFS.read(args[0]);
  if(!c.startsWith('[GZIP]')) throw new Error('gunzip: not gzip');
  VFS.write(args[0].replace(/\.gz$/,''),decodeURIComponent(c.slice(6)));
  VFS.rm(args[0],false,true);
  return null;
};
Commands.zip=(args)=>{
  if(args.length<2) throw new Error('zip: zip <output.zip> <files...>');
  const [out,...files]=args;
  const payload={};
  for(const f of files){
    try{ payload[f]=VFS.read(f); }catch(_){}
  }
  VFS.write(out,'[ZIP]'+encodeURIComponent(JSON.stringify(payload)));
  return `added: ${Object.keys(payload).length} file(s)`;
};
Commands.unzip=(args)=>{
  if(!args[0]) throw new Error('unzip: missing file');
  const c=VFS.read(args[0]);
  if(!c.startsWith('[ZIP]')) throw new Error('unzip: not a zip');
  const data=JSON.parse(decodeURIComponent(c.slice(5)));
  for(const k in data) VFS.write(k,data[k]);
  return `extracted ${Object.keys(data).length} file(s)`;
};

/* ─── Crypto ─── */
Commands.openssl=async(args)=>{
  const sub=args[0];
  if(sub==='md5') return Commands.md5sum(args.slice(1));
  if(sub==='sha256') return await Commands.sha256sum(args.slice(1));
  if(sub==='rand'){ const n=parseInt(args[2],10)||16; let o=''; for(let i=0;i<n;i++) o+=Math.floor(Math.random()*256).toString(16).padStart(2,'0'); return o; }
  throw new Error('openssl: sub-command tidak didukung');
};
Commands.hash=async(args)=>{
  const [algo,...rest]=args; const text=rest.join(' ');
  if(!algo||!text) throw new Error('hash: usage: hash <algo> <text>');
  return await Executor.hashText(algo,text);
};
Commands.encrypt=async(args)=>{
  const [file,pwd]=args;
  if(!file||!pwd) throw new Error('encrypt: encrypt <file> <password>');
  const plain=VFS.read(file);
  const enc=new TextEncoder();
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const keyMat=await crypto.subtle.importKey('raw',enc.encode(pwd),{name:'PBKDF2'},false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},keyMat,{name:'AES-GCM',length:256},false,['encrypt']);
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(plain));
  const b64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf)));
  const out=['[ENC]',b64(salt),b64(iv),b64(ct)].join(':');
  VFS.write(file+'.enc',out);
  return `Encrypted -> ${file}.enc`;
};
Commands.decrypt=async(args)=>{
  const [file,pwd]=args;
  if(!file||!pwd) throw new Error('decrypt: decrypt <file.enc> <password>');
  const raw=VFS.read(file);
  if(!raw.startsWith('[ENC]')) throw new Error('decrypt: bukan format ENC');
  const [,saltB,ivB,ctB]=raw.split(':');
  const un=b64=>new Uint8Array(atob(b64).split('').map(c=>c.charCodeAt(0)));
  const keyMat=await crypto.subtle.importKey('raw',new TextEncoder().encode(pwd),{name:'PBKDF2'},false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:un(saltB),iterations:100000,hash:'SHA-256'},keyMat,{name:'AES-GCM',length:256},false,['decrypt']);
  try{
    const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:un(ivB)},key,un(ctB));
    const text=new TextDecoder().decode(pt);
    VFS.write(file.replace(/\.enc$/,'.dec'),text);
    return `Decrypted -> ${file.replace(/\.enc$/,'.dec')}`;
  }catch(e){ throw new Error('decrypt: password salah / data corrupt'); }
};
Commands['passwd-gen']=(args)=>{
  const len=parseInt(args[0],10)||16;
  const lower='abcdefghijklmnopqrstuvwxyz';
  const upper='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits='0123456789';
  const sym='!@#$%^&*()-_=+[]{};:,.<>?';
  const all=lower+upper+digits+sym;
  let pwd='';
  const pick=s=>s[Math.floor(Math.random()*s.length)];
  pwd+=pick(lower)+pick(upper)+pick(digits)+pick(sym);
  for(let i=4;i<len;i++) pwd+=pick(all);
  pwd=pwd.split('').sort(()=>Math.random()-0.5).join('');
  let strength='weak';
  let score=0;
  if(pwd.length>=12) score++;
  if(pwd.length>=16) score++;
  if(/[a-z]/.test(pwd)&&/[A-Z]/.test(pwd)) score++;
  if(/\d/.test(pwd)) score++;
  if(/[!@#$%^&*()\-_=+\[\]{};:,.<>?]/.test(pwd)) score++;
  if(score>=4) strength='strong';
  else if(score>=2) strength='medium';
  return `${pwd}\n(strength: ${strength})`;
};
Commands.qrcode=(args)=>{
  const text=args.join(' ');
  if(!text) throw new Error('qrcode: missing text');
  // Simple QR-like ASCII (deterministic hash matrix, decorative)
  const N=21;
  const hash=s=>{ let h=0; for(let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0; } return Math.abs(h); };
  let seed=hash(text);
  const rand=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
  let out='';
  for(let y=0;y<N;y++){
    let line='';
    for(let x=0;x<N;x++){
      const inTL=(x<7&&y<7), inTR=(x>=N-7&&y<7), inBL=(x<7&&y>=N-7);
      let black;
      if(inTL||inTR||inBL){
        const lx=inTR?x-(N-7):x, ly=inBL?y-(N-7):y;
        black = (lx===0||lx===6||ly===0||ly===6||(lx>=2&&lx<=4&&ly>=2&&ly<=4));
      } else black = rand()>0.5;
      line+=black?'██':'  ';
    }
    out+=line+'\n';
  }
  return out+'\n['+text.slice(0,40)+']';
};
Commands.barcode=(args)=>{
  const text=args.join(' ');
  if(!text) throw new Error('barcode: missing text');
  const patterns={'0':'11011001100','1':'11001101100','2':'11001100110','3':'10010011000','4':'10010001100','5':'10001001100','6':'10011001000','7':'10011000100','8':'10001100100','9':'11001001000'};
  let bars='';
  for(const ch of text){ bars+=(patterns[ch]||patterns['0'])+'0'; }
  const top='█'.repeat(bars.length);
  return `${top}\n${bars.replace(/1/g,'█').replace(/0/g,' ')}\n${top}\n[${text}]`;
};

/* ─── Process / Jobs ─── */
Commands.jobs=()=>{
  if(!State.jobs.length) return '(no jobs)';
  return State.jobs.map(j=>`[${j.id}] ${j.state.padEnd(8)} ${j.cmd}`).join('\n');
};
Commands.kill=(args)=>{
  const t=args[0]; if(!t) throw new Error('kill: missing pid');
  if(t.startsWith('%')){
    const id=parseInt(t.slice(1),10);
    const j=State.jobs.find(j=>j.id===id);
    if(!j) throw new Error(`kill: %${id}: no such job`);
    j.state='Killed';
    return `[${id}] Killed ${j.cmd}`;
  }
  return `Killed PID ${t}`;
};
Commands.pkill=Commands.killall=(args)=>{
  const name=args[0]; if(!name) throw new Error('pkill: missing name');
  return `killed matching processes: ${name}`;
};
Commands.bg=(args)=>{
  const t=args[0];
  if(t&&t.startsWith('%')){
    const id=parseInt(t.slice(1),10);
    const j=State.jobs.find(j=>j.id===id);
    if(!j) throw new Error(`bg: %${id}: no such job`);
    j.state='Running';
    return `[${id}] ${j.cmd} &`;
  }
  return 'bg: no such job';
};
Commands.fg=(args)=>{
  const t=args[0];
  if(t&&t.startsWith('%')){
    const id=parseInt(t.slice(1),10);
    const j=State.jobs.find(j=>j.id===id);
    if(!j) throw new Error(`fg: %${id}: no such job`);
    j.state='Done';
    return `[${id}] Done ${j.cmd}`;
  }
  return 'fg: no such job';
};

/* ─── Meta ─── */
Commands.tutorial=()=>`📚 TUTORIAL v3

1. help / man ls
2. Ganti tema: theme dracula
3. Split: split h / split v / split off
4. Rekam: record start
5. Buka bookmark: bookmark list
6. Script library: script-library
7. Password kuat: passwd-gen 20
8. QR code: qrcode https://irgxymods.dev
9. Preview markdown: md README.md
10. HTTP: http (buka client GUI)

Tips: Tab autocomplete, ↑↓ history, Ctrl+R reverse search, Ctrl+F cari output.`;
Commands.examples=()=>`💡 CONTOH
echo "hi" | grep h
bc 12 + 34 * 2
sha256sum hello.js
base64 "hello world"
json-tui contoh.json
md README.md
csv data.csv
diff-tui a.txt b.txt
regex-tui
passwd-gen 20
qrcode irgxymods.dev
netdiag
http
record start`;
Commands.changelog=()=>`📝 CHANGELOG
v3.0 ULTIMATE
  + 115+ commands
  + 6 tema (dark/light/dracula/monokai/solarized/nord)
  + Multi-shell (bash/zsh/fish/sh/powershell)
  + Split screen + Presentation mode
  + Session recorder + Transcript
  + Web Crypto AES-GCM encrypt/decrypt
  + JWT sign/verify
  + QR + Barcode ASCII
  + Package Browser + HTTP Client + NetDiag
  + Regex/JSON/CSV/Diff viewer
  + Script Library + Pipe Builder
  + Bookmark + Recent Files + History Search
  + Process Monitor (live)

v2.0
  + 70+ commands, VFS, JS/Python, tabs`;
Commands['history-search']=()=>{ HistorySearch.open(); return null; };
Commands['search-tui']=()=>{ OutputSearch.open(); return null; };
Commands['script-library']=Commands.library=()=>{ ScriptLibrary.open(); return null; };
Commands['pipe-builder']=()=>{ PipeBuilder.open(); return null; };
Commands.bookmark=(args)=>{
  const sub=args[0];
  if(sub==='add'){
    const name=args[1], cmd=args.slice(2).join(' ');
    if(!name||!cmd) throw new Error('bookmark add <name> <command>');
    State.bookmarks.push({name,cmd});
    lsSet(KEY.BOOKMARKS,State.bookmarks);
    return `Bookmark '${name}' disimpan.`;
  }
  if(sub==='list'||!sub){
    if(!State.bookmarks.length) return '(belum ada bookmark)';
    return State.bookmarks.map((b,i)=>`${i+1}. ${b.name} -> ${b.cmd}`).join('\n');
  }
  if(sub==='run'){
    const b=State.bookmarks.find(x=>x.name===args[1]);
    if(!b) throw new Error('bookmark not found');
    return Executor.runString(b.cmd);
  }
  if(sub==='remove'||sub==='rm'){
    const i=State.bookmarks.findIndex(x=>x.name===args[1]);
    if(i>=0){ State.bookmarks.splice(i,1); lsSet(KEY.BOOKMARKS,State.bookmarks); return 'removed'; }
    throw new Error('bookmark not found');
  }
  if(sub==='ui'){ BookmarkMgr.open(); return null; }
  throw new Error('bookmark: add/list/run/remove/ui');
};
Commands.record=(args)=>{
  const sub=args[0];
  if(sub==='start'){ Recorder.start(); return 'Recording started...'; }
  if(sub==='stop'){ Recorder.stop(); return 'Recording stopped.'; }
  if(sub==='save'){
    const cast=Recorder.exportCast();
    VFS.write('/home/irgxymods/session.cast',cast);
    return 'Saved: /home/irgxymods/session.cast';
  }
  if(sub==='play'){
    Recorder.playback();
    return null;
  }
  return `record: ${Recorder.isRecording()?'sedang merekam':'idle'}`;
};
Commands.transcript=()=>{
  const lines=[];
  if(Renderer.screen) for(const el of Renderer.screen.children) lines.push(el.textContent);
  const text=lines.join('\n');
  const blob=new Blob([text],{type:'text/plain'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='transcript-'+Date.now()+'.txt';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  return 'Transcript diunduh.';
};
Commands.banner=(args)=>{
  if(args[0]==='--reset') return 'Banner direset.';
  const text=args.join(' ')||'IRGXYMODS';
  return Commands.figlet([text]);
};

/* ═══════════ SIDEBAR ═══════════ */
const Sidebar = {
  treeEl:null, filter:'', recentEl:null,
  init(){
    this.treeEl=$('#etTree'); this.recentEl=$('#etRecentList');
    $('#etRefreshTree').addEventListener('click',()=>this.refresh());
    $('#etExportFS').addEventListener('click',()=>this.exportFS());
    $('#etImportFS').addEventListener('click',()=>$('#etImportInput').click());
    $('#etImportInput').addEventListener('change',e=>this.importFS(e.target.files[0]));
    $('#etTreeSearch').addEventListener('input',e=>{ this.filter=e.target.value.toLowerCase(); this.refresh(); });
    this.refresh();
  },
  refresh(){
    if(!this.treeEl) return;
    const root=VFS.data['/']; const lines=[];
    const walk=(node,path,depth)=>{
      if(depth>5) return;
      const keys=Object.keys(node.children||{}).sort((a,b)=>{
        const at=node.children[a].type, bt=node.children[b].type;
        if(at!==bt) return at==='dir'?-1:1;
        return a.localeCompare(b);
      });
      for(const k of keys){
        const child=node.children[k];
        if(this.filter && !k.toLowerCase().includes(this.filter) && child.type==='file') continue;
        const cp = path==='/'?'/'+k:path+'/'+k;
        const icon = child.type==='dir'?'fa-folder':'fa-file-code';
        lines.push(`<div class="et-node ${child.type} depth-${Math.min(depth,5)}" data-path="${esc(cp)}" data-type="${child.type}"><i class="fas ${icon}"></i><span>${esc(k)}</span></div>`);
        if(child.type==='dir') walk(child,cp,depth+1);
      }
    };
    walk(root,'/',0);
    this.treeEl.innerHTML=lines.join('');
    $$('.et-node',this.treeEl).forEach(el=>{
      el.addEventListener('click',()=>this.onNodeClick(el.getAttribute('data-path'),el.getAttribute('data-type')));
      el.addEventListener('contextmenu',e=>{ e.preventDefault(); Ctx.open(e.clientX,e.clientY,el.getAttribute('data-path'),el.getAttribute('data-type')); });
    });
    this.updateDisk();
    this.renderRecent();
  },
  async onNodeClick(path,type){
    if(type==='dir'){
      State.cwd=path; Input.updatePrompt();
      await Executor.runString('ls'); updateStatus();
    } else {
      this.addRecent(path);
      const ext=path.split('.').pop().toLowerCase();
      try{
        if(['png','jpg','jpeg','gif','webp','svg'].includes(ext)){ ImagePreview.open(path); }
        else if(ext==='md'){ MarkdownPreview.open(path); }
        else if(ext==='json'){ JSONViewer.open(path); }
        else if(ext==='csv'){ CSVViewer.open(path); }
        else{
          const content=VFS.read(path);
          Renderer.print(`$ cat ${path}`,'dim');
          Renderer.print(content);
        }
      }catch(e){ Renderer.print(e.message,'red'); }
    }
  },
  addRecent(path){
    State.recentFiles = [path,...State.recentFiles.filter(p=>p!==path)].slice(0,10);
    lsSet(KEY.RECENT,State.recentFiles);
    this.renderRecent();
  },
  renderRecent(){
    if(!this.recentEl) return;
    if(!State.recentFiles.length){ this.recentEl.innerHTML='<div class="et-recent-empty">(belum ada file dibuka)</div>'; return; }
    this.recentEl.innerHTML=State.recentFiles.map(p=>`<div class="et-recent-item" data-path="${esc(p)}"><i class="fas fa-file-code"></i> ${esc(VFS.basename(p))}</div>`).join('');
    $$('.et-recent-item',this.recentEl).forEach(el=>{
      el.addEventListener('click',()=>{
        const p=el.getAttribute('data-path');
        const n=VFS.node(VFS.normalize(p));
        if(n) Sidebar.onNodeClick(p,n.type);
      });
    });
  },
  updateDisk(){
    const used=VFS.size(VFS.data['/']);
    const pct=clamp(Math.round(used/VFS_MAX*100),0,100);
    $('#etDiskFill').style.width=pct+'%';
    $('#etDiskLabel').textContent=`${fmtBytes(used)} / 5 MB`;
  },
  exportFS(){
    const blob=new Blob([JSON.stringify(VFS.data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download='irgxymods-vfs-'+Date.now()+'.json';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    Renderer.print('✓ VFS diekspor','green');
  },
  importFS(file){
    if(!file) return;
    const r=new FileReader();
    r.onload=e=>{
      try{
        const d=JSON.parse(e.target.result);
        if(!d['/']) throw new Error('invalid format');
        VFS.data=d; VFS.save(); this.refresh();
        Renderer.print('✓ VFS berhasil diimpor','green');
      }catch(err){ Renderer.print('Import gagal: '+err.message,'red'); }
    };
    r.readAsText(file);
  }
};

/* ═══════════ INPUT ═══════════ */
const Input = {
  el:null, ac:null, acItems:[], acIdx:-1,
  init(){
    this.el=$('#etInput'); this.ac=$('#etAutocomplete');
    this.el.addEventListener('keydown',e=>this.onKey(e));
    this.el.addEventListener('input',()=>this.hideAC());
    $('#etScreen').addEventListener('click',()=>this.el.focus());
    this.updatePrompt();
  },
  updatePrompt(){
    const short=Renderer.shortCwd();
    const fmt=Settings.data.prompt;
    const prompt = fmt.replace('{user}',State.user).replace('{host}',State.host).replace('{cwd}',short).replace('{time}',new Date().toTimeString().slice(0,8));
    const parts = prompt.split(/(\$\s*$)/);
    $('#etPrompt').innerHTML = `<span class="et-user">${esc(State.user)}</span><span class="et-sep">@</span><span class="et-host">${esc(State.host)}</span><span class="et-sep">:</span><span class="et-path">${esc(short)}</span><span class="et-sigil">$</span>`;
    $('#etTitle').textContent=`${State.user}@${State.host}: ${short}${prompt?' ('+fmt+')':''}`;
    $('#etStatusCwd').textContent=short;
    if($('#etShellBadge')) $('#etShellBadge').innerHTML=`<i class="fas fa-terminal"></i> ${esc(Settings.data.shell)}`;
  },
  async onKey(e){
    if(e.key==='Enter'){
      e.preventDefault();
      const cmd=this.el.value; this.el.value=''; this.hideAC();
      if(!cmd.trim()){ Renderer.echoPrompt(''); return; }
      Renderer.echoPrompt(cmd);
      State.history.push(cmd); if(State.history.length>200) State.history.shift();
      State.histIdx=-1; lsSet(KEY.HISTORY,State.history);
      // Background job detection
      if(cmd.trim().endsWith('&')){
        const job=cmd.trim().slice(0,-1).trim();
        const id=State.jobCounter++;
        State.jobs.push({id,cmd:job,state:'Running',start:Date.now()});
        Renderer.print(`[${id}] ${id} (job ${job}) started in background`,'dim');
        updateJobsBadge();
      } else {
        await Executor.runString(cmd);
      }
      this.updatePrompt();
      Sidebar.refresh();
      updateStatus();
    } else if(e.key==='ArrowUp'){
      e.preventDefault();
      if(!State.history.length) return;
      if(State.histIdx===-1) State.histIdx=State.history.length-1;
      else if(State.histIdx>0) State.histIdx--;
      this.el.value=State.history[State.histIdx]||'';
    } else if(e.key==='ArrowDown'){
      e.preventDefault();
      if(State.histIdx===-1) return;
      State.histIdx++;
      if(State.histIdx>=State.history.length){ State.histIdx=-1; this.el.value=''; return; }
      this.el.value=State.history[State.histIdx];
    } else if(e.key==='Tab'){
      e.preventDefault(); this.autocomplete();
    } else if(e.ctrlKey&&e.key.toLowerCase()==='c'){
      e.preventDefault(); State.cancelFlag=true;
      Renderer.print('^C','dim'); this.el.value=''; updateStatus('Ready');
    } else if(e.ctrlKey&&e.key.toLowerCase()==='l'){
      e.preventDefault(); Renderer.clear();
    } else if(e.ctrlKey&&e.key.toLowerCase()==='u'){
      e.preventDefault(); this.el.value='';
    } else if(e.ctrlKey&&e.key.toLowerCase()==='a'){
      e.preventDefault(); this.el.setSelectionRange(0,0);
    } else if(e.ctrlKey&&e.key.toLowerCase()==='e'){
      e.preventDefault(); this.el.setSelectionRange(this.el.value.length,this.el.value.length);
    } else if(e.ctrlKey&&e.key.toLowerCase()==='r'){
      e.preventDefault(); HistorySearch.open();
    } else if(e.ctrlKey&&e.key.toLowerCase()==='f'){
      e.preventDefault(); OutputSearch.open();
    }
  },
  autocomplete(){
    const v=this.el.value; const parts=v.split(/\s+/);
    const last=parts[parts.length-1]||'';
    let cands=[];
    // skip sudo prefix
    let base=parts;
    if(base[0]==='sudo'||base[0]==='env') base=base.slice(1);
    if(base.length<=1){
      cands=Object.keys(Commands).filter(k=>!k.startsWith('_')&&k.startsWith(last));
    } else {
      const dir=last.includes('/')?last.slice(0,last.lastIndexOf('/'))||'/':'.';
      const pre=last.includes('/')?last.slice(last.lastIndexOf('/')+1):last;
      try{
        const n=VFS.node(VFS.normalize(dir));
        if(n&&n.type==='dir'){
          cands=Object.keys(n.children).filter(k=>k.startsWith(pre)).map(k=>{
            const isDir=n.children[k].type==='dir';
            return (dir==='.'?'':dir+'/')+k+(isDir?'/':'');
          });
        }
      }catch(_){}
    }
    if(!cands.length) return;
    if(cands.length===1){
      parts[parts.length-1]=cands[0];
      this.el.value=parts.join(' ')+(cands[0].endsWith('/')?'':' ');
      this.hideAC(); return;
    }
    this.showAC(cands);
  },
  showAC(items){
    this.acItems=items; this.acIdx=0;
    this.ac.innerHTML=items.map((it,i)=>`<div class="et-ac-item${i===0?' active':''}" data-i="${i}">${esc(it)}</div>`).join('');
    this.ac.classList.add('visible');
    $$('.et-ac-item',this.ac).forEach(el=>el.addEventListener('click',()=>this.acceptAC(parseInt(el.getAttribute('data-i'),10))));
  },
  acceptAC(i){
    const c=this.acItems[i]; if(!c) return;
    const parts=this.el.value.split(/\s+/);
    parts[parts.length-1]=c;
    this.el.value=parts.join(' ')+(c.endsWith('/')?'':' ');
    this.hideAC(); this.el.focus();
  },
  hideAC(){ this.ac.classList.remove('visible'); this.acItems=[]; this.acIdx=-1; }
};

/* ═══════════ TAB MANAGER ═══════════ */
const TabManager = {
  init(){
    State.tabs=[newTabState()]; State.activeTab=0;
    $('#etTabAdd').addEventListener('click',()=>this.add());
    this.render();
  },
  add(){
    State.tabs[State.activeTab].cwd=State.cwd;
    State.tabs[State.activeTab].history=[...State.history];
    State.tabs.push(newTabState());
    State.activeTab=State.tabs.length-1;
    State.cwd=State.tabs[State.activeTab].cwd;
    State.history=[...State.tabs[State.activeTab].history];
    Renderer.clear(); this.render(); Input.updatePrompt();
    Renderer.print('Terminal baru. Ketik "help" untuk memulai.','dim');
  },
  close(i){
    if(State.tabs.length<=1) return;
    State.tabs.splice(i,1);
    if(State.activeTab>=State.tabs.length) State.activeTab=State.tabs.length-1;
    State.cwd=State.tabs[State.activeTab].cwd;
    State.history=[...State.tabs[State.activeTab].history];
    Renderer.clear(); this.render(); Input.updatePrompt();
  },
  switch(i){
    State.tabs[State.activeTab].cwd=State.cwd;
    State.tabs[State.activeTab].history=[...State.history];
    State.activeTab=i;
    State.cwd=State.tabs[i].cwd;
    State.history=[...State.tabs[i].history];
    Renderer.clear(); this.render(); Input.updatePrompt();
    Renderer.print(`Tab ${i+1} aktif — cwd: ${State.cwd}`,'dim');
  },
  render(){
    const el=$('#etTabs');
    el.innerHTML=State.tabs.map((t,i)=>`<div class="et-tab${i===State.activeTab?' active':''}" data-i="${i}"><i class="fas fa-terminal" style="font-size:0.7rem"></i><span>tab ${i+1}</span>${State.tabs.length>1?'<button class="et-tab-close" data-close="'+i+'">×</button>':''}</div>`).join('');
    $$('.et-tab',el).forEach(t=>t.addEventListener('click',e=>{ if(e.target.classList.contains('et-tab-close')) return; this.switch(parseInt(t.getAttribute('data-i'),10)); }));
    $$('.et-tab-close',el).forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); this.close(parseInt(b.getAttribute('data-close'),10)); }));
  }
};

/* ═══════════ SPLIT MANAGER ═══════════ */
const SplitManager = {
  active:false,
  splitH(){
    if(this.active) this.unsplit();
    const main=$('#etMain');
    main.classList.add('split-h'); main.classList.remove('split-v');
    // Clone a secondary pane
    const sec=document.createElement('div');
    sec.className='et-pane';
    sec.id='etPaneSecondary';
    sec.innerHTML=`<div class="et-screen" id="etScreen2"></div>
      <div class="et-input-row"><span class="et-prompt"><span class="et-user">irgxymods</span><span class="et-sep">@</span><span class="et-host">irgxy-terminal</span><span class="et-sep">:</span><span class="et-path">~</span><span class="et-sigil">$</span></span><div class="et-input-wrap"><input type="text" class="et-input" id="etInput2" autocomplete="off" spellcheck="false" /></div></div>`;
    if(!$('#etPaneSecondary')) main.appendChild(sec);
    else main.removeChild($('#etPaneSecondary'));
    this.active=true;
    const s2=$('#etScreen2');
    if(s2) s2.innerHTML='<div class="et-line dim">Split pane — ketik help.</div>';
    if($('#etInput2')) $('#etInput2').addEventListener('keydown',async e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        const c=e.target.value; e.target.value='';
        if(!c.trim()) return;
        Renderer.print(`$ ${c}`,'dim');
        await Executor.runString(c);
      }
    });
  },
  splitV(){
    this.unsplit();
    const main=$('#etMain');
    main.classList.add('split-v'); main.classList.remove('split-h');
    const sec=document.createElement('div');
    sec.className='et-pane'; sec.id='etPaneSecondary';
    sec.innerHTML=`<div class="et-screen" id="etScreen2"></div>
      <div class="et-input-row"><span class="et-prompt"><span class="et-user">irgxymods</span><span class="et-sep">@</span><span class="et-host">irgxy-terminal</span><span class="et-sep">:</span><span class="et-path">~</span><span class="et-sigil">$</span></span><div class="et-input-wrap"><input type="text" class="et-input" id="etInput2" autocomplete="off" spellcheck="false" /></div></div>`;
    main.appendChild(sec);
    this.active=true;
    const s2=$('#etScreen2');
    if(s2) s2.innerHTML='<div class="et-line dim">Split pane — ketik help.</div>';
    if($('#etInput2')) $('#etInput2').addEventListener('keydown',async e=>{
      if(e.key==='Enter'){ e.preventDefault(); const c=e.target.value; e.target.value=''; if(!c.trim()) return; Renderer.print(`$ ${c}`,'dim'); await Executor.runString(c); }
    });
  },
  unsplit(){
    const main=$('#etMain');
    main.classList.remove('split-h','split-v');
    const s=$('#etPaneSecondary'); if(s) s.remove();
    this.active=false;
  }
};

/* ═══════════ CTX MENU ═══════════ */
const Ctx = {
  el:null, curPath:null, curType:null,
  init(){
    this.el=$('#etCtx');
    $$('#etCtx button',this.el).forEach(b=>b.addEventListener('click',()=>this.action(b.getAttribute('data-act'))));
    document.addEventListener('click',()=>this.hide());
    document.addEventListener('scroll',()=>this.hide(),true);
  },
  open(x,y,p,t){ this.curPath=p; this.curType=t; this.el.style.left=x+'px'; this.el.style.top=y+'px'; this.el.classList.add('visible'); },
  hide(){ this.el.classList.remove('visible'); },
  action(a){
    const p=this.curPath; if(!p) return;
    try{
      if(a==='open') Sidebar.onNodeClick(p,this.curType);
      else if(a==='preview') Sidebar.onNodeClick(p,'file');
      else if(a==='delete'){ VFS.rm(p,this.curType==='dir',true); Sidebar.refresh(); Renderer.print('Deleted: '+p,'dim'); }
      else if(a==='duplicate'){ const n=VFS.basename(p); VFS.cp(p,VFS.parent(p)+'/'+n+'_copy'); Sidebar.refresh(); }
      else if(a==='rename'){ const nn=prompt('Nama baru:',VFS.basename(p)); if(nn){ VFS.mv(p,VFS.parent(p)+'/'+nn); Sidebar.refresh(); } }
    }catch(e){ Renderer.print(e.message,'red'); }
    this.hide();
  }
};

/* ═══════════ MODALS ═══════════ */
function bindModalClose(id){ const m=$('#'+id); if(!m) return; $$('.et-modal-close',m).forEach(b=>b.addEventListener('click',()=>m.classList.remove('visible'))); m.addEventListener('click',e=>{ if(e.target===m) m.classList.remove('visible'); }); }

const PackageBrowser = {
  open(mgr){
    $('#etPackageBrowser').classList.add('visible');
    $('#etPbManager').value=mgr||'pkg';
    this.render();
  },
  render(){
    const mgr=$('#etPbManager').value;
    const q=($('#etPbSearch').value||'').toLowerCase();
    const db=mgr==='npm'?NPM_DB:mgr==='pip'?PIP_DB:PKG_DB;
    const keys=Object.keys(db).filter(k=>k.includes(q));
    $('#etPbList').innerHTML=keys.map(k=>`<div class="et-pb-card"><h4>${esc(k)}</h4><small>versi ${db[k]}</small><button class="et-pb-install" data-pkg="${esc(k)}" data-mgr="${mgr}"><i class="fas fa-download"></i> Install</button></div>`).join('') || '<div class="et-line dim">Tidak ada hasil.</div>';
    $$('.et-pb-install',$('#etPbList')).forEach(b=>b.addEventListener('click',async()=>{
      const pkg=b.getAttribute('data-pkg'), m=b.getAttribute('data-mgr');
      Renderer.print(`$ ${m} install ${pkg}`,'dim');
      await Executor.pkgInstall([pkg],m,{});
    }));
  },
  init(){
    bindModalClose('etPackageBrowser');
    $('#etPbSearch').addEventListener('input',()=>this.render());
    $('#etPbManager').addEventListener('change',()=>this.render());
  }
};

const MarkdownPreview = {
  open(f){
    const path=VFS.normalize(f);
    let content;
    try{ content=VFS.read(path); }catch(e){ Renderer.print(e.message,'red'); return; }
    $('#etMdTitle').innerHTML=`<i class="fas fa-file-alt"></i> ${esc(path)}`;
    $('#etMdContent').innerHTML=this.renderMD(content);
    $('#etMdPreview').classList.add('visible');
    Sidebar.addRecent(path);
  },
  renderMD(md){
    let h=esc(md);
    h=h.replace(/^### (.*$)/gm,'<h3>$1</h3>');
    h=h.replace(/^## (.*$)/gm,'<h2>$1</h2>');
    h=h.replace(/^# (.*$)/gm,'<h1>$1</h1>');
    h=h.replace(/```([\s\S]*?)```/g,(_,c)=>`<pre><code>${c}</code></pre>`);
    h=h.replace(/`([^`]+)`/g,'<code>$1</code>');
    h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
    h=h.replace(/\*(.+?)\*/g,'<em>$1</em>');
    h=h.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>');
    h=h.replace(/^\- (.*$)/gm,'<li>$1</li>');
    h=h.replace(/(<li>.*<\/li>)/gs,m=>`<ul>${m}</ul>`);
    h=h.replace(/^\> (.*$)/gm,'<blockquote>$1</blockquote>');
    h=h.split('\n\n').map(p=>/^<(h\d|ul|pre|blockquote)/.test(p.trim())?p:`<p>${p}</p>`).join('');
    return h;
  },
  init(){ bindModalClose('etMdPreview'); }
};

const JSONViewer = {
  open(f){
    const path=VFS.normalize(f);
    let data;
    try{ data=JSON.parse(VFS.read(path)); }catch(e){ Renderer.print('json-tui: '+e.message,'red'); return; }
    $('#etJsonTree').innerHTML=this.renderNode(data,'$');
    $('#etJsonViewer').classList.add('visible');
    $$('.et-json-node',$('#etJsonTree')).forEach(n=>n.addEventListener('click',()=>{
      const ch=n.nextElementSibling;
      if(ch&&ch.classList.contains('et-json-children')) ch.classList.toggle('collapsed');
      const tg=n.querySelector('.et-json-toggle');
      if(tg) tg.textContent=ch&&ch.classList.contains('collapsed')?'▶':'▼';
    }));
    Sidebar.addRecent(path);
  },
  renderNode(v,path){
    if(Array.isArray(v)) return this.renderArr(v,path);
    if(v&&typeof v==='object') return this.renderObj(v,path);
    return this.renderPrim(v);
  },
  renderPrim(v){
    if(v===null) return '<span class="et-json-null">null</span>';
    if(typeof v==='string') return `<span class="et-json-str">"${esc(v)}"</span>`;
    if(typeof v==='number') return `<span class="et-json-num">${v}</span>`;
    if(typeof v==='boolean') return `<span class="et-json-bool">${v}</span>`;
    return esc(String(v));
  },
  renderObj(o,path){
    const keys=Object.keys(o);
    if(!keys.length) return '{ }';
    const id='j'+uid();
    let html=`<span class="et-json-node"><span class="et-json-toggle">▼</span>{</span><div class="et-json-children" data-parent="${id}">`;
    for(const k of keys) html+=`<div><span class="et-json-key">"${esc(k)}"</span>: ${this.renderNode(o[k],path+'.'+k)}</div>`;
    html+='</div>}';
    return html;
  },
  renderArr(a,path){
    if(!a.length) return '[ ]';
    let html='<span class="et-json-node"><span class="et-json-toggle">▼</span>[</span><div class="et-json-children">';
    a.forEach((v,i)=>html+=`<div>${this.renderNode(v,path+'['+i+']')}${i<a.length-1?',':''}</div>`);
    html+='</div>]';
    return html;
  },
  init(){
    bindModalClose('etJsonViewer');
    $('#etJsonCopy').addEventListener('click',async()=>{
      const txt=$('#etJsonTree').textContent;
      const ok=await copyText(txt);
      Renderer.print(ok?'✓ JSON dicopy':'copy gagal', ok?'green':'red');
    });
    $('#etJsonSearch').addEventListener('input',e=>{
      const q=e.target.value.toLowerCase();
      $$('.et-json-key',$('#etJsonTree')).forEach(k=>{
        const m=k.textContent.toLowerCase().includes(q);
        k.style.background=m?'rgba(201,169,110,0.3)':'';
      });
    });
  }
};

const CSVViewer = {
  open(f){
    const path=VFS.normalize(f);
    let content;
    try{ content=VFS.read(path); }catch(e){ Renderer.print(e.message,'red'); return; }
    const rows=content.split('\n').filter(l=>l.length).map(l=>l.split(','));
    if(!rows.length){ Renderer.print('csv: empty','warn'); return; }
    let html='<table class="et-csv-table"><thead><tr>';
    rows[0].forEach((c,i)=>html+=`<th data-i="${i}">${esc(c)}</th>`);
    html+='</tr></thead><tbody>';
    for(let i=1;i<rows.length;i++){
      html+='<tr>'; rows[i].forEach(c=>html+=`<td>${esc(c)}</td>`); html+='</tr>';
    }
    html+='</tbody></table>';
    $('#etCsvWrap').innerHTML=html;
    $('#etCsvViewer').classList.add('visible');
    let sortAsc=true;
    $$('.et-csv-table th',$('#etCsvWrap')).forEach(th=>th.addEventListener('click',()=>{
      const i=parseInt(th.getAttribute('data-i'),10);
      const body=$('.et-csv-table tbody',$('#etCsvWrap'));
      const trs=Array.from(body.children);
      trs.sort((a,b)=>{
        const av=a.children[i].textContent, bv=b.children[i].textContent;
        const an=parseFloat(av), bn=parseFloat(bv);
        if(!isNaN(an)&&!isNaN(bn)) return sortAsc?an-bn:bn-an;
        return sortAsc?av.localeCompare(bv):bv.localeCompare(av);
      });
      sortAsc=!sortAsc;
      trs.forEach(tr=>body.appendChild(tr));
    }));
    Sidebar.addRecent(path);
  },
  init(){ bindModalClose('etCsvViewer'); }
};

const HTTPClient = {
  open(){ $('#etHttpClient').classList.add('visible'); },
  init(){
    bindModalClose('etHttpClient');
    $('#etHttpSend').addEventListener('click',()=>this.send());
    const hist=lsGet('irgxy_http_hist_v3',[]);
    if(hist.length && !$('#etHttpUrl').value) $('#etHttpUrl').value=hist[hist.length-1].url||'';
  },
  async send(){
    const method=$('#etHttpMethod').value;
    const url=$('#etHttpUrl').value;
    const body=$('#etHttpBody').value;
    if(!url){ $('#etHttpResp').textContent='URL kosong.'; return; }
    $('#etHttpResp').textContent='Sending...';
    try{
      const opts={method};
      if(body && ['POST','PUT','PATCH'].includes(method)){ opts.body=body; opts.headers={'Content-Type':'application/json'}; }
      const st=performance.now();
      const r=await fetch(url,opts);
      const t=await r.text();
      const el=(performance.now()-st).toFixed(0);
      const hs=[]; r.headers.forEach((v,k)=>hs.push(`${k}: ${v}`));
      $('#etHttpResp').textContent=`HTTP ${r.status} ${r.statusText}  (${el} ms)\n\n${hs.join('\n')}\n\n${t.slice(0,4000)}`;
      const hist=lsGet('irgxy_http_hist_v3',[]);
      hist.push({method,url,ts:Date.now()});
      lsSet('irgxy_http_hist_v3',hist.slice(-20));
    }catch(e){ $('#etHttpResp').textContent='Error: '+e.message; }
  }
};

const RegexTester = {
  open(){ $('#etRegexTester').classList.add('visible'); this.test(); },
  init(){
    bindModalClose('etRegexTester');
    ['etRegexPattern','etRegexText'].forEach(id=>$('#'+id).addEventListener('input',()=>this.test()));
    $$('#etRegexTester input[data-flag]').forEach(cb=>cb.addEventListener('change',()=>this.test()));
  },
  test(){
    const pat=$('#etRegexPattern').value;
    const text=$('#etRegexText').value;
    if(!pat){ $('#etRegexResult').textContent='(pattern kosong)'; return; }
    const flags=$$('#etRegexTester input[data-flag]:checked').map(c=>c.getAttribute('data-flag')).join('');
    try{
      const re=new RegExp(pat,flags);
      const ms=[...text.matchAll(new RegExp(pat,flags.includes('g')?flags:flags+'g'))];
      const html=text.replace(re,m=>`<span class="m">${esc(m)}</span>`);
      let out=`${ms.length} match\n\n`;
      ms.slice(0,50).forEach((m,i)=>{
        out+=`[${i}] "${m[0]}" @ ${m.index}\n`;
        m.slice(1).forEach((g,j)=>out+=`      group ${j+1}: ${g}\n`);
      });
      $('#etRegexResult').innerHTML=out+'<hr style="border-color:rgba(255,255,255,0.1)"><div>'+html+'</div>';
    }catch(e){ $('#etRegexResult').textContent='Regex error: '+e.message; }
  }
};

const DiffViewer = {
  open(a,b){
    const A=VFS.read(a).split('\n');
    const B=VFS.read(b).split('\n');
    const max=Math.max(A.length,B.length);
    let colA='<div class="et-diff-col"><div class="et-diff-head">'+esc(a)+'</div>';
    let colB='<div class="et-diff-col"><div class="et-diff-head">'+esc(b)+'</div>';
    for(let i=0;i<max;i++){
      const av=A[i], bv=B[i];
      const same=av===bv;
      colA+=`<div class="et-diff-line ${!same&&av!=null?'del':''}">${esc(av||'')}</div>`;
      colB+=`<div class="et-diff-line ${!same&&bv!=null?'add':''}">${esc(bv||'')}</div>`;
    }
    colA+='</div>'; colB+='</div>';
    $('#etDiffTitle').innerHTML=`<i class="fas fa-code-compare"></i> ${esc(a)} ⇄ ${esc(b)}`;
    $('#etDiffWrap').innerHTML=colA+colB;
    $('#etDiffViewer').classList.add('visible');
  },
  init(){ bindModalClose('etDiffViewer'); }
};

const ScriptLibrary = {
  scripts:[
    {name:'Greet User',desc:'Sapaan dengan warna',code:'echo "Halo, $USER!"'},
    {name:'Backup Notes',desc:'Copy docs ke /tmp',code:'cp docs/notes.txt /tmp/notes-backup.txt && echo "Backup OK"'},
    {name:'System Info',desc:'Tampilkan info sistem',code:'uname -a && uptime && df -h'},
    {name:'List & Count',desc:'List file dan hitung',code:'ls -l | wc -l'},
    {name:'Hash Check',desc:'SHA256 semua file .js',code:'find . -name "*.js"'},
    {name:'Git Init',desc:'Inisialisasi repo',code:'git init && git status'},
    {name:'Clean /tmp',desc:'Bersihkan folder tmp',code:'rm -rf /tmp/*'},
    {name:'Hello JS',desc:'Jalankan JS',code:'node hello.js'},
    {name:'Hello Python',desc:'Jalankan Python',code:'python3 hello.py'},
    {name:'Random Password',desc:'Generate password 24 char',code:'passwd-gen 24'},
    {name:'JSON Pretty',desc:'Pretty print contoh.json',code:'json contoh.json'},
    {name:'Readme Preview',desc:'Preview README.md',code:'md README.md'}
  ],
  open(){
    $('#etSlList').innerHTML=this.scripts.map((s,i)=>`<div class="et-sl-card"><h4>${esc(s.name)}</h4><p>${esc(s.desc)}</p><code>${esc(s.code)}</code><div class="et-sl-actions"><button data-i="${i}" data-act="run"><i class="fas fa-play"></i> Run</button><button data-i="${i}" data-act="copy"><i class="fas fa-copy"></i> Copy</button><button data-i="${i}" data-act="insert"><i class="fas fa-terminal"></i> Insert</button></div></div>`).join('');
    $$('.et-sl-card button',$('#etSlList')).forEach(b=>b.addEventListener('click',async()=>{
      const s=this.scripts[parseInt(b.getAttribute('data-i'),10)];
      const act=b.getAttribute('data-act');
      if(act==='run'){ $('#etScriptLib').classList.remove('visible'); Input.el.value=s.code; Input.el.focus(); Input.el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); }
      else if(act==='copy'){ const ok=await copyText(s.code); Renderer.print(ok?'Copied':'copy gagal', ok?'green':'red'); }
      else { Input.el.value=s.code; Input.el.focus(); }
    }));
    $('#etScriptLib').classList.add('visible');
  },
  init(){ bindModalClose('etScriptLib'); }
};

const PipeBuilder = {
  stages:[],
  open(){ this.render(); $('#etPipeBuilder').classList.add('visible'); },
  init(){
    bindModalClose('etPipeBuilder');
    $('#etPipeAddBtn').addEventListener('click',()=>{
      const v=$('#etPipeCmd').value.trim();
      if(!v) return;
      this.stages.push(v); $('#etPipeCmd').value=''; this.render();
    });
    $('#etPipeClearBtn').addEventListener('click',()=>{ this.stages=[]; this.render(); });
    $('#etPipeRunBtn').addEventListener('click',async()=>{
      if(!this.stages.length) return;
      const cmd=this.stages.join(' | ');
      $('#etPipeBuilder').classList.remove('visible');
      Renderer.echoPrompt(cmd);
      await Executor.runString(cmd);
    });
  },
  render(){
    const el=$('#etPipeStages');
    if(!this.stages.length){ el.innerHTML='<div class="et-line dim">(belum ada stage)</div>'; }
    else el.innerHTML=this.stages.map((s,i)=>`<div class="et-pb-stage"><span class="et-pb-idx">${i+1}</span><span class="et-pb-cmd">${esc(s)}</span><button data-i="${i}"><i class="fas fa-times"></i></button></div>`).join('');
    $$('.et-pb-stage button',el).forEach(b=>b.addEventListener('click',()=>{
      this.stages.splice(parseInt(b.getAttribute('data-i'),10),1); this.render();
    }));
    $('#etPipePreview').textContent=this.stages.join(' | ')||'(kosong)';
  }
};

const ProcessMonitor = {
  timer:null,
  open(){
    $('#etProcMon').classList.add('visible');
    this.tick();
    this.timer=setInterval(()=>this.tick(),1000);
  },
  close(){ clearInterval(this.timer); this.timer=null; $('#etProcMon').classList.remove('visible'); },
  tick(){
    const procs=[
      {pid:1,user:'root',cpu:Math.random()*2,mem:0.3,cmd:'irgxy-init'},
      {pid:42,user:'irgxymods',cpu:Math.random()*10,mem:2.1,cmd:'terminal-ui'},
      {pid:88,user:'irgxymods',cpu:Math.random()*4,mem:0.8,cmd:'vfs-daemon'},
      {pid:120,user:'irgxymods',cpu:Math.random()*6,mem:1.5,cmd:'irgxy-shell'},
      ...State.jobs.map(j=>({pid:200+j.id,user:'irgxymods',cpu:Math.random()*3,mem:0.5,cmd:'[job] '+j.cmd}))
    ];
    let html='<table class="et-pm-table"><thead><tr><th>PID</th><th>USER</th><th>CPU%</th><th>MEM%</th><th>COMMAND</th></tr></thead><tbody>';
    procs.forEach(p=>{
      const cpuW=Math.min(100,p.cpu*6);
      html+=`<tr><td>${p.pid}</td><td>${esc(p.user)}</td><td><span class="et-pm-bar" style="width:${cpuW}px"></span>${p.cpu.toFixed(1)}</td><td>${p.mem.toFixed(1)}</td><td>${esc(p.cmd)}</td></tr>`;
    });
    html+='</tbody></table>';
    $('#etProcMonBody').innerHTML=html;
  },
  init(){
    const m=$('#etProcMon');
    $$('.et-modal-close',m).forEach(b=>b.addEventListener('click',()=>this.close()));
    m.addEventListener('click',e=>{ if(e.target===m) this.close(); });
  }
};

const NetDiag = {
  open(){
    $('#etNetDiag').classList.add('visible');
    $('#etNetDiagBody').innerHTML='<div class="et-line dim">Running diagnostics...</div>';
    this.run();
  },
  async run(){
    const tests=[
      {label:'Browser Online', fn:()=>navigator.onLine?'Yes':'No', val:()=>100},
      {label:'Ping 1.1.1.1', fn:async()=>{const s=performance.now();try{await fetch('https://1.1.1.1',{mode:'no-cors'});}catch(_){} return (performance.now()-s).toFixed(0)+' ms';}, val:()=>80},
      {label:'DNS resolve', fn:async()=>{const s=performance.now();try{await fetch('https://dns.google/resolve?name=irgxymods.dev&type=A',{cache:'no-store'});}catch(_){} return (performance.now()-s).toFixed(0)+' ms';}, val:()=>70},
      {label:'HTTP GET', fn:async()=>{const s=performance.now();try{const r=await fetch('https://api.github.com');return (performance.now()-s).toFixed(0)+' ms ('+r.status+')';}catch(e){return 'fail';}}, val:()=>60}
    ];
    const body=$('#etNetDiagBody'); body.innerHTML='';
    for(const t of tests){
      const row=document.createElement('div');
      row.className='et-diag-row';
      row.innerHTML=`<div class="et-diag-label">${esc(t.label)}</div><div class="et-diag-bar"><div class="et-diag-fill"></div></div><div class="et-diag-val">...</div>`;
      body.appendChild(row);
      const val=await t.fn();
      row.querySelector('.et-diag-val').textContent=val;
      row.querySelector('.et-diag-fill').style.width=t.val()+'%';
    }
  },
  init(){ bindModalClose('etNetDiag'); }
};

const HistorySearch = {
  open(){
    $('#etHistorySearch').classList.add('visible');
    $('#etHsInput').value=''; $('#etHsInput').focus();
    this.filter('');
  },
  close(){ $('#etHistorySearch').classList.remove('visible'); },
  filter(q){
    const items=State.history.filter(h=>h.toLowerCase().includes(q.toLowerCase())).slice(-30).reverse();
    $('#etHsList').innerHTML=items.map((h,i)=>`<div class="et-hs-item${i===0?' active':''}" data-cmd="${esc(h)}">${esc(h)}</div>`).join('') || '<div class="et-hs-item">(tidak ada)</div>';
    $$('.et-hs-item',$('#etHsList')).forEach(el=>el.addEventListener('click',()=>{
      Input.el.value=el.getAttribute('data-cmd')||'';
      Input.el.focus();
      this.close();
    }));
  },
  init(){
    $('#etHsInput').addEventListener('input',e=>this.filter(e.target.value));
    $('#etHsInput').addEventListener('keydown',e=>{
      if(e.key==='Escape'){ e.preventDefault(); this.close(); }
      if(e.key==='Enter'){
        e.preventDefault();
        const first=$('.et-hs-item.active',$('#etHsList'));
        if(first){ Input.el.value=first.getAttribute('data-cmd')||''; Input.el.focus(); }
        this.close();
      }
    });
    $('#etHistorySearch').addEventListener('click',e=>{ if(e.target.id==='etHistorySearch') this.close(); });
  }
};

const OutputSearch = {
  matches:[], cur:-1,
  open(){ $('#etSearchBar').classList.add('visible'); $('#etSearchInput').focus(); },
  close(){ $('#etSearchBar').classList.remove('visible'); this.clearHighlights(); },
  clearHighlights(){ $$('.et-line .hl',$('#etScreen')).forEach(s=>{ const t=s.textContent; s.replaceWith(t); }); },
  search(q){
    this.clearHighlights();
    this.matches=[]; this.cur=-1;
    if(!q) return;
    const lines=$$('.et-line',$('#etScreen'));
    lines.forEach(el=>{
      const re=new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');
      const html=el.innerHTML.replace(re,m=>`<span class="hl">${m}</span>`);
      if(html!==el.innerHTML){ el.innerHTML=html; this.matches.push(...el.querySelectorAll('.hl')); }
    });
    this.cur=this.matches.length-1;
    this.updateCount();
    this.next(1);
  },
  updateCount(){ $('#etSearchCount').textContent=`${this.matches.length?this.cur+1:0}/${this.matches.length}`; },
  next(dir){
    if(!this.matches.length) return;
    if(this.cur>=0&&this.cur<this.matches.length) this.matches[this.cur].classList.remove('active');
    this.cur=(this.cur+dir+this.matches.length)%this.matches.length;
    this.matches[this.cur].classList.add('active');
    this.matches[this.cur].scrollIntoView({block:'center'});
    this.updateCount();
  },
  init(){
    $('#etSearchInput').addEventListener('input',e=>this.search(e.target.value));
    $('#etSearchNext').addEventListener('click',()=>this.next(1));
    $('#etSearchPrev').addEventListener('click',()=>this.next(-1));
    $('#etSearchClose').addEventListener('click',()=>this.close());
    $('#etSearchInput').addEventListener('keydown',e=>{
      if(e.key==='Escape'){ e.preventDefault(); this.close(); }
      else if(e.key==='Enter'){ e.preventDefault(); this.next(e.shiftKey?-1:1); }
    });
  }
};

const SettingsPanel = {
  open(){ Settings.syncUI(); $('#etSettingsDrawer').classList.add('open'); },
  close(){ $('#etSettingsDrawer').classList.remove('open'); },
  init(){
    $('#etDrawerClose').addEventListener('click',()=>this.close());
    const map={
      etSetFontSize:'fontSize', etSetFontFamily:'fontFamily', etSetTheme:'theme',
      etSetShell:'shell', etSetCursor:'cursor', etSetBlink:'blink', etSetSound:'sound',
      etSetAutoCopy:'autoCopy', etSetScrollback:'scrollback', etSetPrompt:'prompt'
    };
    for(const id in map){
      const el=$('#'+id); if(!el) continue;
      const key=map[id];
      el.addEventListener('input',()=>{
        let v;
        if(el.type==='checkbox') v=el.checked;
        else if(el.type==='number'||el.type==='range') v=parseInt(el.value,10);
        else v=el.value;
        Settings.set(key,v);
      });
      el.addEventListener('change',()=>{
        let v;
        if(el.type==='checkbox') v=el.checked;
        else if(el.type==='number'||el.type==='range') v=parseInt(el.value,10);
        else v=el.value;
        Settings.set(key,v);
      });
    }
    $('#etSetSave').addEventListener('click',()=>{ Settings.save(); Renderer.print('✓ Settings disimpan','green'); this.close(); });
    $('#etSetReset').addEventListener('click',()=>{ Settings.reset(); Renderer.print('✓ Settings direset','green'); });
  }
};

const BookmarkMgr = {
  open(){ this.render(); $('#etBookmarkMgr').classList.add('visible'); },
  render(){
    const l=$('#etBmList');
    if(!State.bookmarks.length){ l.innerHTML='<div class="et-line dim">(belum ada bookmark)</div>'; return; }
    l.innerHTML=State.bookmarks.map((b,i)=>`<div class="et-bm-item"><strong>${esc(b.name)}</strong><code>${esc(b.cmd)}</code><button data-i="${i}" title="Delete"><i class="fas fa-trash"></i></button></div>`).join('');
    $$('.et-bm-item button',l).forEach(btn=>btn.addEventListener('click',()=>{
      State.bookmarks.splice(parseInt(btn.getAttribute('data-i'),10),1);
      lsSet(KEY.BOOKMARKS,State.bookmarks);
      this.render();
    }));
    $$('.et-bm-item code',l).forEach(c=>c.addEventListener('click',async()=>{ await copyText(c.textContent); Renderer.print('Copied','green'); }));
  },
  init(){
    bindModalClose('etBookmarkMgr');
    $('#etBmAddBtn').addEventListener('click',()=>{
      const n=$('#etBmName').value.trim(), c=$('#etBmCmd').value.trim();
      if(!n||!c) return;
      State.bookmarks.push({name:n,cmd:c});
      lsSet(KEY.BOOKMARKS,State.bookmarks);
      $('#etBmName').value=''; $('#etBmCmd').value='';
      this.render();
    });
  }
};

const ImagePreview = {
  open(path){
    try{
      const node=VFS.node(VFS.normalize(path));
      if(!node||node.type!=='file') throw new Error('File tidak ditemukan');
      const c=node.content||'';
      let src=c;
      if(!isDataURL(c)&&/^[A-Za-z0-9+/=\s]+$/.test(c.slice(0,100))&&c.length>50){
        // assume base64
        src='data:image/png;base64,'+c.replace(/\s/g,'');
      } else if(!isDataURL(c)){
        Renderer.print('Preview: file bukan gambar base64/dataURL','warn');
        return;
      }
      $('#etImgTitle').innerHTML=`<i class="fas fa-image"></i> ${esc(path)}`;
      $('#etImgWrap').innerHTML=`<img src="${src}" alt="preview" />`;
      $('#etImgPreview').classList.add('visible');
      Sidebar.addRecent(path);
    }catch(e){ Renderer.print('Preview: '+e.message,'red'); }
  },
  init(){ bindModalClose('etImgPreview'); }
};

const AliasEnvUI = {
  openAlias(){
    const cur=State.alias;
    const body=Object.keys(cur).map(k=>`${k}=${cur[k]}`).join('\n');
    const next=prompt('Edit alias (satu per baris, format name=value):',body);
    if(next==null) return;
    State.alias={};
    next.split('\n').forEach(line=>{
      const m=line.match(/^\s*(\S+)=(.*)$/);
      if(m) State.alias[m[1]]=m[2];
    });
    lsSet(KEY.ALIAS,State.alias);
    Renderer.print('✓ Alias disimpan','green');
  },
  openEnv(){
    const cur=State.env;
    const body=Object.keys(cur).map(k=>`${k}=${cur[k]}`).join('\n');
    const next=prompt('Edit env (satu per baris KEY=VALUE):',body);
    if(next==null) return;
    const ne={};
    next.split('\n').forEach(line=>{
      const m=line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/i);
      if(m) ne[m[1]]=m[2];
    });
    State.env=ne;
    lsSet(KEY.ENV,State.env);
    Renderer.print('✓ Env disimpan','green');
  }
};

const Recorder = {
  isRecording(){ return State.recording; },
  start(){
    if(State.recording) return;
    State.recording=true; State.recordStart=Date.now(); State.recordEvents=[];
    $('#etRecordIndicator').classList.add('visible');
    State.recordInterval=setInterval(()=>{
      const s=Math.floor((Date.now()-State.recordStart)/1000);
      $('#etRecTime').textContent=`${pad(Math.floor(s/60))}:${pad(s%60)}`;
    },500);
  },
  stop(){
    if(!State.recording) return;
    State.recording=false;
    clearInterval(State.recordInterval); State.recordInterval=null;
    $('#etRecordIndicator').classList.remove('visible');
    lsSet(KEY.CAST,State.recordEvents);
  },
  log(type,text){
    if(!State.recording) return;
    State.recordEvents.push({t:Date.now()-State.recordStart,type,text});
  },
  exportCast(){
    const header={version:2,width:80,height:24,timestamp:Math.floor(State.recordStart/1000),env:{SHELL:Settings.data.shell,TERM:'xterm-256color'}};
    const lines=[JSON.stringify(header)];
    State.recordEvents.forEach(e=>lines.push(JSON.stringify([e.t/1000,'o',`${e.text}\r\n`])));
    return lines.join('\n');
  },
  async playback(){
    if(!State.recordEvents.length){ Renderer.print('Tidak ada rekaman.','warn'); return; }
    Renderer.print('▶ Playback started...','dim');
    const ev=State.recordEvents;
    let prev=0;
    for(const e of ev){
      await sleep(Math.min(2000, e.t-prev));
      prev=e.t;
      Renderer.print((e.type==='input'?'$ ':'')+e.text, e.type==='error'?'red':e.type==='input'?'gold':'');
    }
    Renderer.print('▶ Playback finished.','dim');
  }
};

/* ═══════════ STATUS ═══════════ */
function updateStatus(text){ $('#etStatusText').textContent=text||'Ready'; }
function updateJobsBadge(){
  const running=State.jobs.filter(j=>j.state==='Running').length;
  const b=$('#etJobsBadge');
  if(!b) return;
  if(running>0){ b.style.display=''; $('#etJobsCount').textContent=running; }
  else b.style.display='none';
}
function tickClock(){
  const d=new Date();
  $('#etStatusTime').textContent=`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* ═══════════ BIND GLOBAL UI ═══════════ */
function bindGlobal(){
  // Quick commands
  $$('.et-quick').forEach(b=>b.addEventListener('click',()=>{
    const cmd=b.getAttribute('data-cmd');
    Input.el.value=cmd; Input.el.focus();
    Input.el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  }));
  // FAQ
  $$('.et-faq-q').forEach(q=>q.addEventListener('click',()=>q.parentElement.classList.toggle('open')));
  // Titlebar actions
  $('#etToggleSidebar').addEventListener('click',()=>$('#etSidebar').classList.toggle('hidden'));
  $('#etFullscreenBtn').addEventListener('click',()=>{
    const w=$('#etWindow');
    w.classList.toggle('terminal-fullscreen');
    const ico=$('#etFullscreenBtn i');
    ico.className=w.classList.contains('terminal-fullscreen')?'fas fa-compress':'fas fa-expand';
    setTimeout(()=>Input.el.focus(),100);
  });
  $('#etResetBtn').addEventListener('click',()=>{
    if(!confirm('Reset Virtual FS ke kondisi awal?')) return;
    VFS.reset(); Sidebar.refresh(); Renderer.print('✓ Virtual FS direset','green');
  });
  $('#etSplitBtn').addEventListener('click',()=>TabManager.add());
  $('#etSplitBtn2').addEventListener('click',()=>{
    if(SplitManager.active) SplitManager.unsplit();
    else SplitManager.splitH();
  });
  $('#etSettingsBtn').addEventListener('click',()=>SettingsPanel.open());
  $('#etSearchBtn').addEventListener('click',()=>OutputSearch.open());
  $('#etBookmarkBtn').addEventListener('click',()=>BookmarkMgr.open());
  $('#etPresentBtn').addEventListener('click',()=>Commands.presentation());
  $('#etRecordBtn').addEventListener('click',()=>{
    if(Recorder.isRecording()){ Recorder.stop(); $('#etRecordBtn').classList.remove('active'); Renderer.print('Recording stopped.','green'); }
    else { Recorder.start(); $('#etRecordBtn').classList.add('active'); Renderer.print('Recording... (klik lagi untuk stop)','red'); }
  });
  // Back to top
  const bt=$('#backToTop');
  window.addEventListener('scroll',()=>bt.classList.toggle('visible',window.scrollY>300),{passive:true});
  bt.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  // Click on terminal closes settings dropdown
  document.addEventListener('click',e=>{
    const dd=$('#settingsDropdown');
    if(!dd||!dd.classList.contains('active')) return;
    if(e.target.closest('#settingsToggle')||e.target.closest('#settingsDropdown')) return;
    if(e.target.closest('#etWindow')) dd.classList.remove('active');
  });
}

/* ═══════════ BOOT ═══════════ */
function boot(){
  try{
    Settings.load();
    Settings.apply();
    VFS.init();
    State.packages = lsGet(KEY.PKGS, lsGet(KEY.PKGS_OLD, {pkg:[],npm:[],pip:[]}));
    State.history = lsGet(KEY.HISTORY,[]);
    State.alias = lsGet(KEY.ALIAS,{});
    State.bookmarks = lsGet(KEY.BOOKMARKS,[]);
    State.recentFiles = lsGet(KEY.RECENT,[]);
    const envStored = lsGet(KEY.ENV,null);
    if(envStored) State.env = Object.assign(State.env,envStored);

    Renderer.init();
    Loading.init();
    Nano.init();
    Input.init();
    Sidebar.init();
    TabManager.init();
    Ctx.init();
    bindGlobal();

    PackageBrowser.init();
    MarkdownPreview.init();
    JSONViewer.init();
    CSVViewer.init();
    HTTPClient.init();
    RegexTester.init();
    DiffViewer.init();
    ScriptLibrary.init();
    PipeBuilder.init();
    ProcessMonitor.init();
    NetDiag.init();
    HistorySearch.init();
    OutputSearch.init();
    SettingsPanel.init();
    BookmarkMgr.init();
    ImagePreview.init();

    // Welcome
    Renderer.print('','dim');
    Renderer.printHTML('<span style="color:#d4a745;font-weight:600">╔══════════════════════════════════════════════╗</span>');
    Renderer.printHTML('<span style="color:#d4a745;font-weight:600">║  IRGXYMODS EMULATOR TERMINAL v3.0 ULTIMATE   ║</span>');
    Renderer.printHTML('<span style="color:#d4a745;font-weight:600">║  115+ commands · 6 tema · split · record      ║</span>');
    Renderer.printHTML('<span style="color:#d4a745;font-weight:600">╚══════════════════════════════════════════════╝</span>');
    Renderer.print('');
    Renderer.print('Ketik "help" untuk daftar, "tutorial" untuk panduan, "script-library" untuk script siap.','dim');
    Renderer.print('Shortcut: Tab autocomplete · ↑↓ history · Ctrl+R history search · Ctrl+F cari output · Ctrl+L clear.','dim');
    Renderer.print('');

    tickClock();
    setInterval(tickClock,1000);
    setInterval(()=>{ lsSet(KEY.VFS_BACKUP,VFS.data); },5*60*1000);

    setTimeout(()=>Input.el.focus(),300);
    console.log('✅ IRGXYMODS Terminal v3.0 ready');
  }catch(e){
    console.error('Boot error:',e);
    alert('Terminal gagal dimuat: '+e.message);
  }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
else boot();

})();