// Simple SPA Router helpers
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

const state = {
  screen: 'intro',
  patients: JSON.parse(localStorage.getItem('patients')||'[]'),
  currentPatientId: null,
  currentArtic: null,
  device: {
    connected: false,
    touching: false,
    pressTimes: [],
  }
};

let Screens = {};

function savePatients(){ 
  localStorage.setItem('patients', JSON.stringify(state.patients)); 
}

function navigate(to){
  state.screen = to;
  render();
}

function fmtTime(sec){
  const m = Math.floor(sec/60).toString().padStart(2,'0');
  const s = Math.floor(sec%60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

// --- Device Simulator Logic ---
function updateLights(root){
  const red = root.querySelector('.dot.red');
  const yellow = root.querySelector('.dot.yellow');
  const green = root.querySelector('.dot.green');
  if (!red || !yellow || !green) return;

  red.style.opacity = state.device.connected ? .2 : 1;
  yellow.style.opacity = state.device.connected ? .2 : (state.device.touching ? .2 : .6);
  green.style.opacity = state.device.touching ? 1 : .2;
}

function bindSimulator(root){
  const btnConnect = root.querySelector('#btn-connect');
  const btnDisconnect = root.querySelector('#btn-disconnect');
  const btnTouch = root.querySelector('#btn-touch');
  const btnStart = root.querySelector('#btn-start');

  if (btnConnect) btnConnect.onclick = ()=>{
    state.device.connected = true;
    state.device.touching = false;
    updateLights(root);
    const nextBtn = root.querySelector('#btn-next-intro');
    if (nextBtn) nextBtn.disabled = false;
  };
  if (btnDisconnect) btnDisconnect.onclick = ()=>{
    state.device.connected = false;
    state.device.touching = false;
    updateLights(root);
    const nextBtn = root.querySelector('#btn-next-intro');
    if (nextBtn) nextBtn.disabled = true;
  };
  if (btnTouch) btnTouch.onclick = ()=>{
    if (!state.device.connected) return alert('Connect device first (simulate).');
    state.device.touching = !state.device.touching;
    updateLights(root);
  };
  if (btnStart) btnStart.onclick = onStartPress;
  updateLights(root);
}

function onStartPress(){
  const now = performance.now();
  state.device.pressTimes = state.device.pressTimes.filter(t => now - t < 600);
  state.device.pressTimes.push(now);
  const n = state.device.pressTimes.length;

  if (n === 2){
    const pressCopy = [...state.device.pressTimes];
    setTimeout(()=>{
      if (state.device.pressTimes.length === 2 && 
          pressCopy.every((t,i)=>t===state.device.pressTimes[i])){
        navigate('practice');
      }
      state.device.pressTimes = [];
    }, 250);
  } else if (n === 3){
    navigate('game');
    state.device.pressTimes = [];
  }
}

// --- Render screens ---
function render(){
  const app = $('#app');
  app.innerHTML = '';
  let node;
  switch(state.screen){
    case 'intro': node = Screens.intro.cloneNode(true); bindIntro(node); break;
    case 'log': node = Screens.log.cloneNode(true); bindLog(node); break;
    case 'add': node = Screens.add.cloneNode(true); bindAdd(node); break;
    case 'artic': node = Screens.artic.cloneNode(true); bindArtic(node); break;
    case 'mode': node = Screens.mode.cloneNode(true); bindMode(node); break;
    case 'practice': node = Screens.practice.cloneNode(true); bindPractice(node); break;
    case 'game': node = Screens.game.cloneNode(true); bindGame(node); break;
  }
  app.appendChild(node);
}

function bindIntro(root){
  bindNav(root);
  bindSimulator(root);
  const nextBtn = root.querySelector('#btn-next-intro');
  if (nextBtn) {
    nextBtn.disabled = !state.device.connected;
    nextBtn.onclick = () => {
      if (!state.device.connected) {
        alert('Please connect the device before proceeding.');
        return;
      }
      navigate('log');
    };
  }
}

function bindNav(root){
  root.addEventListener('click', (e)=>{
    const to = e.target.getAttribute('data-nav');
    if (!to) return;
    navigate(to);
  });
}

function bindLog(root){
  bindNav(root);
  const list = root.querySelector('#patient-list');
  list.innerHTML = '';
  if (state.patients.length === 0){
    const empty = document.createElement('div');
    empty.className='card';
    empty.textContent='No patients yet. Click “Add Patient”.';
    list.appendChild(empty);
    return;
  }
  state.patients.forEach(p => {
    const row = document.createElement('div');
    row.className='card row';
    const name = document.createElement('div');
    name.innerHTML = `<b>${p.name}</b> • Age ${p.age} • ${p.problem}`;
    const open = document.createElement('button');
    open.textContent='Open';
    open.onclick = ()=>{ state.currentPatientId = p.id; navigate('artic'); };
    row.appendChild(name); row.appendChild(open);
    list.appendChild(row);
  });
}

function bindAdd(root){
  bindNav(root);
  const form = root.querySelector('#add-form');
  form.onsubmit = (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const p = { id: crypto.randomUUID(), name: fd.get('name'), age: +fd.get('age'), problem: fd.get('problem') };
    state.patients.push(p);
    savePatients();
    navigate('log');
  };
}

function bindArtic(root){
  bindNav(root);
  const patient = state.patients.find(p => p.id===state.currentPatientId) || {name:'Unknown'};
  $('#patient-title', root).textContent = `Patient: ${patient.name}`;

  const sounds = ['La','Ra','Sa','Cha','Tha','Ka','Ga','Ta','Da','Na','Ma','Pa','Ba'];
  const wrap = $('#artic-list', root);
  wrap.classList.add('chips');
  sounds.forEach(s => {
    const b = document.createElement('button');
    b.textContent = s;
    b.onclick = ()=>{ state.currentArtic = s; navigate('mode'); };
    wrap.appendChild(b);
  });
}

function bindMode(root){
  bindNav(root);
  $('#mode-title', root).textContent = `Articulation: ${state.currentArtic||'—'}`;
  $('#go-practice', root).onclick = ()=>navigate('practice');
  $('#go-game', root).onclick = ()=>navigate('game');
}

// --- Practice Mode ---
let pracInterval = null, pracRemaining = 0, correct = 0;
function bindPractice(root){
  bindNav(root);
  const prompt = $('#prac-prompt', root);
  const timerEl = $('#prac-timer', root);
  const feedback = $('#prac-feedback', root);
  $('#prac-artic', root).value = state.currentArtic || '';
  $('#correct-count', root).textContent = correct = 0;

  function tick(){
    pracRemaining--;
    timerEl.textContent = fmtTime(pracRemaining);
    if (pracRemaining<=0){
      clearInterval(pracInterval); pracInterval=null;
      feedback.textContent = 'YOU DID GREAT';
      return;
    }
  }

  $('#prac-start', root).onclick = ()=>{
    const a = $('#prac-artic', root).value.trim()||'...';
    prompt.textContent = `Say “${a}”`;
    pracRemaining = Math.max(5, +$('#prac-secs', root).value||60);
    timerEl.textContent = fmtTime(pracRemaining);
    feedback.textContent = '';
    correct = 0; $('#correct-count', root).textContent = correct;
    if (pracInterval) clearInterval(pracInterval);
    pracInterval = setInterval(tick, 1000);
  };

  $('#prac-stop', root).onclick = ()=>{
    if (pracInterval){ clearInterval(pracInterval); pracInterval=null; }
  };

  $('#btn-correct', root).onclick = ()=>{
    if (correct < 10) {
      correct++;
      $('#correct-count', root).textContent = correct;
      if (correct===10){
        feedback.textContent = 'Perfect, you are doing great!';
      }
    }
  };

  $('#btn-wrong', root).onclick = ()=>{
    feedback.textContent = 'Keep trying!';
  };

  $('#long-press-shutdown', root).onclick = ()=>{
    alert('THANKS FOR USING ME');
    navigate('intro');
  };
}

// --- Game Mode ---
let g1Interval=null, g1Remaining=0, g1Points=0, g1Ready=false;
let g2Interval=null, g2Remaining=0, g2Score=0, g2Words=[], g2Idx=0;

function bindGame(root){
  bindNav(root);
  g1Ready = false;

  $$('.tabs button', root).forEach(btn=>{
    btn.onclick = ()=>{
      $$('.tabs button', root).forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const id = btn.getAttribute('data-tab');
      $$('.tab-panel', root).forEach(p=>p.classList.add('hidden'));
      $('#'+id, root).classList.remove('hidden');
    };
  });

  const g1TimerEl = $('#g1-timer', root);
  const g1PtsEl = $('#g1-points', root);
  const g1F = $('#g1-feedback', root);

  $('#g1-ready', root).onclick = ()=>{
    g1Ready=true; 
    $('#g1-start', root).disabled=false; 
    g1F.textContent='Ready!';
  };

  $('#g1-start', root).onclick = ()=>{
    if (!g1Ready) return alert('Click Ready first!');
    g1Points=0; g1PtsEl.textContent=g1Points; g1F.textContent='';
    g1Remaining= Math.max(30, +$('#g1-secs', root).value||60);
    g1TimerEl.textContent = fmtTime(g1Remaining);
    if (g1Interval) clearInterval(g1Interval);
    g1Interval = setInterval(()=>{
      g1Remaining--; g1TimerEl.textContent = fmtTime(g1Remaining);
      if (g1Remaining<=0){
        clearInterval(g1Interval); g1Interval=null;
        g1F.textContent = feedbackForPoints(g1Points, +$('#g1-secs', root).value||60);
      }
    },1000);
  };

  $('#g1-stop', root).onclick = ()=>{ if (g1Interval){ clearInterval(g1Interval); g1Interval=null; } };
  $('#g1-touch', root).onclick = ()=>{ if (!g1Interval) return; g1Points++; g1PtsEl.textContent=g1Points; };

  function feedbackForPoints(points, secs){
    const ratio = secs>0 ? points * (60/secs) : points;
    if (ratio>=60) return 'YOU ARE AN EXPERT NOW!';
    if (ratio>=30) return 'Well done! Nice!';
    if (ratio>=20) return 'Very well done! But still there is always room for improvement';
    if (ratio>=10) return 'Not bad but you can improve!';
    return 'Keep going!';
  }

  const g2TimerEl = $('#g2-timer', root);
  const g2ScoreEl = $('#g2-score', root);
  const g2Feedback = $('#g2-feedback', root);
  const g2Current = $('#g2-current', root);

  $('#g2-ready', root).onclick = ()=>{
    g2Words = $('#g2-words', root).value.split('\n').map(w=>w.trim()).filter(Boolean);
    if (!g2Words.length) return alert('Please enter at least one word!');
    g2Idx = 0; g2Current.textContent = g2Words[0];
    $('#g2-start', root).disabled=false;
    g2Feedback.textContent='Ready!';
  };

  $('#g2-start', root).onclick = ()=>{
    g2Score = 0; g2ScoreEl.textContent = g2Score; g2Feedback.textContent='';
    g2Remaining = Math.max(30, +$('#g2-secs', root).value||60);
    g2TimerEl.textContent = fmtTime(g2Remaining);
    if (g2Interval) clearInterval(g2Interval);
    g2Interval = setInterval(()=>{
      g2Remaining--; g2TimerEl.textContent = fmtTime(g2Remaining);
      if (g2Remaining<=0){
        clearInterval(g2Interval); g2Interval=null;
        g2Feedback.textContent = feedbackForPoints(g2Score, +$('#g2-secs', root).value||60);
      }
    },1000);
  };

  $('#g2-stop', root).onclick = ()=>{ if (g2Interval){ clearInterval(g2Interval); g2Interval=null; } };

  $('#g2-correct', root).onclick = ()=>{
    if (!g2Interval) return;
    g2Score++; g2ScoreEl.textContent = g2Score;
    nextWord();
  };
  $('#g2-wrong', root).onclick = ()=>{
    if (!g2Interval) return;
    if (g2Score > 0) g2Score--;
    g2ScoreEl.textContent = g2Score;
    nextWord();
  };

  function nextWord(){
    if (!g2Words.length) return;
    g2Idx = (g2Idx+1) % g2Words.length;
    g2Current.textContent = g2Words[g2Idx];
  }
}

// --- Init ---
window.addEventListener('load', ()=>{
  Screens = {
    intro: $('#intro-tpl').content.cloneNode(true),
    log: $('#log-tpl').content.cloneNode(true),
    add: $('#add-tpl').content.cloneNode(true),
    artic: $('#articulation-tpl').content.cloneNode(true),
    mode: $('#mode-tpl').content.cloneNode(true),
    practice: $('#practice-tpl').content.cloneNode(true),
    game: $('#game-tpl').content.cloneNode(true),
  };
  render();
});
