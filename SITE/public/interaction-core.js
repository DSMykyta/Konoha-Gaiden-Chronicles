'use strict';

// Shared timing and geometry for transient surfaces. No application functions
// are replaced, and a cancelled callback can never reopen an old surface.
const TimelineInteractions = {
  OPEN_DELAY: 260,
  CLOSE_DELAY: 240,
  AIM_DELAY: 420,
  AIM_PADDING: 14,
  PANEL_WIDTH: 390,
  PANEL_GAP: 12,
  GUTTER: 12,

  hovered(element) {
    // A queued preview also checks the browser's current hit state. Pointer-leave
    // can arrive late while a layout or scroll replaces the surface under it.
    return element.matches(':hover');
  },

  // Protect the diagonal path from an active row to its adjacent child panel.
  // Movement away from the panel or outside this wedge is an intentional switch.
  inHoverCorridor(from, to, rect, padding = this.AIM_PADDING) {
    if (!from || !to || !rect ||
        ![from.x, from.y, to.x, to.y, rect.left, rect.right, rect.top, rect.bottom].every(Number.isFinite)) return false;
    const edge = from.x < rect.left ? rect.left : from.x > rect.right ? rect.right : null;
    if (edge === null) return false;
    const progress = (to.x - from.x) / (edge - from.x);
    if (progress <= 0 || progress > 1) return false;
    const upper = from.y + (rect.top - padding - from.y) * progress;
    const lower = from.y + (rect.bottom + padding - from.y) * progress;
    return to.y >= upper && to.y <= lower;
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
    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));
    // Reserve a shelf for the separate parent control. Keep the reading surface
    // above its point so the mark and the strand remain directly accessible.
    const minTop = Math.min(top + 52, bottom - 80), gap = 18;
    const above = y - gap - minTop, below = bottom - y - gap;
    const useAbove = above >= 120 || above >= below;
    const room = useAbove ? above : below;
    const height = Math.min(420, Math.max(80, room), bottom - minTop);
    const left = clamp(x - width / 2, gutter, viewportWidth - width - gutter);
    const cardTop = clamp(useAbove ? y - gap - height : y + gap, minTop, bottom - height);
    return { left, top: cardTop, width, height };
  },

  panelLayout(count, viewportWidth, anchorLeft, top, bottom) {
    const { PANEL_WIDTH: preferred, PANEL_GAP: gap, GUTTER: gutter } = this;
    const width = Math.min(preferred, Math.max(1, viewportWidth - gutter * 2));
    const clampLeft = value => Math.max(gutter, Math.min(value, viewportWidth - gutter - width));
    const slots = [];
    for (let index = 0; index < count; index++) {
      let left = clampLeft(anchorLeft);
      if (index) {
        const parent = slots[index - 1];
        const candidates = [...new Set(slots.flatMap(slot => [slot.left + width + gap, slot.left - width - gap]))]
          .filter(value => value >= gutter && value + width <= viewportWidth - gutter)
          .sort((a, b) => Math.abs(a - parent.left) - Math.abs(b - parent.left) || b - a);
        const free = candidates.find(value => slots.every(slot => slot.obscured || value + width + gap <= slot.left || value >= slot.left + width + gap));
        if (free !== undefined) left = free;
        else {
          // Only a click may cover a parent. Hover inspects these slots before
          // opening, and never moves or removes the row under the pointer.
          left = parent.left;
          for (const slot of slots) if (slot.left === left) slot.obscured = true;
        }
      }
      slots.push({ left, top, width, height: Math.max(80, bottom - top), obscured: false });
    }
    return slots;
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
    const show = (node, immediate = false, pointer = null) => {
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
        const rect = pointer && node.classList.contains('thread-hit') ? {left:pointer.x,top:pointer.y,bottom:pointer.y,width:0} : node.getBoundingClientRect(), box = tip.getBoundingClientRect();
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
      if (node && !node.contains(event.relatedTarget)) show(node, node.classList.contains('thread-hit'), Number.isFinite(event.clientX) ? {x:event.clientX,y:event.clientY} : null);
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
