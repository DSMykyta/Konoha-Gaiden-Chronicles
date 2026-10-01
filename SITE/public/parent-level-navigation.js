'use strict';

(() => {
  let parentTarget = null;
  let parentButton = null;
  let resizeObserver = null;

  const style = document.createElement('style');
  style.textContent = `
    /* Parent navigation is an external control, never an inline content block. */
    .scene-context,
    .card-open-scene {
      display: none !important;
    }

    .card-parent-level-button {
      position: fixed;
      z-index: calc(var(--z-card, 40) + 3);
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      min-width: 36px;
      min-height: 36px;
      padding: 0;
      border: 1px solid rgba(255,255,255,.94);
      border-radius: 999px;
      background: linear-gradient(145deg,rgba(255,255,255,.88),rgba(225,234,245,.48));
      -webkit-backdrop-filter: blur(14px) saturate(1.16);
      backdrop-filter: blur(14px) saturate(1.16);
      box-shadow: inset 0 1px 0 #fff, inset 0 -1px 0 rgba(132,148,169,.12), 0 5px 16px rgba(42,54,70,.14);
      color: #596575;
      cursor: pointer;
      opacity: 0;
      transform: translateY(2px);
      transition: opacity .14s ease, transform .14s ease, background .14s ease, box-shadow .14s ease;
    }
    .card-parent-level-button.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
    .card-parent-level-button:hover,
    .card-parent-level-button:focus-visible {
      color: #20262e;
      background: linear-gradient(145deg,rgba(255,255,255,.98),rgba(229,237,246,.66));
      box-shadow: inset 0 1px 0 #fff, 0 7px 18px rgba(42,54,70,.17);
    }
    .card-parent-level-button svg {
      width: 17px;
      height: 17px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    @media (max-width: 760px) {
      .card-parent-level-button {
        width: 34px;
        height: 34px;
        min-width: 34px;
        min-height: 34px;
      }
    }
  `;
  document.head.append(style);

  function ensureButton() {
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
    document.body.append(parentButton);
    return parentButton;
  }

  function labelFor(kind) {
    return ({scene:'До сцени', episode:'До епізоду', arc:'До арки'})[kind] || 'Рівнем вище';
  }

  function setParentTarget(target) {
    parentTarget = target || null;
    const button = ensureButton();
    if (!parentTarget) {
      button.classList.remove('is-visible');
      button.tabIndex = -1;
      return;
    }
    const label = labelFor(parentTarget.kind);
    button.setAttribute('aria-label', label);
    button.title = label;
    button.tabIndex = 0;
    requestAnimationFrame(() => {
      positionButton();
      button.classList.add('is-visible');
    });
  }

  function positionButton() {
    if (!parentButton || !parentTarget) return;
    const card = document.getElementById('eventCard');
    if (!card || card.hidden) {
      parentButton.classList.remove('is-visible');
      return;
    }
    const rect = card.getBoundingClientRect();
    const size = parentButton.offsetWidth || 36;
    const gap = 9;
    let left = rect.left - size - gap;
    let top = rect.top + 8;

    // Prefer the outer edge. On a narrow viewport keep it at the card edge,
    // but never turn it back into an inline content control.
    if (left < 8) left = Math.max(8, rect.left + 8);
    top = Math.max(8, Math.min(window.innerHeight - size - 8, top));

    parentButton.style.left = `${Math.round(left)}px`;
    parentButton.style.top = `${Math.round(top)}px`;
  }

  function episodeParentArc(episodeId) {
    const episode = episodeMap?.get?.(episodeId);
    return episode?.arc_id || null;
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
    if (typeof revealReadingNode === 'function') revealReadingNode();
    if (typeof focusReadingCard === 'function') focusReadingCard();
    requestAnimationFrame(positionButton);
  }

  function replaceWithScene(id) {
    const scene = sceneMap?.get?.(id);
    if (!scene) return;
    const group = sceneEvents(id);
    if (!group.length) return;

    zoom = zoomModes.week;
    if (scene.day !== null && scene.day !== undefined) {
      center = clampAxisCenter(dayToAxis(scene.day + .5));
    }

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
    if (positions.length) {
      center = clampAxisCenter(dayToAxis((Math.min(...positions) + Math.max(...positions)) / 2));
    }

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
    if (positions.length) {
      center = clampAxisCenter(dayToAxis((Math.min(...positions) + Math.max(...positions)) / 2));
    }

    pinCard(point.id, () => showStoryGroup(point));
  }

  function navigateParent(target) {
    if (!target) return;
    if (target.kind === 'scene') return replaceWithScene(target.id);
    if (target.kind === 'episode') return replaceWithEpisode(target.id);
    if (target.kind === 'arc') return replaceWithArc(target.id);
  }

  // Remove the old full-scene modal behavior globally. Every old call to
  // openScene now replaces the current card with the scene-level card.
  openScene = function openSceneAsParentCard(id) {
    replaceWithScene(id);
  };

  const baseShowEvent = showEvent;
  showEvent = function showEventWithParentLevel(event) {
    const result = baseShowEvent.apply(this, arguments);
    const sceneId = event?.scene_id || null;
    setParentTarget(sceneId ? {kind:'scene', id:sceneId} : null);
    return result;
  };

  const baseShowSceneCard = showSceneCard;
  showSceneCard = function showSceneCardWithParentLevel(scene, group) {
    const result = baseShowSceneCard.apply(this, arguments);
    const episodeId = scene?.episode_id || null;
    setParentTarget(episodeId ? {kind:'episode', id:episodeId} : null);
    return result;
  };

  const baseShowStoryGroup = showStoryGroup;
  showStoryGroup = function showStoryGroupWithParentLevel(point) {
    const result = baseShowStoryGroup.apply(this, arguments);
    if (point?.kind === 'episode') {
      const episodeId = point.rawId || point.story?.id || null;
      const arcId = episodeParentArc(episodeId);
      setParentTarget(arcId ? {kind:'arc', id:arcId} : null);
    } else {
      setParentTarget(null);
    }
    return result;
  };

  const baseCloseCard = closeCard;
  closeCard = function closeCardWithParentLevel() {
    setParentTarget(null);
    return baseCloseCard.apply(this, arguments);
  };

  // Keep the floating parent control attached to the card while the reading
  // layout moves vertically or the viewport changes.
  const baseRender = render;
  render = function renderWithParentLevelButton() {
    const result = baseRender.apply(this, arguments);
    requestAnimationFrame(positionButton);
    return result;
  };

  window.addEventListener('resize', positionButton);
  document.getElementById('canvas')?.addEventListener('scroll', positionButton, {passive:true});

  const card = document.getElementById('eventCard');
  if (card && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(positionButton);
    resizeObserver.observe(card);
  }
})();
