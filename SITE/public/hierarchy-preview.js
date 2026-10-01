'use strict';

(() => {
  const baseBindCard = bindCard;
  const baseCloseCard = closeCard;
  const baseBindSceneActionPreviews = bindSceneActionPreviews;
  const baseShowSceneCard = showSceneCard;
  const baseRenderProfile = renderProfile;
  const cascade = [];
  const closeTimers = [];

  const style = document.createElement('style');
  style.textContent = `
    .hierarchy-preview-content { padding: 22px; }
    .hierarchy-preview .preview-top { min-height: 34px; }

    .story-children,
    .scene-actions {
      position: relative;
      isolation: isolate;
      counter-reset: hierarchy-row;
      display: grid;
      gap: 4px;
    }
    .scene-actions { list-style: none; padding-left: 0; }
    .story-children .result,
    .scene-actions li {
      position: relative;
      z-index: 1;
      counter-increment: hierarchy-row;
      display: grid;
      grid-template-columns: 22px minmax(0,1fr);
      align-items: center;
      column-gap: 8px;
      width: 100%;
      min-height: 0;
      margin: 0;
      padding: 10px 12px;
      border: 0 !important;
      border-radius: 14px;
      background: transparent !important;
      box-shadow: none !important;
      text-align: left;
      cursor: pointer;
      transform: none !important;
    }
    .story-children .result::before,
    .scene-actions li::before {
      content: counter(hierarchy-row, decimal-leading-zero);
      position: static;
      grid-column: 1;
      justify-self: start;
      align-self: center;
      color: var(--muted);
      font-size: 9px;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      pointer-events: none;
      transition: color .16s ease;
    }
    .story-children .result > span,
    .story-children .result > strong,
    .scene-actions li > div {
      grid-column: 2;
      display: block;
      min-width: 0;
      width: 100%;
      align-self: center;
    }
    .story-children .result strong,
    .scene-action-title {
      display: block;
      width: 100%;
      padding: 0;
      background: transparent !important;
      color: var(--text);
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.4;
      transform: none !important;
    }
    .story-children .result small,
    .story-row-description,
    .scene-actions li .event-gallery { display: none !important; }

    .hierarchy-hover-glass {
      position: absolute;
      z-index: 0;
      left: 0;
      right: 0;
      top: 0;
      height: 0;
      border: 1px solid rgba(255,255,255,.92);
      border-radius: 14px;
      opacity: 0;
      pointer-events: none;
      background: linear-gradient(145deg, rgba(255,255,255,.62), rgba(232,239,247,.22));
      -webkit-backdrop-filter: blur(14px) saturate(1.14);
      backdrop-filter: blur(14px) saturate(1.14);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.94), inset 0 -1px 0 rgba(124,142,164,.10), 0 5px 14px rgba(42,54,70,.09);
      transform: translate3d(0,0,0);
      transition: transform 210ms cubic-bezier(.2,.72,.2,1), height 210ms cubic-bezier(.2,.72,.2,1), opacity 110ms ease;
      will-change: transform,height,opacity;
    }
    .story-children .result:hover::before,
    .story-children .result:focus-visible::before,
    .scene-actions li:hover::before,
    .scene-actions li:focus-within::before { color: var(--text); }
    .hierarchy-preview .scene-actions li { cursor: pointer; }

    @media (max-width: 760px) {
      .hierarchy-preview-content { padding: 18px; }
      .story-children .result,
      .scene-actions li {
        grid-template-columns: 20px minmax(0,1fr);
        column-gap: 7px;
        padding: 9px 10px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .hierarchy-hover-glass { transition: opacity 80ms linear; }
    }
  `;
  document.head.append(style);

  if (typeof StoryClouds !== 'undefined') {
    const baseCloudGroups = StoryClouds.groups.bind(StoryClouds);
    StoryClouds.groups = function hierarchyAwareCloudGroups(nodes, level, sceneMapArg, episodeMapArg) {
      const groups = baseCloudGroups(nodes, level, sceneMapArg, episodeMapArg);
      const momentsByScene = new Map();
      const scenesByEpisode = new Map();
      for (const node of nodes) {
        const sceneIds = (node.sourceSceneIds?.length ? node.sourceSceneIds : node.scene?.id ? [node.scene.id] : []).filter(Boolean);
        const momentIds = (node.group || []).map(event => event?.id).filter(Boolean);
        for (const sceneId of sceneIds) {
          if (!momentsByScene.has(sceneId)) momentsByScene.set(sceneId, new Set());
          for (const momentId of momentIds) momentsByScene.get(sceneId).add(momentId);
        }
        const episodeIds = (node.kind === 'episode' && node.rawId ? [node.rawId] : node.sourceEpisodeIds?.length ? node.sourceEpisodeIds : node.scene?.episode_id ? [node.scene.episode_id] : []).filter(Boolean);
        for (const episodeId of episodeIds) {
          if (!scenesByEpisode.has(episodeId)) scenesByEpisode.set(episodeId, new Set());
          for (const sceneId of sceneIds) scenesByEpisode.get(episodeId).add(sceneId);
        }
      }
      return groups.filter(group => {
        if (group.kind === 'moment') return false;
        if (group.kind === 'episode') return (scenesByEpisode.get(group.id)?.size || 0) > 1;
        if (group.kind === 'scene') return (momentsByScene.get(group.id)?.size || 0) > 1;
        return true;
      });
    };
  }

  function normalizeCloudLabels(root = document) {
    root.querySelectorAll?.('.cloud-label').forEach(label => {
      const parent = label.querySelector('.cloud-parent');
      if (!parent) return;
      const wanted = label.dataset.cloudKind === 'scene' ? 'СЦЕНА' : label.dataset.cloudKind === 'episode' ? 'ЕПІЗОД' : null;
      if (wanted && parent.textContent !== wanted) parent.textContent = wanted;
    });
  }

  const timeline = document.getElementById('timeline');
  if (timeline) {
    normalizeCloudLabels(timeline);
    new MutationObserver(() => normalizeCloudLabels(timeline)).observe(timeline, { childList: true, subtree: true });
  }

  function countLabel(n, one, few, many) {
    const mod100 = n % 100, mod10 = n % 10;
    const form = mod100 >= 11 && mod100 <= 14 ? many : mod10 === 1 ? one : mod10 >= 2 && mod10 <= 4 ? few : many;
    return `${n} ${form}`;
  }

  function storyRange(items) {
    const days = items.map(item => item?.day).filter(day => day !== null && day !== undefined);
    if (!days.length) return { text: 'Без установленої дати', hasYear: false };
    const start = Math.min(...days), end = Math.max(...days);
    return { text: start === end ? dateText(start, true) : `${dateText(start, true)} — ${dateText(end, true)}`, hasYear: true };
  }

  function hierarchyRows(container) {
    return container.matches('.scene-actions') ? [...container.querySelectorAll(':scope > li')] : [...container.querySelectorAll(':scope > .result')];
  }

  function bindMovingHighlight(container) {
    if (!container || container.dataset.glidingHighlightBound === 'true') return;
    container.dataset.glidingHighlightBound = 'true';
    const glass = document.createElement('span');
    glass.className = 'hierarchy-hover-glass';
    glass.setAttribute('aria-hidden', 'true');
    container.prepend(glass);
    const moveTo = row => {
      const top = row.offsetTop;
      const height = row.offsetHeight;
      glass.style.transform = `translate3d(0,${top}px,0)`;
      glass.style.height = `${height}px`;
      glass.style.opacity = '1';
    };
    for (const row of hierarchyRows(container)) {
      row.addEventListener('pointerenter', event => { if (canHover(event)) moveTo(row); });
      row.addEventListener('focusin', () => moveTo(row));
    }
    container.addEventListener('pointerleave', () => { glass.style.opacity = '0'; });
    container.addEventListener('focusout', event => { if (!container.contains(event.relatedTarget)) glass.style.opacity = '0'; });
  }

  function prepareHierarchyLists(root) {
    root?.querySelectorAll?.('.story-children .result small, .scene-actions li small, .scene-actions li .event-gallery').forEach(node => node.remove());
    root?.querySelectorAll?.('.story-children, .scene-actions').forEach(bindMovingHighlight);
  }

  function clearTimers() {
    for (let i = 0; i < closeTimers.length; i++) {
      clearTimeout(closeTimers[i]);
      closeTimers[i] = null;
    }
    cancelHoverClose();
  }

  function closeFrom(depth = 0, restoreFocus = false) {
    const trigger = cascade[depth]?.trigger;
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
    if (restoreFocus && trigger?.isConnected) trigger.focus();
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
    const rightSpace = vw - parentRect.right - gap, leftSpace = parentRect.left - gap;
    const side = rightSpace >= width || rightSpace >= leftSpace ? 'right' : 'left';
    const available = side === 'right' ? rightSpace : leftSpace;
    if (available < width) width = Math.max(240, Math.min(width, available));
    panel.style.width = `${width}px`;
    panel.dataset.side = side;
    let left = side === 'right' ? parentRect.right + gap : parentRect.left - gap - width;
    left = clamp(left, 12, Math.max(12, vw - width - 12));
    const headerBottom = document.querySelector('.masthead')?.getBoundingClientRect?.().bottom || 86;
    const topLimit = headerBottom + 12, bottomLimit = vh - 132;
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
    const sceneRows = scenes.map(scene => `<button class="result" data-story-scene="${esc(scene.id)}"><strong>${esc(scene.title)}</strong></button>`).join('');
    return {
      label: 'Опис епізоду',
      html: `<div class="preview-top">${cardMetaLine('episode', range.text, range.hasYear)}</div><h2>${esc(episode.title)}</h2>${episode.description ? `<p class="event-text">${esc(episode.description)}</p>` : ''}<p class="scene-location">${countLabel(scenes.length, 'сцена', 'сцени', 'сцен')} · ${actionCount(moments.length)}</p>${sceneRows ? `<div class="story-children">${sceneRows}</div>` : ''}`
    };
  }

  function scenePreviewHtml(id) {
    const scene = sceneMap.get(id);
    if (!scene) return null;
    const group = sceneEvents(id), cast = sceneCast(scene, group), range = storyRange(group.length ? group : [scene]);
    const actions = group.map(event => `<li data-scene-preview="${esc(event.id)}"><div><button class="scene-action-title" aria-haspopup="dialog" aria-label="Переглянути дію: ${esc(event.title)}">${esc(event.title)}</button></div></li>`).join('');
    return {
      label: 'Опис сцени',
      html: `<div class="preview-top">${cardMetaLine('scene', range.text, range.hasYear)}</div><h2>${esc(scene.title)}</h2><button class="scene-context" data-open-scene="${esc(scene.id)}" title="Читати сцену цілком"><span>Сцена · ${actionCount(group.length)}</span>${esc(name(scene.location_id))} <span aria-hidden="true">↗</span></button>${cast.length ? `<div class="people scene-people">${cast.map(entityId => `<button class="person" data-event-focus-character="${esc(entityId)}" aria-label="Зосередитися на лінії ${esc(name(entityId))}" title="Зосередитися на лінії"><span class="swatch" style="background:${color(entityId)}"></span>${esc(name(entityId))}</button>`).join('')}</div>` : ''}${actions ? `<ol class="scene-actions">${actions}</ol>` : ''}`
    };
  }

  function momentPreviewHtml(id) {
    const event = eventMap.get(id);
    if (!event) return null;
    return { label: 'Опис моменту', html: `<div class="preview-top">${cardMetaLine('moment', event.day === null ? 'Без установленої дати' : dateText(event.day, true), event.day !== null)}</div>${eventDetailsHtml(event, 'data-hierarchy-event', false)}` };
  }

  function previewHtml(kind, id) {
    const rendered = kind === 'episode' ? episodePreviewHtml(id) : kind === 'scene' ? scenePreviewHtml(id) : kind === 'moment' ? momentPreviewHtml(id) : null;
    if (rendered) rendered.html = rendered.html.replace('</div>', '<button class="close" data-close-hierarchy aria-label="Закрити перегляд" title="Закрити">×</button></div>');
    return rendered;
  }

  function bindPanelActions(content, depth) {
    content.querySelector('[data-close-hierarchy]')?.addEventListener('click', () => closeFrom(depth, true));
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
      const rect = parentSurface.getBoundingClientRect(), viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      if (Math.max(rect.left - 12, viewportWidth - rect.right - 12) < panelWidth(depth, viewportWidth)) return;
      openPreview(kind, id, parentSurface, trigger, depth, false);
    });
    trigger.addEventListener('pointerleave', () => scheduleClose(depth));
    if (allowPin) trigger.addEventListener('click', event => { event.preventDefault(); openPreview(kind, id, parentSurface, trigger, depth, true); });
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
    prepareHierarchyLists(content);
    bindPanelActions(content, depth);
    bindChildTriggers(content, panel, depth, kind);
    panel.addEventListener('pointerenter', clearTimers);
    panel.addEventListener('pointerleave', () => scheduleClose(depth));
    if (pinned && document.documentElement.dataset.input === 'keyboard') content.querySelector('[data-close-hierarchy]')?.focus();
  }

  function bindRootStoryPreviews() {
    const card = $('eventCard');
    if (card.hidden) return;
    prepareHierarchyLists($('cardContent'));
    bindStoryTriggers($('cardContent'), card, 0);
  }

  showSceneCard = function showSceneCardWithUnifiedRows(scene, group) {
    baseShowSceneCard(scene, group);
    prepareHierarchyLists($('cardContent'));
  };

  bindSceneActionPreviews = function bindSceneActionHierarchyPreviews() {
    baseBindSceneActionPreviews();
    prepareHierarchyLists($('cardContent'));
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

  function abilityRegistry() {
    return new Map((data?.abilities || []).map(ability => [ability.id, ability]));
  }

  function techniqueCard(item, index, registry) {
    const source = registry.get(item.id) || {};
    const ability = { ...source, ...item };
    const classifications = Array.isArray(ability.classification) ? ability.classification : ability.kind ? [ability.kind] : [];
    const facts = [
      ability.mechanics ? ['Принцип', ability.mechanics] : null,
      ability.limitation ? ['Обмеження', ability.limitation] : null
    ].filter(Boolean);
    return `<article class="profile-entry technique-card" data-ability="${esc(ability.id || '')}" tabindex="0"><div class="technique-card-top"><span class="technique-card-index">${String(index + 1).padStart(2, '0')}</span>${ability.rank ? `<span class="technique-card-rank">Ранг ${esc(ability.rank)}</span>` : ''}</div><strong class="technique-card-name">${esc(ability.name || ability.label || ability.id || 'Техніка')}</strong>${ability.romanized_name ? `<p class="technique-card-romanized">${esc(ability.romanized_name)}</p>` : ''}${classifications.length ? `<p class="technique-card-tags">${classifications.map(value => `<span>${esc(value)}</span>`).join('')}</p>` : ''}${ability.summary ? `<p class="technique-card-summary">${esc(ability.summary)}</p>` : ''}${facts.length ? `<dl class="technique-card-facts">${facts.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>` : ''}${item.status ? `<div class="technique-card-status"><span>Статус</span><strong>${esc(item.status)}</strong></div>` : ''}</article>`;
  }

  function bindTechniqueTrack(track) {
    if (!track || track.dataset.techniqueTrackBound === 'true') return;
    track.dataset.techniqueTrackBound = 'true';
    track.tabIndex = 0;
    track.setAttribute('aria-label', 'Картотека технік');
    let drag = null;
    track.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.pointerType === 'touch') return;
      drag = { id: event.pointerId, x: event.clientX, left: track.scrollLeft };
      track.setPointerCapture?.(event.pointerId);
      track.classList.add('is-dragging');
    });
    track.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      if (Math.abs(dx) > 2) event.preventDefault();
      track.scrollLeft = drag.left - dx;
    });
    const end = event => {
      if (!drag || (event?.pointerId !== undefined && drag.id !== event.pointerId)) return;
      drag = null;
      track.classList.remove('is-dragging');
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('lostpointercapture', end);
    track.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const card = track.querySelector('.technique-card');
      const step = card ? card.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0) : track.clientWidth * .8;
      track.scrollBy({ left: event.key === 'ArrowRight' ? step : -step, behavior: 'smooth' });
    });
  }

  function decorateTechniqueCards() {
    const root = $('profileContent');
    if (!root || !profileEntity) return;
    const profile = profileMap.get(profileEntity);
    const versions = profile?.versions?.length ? profile.versions : [{ id: 'general', label: 'Профіль' }];
    const index = Math.max(0, versions.findIndex(version => version.id === profileVersion));
    const version = mergedProfileVersion(versions, index);
    const abilities = version.abilities || [];
    if (!abilities.length) return;
    const section = [...root.querySelectorAll('.profile-section')].find(node => node.querySelector(':scope > h3')?.textContent.trim() === 'Здібності');
    const track = section?.querySelector('.profile-entry-list');
    if (!track) return;
    const registry = abilityRegistry();
    track.classList.add('technique-card-track');
    track.innerHTML = abilities.map((item, abilityIndex) => techniqueCard(item, abilityIndex, registry)).join('');
    bindTechniqueTrack(track);
  }

  renderProfile = function renderProfileWithTechniqueCards() {
    baseRenderProfile();
    decorateTechniqueCards();
  };

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !cascade.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeFrom(cascade.length - 1, true);
  }, true);

  window.addEventListener('resize', () => {
    cascade.forEach((entry, depth) => {
      if (entry?.panel?.isConnected && entry?.parentSurface?.isConnected) positionPanel(entry.panel, entry.parentSurface, depth);
    });
  });
})();
