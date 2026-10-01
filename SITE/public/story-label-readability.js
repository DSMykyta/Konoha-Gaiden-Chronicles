'use strict';

(() => {
  const LARGE_MIN = 96;
  const SMALL_MIN = 76;
  const MAX_WIDTH = 190;
  const GAP = 6;

  const style = document.createElement('style');
  style.textContent = `
    .time-axis { bottom: calc(70px + env(safe-area-inset-bottom)) !important; }
    .story-title-scale {
      height: calc(76px + env(safe-area-inset-bottom)) !important;
      overflow: hidden !important;
    }
    .story-title-level {
      top: 20px !important;
    }
    .story-title-slot {
      height: 76px !important;
      overflow: visible;
    }
    .story-title-slot::before {
      top: 0 !important;
      height: 10px !important;
    }
    .story-title-label {
      inset: 11px 3px 4px !important;
      height: 60px !important;
      padding: 6px 7px !important;
      white-space: normal !important;
      text-overflow: clip !important;
      overflow: hidden !important;
      display: -webkit-box !important;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      text-align: left !important;
      font-size: 10.5px !important;
      line-height: 1.35 !important;
      overflow-wrap: anywhere;
      word-break: normal;
    }
    .story-title-label:hover,
    .story-title-label:focus-visible,
    .story-title-label.is-active {
      z-index: 4;
      box-shadow: 0 2px 9px #27364c12;
    }
    @media (min-width: 1400px) {
      .story-title-label { font-size: 11px !important; }
    }
    @media (max-width: 760px) {
      .time-axis { bottom: calc(66px + env(safe-area-inset-bottom)) !important; }
      .story-title-scale { height: calc(72px + env(safe-area-inset-bottom)) !important; }
      .story-title-level { top: 18px !important; }
      .story-title-slot { height: 72px !important; }
      .story-title-label { height: 56px !important; font-size: 9.5px !important; padding-inline: 5px !important; }
    }
  `;
  document.head.append(style);

  let scheduled = false;

  function number(value) {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function originalAnchor(slot) {
    const left = number(slot.style.left);
    const width = Math.max(1, number(slot.style.width));
    const raw = slot.style.getPropertyValue('--story-anchor').trim();
    if (!raw) return left + width / 2;
    if (raw.endsWith('%')) return left + width * number(raw) / 100;
    return left + number(raw);
  }

  function preferredWidth(title, minimum) {
    const length = String(title || '').trim().length;
    return Math.max(minimum, Math.min(MAX_WIDTH, 74 + Math.sqrt(Math.max(1, length)) * 15));
  }

  function layout() {
    scheduled = false;
    const root = document.getElementById('storyTitleScale');
    const track = root?.querySelector('.story-title-track');
    if (!root || !track) return;

    const slots = [...track.querySelectorAll('.story-title-slot')];
    if (!slots.length) return;

    const viewport = root.clientWidth || window.innerWidth || 1000;
    const compact = viewport <= 760;
    const leftBound = compact ? 104 : 122;
    const rightBound = viewport - (compact ? 6 : 10);
    const available = Math.max(1, rightBound - leftBound);
    const minimum = compact ? SMALL_MIN : LARGE_MIN;

    const entries = slots.map(slot => ({
      slot,
      button: slot.querySelector('.story-title-label'),
      anchor: originalAnchor(slot)
    })).filter(entry => entry.button).sort((a, b) => a.anchor - b.anchor);

    if (!entries.length) return;

    let widths = entries.map(entry => preferredWidth(entry.button.textContent, minimum));
    const gaps = GAP * Math.max(0, entries.length - 1);
    const preferredTotal = widths.reduce((sum, width) => sum + width, 0) + gaps;

    if (preferredTotal > available) {
      const usable = Math.max(1, available - gaps);
      const hardFloor = Math.max(compact ? 54 : 66, usable / entries.length * .78);
      const target = usable / widths.reduce((sum, width) => sum + width, 0);
      widths = widths.map(width => Math.max(hardFloor, width * target));
      const total = widths.reduce((sum, width) => sum + width, 0);
      if (total > usable) {
        const secondScale = usable / total;
        widths = widths.map(width => width * secondScale);
      }
    }

    const positions = [];
    let cursor = leftBound;
    for (let i = 0; i < entries.length; i++) {
      const width = widths[i];
      const desired = entries[i].anchor - width / 2;
      const left = Math.max(cursor, desired);
      positions.push(left);
      cursor = left + width + GAP;
    }

    const end = positions.at(-1) + widths.at(-1);
    if (end > rightBound) {
      let right = rightBound;
      for (let i = entries.length - 1; i >= 0; i--) {
        positions[i] = Math.min(positions[i], right - widths[i]);
        right = positions[i] - GAP;
      }
    }

    if (positions[0] < leftBound) {
      const shift = leftBound - positions[0];
      for (let i = 0; i < positions.length; i++) positions[i] += shift;
    }

    const finalEnd = positions.at(-1) + widths.at(-1);
    if (finalEnd > rightBound) {
      const shift = finalEnd - rightBound;
      for (let i = 0; i < positions.length; i++) positions[i] -= shift;
    }

    for (let i = 0; i < entries.length; i++) {
      const {slot, button, anchor} = entries[i];
      const left = positions[i];
      const width = widths[i];
      slot.style.left = `${left}px`;
      slot.style.width = `${width}px`;
      slot.style.setProperty('--story-anchor', `${((anchor - left) / Math.max(1, width)) * 100}%`);
      button.title = button.textContent.trim();
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(layout);
  }

  function init() {
    const waitForScale = () => {
      const root = document.getElementById('storyTitleScale');
      const track = root?.querySelector('.story-title-track');
      if (!root || !track) {
        requestAnimationFrame(waitForScale);
        return;
      }
      new MutationObserver(schedule).observe(track, {childList: true});
      window.addEventListener('resize', schedule);
      schedule();
    };
    waitForScale();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
