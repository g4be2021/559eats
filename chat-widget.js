// 559eats chat bubble. Talks to /api/chat. Include with <script src="/chat-widget.js" defer></script>
(function () {
  if (window.__eatsChat) return; window.__eatsChat = true;
  const KEY = '559eats-chat';
  let msgs = [];
  try { msgs = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch {}
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-20))); } catch {} };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<)]+[^\s<).,!?])/g, (u) => `<a href="${u}" ${u.includes('559eats.com') ? '' : 'target="_blank" rel="noopener"'}>${u.replace(/^https?:\/\/(www\.)?/, '')}</a>`).replace(/\n/g, '<br>');

  const css = `
  .ec-btn{position:fixed;right:18px;bottom:18px;z-index:2500;width:58px;height:58px;border-radius:50%;border:none;background:#E8512A;color:#fff;font-size:26px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;transition:transform .15s}
  .ec-btn:hover{transform:scale(1.06)}
  .ec-panel{position:fixed;right:18px;bottom:88px;z-index:2500;width:min(370px,calc(100vw - 24px));height:min(540px,calc(100vh - 120px));background:#fff;border-radius:18px;box-shadow:0 16px 48px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#2d2420}
  .ec-panel.open{display:flex}
  .ec-head{background:#1a1310;color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}
  .ec-head b{font-family:'Playfair Display',Georgia,serif;font-size:1.05rem}.ec-head span{font-size:.75rem;opacity:.7;display:block}
  .ec-x{margin-left:auto;background:none;border:none;color:#fff;font-size:20px;cursor:pointer;opacity:.8}
  .ec-body{flex:1;overflow-y:auto;padding:14px;background:#faf7f4;display:flex;flex-direction:column;gap:8px}
  .ec-m{max-width:85%;padding:9px 12px;border-radius:14px;font-size:.88rem;line-height:1.45;word-wrap:break-word}
  .ec-m.bot{background:#fff;border:1px solid #eee4dc;align-self:flex-start;border-bottom-left-radius:4px}
  .ec-m.me{background:#E8512A;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
  .ec-m a{color:#c73e18;font-weight:600}.ec-m.me a{color:#fff}
  .ec-typing{align-self:flex-start;font-size:.8rem;color:#7a6e6a;padding:4px 6px}
  .ec-sug{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 10px;background:#faf7f4}
  .ec-sug button{font:inherit;font-size:.76rem;font-weight:600;border:1.5px solid #e8e0da;background:#fff;border-radius:999px;padding:6px 10px;cursor:pointer;color:#2d2420}
  .ec-sug button:hover{border-color:#E8512A;color:#E8512A}
  .ec-form{display:flex;gap:8px;padding:10px;border-top:1px solid #eee4dc;background:#fff}
  .ec-form input{flex:1;border:1.5px solid #e8e0da;border-radius:999px;padding:10px 14px;font:inherit;font-size:16px;outline:none}
  .ec-form input:focus{border-color:#E8512A}
  .ec-form button{border:none;background:#E8512A;color:#fff;border-radius:999px;padding:0 16px;font-weight:700;cursor:pointer}
  .ec-form button:disabled{opacity:.5}
  .ec-foot{font-size:.66rem;color:#9a8f8a;text-align:center;padding:0 10px 8px;background:#fff}
  @media(max-width:760px){.ec-btn{bottom:84px}.ec-panel{bottom:150px}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const btn = document.createElement('button');
  btn.className = 'ec-btn'; btn.setAttribute('aria-label', 'Chat with 559eats'); btn.textContent = '💬';
  const panel = document.createElement('div');
  panel.className = 'ec-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '559eats chat');
  panel.innerHTML = `
    <div class="ec-head"><div><b>559eats</b><span>Ask about trucks, hours, catering or listing your truck</span></div><button class="ec-x" aria-label="Close">✕</button></div>
    <div class="ec-body"></div>
    <div class="ec-sug"></div>
    <form class="ec-form"><input type="text" placeholder="Type a message..." maxlength="600" autocomplete="off"><button type="submit">Send</button></form>
    <div class="ec-foot">Automated assistant. Answers can be wrong, so call the truck if it matters.</div>`;
  document.body.appendChild(btn); document.body.appendChild(panel);

  const body = panel.querySelector('.ec-body'), sug = panel.querySelector('.ec-sug');
  const form = panel.querySelector('form'), input = form.querySelector('input'), send = form.querySelector('button');
  const SUGS = ["Who's open now?", 'Tacos near downtown', 'Book a truck for an event', 'List my truck'];

  function render() {
    const all = msgs.length ? msgs : [{ role: 'assistant', content: "Hi! I can help you find a food truck, check who's open, or get your truck listed. What are you looking for? / ¿En qué le puedo ayudar?" }];
    body.innerHTML = all.map((m) => `<div class="ec-m ${m.role === 'user' ? 'me' : 'bot'}">${linkify(m.content)}</div>`).join('');
    sug.innerHTML = msgs.length ? '' : SUGS.map((s) => `<button type="button">${esc(s)}</button>`).join('');
    body.scrollTop = body.scrollHeight;
  }
  async function ask(text) {
    text = text.trim(); if (!text) return;
    msgs.push({ role: 'user', content: text }); save(); render();
    input.value = ''; send.disabled = true;
    const t = document.createElement('div'); t.className = 'ec-typing'; t.textContent = 'Typing...'; body.appendChild(t); body.scrollTop = body.scrollHeight;
    try {
      const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: msgs, page: location.pathname }) });
      const j = await r.json().catch(() => ({}));
      msgs.push({ role: 'assistant', content: j.reply || 'Sorry, something went wrong. Try again in a moment.' });
    } catch {
      msgs.push({ role: 'assistant', content: 'Sorry, I could not connect. Check your internet and try again.' });
    }
    save(); send.disabled = false; render(); input.focus();
  }
  btn.addEventListener('click', () => { const o = panel.classList.toggle('open'); btn.textContent = o ? '✕' : '💬'; if (o) { render(); input.focus(); } });
  panel.querySelector('.ec-x').addEventListener('click', () => { panel.classList.remove('open'); btn.textContent = '💬'; });
  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  sug.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) ask(b.textContent); });
})();
