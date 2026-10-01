'use strict';

(() => {
  const MIN_VIEW_DAYS = {
    episode: 2.5,
    scene: 1,
    moment: .65
  };
  const PADDING = {
    episode: 1.4,
    scene: 1.25,
    moment: 1
  };
  const MAX_ZOOM = 730;

  function parseStoryKey(key) {
    const separator = String(key || '').indexOf(':');
    if (separator < 1) return null;
    return {
      kind: key.slice(0, separator),
      id: key.slice(separator + 1)
    };
  }

  function chronologyPositions(kind, id) {
    if (typeof orderedScenes !== 'function') return [];
    const scenes = orderedScenes().filter(scene => scene.day !== null);

    if (kind === 'episode') {
      return scenes
        .filter(scene => sceneMap?.get(scene.id)?.episode_id === id)
        .map(scene => scene.position ?? scene.day + .5)
        .filter(Number.isFinite);
    }

    if (kind === 'scene') {
      const scene = scenes.find(item => item.id === id);
      const position = scene?.position ?? (scene?.day !== null && scene?.day !== undefined ? scene.day + .5 : null);
      return Number.isFinite(position) ? [position] : [];
    }

    if (kind === 'moment') {
      if (typeof semanticNodes === 'function') {
        const node = semanticNodes('moment', scenes).find(item => item.id === id);
        if (Number.isFinite(node?.day)) return [node.day];
      }
      const event = eventMap?.get(id);
      return Number.isFinite(event?.day) ? [event.day + .5] : [];
    }

    return [];
  }

  function focusViewport(kind, id) {
    if (!MIN_VIEW_DAYS[kind]) return;
    if (typeof dayToAxis !== 'function' || typeof clampAxisCenter !== 'function' || typeof render !== 'function') return;

    const positions = chronologyPositions(kind, id);
    if (!positions.length) return;

    const axes = positions.map(day => dayToAxis(day)).filter(Number.isFinite);
    if (!axes.length) return;

    const first = Math.min(...axes);
    const last = Math.max(...axes);
    const span = Math.max(0, last - first);
    const visibleSpan = Math.max(MIN_VIEW_DAYS[kind], span * PADDING[kind]);
    const desiredZoom = Math.min(MAX_ZOOM, 365 / Math.max(.5, visibleSpan));

    // Concentration should only move closer. If the user is already closer,
    // keep their scale and only center the selected story object.
    zoom = Math.min(MAX_ZOOM, Math.max(zoom, desiredZoom));
    center = clampAxisCenter((first + last) / 2, zoom);

    const canvas = document.getElementById('canvas');
    if (canvas) canvas.scrollTop = 0;
    render();
  }

  document.addEventListener('click', event => {
    const label = event.target instanceof Element ? event.target.closest('.story-title-label[data-story-key]') : null;
    if (!label) return;

    const key = label.dataset.storyKey;
    const target = parseStoryKey(key);
    if (!target) return;

    // story-label-scale owns the actual fixed-focus toggle. Run after its click
    // handler, then zoom only if this click really ended in fixed concentration.
    requestAnimationFrame(() => {
      const focus = window.__storyScaleFocus;
      if (!focus?.active || focus.mode !== 'fixed' || focus.key !== key) return;
      focusViewport(target.kind, target.id);
    });
  }, true);
})();
