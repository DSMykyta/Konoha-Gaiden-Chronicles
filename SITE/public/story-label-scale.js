'use strict';
(() => {
  if (typeof StoryClouds === 'undefined') return;

  const basePalette = StoryClouds.palette.bind(StoryClouds);
  StoryClouds.__storyLabelHighlight = null;
  StoryClouds.palette = function highlightedPalette(kind, key) {
    const colors = basePalette(kind, key);
    if (StoryClouds.__storyLabelHighlight === key) {
      return {...colors, alpha: Math.min(1, Math.max(.92, colors.alpha * 1.55))};
    }
    return colors;
  };

  const baseCreate = StoryClouds.create.bind(StoryClouds);
  StoryClouds.create = function createStoryCloudRenderer(canvas) {
    const renderer = baseCreate(canvas);
    let lastUpdate = null;
    const api = {
      update(next) {
        lastUpdate = {...(lastUpdate || {}), ...next};
        StoryClouds.__lastUpdate = lastUpdate;
        return renderer.update(next);
      },
      scroll(scrollTop) {
        return renderer.scroll(scrollTop);
      },
      highlight(key) {
        StoryClouds.__storyLabelHighlight = key || null;
        if (lastUpdate) renderer.update(lastUpdate);
      }
    };
    StoryClouds.__storyLabelRenderer = api;
    return api;
  };

  const style = document.createElement('style');
  style.textContent = `
    #timeline .story-scale-label { cursor: default; opacity: 1; transition: opacity 150ms ease; }
    #timeline .story-scale-label text { fill: #4d5664; font: 500 11px/1.25 Manrope, sans-serif; }
    #timeline .story-scale-label .story-scale-tick { stroke: #aeb6c1; stroke-width: 1; vector-effect: non-scaling-stroke; }
    #timeline .story-scale-label.is-story-active text { fill: #252c35; font-weight: 700; }
    #timeline.story-label-hover .story-scale-label:not(.is-story-active) { opacity: .18; }
    #timeline .moment-inline-label { pointer-events: none; }
    #timeline .moment-inline-label text { fill: #4d5664; font: 500 10.5px/1.25 Manrope, sans-serif; paint-order: stroke; stroke: #f5f6f8e8; stroke-width: 4px; stroke-linejoin: round; }
    @media (prefers-reduced-motion: reduce) { #timeline .story-scale-label { transition: none; } }
  `;
  document.head.append(style);

  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs, parent) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs || {})) node.setAttribute(key, String(value));
    parent.append(node);
    return node;
  };
  const truncate = (text, max) => {
    const value = String(text || '').trim();
    if (value.length <= max) return value;
    return value.slice(0, Math.max(1, max - 1)).trimEnd() + '…';
  };
  const wrap = (text, limit = 28) => {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean), lines = [];
    let line = '';
    for (const word of words) {
      if (line && line.length + word.length + 1 > limit) {
        lines.push(line);
        line = word;
        if (lines.length === 2) break;
      } else line += (line ? ' ' : '') + word;
    }
    if (line && lines.length < 2) lines.push(line);
    if (words.join(' ').length > lines.join(' ').length && lines.length) lines[lines.length - 1] = truncate(lines[lines.length - 1], limit);
    return lines;
  };

  let applying = false, scheduled = false;
  function semanticLevel() {
    return document.querySelector('.timeline-key [data-level][aria-current="true"]')?.dataset.level || 'episode';
  }
  function setHighlight(key, activeLabel = null) {
    const timeline = document.getElementById('timeline');
    if (!timeline) return;
    timeline.classList.toggle('story-label-hover', !!key);
    timeline.querySelectorAll('.story-scale-label').forEach(label => label.classList.toggle('is-story-active', !!key && label.dataset.cloudKey === key));
    StoryClouds.__storyLabelRenderer?.highlight(key);
    if (activeLabel && key) activeLabel.classList.add('is-story-active');
  }
  function expandTimeline(timeline, requiredHeight) {
    const viewBox = (timeline.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number);
    if (viewBox.length !== 4 || viewBox.some(Number.isNaN) || requiredHeight <= viewBox[3]) return;
    viewBox[3] = requiredHeight;
    timeline.setAttribute('viewBox', viewBox.join(' '));
    timeline.style.height = requiredHeight + 'px';
  }
  function addScaleLabels(timeline, level, groups, width, nodes) {
    const kind = level === 'episode' ? 'episode' : level === 'scene' ? 'scene' : null;
    if (!kind) return;
    const candidates = groups.filter(group => group.kind === kind && group.nodes?.length)
      .map(group => ({group, start: Math.min(...group.nodes.map(node => node.x))}))
      .sort((a, b) => a.start - b.start || a.group.key.localeCompare(b.group.key));
    if (!candidates.length) return;
    const maxY = Math.max(...nodes.map(node => node.y || 0), 0);
    const baseline = maxY + (level === 'episode' ? 96 : 108);
    expandTimeline(timeline, baseline + 52);
    candidates.forEach((entry, index) => {
      const nextStart = candidates[index + 1]?.start ?? width - 18;
      const x = Math.max(12, Math.min(width - 24, entry.start));
      const available = Math.max(54, nextStart - x - 12);
      const maxChars = Math.max(9, Math.floor(available / 6.35));
      const group = svg('g', {
        class: 'story-scale-label',
        'data-cloud-key': entry.group.key,
        'data-cloud-kind': entry.group.kind,
        'data-cloud-id': entry.group.id,
        tabindex: '0',
        role: 'button',
        'aria-label': entry.group.title
      }, timeline);
      svg('line', {class: 'story-scale-tick', x1: x, x2: x, y1: baseline - 17, y2: baseline - 5}, group);
      const text = svg('text', {x: x + 5, y: baseline + 8}, group);
      text.textContent = truncate(entry.group.title, maxChars);
      const title = svg('title', {}, group);
      title.textContent = entry.group.title;
      const enter = () => setHighlight(entry.group.key, group);
      const leave = () => setHighlight(null);
      group.addEventListener('pointerenter', enter);
      group.addEventListener('pointerleave', leave);
      group.addEventListener('focus', enter);
      group.addEventListener('blur', leave);
    });
  }
  function addMomentTitles(timeline, nodes, width) {
    const moments = nodes.filter(node => node.kind === 'moment');
    for (const [index, node] of moments.entries()) {
      const right = node.x < width * .72;
      const x = node.x + (right ? 11 : -11);
      const y = node.y + (index % 2 ? 18 : -14);
      const group = svg('g', {class: 'moment-inline-label'}, timeline);
      const text = svg('text', {x, y, 'text-anchor': right ? 'start' : 'end'}, group);
      const lines = wrap(node.title, width < 700 ? 22 : 29);
      lines.forEach((line, lineIndex) => {
        const span = svg('tspan', {x, dy: lineIndex ? 13 : 0}, text);
        span.textContent = line;
      });
    }
  }
  function apply() {
    scheduled = false;
    if (applying) return;
    const timeline = document.getElementById('timeline'), state = StoryClouds.__lastUpdate;
    if (!timeline || !state?.groups || !state?.nodes) return;
    applying = true;
    try {
      timeline.querySelectorAll('.cloud-label,.story-scale-label,.moment-inline-label').forEach(node => node.remove());
      timeline.classList.remove('story-label-hover');
      StoryClouds.__storyLabelHighlight = null;
      const level = semanticLevel();
      const width = state.width || timeline.viewBox?.baseVal?.width || timeline.clientWidth || 1000;
      if (level === 'moment') addMomentTitles(timeline, state.nodes, width);
      else addScaleLabels(timeline, level, state.groups, width, state.nodes);
    } finally {
      applying = false;
    }
  }
  function scheduleApply() {
    if (applying || scheduled) return;
    scheduled = true;
    requestAnimationFrame(apply);
  }

  const timeline = document.getElementById('timeline');
  if (timeline) new MutationObserver(scheduleApply).observe(timeline, {childList: true});
  window.addEventListener('resize', scheduleApply);
  document.addEventListener('DOMContentLoaded', scheduleApply, {once: true});
})();
