'use strict';

const HierarchyPreview = (() => {
  const cascade = [];
  const hoverTargets = new Map();

  function lists(root) {
    root.querySelectorAll('.story-children,.scene-actions').forEach(container => {
      if (container.dataset.highlightBound) return;
      container.dataset.highlightBound = 'true';
      const glass = document.createElement('span');
      glass.className = 'hierarchy-hover-glass';
      glass.setAttribute('aria-hidden', 'true');
      container.prepend(glass);
      const move = row => {
        glass.style.transform = `translate3d(0,${row.offsetTop}px,0)`;
        glass.style.height = `${row.offsetHeight}px`;
        glass.style.opacity = '1';
      };
      container.querySelectorAll(':scope > .result,:scope > li').forEach(row => {
        row.addEventListener('pointerenter', event => { if (canHover(event)) move(row); });
        row.addEventListener('focusin', () => move(row));
      });
      const restore = () => {
        const active = container.querySelector(':scope > .is-preview-active');
        if (active) move(active); else glass.style.opacity = '0';
      };
      container.addEventListener('pointerleave', restore);
      container.addEventListener('focusout', event => { if (!container.contains(event.relatedTarget)) restore(); });
      container.syncHighlight = restore;
    });
  }

  function keep() {
    uiTimers.cancelAll('hierarchy-close:');
    cancelHoverClose();
  }

  function layout() {
    const root = $('eventCard');
    if (root.hidden || !cardPlacement) return;
    const surfaces = [root, ...cascade.map(entry => entry.panel)];
    const width = document.documentElement.clientWidth || window.innerWidth || $('canvas').clientWidth;
    const viewportHeight = window.innerHeight || $('canvas').clientHeight;
    const minTop = Math.min(readingBounds().top, Math.max(12, viewportHeight - 92));
    const bottom = Math.max(minTop + 80, viewportHeight - 116);
    const height = Math.min(cardPlacement.height, bottom - minTop);
    const top = Math.max(minTop, Math.min(cardPlacement.top, bottom - height));
    const slots = TimelineInteractions.panelLayout(surfaces.length, width, cardPlacement.left, top, top + height);
    surfaces.forEach((surface, index) => {
      const slot = slots[index];
      surface.style.left = `${slot.left}px`;
      surface.style.top = `${slot.top}px`;
      surface.style.width = `${slot.width}px`;
      surface.style.maxHeight = `${slot.height}px`;
      surface.style.setProperty('--card-height', `${slot.height}px`);
      surface.dataset.cascadeObscured = String(slot.obscured);
      surface.inert = slot.obscured;
      if (slot.obscured) surface.setAttribute('aria-hidden', 'true');
      else surface.removeAttribute('aria-hidden');
    });
    const parent = root.querySelector('.card-parent-level-button');
    if (parent) parent.hidden = cascade.length > 0;
    tooltipController?.refresh();
  }

  function closeFrom(depth = 0, restoreFocus = false) {
    const trigger = cascade[depth]?.trigger;
    for (let i = cascade.length - 1; i >= depth; i--) {
      uiTimers.cancel(`hierarchy-open:${i}`);
      uiTimers.cancel(`hierarchy-close:${i}`);
      const entry = cascade[i];
      entry.trigger?.classList.remove('is-preview-active');
      entry.trigger?.closest('.story-children,.scene-actions')?.syncHighlight?.();
      entry.panel.remove();
    }
    cascade.splice(depth);
    for (const key of hoverTargets.keys()) if (key >= depth) {
      hoverTargets.delete(key);
      uiTimers.cancel(`hierarchy-open:${key}`);
    }
    layout();
    if (restoreFocus && trigger?.isConnected) (trigger.matches('button') ? trigger : trigger.querySelector('button'))?.focus({ preventScroll: true });
  }

  function scheduleClose(depth = 0) {
    if (cascade.slice(depth).some(entry => entry.pinned)) return;
    uiTimers.defer(`hierarchy-close:${depth}`, TimelineInteractions.CLOSE_DELAY, () => closeFrom(depth));
  }

  function leave(event, depth) {
    const next = event.relatedTarget;
    if (next && cascade.slice(depth).some(entry => entry.panel.contains(next))) return keep();
    const ancestor = cascade.findIndex(entry => next && entry.panel.contains(next));
    scheduleClose(ancestor >= 0 ? ancestor + 1 : 0);
    deferHoverClose();
  }

  function range(items) {
    const days = items.map(item => item.day).filter(Number.isFinite);
    if (!days.length) return 'Без установленої дати';
    const start = Math.min(...days), end = Math.max(...days);
    return start === end ? dateText(start, true) : `${dateText(start, true)} — ${dateText(end, true)}`;
  }

  function html(kind, id) {
    const event = kind === 'moment' ? eventMap.get(id) : null;
    const scene = kind === 'scene' ? sceneMap.get(id) : null;
    const point = kind === 'episode' ? storyPoint(kind, id) : null;
    const group = event ? [event] : scene ? sceneEvents(id) : point?.group;
    if (!group?.length) return null;
    const header = `<div class="story-panel-header">${cardMetaLine(kind, range(group), group.some(event => event.day !== null))}<button class="close" data-close-hierarchy aria-label="Закрити перегляд" data-tooltip="Закрити">×</button></div>`;
    const body = event ? eventDetailsHtml(event, 'data-hierarchy-event') : scene ? sceneCardBody(scene, group) : storyCardBody(point);
    return { header, body };
  }

  function pin(depth) {
    pinOpenCard();
    cascade.slice(0, depth + 1).forEach(entry => { entry.pinned = true; });
    keep();
  }

  function open(kind, id, parentSurface, trigger, depth = 0, pinned = false) {
    if ($('eventCard').hidden || !parentSurface?.isConnected) return;
    const existing = cascade[depth];
    if (existing?.pinned && !pinned && existing.id !== id) return;
    uiTimers.cancel(`hierarchy-open:${depth}`);
    keep();
    if (existing?.kind === kind && existing.id === id) {
      if (pinned) pin(depth);
      return;
    }
    const rendered = html(kind, id);
    if (!rendered) return;
    closeFrom(depth);
    const panel = document.createElement('aside');
    panel.className = 'event-preview hierarchy-preview story-panel';
    panel.dataset.hierarchyDepth = String(depth);
    if (depth === 0 && kind === 'moment') panel.id = 'eventPreview';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', `Опис ${kind === 'moment' ? 'моменту' : kind === 'scene' ? 'сцени' : 'епізоду'}`);
    panel.innerHTML = `<div class="hierarchy-preview-content">${rendered.header}<div class="preview-scroll">${rendered.body}</div></div>`;
    document.body.append(panel);
    cascade.push({ panel, trigger, parentSurface, kind, id, pinned: false });
    trigger?.classList.add('is-preview-active');
    trigger?.closest('.story-children,.scene-actions')?.syncHighlight?.();
    lists(panel);
    bind(panel, panel, depth + 1);
    panel.addEventListener('pointerenter', keep);
    panel.addEventListener('pointerleave', event => leave(event, depth));
    panel.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-close-hierarchy')) closeFrom(depth, true);
      else if (button.dataset.eventFocusCharacter) setFocus(button.dataset.eventFocusCharacter);
      else if (button.dataset.hierarchyEvent) navigateEvent(button.dataset.hierarchyEvent);
    });
    if (pinned) pin(depth);
    layout();
    if (pinned && document.documentElement.dataset.input === 'keyboard') panel.querySelector('[data-close-hierarchy]').focus({ preventScroll: true });
  }

  function bind(root, parentSurface = $('eventCard'), depth = 0) {
    lists(root);
    root.querySelectorAll('[data-story-episode],[data-story-scene],[data-scene-preview]').forEach(trigger => {
      if (trigger.dataset.previewBound) return;
      trigger.dataset.previewBound = 'true';
      const kind = trigger.dataset.storyEpisode ? 'episode' : trigger.dataset.storyScene ? 'scene' : 'moment';
      const id = trigger.dataset.storyEpisode || trigger.dataset.storyScene || trigger.dataset.scenePreview;
      trigger.addEventListener('pointerenter', event => {
        if (!canHover(event)) return;
        keep();
        hoverTargets.set(depth, trigger);
        // Hover must leave its row usable. Compact screens drill down by click.
        const viewport = document.documentElement.clientWidth || window.innerWidth;
        if (viewport < TimelineInteractions.PANEL_WIDTH * 2 + TimelineInteractions.PANEL_GAP + 24) return;
        uiTimers.defer(`hierarchy-open:${depth}`, TimelineInteractions.OPEN_DELAY, () => {
          if (hoverTargets.get(depth) === trigger && trigger.isConnected && parentSurface.isConnected) open(kind, id, parentSurface, trigger, depth);
        });
      });
      trigger.addEventListener('pointerleave', event => {
        if (hoverTargets.get(depth) === trigger) hoverTargets.delete(depth);
        uiTimers.cancel(`hierarchy-open:${depth}`);
        leave(event, depth);
      });
      trigger.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        open(kind, id, parentSurface, trigger, depth, true);
      });
    });
  }

  return {
    bind, open, layout, keep, leave,
    clear() { uiTimers.cancelAll('hierarchy-'); hoverTargets.clear(); closeFrom(0); },
    closeFrom,
    escape() {
      uiTimers.cancelAll('hierarchy-open:');
      hoverTargets.clear();
      if (!cascade.length) return false;
      closeFrom(cascade.length - 1, true);
      return true;
    },
    get size() { return cascade.length; },
    dismissTransient() {
      const depth = cascade.findIndex(entry => !entry.pinned);
      if (depth >= 0) closeFrom(depth);
      uiTimers.cancelAll('hierarchy-open:');
      hoverTargets.clear();
    }
  };
})();
