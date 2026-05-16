// Script injected into the preview iframe via srcdoc. Emits clicks and link
// navigations back to the parent via postMessage.
export const INJECT_SCRIPT = `
(function () {
  var POST = function (msg) {
    var payload = Object.assign({ source: 'you-design' }, msg);
    parent.postMessage(payload, '*');
  };
  var getId = function (el) {
    return el && el.getAttribute ? el.getAttribute('data-yd-id') : null;
  };

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (a) {
      e.preventDefault();
      POST({ type: 'navigate', href: a.getAttribute('href') });
      return;
    }
    var id = getId(e.target);
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    var r = e.target.getBoundingClientRect();
    POST({
      type: 'select',
      id: id,
      bounds: { x: r.x, y: r.y, w: r.width, h: r.height },
      tag: (e.target.tagName || '').toLowerCase(),
      text: e.target.textContent || '',
      classes: (e.target.className || '').toString().split(/\\s+/).filter(Boolean)
    });
  }, true);

  POST({ type: 'ready' });
})();
`;
