'use strict';

(() => {
  const PANEL_WIDTH = 390;
  const PANEL_GAP = 12;
  const VIEWPORT_GUTTER = 12;
  let parentTarget = null;
  let parentButton = null;
  let tooltip = null;
  let tooltipTarget = null;
  let reflowRaf = 0;

  const style = document.createElement('style');
  style.textContent = `
    /* All story panels share one compact width and one continuous cascade. */
    .story-panel,
    .event-card,
    .event-preview {
      width: min(${PANEL_WIDTH}px, calc(100vw - 24px)) !important;
      max-width: calc(100vw - 24px) !important;
    }

    /* Redundant scene context/open-scene block is not shown in card hierarchy. */
    .scene-context,
    .card-open-scene {
      display: none !important;
    }

    /* Parent navigation belongs to the panel header, never outside the card. */
    .card-parent-level-button {
      position: static !important;
      inset: auto !important;
      margin: 0 !important;
      opacity: 1 !important;
      transform: none !important;
    }
    .card-parent-level-button[hidden] { display: none !important; }

    /* These detail accordions duplicate information already visible in the card. */
    .event-card .disclosure,
    .event-preview .disclosure,
    .hierarchy-preview .disclosure {
      display: none !important;
    }

    /* One restrained scrollbar treatment across reading surfaces. */
    :where(.event-card,.event-preview,.panel,.profile-dialog,.scene-dialog,.character-events-dialog,#cardScroll,.hierarchy-preview-content,.technique-card-track) {
      scrollbar-width: thin;
      scrollbar-color: rgba(102,116,134,.34) transparent;
    }
    :where(.event-card,.event-preview,.panel,.profile-dialog,.scene-dialog,.character-events-dialog,#cardScroll,.hierarchy-preview-content,.technique-card-track)::-webkit-scrollbar {
      width: 7px;
      height: 7px;
    }
    :where(.event-card,.event-preview,.panel,.profile-dialog,.scene-dialog,.character-events-dialog,#cardScroll,.hierarchy-preview-content,.technique-card-track)::-webkit-scrollbar-track {
      background: transparent;
    }
    :where(.event-card,.event-preview,.panel,.profile-dialog,.scene-dialog,.character-events-dialog,#cardScroll,.hierarchy-preview-content,.technique-card-track)::-webkit-scrollbar-thumb {
      border: 2px solid transparent;
      border-radius: 99px;
      background: rgba(102,116,134,.30);
      background-clip: padding-box;
    }
    :where(.event-card,.event-preview,.panel,.profile-dialog,.scene-dialog,.character-events-dialog,#cardScroll,.hierarchy-preview-content,.technique-card-track)::-webkit-scrollbar-thumb:hover {
      background: rgba(102,116,134,.46);
      background-clip: padding-box;
    }

    .glass-tooltip {
      position: fixed;
      z-index: 9999;
      max-width: 260px;
      padding: 6px 9px;
      border: 1px solid rgba(255,255,255,.92);
      border-radius: 9px;
      background: linear-gradient(145deg,rgba(255,255,255,.84),rgba(230,237,246,.56));
      -webkit-backdrop-filter: blur(14px) saturate(1.08);
      backdrop-filter: blur(14px) saturate(1.08);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.96),0 5px 16px rgba(40,53,70,.12);
      color: #4f5a68;
      font: 500 10.5px/1.35 Manrope,sans-serif;
      pointer-events: none;
      opacity: 0;
      transform: translateY(3px);
      transition: opacity .12s ease,transform .12s ease;
    }
    .glass-tooltip.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.head.append(style);

  function ensureParentButton() {
    if (parentButton?.isConnected) return parentButton;
    parentButton = document.createElement('button');
    parentButton.type = 'button';
    parentButton.className = 'card-parent-level-button';
    parentButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 7-6 5 6 5"/><path d="M10 12h7"/></svg>';
    parentButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (parentTarget) navigateParent(parentTarget);
    });
    return parentButton;
  }

  function labelFor(kind) {
    return ({scene:'До сцени',episode:'До епізоду',arc:'До арки'})[kind] || 'Рівнем вище';
  }

  function childCascadeOpen() {
    return Boolean(document.querySelector('.hierarchy-preview.is-visible')) || Boolean(document.querySelector('#eventPreview:not([hidden])'));
  }

  function attachParentButton() {
    const button = ensureParentButton();
    const card = document.getElementById('eventCard');
    if (!card || card.hidden || !parentTarget || childCascadeOpen()) {
      button.hidden = true;
      return;
    }
    const header = card.querySelector('.story-panel-header,.card-top,.preview-top');
    if (!header) {
      button.hidden = true;
      return;
    }
    let actions = header.querySelector('.card-top-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'card-top-actions';
      const controls = [...header.children].filter(node => node.matches?.('.close,.card-arrow,.card-open-scene'));
      controls.forEach(node => actions.append(node));
      header.append(actions);
    }
    if (button.parentElement !== actions) actions.prepend(button);
    const label = labelFor(parentTarget.kind);
    button.dataset.tooltip = label;
    button.setAttribute('aria-label', label);
    button.removeAttribute('title');
    button.hidden = false;
  }

  function setParentTarget(target) {
    parentTarget = target || null;
    requestAnimationFrame(attachParentButton);
  }

  function episodeParentArc(episodeId) {
    return episodeMap?.get?.(episodeId)?.arc_id || null;
  }

  function visibleStoryScenes() {
    return typeof orderedScenes === 'function' ? orderedScenes().filter(scene => scene.day !== null) : [];
  }

  function pinCard(focusKey, drawCard) {
    closeCard();
    focusId = focusKey;
    pinnedNodeId = focusKey;
    anchorEvent = null;
    drawCard();
    const card = document.getElementById('eventCard');
    if (card) card.hidden = false;
    render();
    requestAnimationFrame(() => {
      if (typeof revealReadingNode === 'function') revealReadingNode();
      if (typeof focusReadingCard === 'function') focusReadingCard();
      attachParentButton();
      scheduleCascadeReflow();
    });
  }

  function replaceWithScene(id) {
    const scene = sceneMap?.get?.(id);
    if (!scene) return;
    const group = sceneEvents(id);
    if (!group.length) return;
    zoom = zoomModes.week;
    if (scene.day !== null && scene.day !== undefined) center = clampAxisCenter(dayToAxis(scene.day + .5));
    pinCard(id, () => showSceneCard(scene, group));
  }

  function episodePoint(id) {
    const episode = episodeMap?.get?.(id);
    if (!episode) return null;
    const scenes = visibleStoryScenes().filter(scene => sceneMap?.get?.(scene.id)?.episode_id === id);
    if (!scenes.length) return null;
    const group = scenes.flatMap(scene => scene.group || []);
    const positions = scenes.map(scene => scene.position ?? scene.day).filter(Number.isFinite);
    const day = positions.length ? (Math.min(...positions) + Math.max(...positions)) / 2 : scenes[0].day;
    return {
      id:`episode:${id}`,
      rawId:id,
      kind:'episode',
      title:episode.title || id,
      story:episode,
      group,
      day,
      calendarDay:scenes[0].day,
      childCount:scenes.length,
      sourceSceneIds:scenes.map(scene => scene.id),
      sourceEpisodeIds:[id],
      scenes
    };
  }

  function replaceWithEpisode(id) {
    const point = episodePoint(id);
    if (!point) return;
    const positions = point.scenes.map(scene => scene.position ?? scene.day).filter(Number.isFinite);
    zoom = zoomModes.month;
    if (positions.length) center = clampAxisCenter(dayToAxis((Math.min(...positions) + Math.max(...positions)) / 2));
    pinCard(point.id, () => showStoryGroup(point));
  }

  function arcPoint(id) {
    const arc = arcMap?.get?.(id);
    if (!arc) return null;
    const episodes = [...episodeMap.values()].filter(episode => episode?.arc_id === id);
    const episodeIds = new Set(episodes.map(episode => episode.id));
    const scenes = visibleStoryScenes().filter(scene => episodeIds.has(sceneMap?.get?.(scene.id)?.episode_id));
    if (!scenes.length) return null;
    const group = scenes.flatMap(scene => scene.group || []);
    const positions = scenes.map(scene => scene.position ?? scene.day).filter(Number.isFinite);
    const day = positions.length ? (Math.min(...positions) + Math.max(...positions)) / 2 : scenes[0].day;
    return {
      id:`arc:${id}`,
      rawId:id,
      kind:'arc',
      title:arc.title || id,
      story:arc,
      group,
      day,
      calendarDay:scenes[0].day,
      childCount:episodes.length,
      sourceSceneIds:scenes.map(scene => scene.id),
      sourceEpisodeIds:episodes.map(episode => episode.id)
    };
  }

  function replaceWithArc(id) {
    const point = arcPoint(id);
    if (!point) return;
    const positions = point.sourceSceneIds
      .map(sceneId => visibleStoryScenes().find(scene => scene.id === sceneId))
      .filter(Boolean)
      .map(scene => scene.position ?? scene.day)
      .filter(Number.isFinite);
    zoom = zoomModes.year;
    if (positions.length) center = clampAxisCenter(dayToAxis((Math.min(...positions) + Math.max(...positions)) / 2));
    pinCard(point.id, () => showStoryGroup(point));
  }

  function navigateParent(target) {
    if (!target) return;
    if (target.kind === 'scene') return replaceWithScene(target.id);
    if (target.kind === 'episode') return replaceWithEpisode(target.id);
    if (target.kind === 'arc') return replaceWithArc(target.id);
  }

  openScene = function openSceneAsParentCard(id) {
    replaceWithScene(id);
  };

  const baseShowEvent = showEvent;
  showEvent = function showEventWithParentLevel(event) {
    const result = baseShowEvent.apply(this, arguments);
    const sceneId = event?.scene_id || null;
    setParentTarget(sceneId ? {kind:'scene',id:sceneId} : null);
    return result;
  };

  const baseShowSceneCard = showSceneCard;
  showSceneCard = function showSceneCardWithParentLevel(scene, group) {
    const result = baseShowSceneCard.apply(this, arguments);
    const episodeId = scene?.episode_id || null;
    setParentTarget(episodeId ? {kind:'episode',id:episodeId} : null);
    return result;
  };

  const baseShowStoryGroup = showStoryGroup;
  showStoryGroup = function showStoryGroupWithParentLevel(point) {
    const result = baseShowStoryGroup.apply(this, arguments);
    if (point?.kind === 'episode') {
      const episodeId = point.rawId || point.story?.id || null;
      const arcId = episodeParentArc(episodeId);
      setParentTarget(arcId ? {kind:'arc',id:arcId} : null);
    } else {
      setParentTarget(null);
    }
    return result;
  };

  const baseCloseCard = closeCard;
  closeCard = function closeCardWithParentLevel() {
    setParentTarget(null);
    parentButton?.remove();
    parentButton = null;
    return baseCloseCard.apply(this, arguments);
  };

  function visualLeft(surface) {
    return surface.getBoundingClientRect().left;
  }

  function setVisualLeft(surface, targetLeft) {
    const rect = surface.getBoundingClientRect();
    const current = parseFloat(surface.style.left);
    if (!Number.isFinite(current)) return;
    surface.style.left = `${current + targetLeft - rect.left}px`;
  }

  function visibleCascadePanels() {
    const root = document.getElementById('eventCard');
    if (!root || root.hidden) return [];
    const hierarchy = [...document.querySelectorAll('.hierarchy-preview.is-visible')]
      .sort((a,b) => Number(a.dataset.hierarchyDepth || 0) - Number(b.dataset.hierarchyDepth || 0));
    const preview = document.getElementById('eventPreview');
    const panels = [root, ...hierarchy];
    if (preview && !preview.hidden && !preview.classList.contains('hierarchy-preview') && !panels.includes(preview)) panels.push(preview);
    return panels;
  }

  function reflowCascade() {
    const panels = visibleCascadePanels();
    if (!panels.length) return;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const widths = panels.map(panel => panel.getBoundingClientRect().width || PANEL_WIDTH);
    const total = widths.reduce((sum,width) => sum + width,0) + PANEL_GAP * Math.max(0,panels.length - 1);
    const rootLeft = visualLeft(panels[0]);
    const maxStart = Math.max(VIEWPORT_GUTTER, vw - VIEWPORT_GUTTER - total);
    let x = Math.max(VIEWPORT_GUTTER, Math.min(rootLeft, maxStart));
    panels.forEach((panel,index) => {
      setVisualLeft(panel, x);
      x += widths[index] + PANEL_GAP;
    });
  }

  function scheduleCascadeReflow() {
    cancelAnimationFrame(reflowRaf);
    reflowRaf = requestAnimationFrame(() => requestAnimationFrame(reflowCascade));
  }

  function syncGlass(container) {
    const glass = container?.querySelector(':scope > .hierarchy-hover-glass');
    if (!glass) return;
    const activeRow = container.querySelector(':scope > .is-preview-active');
    if (!activeRow) {
      glass.style.opacity = '0';
      return;
    }
    glass.style.transform = `translate3d(0,${activeRow.offsetTop}px,0)`;
    glass.style.height = `${activeRow.offsetHeight}px`;
    glass.style.opacity = '1';
  }

  document.addEventListener('pointerout', event => {
    const container = event.target instanceof Element ? event.target.closest('.story-children,.scene-actions') : null;
    if (!container) return;
    if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) return;
    requestAnimationFrame(() => syncGlass(container));
  }, true);

  const observer = new MutationObserver(mutations => {
    let needsReflow = false;
    for (const mutation of mutations) {
      if (mutation.type === 'childList') needsReflow = true;
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target;
        const container = target instanceof Element ? target.closest('.story-children,.scene-actions') : null;
        if (container) requestAnimationFrame(() => syncGlass(container));
        if (target instanceof Element && (target.matches('.hierarchy-preview,.event-preview,.event-card') || target.closest('.hierarchy-preview,.event-preview,.event-card'))) needsReflow = true;
      }
    }
    if (needsReflow) {
      requestAnimationFrame(attachParentButton);
      scheduleCascadeReflow();
    }
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});

  function ensureTooltip() {
    if (tooltip?.isConnected) return tooltip;
    tooltip = document.createElement('div');
    tooltip.className = 'glass-tooltip';
    tooltip.setAttribute('role','tooltip');
    document.body.append(tooltip);
    return tooltip;
  }

  function tooltipTrigger(target) {
    return target instanceof Element ? target.closest('[data-tooltip],button[title]') : null;
  }

  function tooltipText(target) {
    if (!target) return '';
    const text = target.dataset.tooltip || target.dataset.glassTooltip || target.getAttribute('title') || '';
    const title = target.getAttribute('title');
    if (title) {
      target.dataset.glassTooltip = title;
      target.removeAttribute('title');
    }
    return text;
  }

  function placeTooltip(target) {
    if (!tooltip || !target) return;
    const rect = target.getBoundingClientRect();
    const tip = tooltip.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || innerWidth;
    const vh = document.documentElement.clientHeight || innerHeight;
    let left = rect.left + rect.width / 2 - tip.width / 2;
    let top = rect.bottom + 8;
    left = Math.max(8,Math.min(vw - tip.width - 8,left));
    if (top + tip.height > vh - 8) top = rect.top - tip.height - 8;
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(Math.max(8,top))}px`;
  }

  document.addEventListener('pointerover', event => {
    const target = tooltipTrigger(event.target);
    if (!target || !canHover(event)) return;
    if (tooltipTarget === target) return;
    const text = tooltipText(target);
    if (!text) return;
    tooltipTarget = target;
    const tip = ensureTooltip();
    tip.textContent = text;
    requestAnimationFrame(() => {
      placeTooltip(target);
      tip.classList.add('is-visible');
    });
  },true);

  document.addEventListener('pointerout', event => {
    if (!tooltipTarget) return;
    if (event.relatedTarget instanceof Node && tooltipTarget.contains(event.relatedTarget)) return;
    const target = tooltipTrigger(event.target);
    if (target !== tooltipTarget) return;
    tooltip?.classList.remove('is-visible');
    tooltipTarget = null;
  },true);

  const baseRender = render;
  render = function renderWithParentLevelButton() {
    const result = baseRender.apply(this, arguments);
    requestAnimationFrame(() => {
      attachParentButton();
      scheduleCascadeReflow();
    });
    return result;
  };

  window.addEventListener('resize',scheduleCascadeReflow);
})();