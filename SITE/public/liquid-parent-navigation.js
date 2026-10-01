'use strict';

(() => {
  const card = document.getElementById('eventCard');
  if (!card) return;

  const baseShowEvent = showEvent;
  const baseShowSceneCard = showSceneCard;
  const baseShowStoryGroup = showStoryGroup;
  const baseCloseCard = closeCard;
  const basePositionCard = positionCard;
  const baseOpenScene = openScene;

  let surface = null;

  const style = document.createElement('style');
  style.textContent = `
    /* Liquid Glass is kept on the floating navigation shell. The reading layer
       stays milky and calm so body copy remains readable over a busy timeline. */
    .event-card,
    .event-preview,
    .hierarchy-preview {
      border: 1px solid rgba(255,255,255,.86);
      background:
        linear-gradient(145deg, rgba(255,255,255,.78), rgba(241,245,249,.60));
      -webkit-backdrop-filter: blur(28px) saturate(1.22);
      backdrop-filter: blur(28px) saturate(1.22);
      box-shadow:
        0 22px 58px rgba(36,48,66,.16),
        0 4px 14px rgba(36,48,66,.08),
        inset 0 1px 0 rgba(255,255,255,.96),
        inset 0 -1px 0 rgba(151,163,180,.16);
    }
    .event-card::before,
    .event-preview::before,
    .hierarchy-preview::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      background:
        radial-gradient(120% 55% at 18% -8%, rgba(255,255,255,.72), transparent 54%),
        linear-gradient(110deg, rgba(255,255,255,.22), transparent 32%, rgba(255,255,255,.10) 68%, transparent);
      opacity: .72;
    }
    #cardContent,
    #eventPreviewContent,
    .hierarchy-preview-content { position: relative; z-index: 1; }
    #cardHeader {
      background: rgba(255,255,255,.34);
      border-bottom-color: rgba(137,150,168,.20);
    }
    #cardScroll {
      background: rgba(249,251,253,.62);
    }
    .event-card .card-arrow,
    .event-card .card-top-actions > .close,
    .event-preview .preview-top > button,
    .hierarchy-preview .preview-top > button,
    .hierarchy-level-up {
      border: 1px solid rgba(255,255,255,.88);
      background: linear-gradient(145deg, rgba(255,255,255,.72), rgba(234,240,247,.52));
      -webkit-backdrop-filter: blur(18px) saturate(1.18);
      backdrop-filter: blur(18px) saturate(1.18);
      box-shadow:
        0 7px 20px rgba(41,52,68,.12),
        inset 0 1px 0 rgba(255,255,255,.96),
        inset 0 -1px 0 rgba(144,157,176,.16);
    }
    .event-card .card-arrow:not(:disabled):hover,
    .event-card .card-top-actions > .close:hover,
    .event-preview .preview-top > button:hover,
    .hierarchy-preview .preview-top > button:hover,
    .hierarchy-level-up:hover {
      background: linear-gradient(145deg, rgba(255,255,255,.88), rgba(228,236,245,.68));
      box-shadow:
        0 9px 24px rgba(41,52,68,.15),
        inset 0 1px 0 rgba(255,255,255,1),
        inset 0 -1px 0 rgba(133,148,169,.18);
    }
    .event-card .person,
    .event-preview .person,
    .hierarchy-preview .person {
      background: rgba(255,255,255,.46);
      border-color: rgba(135,149,168,.25);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.72);
    }
    .hierarchy-level-up {
      position: fixed;
      z-index: calc(var(--z-card) + 1);
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      border-radius: 17px;
      color: #3d4652;
      cursor: pointer;
      touch-action: manipulation;
      transition: transform 150ms cubic-bezier(.2,.8,.2,1), box-shadow 150ms ease, background 150ms ease;
    }
    .hierarchy-level-up[hidden] { display: none !important; }
    .hierarchy-level-up svg {
      width: 20px;
      height: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .hierarchy-level-up:not(:disabled):active { transform: scale(.94); }
    @media (max-width: 760px) {
      .hierarchy-level-up { width: 44px; height: 44px; border-radius: 15px; }
    }
    @media (prefers-reduced-transparency: reduce), (prefers-contrast: more) {
      .event-card, .event-preview, .hierarchy-preview {
        background: rgba(255,255,255,.97);
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        border-color: #b3bcc9;
      }
      #cardScroll { background: #fff; }
      .hierarchy-level-up,
      .event-card .card-arrow,
      .event-card .card-top-actions > .close,
      .event-preview .preview-top > button,
      .hierarchy-preview .preview-top > button {
        background: #fff;
        -webkit-backdrop-filter: none;
        backdrop-filter: none;
        border-color: #b3bcc9;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .hierarchy-level-up { transition: none; }
    }
  `;
  document.head.append(style);

  const up = document.createElement('button');
  up.type = 'button';
  up.className = 'hierarchy-level-up';
  up.hidden = true;
  up.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 14.5 5.5-5.5 5.5 5.5"/><path d="M12 9v8"/></svg>';
  document.body.append(up);

  function normalizeId(kind, value) {
    if (!value) return null;
    const prefix = kind + ':';
    return String(value).startsWith(prefix) ? String(value).slice(prefix.length) : String(value);
  }

  function parentOf(current = surface) {
    if (!current) return null;
    if (current.kind === 'moment') {
      const sceneId = eventMap.get(current.id)?.scene_id;
      return sceneId && sceneMap.has(sceneId) ? { kind: 'scene', id: sceneId, label: 'До сцени' } : null;
    }
    if (current.kind === 'scene') {
      const episodeId = sceneMap.get(current.id)?.episode_id;
      return episodeId && episodeMap.has(episodeId) ? { kind: 'episode', id: episodeId, label: 'До епізоду' } : null;
    }
    if (current.kind === 'episode') {
      const arcId = episodeMap.get(current.id)?.arc_id;
      return arcId && arcMap.has(arcId) ? { kind: 'arc', id: arcId, label: 'До арки' } : null;
    }
    return null;
  }

  function episodePoint(id) {
    const episode = episodeMap.get(id);
    if (!episode) return null;
    const scenes = (episode.scene_ids || []).map(sceneId => sceneMap.get(sceneId)).filter(Boolean);
    const group = scenes.flatMap(scene => sceneEvents(scene.id));
    const days = group.map(event => event.day).filter(day => day !== null);
    return {
      id: 'episode:' + id,
      rawId: id,
      kind: 'episode',
      title: episode.title || id,
      story: episode,
      group,
      day: days.length ? (Math.min(...days) + Math.max(...days)) / 2 : (scenes[0]?.day ?? 0),
      calendarDay: days.length ? Math.floor(Math.min(...days)) : (scenes[0]?.day ?? 0),
      childCount: scenes.length,
      sourceSceneIds: scenes.map(scene => scene.id),
      sourceEpisodeIds: [id]
    };
  }

  function arcPoint(id) {
    const arc = arcMap.get(id);
    if (!arc) return null;
    const episodes = [...episodeMap.values()].filter(episode => episode.arc_id === id);
    const sceneIds = [...new Set(episodes.flatMap(episode => episode.scene_ids || []))];
    const group = sceneIds.flatMap(sceneId => sceneEvents(sceneId));
    const days = group.map(event => event.day).filter(day => day !== null);
    return {
      id: 'arc:' + id,
      rawId: id,
      kind: 'arc',
      title: arc.title || id,
      story: arc,
      group,
      day: days.length ? (Math.min(...days) + Math.max(...days)) / 2 : 0,
      calendarDay: days.length ? Math.floor(Math.min(...days)) : 0,
      childCount: episodes.length,
      sourceSceneIds: sceneIds,
      sourceEpisodeIds: episodes.map(episode => episode.id)
    };
  }

  function positionUp() {
    if (up.hidden || card.hidden) return;
    const rect = card.getBoundingClientRect();
    const size = up.getBoundingClientRect().width || 48;
    const gap = 10;
    const vw = document.documentElement.clientWidth || window.innerWidth;
    let left;
    if (rect.left >= size + gap + 8) left = rect.left - size - gap;
    else if (vw - rect.right >= size + gap + 8) left = rect.right + gap;
    else left = Math.max(8, rect.left + 8);
    const top = Math.max(8, rect.top + 8);
    up.style.left = Math.round(left) + 'px';
    up.style.top = Math.round(top) + 'px';
  }

  function updateUp() {
    const parent = parentOf();
    up.hidden = !parent || card.hidden;
    if (!parent) return;
    up.setAttribute('aria-label', parent.label);
    up.title = parent.label;
    up.dataset.parentKind = parent.kind;
    up.dataset.parentId = parent.id;
    requestAnimationFrame(positionUp);
  }

  function stripModalEntrypoints() {
    card.querySelectorAll('.scene-context, .card-open-scene').forEach(element => element.remove());
  }

  function finishSurface(kind, id) {
    surface = { kind, id: normalizeId(kind, id) };
    stripModalEntrypoints();
    updateUp();
  }

  function openSurface(kind, id) {
    if (!id) return;
    cancelHoverClose();
    closeEventPreview(true);
    hoverCard = false;

    if (kind === 'scene') {
      const scene = sceneMap.get(id);
      if (!scene) return;
      const group = sceneEvents(id);
      showSceneCard(scene, group);
    } else if (kind === 'episode') {
      const point = episodePoint(id);
      if (!point) return;
      showStoryGroup(point);
    } else if (kind === 'arc') {
      const point = arcPoint(id);
      if (!point) return;
      showStoryGroup(point);
    } else return;

    card.hidden = false;
    stripModalEntrypoints();
    updateUp();
    if (document.documentElement.dataset.input === 'keyboard') {
      card.querySelector('.card-top button:not(:disabled)')?.focus();
    }
  }

  showEvent = function showEventWithoutSceneModal(event) {
    baseShowEvent(event);
    finishSurface('moment', event.id);
  };

  showSceneCard = function showSceneCardWithoutModal(scene, group) {
    baseShowSceneCard(scene, group);
    finishSurface('scene', scene.id);
  };

  showStoryGroup = function showStoryGroupWithParentNavigation(point) {
    baseShowStoryGroup(point);
    finishSurface(point.kind, point.rawId || point.id);
  };

  /* Scene reading is now another hierarchy card, not a modal dialog. */
  openScene = function openSceneAsCard(id) {
    if (!sceneMap.has(id)) return;
    if (card.hidden) {
      navigateScene(id);
      return;
    }
    openSurface('scene', id);
  };

  closeCard = function closeCardWithLevelButton(restoreFocus = false) {
    surface = null;
    up.hidden = true;
    return baseCloseCard(restoreFocus);
  };

  positionCard = function positionCardWithLevelButton(point) {
    basePositionCard(point);
    requestAnimationFrame(positionUp);
  };

  up.addEventListener('pointerenter', cancelHoverClose);
  up.addEventListener('pointerleave', deferHoverClose);
  up.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const parent = parentOf();
    if (parent) openSurface(parent.kind, parent.id);
  });

  const resizeObserver = new ResizeObserver(() => positionUp());
  resizeObserver.observe(card);
  window.addEventListener('resize', positionUp);
  document.getElementById('canvas')?.addEventListener('scroll', positionUp, { passive: true });
})();
