// Foldwell — folio tab switcher
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tool-list');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      tabs.forEach(t => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      panels.forEach(p => {
        p.classList.toggle('is-active', p.dataset.panel === target);
      });
    });

    // keyboard support: left/right arrows move between tabs
    tab.addEventListener('keydown', (e) => {
      const list = Array.from(tabs);
      const i = list.indexOf(tab);
      if (e.key === 'ArrowRight') list[(i + 1) % list.length].focus();
      if (e.key === 'ArrowLeft') list[(i - 1 + list.length) % list.length].focus();
    });
  });
});