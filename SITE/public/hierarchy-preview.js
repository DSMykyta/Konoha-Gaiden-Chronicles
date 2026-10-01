'use strict';

(() => {
  const baseBindCard = bindCard;
  const baseCloseCard = closeCard;
  const cascade = [];
  const closeTimers = [];

  const style = document.createElement('style');
  style.textContent = `
    .hierarchy-preview-content { padding: 22px; }
    .result.is-preview-active { background: var(--accent-soft); }
    .hierarchy-preview .preview-top { min-height: 34px; }
    .hierarchy-preview .scene-actions li { cursor: pointer; }
    @media (max-width: 760px) { .hierarchy-preview-content { padding: 18px; } }
  `;
  document.head.append(style);

  function countLabel(n, one, few, many) {
    const mod100 = n % 100;
    const mod10 = n % 10;
    const form = mod100 >= 11 && mod100 <= 14 ? many : mod10 === 1 ? one : mod10 >= 2 && mod10 <= 4 ? few : many;
    return `${n} ${form}`;
  }

  function storyRange(items) {
    const days = items.map(item => item?.day).filter(day => day !== null && day !== undefined);
    if (!days.length) return { text: 'Без установленої дати', hasYear: false };
    const start = Math.min(...days), end = Math.max(...days);
    return {
      text: start === end ? dateText(start, true) : `${dateText(start, true)} — ${dateText(end, true)}`,
      hasYear: true
    };
  }

  function clearTimers() {
    for (let i = 0; i < closeTimers.length; i++) {
      clearTimeout(closeTimers[i]);
      closeTimers[i] = null;
    }
    cancelHoverClose();
  }

  function closeFrom(depth = 0) {
    for (let i = cascade.length - 1; i >= depth; i--) {
      const entry = cascade[i];
      if (!entry) continue;
      entry.trigger?.classList.remove('is-preview-active');
      entry.panel?.remove();
      cascade[i] = null;
      clearTimeout(closeTimers[i]);
      closeTimers[i] = null;
    }
    while (cascade.length && !cascade[cascade.length - 1]) cascade.pop();
  }

  function scheduleClose(depth) {
    clearTimeout(closeTimers[depth]);
    if (cascade[depth]?.pinned) return;
    closeTimers[depth] = setTimeout(() => closeFrom(depth), 220);
  }

  function panelWidth(depth, viewportWidth) {
    const preferred = [360, 340, 320][depth] || 300;
    return Math.min(preferred, Math.max(260, viewportWidth - 24));
  }

  function positionPanel(panel, parentSurface, depth) {
    const gap = 12;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    const parentRect = parentSurface.getBoundingClientRect();
    let width = panelWidth(depth, vw);
    const rightSpace = vw - parentRect.right - gap;
    const leftSpace = parentRect.left - gap;
    const side = rightSpace >= width || rightSpace >= leftSpace ? 'right' : 'left';
    const available = side === 'right' ? rightSpace : leftSpace;
    if (available < width) width = Math.max(240, Math.min(width, available));
    panel.style.width = `${width}px`;
    panel.dataset.side = side;
    let left = side === 'right' ? parentRect.right + gap : parentRect.left - gap - width;
    left = clamp(left, 12, Math.max(12, vw - width - 12));
    const headerBottom = document.querySelector('.masthead')?.getBoundingClientRect?.().bottom || 86;
    const topLimit = headerBottom + 12;
    const bottomLimit = vh - 132;
    panel.style.left = `${left}px`;
    panel.style.maxHeight = `${Math.max(160, bottomLimit - topLimit)}px`;
    panel.style.top = `${clamp(parentRect.top, topLimit, Math.max(topLimit, bottomLimit - Math.min(panel.scrollHeight || 480, bottomLimit - topLimit)))}px`;
  }

  function episodePreviewHtml(id) {
    const episode = episodeMap.get(id);
    if (!episode) return null;
    const scenes = (episode.scene_ids || []).map(sceneId => sceneMap.get(sceneId)).filter(Boolean);
    const moments = scenes.flatMap(scene => sceneEvents(scene.id));
    const range = storyRange(moments.length ? moments : scenes);
    const sceneRows = scenes.map(scene => {
      const group = sceneEvents(scene.id);
      const meta = [scene.day === null ? null : dateText(scene.day), scene.location_id ? name(scene.location_id) : null, actionCount(group.length)].filter(Boolean).join(' · ');
      return `<button class="result" data-story-scene="${esc(scene.id)}"><span><strong>${esc(scene.title)}</strong>${meta ? `<small class="result-context">${esc(meta)}</small>` : ''}</span></button>`;
    }).join('');
    return {
      label: 'Опис епізоду',
      html: `<div class="preview-top">${cardMetaLine('episode', range.text, range.hasYear)}</div><h2>${esc(episode.title)}</h2>${episode.description ? `<p class="event-text">${esc(episode.description)}</p>` : ''}<p class="scene-location">${countLabel(scenes.length, 'сцена', 'сцени', 'сцен')} · ${actionCount(moments.length)}</p>${sceneRows ? `<div class="story-children">${sceneRows}</div>` : ''}`
    };
  }

  function scenePreviewHtml(id) {
    const scene = sceneMap.get(id);
    if (!scene) return null;
    const group = sceneEvents(id);
    const cast = sceneCast(scene, group);
    const range = storyRange(group.length ? group : [scene]);
    const actions = group.map(event => `<li data-scene-preview="${esc(event.id)}"><div>${eventGallery(event)}<button class="scene-action-title" aria-haspopup="dialog" aria-label="Переглянути дію: ${esc(event.title)}">${esc(event.title)}</button></div></li>`).join('');
    return {
      label: 'Опис сцени',
      html: `<div class="preview-top">${cardMetaLine('scene', range.text, range.hasYear)}</div><h2>${esc(scene.title)}</h2><button class="scene-context" data-open-scene="${esc(scene.id)}" title="Читати сцену цілком"><span>Сцена · ${actionCount(group.length)}</span>${esc(name(scene.location_id))} <span aria-hidden="true">↗</span></button>${cast.length ? `<div class="people scene-people">${cast.map(entityId => `<button class="person" data-event-focus-character="${esc(entityId)}" aria-label="Зосередитися на лінії ${esc(name(entityId))}" title="Зосередитися на лінії"><span class="swatch" style="background:${color(entityId)}"></span>${esc(name(entityId))}</button>`).join('')}</div>` : ''}${actions ? `<ol class="scene-actions">${actions}</ol>` : ''}`
    };
  }

  function momentPreviewHtml(id) {
    const event = eventMap.get(id);
    if (!event) return null;
    return {
      label: 'Опис моменту',
      html: `<div class="preview-top">${cardMetaLine('moment', event.day === null ? 'Без установленої дати' : dateText(event.day, true), event.day !== null)}</div>${eventDetailsHtml(event, 'data-hierarchy-event', false)}`
    };
  }

  function previewHtml(kind, id) {
    if (kind === 'episode') return episodePreviewHtml(id);
    if (kind === 'scene') return scenePreviewHtml(id);
    if (kind === 'moment') return momentPreviewHtml(id);
    return null;
  }

  function bindPanelActions(content) {
    content.querySelectorAll('[data-event-focus-character]').forEach(button => button.addEventListener('click', () => {
      const id = button.dataset.eventFocusCharacter;
      if (focusedCharacter !== id) setFocus(id);
    }));
    content.querySelectorAll('[data-open-scene]').forEach(button => button.addEventListener('click', () => openScene(button.dataset.openScene, button)));
    content.querySelectorAll('[data-hierarchy-event]').forEach(button => button.addEventListener('click', () => navigateEvent(button.dataset.hierarchyEvent)));
  }

  function bindTrigger(trigger, kind, id, parentSurface, depth, allowPin = false) {
    if (trigger.dataset.hierarchyPreviewBound === 'true') return;
    trigger.dataset.hierarchyPreviewBound = 'true';
    trigger.addEventListener('pointerenter', event => {
      clearTimers();
      if (!canHover(event)) return;
      openPreview(kind, id, parentSurface, trigger, depth, false);
    });
    trigger.addEventListener('pointerleave', () => scheduleClose(depth));
    if (allowPin) {
      trigger.addEventListener('click', event => {
        event.preventDefault();
        openPreview(kind, id, parentSurface, trigger, depth, true);
      });
    }
  }

  function bindStoryTriggers(root, parentSurface, depth) {
    root.querySelectorAll('[data-story-episode]').forEach(trigger => bindTrigger(trigger, 'episode', trigger.dataset.storyEpisode, parentSurface, depth));
    root.querySelectorAll('[data-story-scene]').forEach(trigger => bindTrigger(trigger, 'scene', trigger.dataset.storyScene, parentSurface, depth));
  }

  function bindMomentTriggers(root, parentSurface, depth) {
    root.querySelectorAll('[data-scene-preview]').forEach(trigger => bindTrigger(trigger, 'moment', trigger.dataset.scenePreview, parentSurface, depth, true));
  }

  function bindChildTriggers(content, panel, depth, kind) {
    if (kind === 'episode') bindStoryTriggers(content, panel, depth + 1);
    if (kind === 'scene') bindMomentTriggers(content, panel, depth + 1);
  }

  function openPreview(kind, id, parentSurface, trigger, depth, pinned) {
    const rendered = previewHtml(kind, id);
    if (!rendered) return;
    clearTimers();
    closeFrom(depth);
    trigger.classList.add('is-preview-active');

    const panel = document.createElement('aside');
    panel.className = 'event-preview hierarchy-preview is-visible';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', rendered.label);
    panel.dataset.hierarchyDepth = String(depth);
    const content = document.createElement('div');
    content.className = 'hierarchy-preview-content';
    content.innerHTML = rendered.html;
    panel.append(content);
    document.body.append(panel);

    cascade[depth] = { panel, trigger, parentSurface, kind, id, pinned };
    positionPanel(panel, parentSurface, depth);
    bindPanelActions(content);
    bindChildTriggers(content, panel, depth, kind);

    panel.addEventListener('pointerenter', clearTimers);
    panel.addEventListener('pointerleave', () => scheduleClose(depth));
  }

  function bindRootStoryPreviews() {
    const card = $('eventCard');
    if (card.hidden) return;
    bindStoryTriggers($('cardContent'), card, 0);
  }

  bindSceneActionPreviews = function bindSceneActionHierarchyPreviews() {
    const card = $('eventCard');
    if (card.hidden) return;
    bindMomentTriggers($('cardContent'), card, 0);
  };

  bindCard = function bindCardWithHierarchyPreview() {
    closeEventPreview(true);
    closeFrom(0);
    baseBindCard();
    bindRootStoryPreviews();
  };

  closeCard = function closeCardWithHierarchyPreview(restoreFocus = false) {
    closeFrom(0);
    return baseCloseCard(restoreFocus);
  };

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !cascade.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeFrom(cascade.length - 1);
  }, true);

  window.addEventListener('resize', () => {
    cascade.forEach((entry, depth) => {
      if (entry?.panel?.isConnected && entry?.parentSurface?.isConnected) positionPanel(entry.panel, entry.parentSurface, depth);
    });
  });
})();
