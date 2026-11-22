// Phone menu for 559eats. On narrow screens the top nav only has room for the logo and
// "List your truck", so this adds a Menu button that opens a panel with every page.
(function () {
  var LINKS = [
    ['/', 'Map'],
    ['/browse.html', 'Browse trucks'],
    ['/events.html', 'Events'],
    ['/catering.html', 'Catering'],
    ['/apply.html', 'List your truck (free)'],
    ['/login.html', 'Owner login'],
    ['/pricing.html', 'Pricing'],
    ['/about.html', 'About'],
    ['/contact.html', 'Contact'],
  ];

  function init() {
    var nav = document.querySelector('nav');
    if (!nav || nav.querySelector('.mnav-btn')) return;

    var css = document.createElement('style');
    css.textContent =
      '.mnav-btn{display:none;align-items:center;gap:6px;margin-left:10px;background:none;border:1.5px solid #e8e0da;border-radius:999px;padding:7px 12px;font:inherit;font-size:.85rem;font-weight:600;color:#2d2420;cursor:pointer;min-height:40px}' +
      '.mnav-btn svg{width:18px;height:18px}' +
      '.mnav-panel{position:fixed;left:0;right:0;z-index:2000;background:#fff;border-bottom:1px solid #e8e0da;box-shadow:0 12px 30px rgba(0,0,0,.15);padding:6px 0 10px;display:none;max-height:calc(100vh - 64px);overflow-y:auto}' +
      '.mnav-panel.open{display:block}' +
      '.mnav-panel a{display:block;padding:14px 22px;font-size:1rem;font-weight:600;color:#2d2420;text-decoration:none;font-family:inherit}' +
      '.mnav-panel a:active,.mnav-panel a:hover{background:#f9ede8;color:#c73e18}' +
      '.mnav-panel a.cur{color:#E8512A}' +
      '.mnav-panel a.sep{border-top:1px solid #f0e8e2;margin-top:6px;padding-top:16px}' +
      '@media (max-width:760px){.mnav-btn{display:inline-flex}}' +
      '@media (max-width:420px){nav .nav-cta{padding:7px 12px!important;font-size:.8rem!important}nav{gap:10px!important}.mnav-btn span{display:none}.mnav-btn{padding:8px 10px}}';
    document.head.appendChild(css);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mnav-btn';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'mnav-panel');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span>Menu</span>';

    var panel = document.createElement('div');
    panel.id = 'mnav-panel';
    panel.className = 'mnav-panel';
    var here = location.pathname.replace(/\.html$/, '') || '/';
    LINKS.forEach(function (l, i) {
      var a = document.createElement('a');
      a.href = l[0];
      a.textContent = l[1];
      var p = l[0].replace(/\.html$/, '');
      if (p === here || (p === '/' && here === '/index')) a.className = 'cur';
      if (i === 5) a.className += ' sep';
      panel.appendChild(a);
    });

    nav.appendChild(btn);
    document.body.appendChild(panel);

    function place() { panel.style.top = Math.round(nav.getBoundingClientRect().bottom) + 'px'; }
    function close() { panel.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      place();
      var open = panel.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) { if (!panel.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', function () { if (window.innerWidth > 760) close(); else place(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
