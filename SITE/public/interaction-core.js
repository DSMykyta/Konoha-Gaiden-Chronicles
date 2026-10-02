'use strict';

// Shared timing and geometry for transient surfaces. No application functions
// are replaced, and a cancelled callback can never reopen an old surface.
const TimelineInteractions = {
  OPEN_DELAY: 260,
  CLOSE_DELAY: 240,
  PANEL_WIDTH: 390,
  PANEL_GAP: 12,
  GUTTER: 12,

  hovered(element) {
    // A queued preview also checks the browser's current hit state. Pointer-leave
    // can arrive late while a layout or scroll replaces the surface under it.
    return element.matches(':hover');
  },

  scheduler(clock = globalThis) {
    const jobs = new Map();
    const cancel = key => {
      const job = jobs.get(key);
      if (job) clock.clearTimeout(job.timer);
      jobs.delete(key);
    };
    return {
      defer(key, delay, callback) {
        cancel(key);
        const job = {};
        jobs.set(key, job);
        job.timer = clock.setTimeout(() => {
          if (jobs.get(key) !== job) return;
          jobs.delete(key);
          callback();
        }, delay);
      },
      cancel,
      cancelAll(prefix = '') {
        for (const key of jobs.keys()) if (key.startsWith(prefix)) cancel(key);
      },
      pending: key => jobs.has(key)
    };
  },

  cardLayout(viewportWidth, x, y, top, bottom) {
    const { PANEL_WIDTH: preferred, GUTTER: gutter } = this;
    const width = Math.min(preferred, viewportWidth - gutter * 2);
    let height = Math.min(420, Math.max(80, bottom - top));
    let left = gutter, cardTop = top;
    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
    if (viewportWidth > 760 && bottom - top >= 180) {
      const gap = 18, right = viewportWidth - x - gap - gutter, leftRoom = x - gap - gutter;
      if (Math.max(right, leftRoom) >= width) {
        left = right >= leftRoom ? x + gap : x - gap - width;
        cardTop = clamp(y - height / 2, top, bottom - height);
      } else {
        // A tablet may have room vertically, even when neither side fits.
        const above = y - top - gap, below = bottom - y - gap;
        height = Math.min(height, Math.max(80, above, below));
        left = clamp(x - width / 2, gutter, viewportWidth - width - gutter);
        cardTop = clamp(above >= below ? y - gap - height : y + gap, top, bottom - height);
      }
    }
    return { left, top: cardTop, width, height };
  },

  panelLayout(count, viewportWidth, anchorLeft, top, bottom) {
    const { PANEL_WIDTH: preferred, PANEL_GAP: gap, GUTTER: gutter } = this;
    const width = Math.min(preferred, Math.max(1, viewportWidth - gutter * 2));
    const capacity = Math.max(1, Math.floor((viewportWidth - gutter * 2 + gap) / (width + gap)));
    const visible = Math.min(count, capacity);
    const total = visible * width + (visible - 1) * gap;
    const left = Math.max(gutter, Math.min(anchorLeft, viewportWidth - gutter - total));
    const first = count - visible;
    return Array.from({ length: count }, (_, index) => ({
      left: left + Math.max(0, index - first) * (width + gap),
      top,
      width,
      height: Math.max(80, bottom - top),
      obscured: index < first
    }));
  },

  tooltips(doc, timers) {
    let target = null, tip = null;
    const win = doc.defaultView;
    const trigger = node => node?.closest?.('[data-tooltip],button[title]');
    const hide = () => {
      timers.cancel('tooltip');
      if (target) {
        const ids = (target.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== 'glassTooltip');
        if (ids.length) target.setAttribute('aria-describedby', ids.join(' '));
        else target.removeAttribute('aria-describedby');
      }
      target = null;
      if (tip) tip.hidden = true;
    };
    const show = (node, immediate = false) => {
      if (!node || node.disabled || target === node) return;
      const instant = immediate || !!tip && !tip.hidden;
      hide();
      const text = node.dataset.tooltip || node.getAttribute('title');
      if (!text) return;
      node.dataset.tooltip = text;
      node.removeAttribute('title');
      target = node;
      timers.defer('tooltip', instant ? 0 : this.OPEN_DELAY, () => {
        if (target !== node || !node.isConnected) return hide();
        if (!tip) {
          tip = doc.createElement('div');
          tip.id = 'glassTooltip';
          tip.className = 'glass-tooltip';
          tip.setAttribute('role', 'tooltip');
          doc.body.append(tip);
        }
        tip.textContent = text;
        tip.hidden = false;
        const rect = node.getBoundingClientRect(), box = tip.getBoundingClientRect();
        const width = doc.documentElement.clientWidth || win.innerWidth;
        const height = doc.documentElement.clientHeight || win.innerHeight;
        tip.style.left = Math.round(Math.max(8, Math.min(width - box.width - 8, rect.left + (rect.width - box.width) / 2))) + 'px';
        tip.style.top = Math.round(Math.max(8, rect.bottom + 8 + box.height <= height - 8 ? rect.bottom + 8 : rect.top - box.height - 8)) + 'px';
        node.setAttribute('aria-describedby', [node.getAttribute('aria-describedby'), tip.id].filter(Boolean).join(' '));
      });
    };
    doc.addEventListener('pointerover', event => {
      if (event.pointerType === 'touch' || !win.matchMedia('(any-hover: hover)').matches) return;
      const node = trigger(event.target);
      if (node && !node.contains(event.relatedTarget)) show(node);
    });
    doc.addEventListener('pointerout', event => {
      if (target?.contains(event.target) && !target.contains(event.relatedTarget)) hide();
    });
    doc.addEventListener('focusin', event => show(trigger(event.target), true));
    doc.addEventListener('focusout', hide);
    doc.addEventListener('pointerdown', hide, true);
    doc.addEventListener('scroll', hide, true);
    doc.addEventListener('wheel', hide, { capture: true, passive: true });
    doc.addEventListener('keydown', event => { if (event.key === 'Escape') hide(); });
    doc.addEventListener('visibilitychange', hide);
    win.addEventListener('blur', hide);
    win.addEventListener('resize', hide);
    return { hide, refresh() { if (target && !target.isConnected) hide(); } };
  }
};
if (typeof module !== 'undefined') module.exports = TimelineInteractions;
