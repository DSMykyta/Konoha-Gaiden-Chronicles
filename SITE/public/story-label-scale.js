'use strict';

const StoryTitleScale = (() => {

  const LEVEL_LABELS = {moment: 'Момент', scene: 'Сцена', episode: 'Епізод'};
  const LEVELS = Object.keys(LEVEL_LABELS);

  window.__storyScaleFocus = {
    active: false,
    mode: null,
    key: null,
    eventIds: new Set(),
    characterIds: new Set(),
    cloudKeys: new Set()
  };

  let scaleLevel = null;
  let hoverKey = null;
  let fixedKey = null;
  let hoverSuspended = false;
  let pointerPosition = null;
  let dismissedPointer = null;
  let currentItems = new Map();
  let scaleRoot = null;
  let scaleTrack = null;
  let levelSelect = null;

  function currentSemanticLevel() {
    const level = document.querySelector('.timeline-key [data-level][aria-current="true"]')?.dataset.level;
    return LEVELS.includes(level) ? level : 'episode';
  }

  function eventVisible(event) {
    if (!event) return false;
    if (typeof focusedCharacter !== 'undefined' && focusedCharacter) return event.tracks?.includes(focusedCharacter);
    if (typeof selected === 'undefined' || !(selected instanceof Set)) return true;
    return (event.tracks || []).some(id => selected.has(id));
  }

  function visibleScenes() {
    if (typeof orderedScenes !== 'function') return [];
    return orderedScenes().filter(scene => scene.day !== null && (scene.group || []).some(eventVisible));
  }

  function buildItems(level) {
    const scenes = visibleScenes();
    const items = [];

    if (level === 'moment') {
      const moments = typeof semanticNodes === 'function' ? semanticNodes('moment', scenes) : [];
      for (const node of moments) {
        const events = (node.group || []).filter(eventVisible);
        if (!events.length || node.day === null) continue;
        items.push({key:`moment:${node.id}`,kind:'moment',id:node.id,title:node.title,day:node.day,events});
      }
    } else if (level === 'scene') {
      for (const scene of scenes) {
        const meta = sceneMap?.get(scene.id);
        const events = (scene.group || []).filter(eventVisible);
        if (!events.length || scene.position === null) continue;
        items.push({
          key:`scene:${scene.id}`,
          kind:'scene',
          id:scene.id,
          title:meta?.title || events[0]?.scene_title || scene.id,
          day:scene.position,
          events
        });
      }
    } else {
      const buckets = new Map();
      for (const scene of scenes) {
        const meta = sceneMap?.get(scene.id);
        const episodeId = meta?.episode_id;
        if (!episodeId || !episodeMap?.has(episodeId)) continue;
        if (!buckets.has(episodeId)) buckets.set(episodeId, []);
        buckets.get(episodeId).push(scene);
      }
      for (const [episodeId, episodeScenes] of buckets) {
        const episode = episodeMap.get(episodeId);
        const events = episodeScenes.flatMap(scene => (scene.group || []).filter(eventVisible));
        if (!events.length) continue;
        const days = episodeScenes.map(scene => scene.position).filter(day => day !== null);
        if (!days.length) continue;
        items.push({
          key:`episode:${episodeId}`,
          kind:'episode',
          id:episodeId,
          title:episode?.title || episodeId,
          day:(Math.min(...days)+Math.max(...days))/2,
          events
        });
      }
    }
    return items;
  }

  function layoutItems(items) {
    const [lo, hi] = range();
    return items.filter(item => { const axis=dayToAxis(item.day); return axis>=lo&&axis<hi; })
      .sort((a,b)=>a.day-b.day||a.key.localeCompare(b.key));
  }

  function ensureScale() {
    if (scaleRoot?.isConnected) return;
    scaleRoot = document.createElement('section');
    document.addEventListener('pointermove', event => { pointerPosition = { x:event.clientX, y:event.clientY }; });
    scaleRoot.id = 'storyTitleScale';
    scaleRoot.className = 'story-title-scale';
    scaleRoot.setAttribute('aria-label', 'Шкала назв хронології');

    levelSelect = document.createElement('select');
    levelSelect.id = 'storyTitleLevel';
    levelSelect.className = 'story-title-level';
    levelSelect.setAttribute('aria-label', 'Рівень назв');
    for (const level of LEVELS) {
      const option = document.createElement('option');
      option.value = level;
      option.textContent = LEVEL_LABELS[level];
      levelSelect.append(option);
    }
    levelSelect.addEventListener('change', () => {
      scaleLevel = levelSelect.value;
      hoverKey = null;
      fixedKey = null;
      hoverSuspended = false;
      clearStoryFocus();
      renderScale();
    });

    scaleTrack = document.createElement('div');
    scaleTrack.className = 'story-title-track';
    scaleRoot.append(levelSelect, scaleTrack);
    document.body.append(scaleRoot);
  }

  function relatedNodeIds(item) {
    const eventIds = new Set((item?.events || []).map(event => event.id));
    const ids = new Set();
    for (const node of (typeof graphNodes !== 'undefined' && Array.isArray(graphNodes) ? graphNodes : [])) {
      if ((node.group || []).some(event => eventIds.has(event.id))) ids.add(node.id);
    }
    return ids;
  }

  function relatedCloudKeys(item, nodeIds) {
    const keys = new Set();
    const groups = typeof graphClouds !== 'undefined' && Array.isArray(graphClouds) ? graphClouds : [];
    for (const group of groups) {
      if (item.kind === 'episode') {
        if ((group.kind === 'episode' && group.id === item.id) || (group.kind === 'scene' && group.parentId === item.id)) keys.add(group.key);
        continue;
      }
      if (item.kind === 'scene') {
        if (group.kind === 'scene' && group.id === item.id) keys.add(group.key);
        continue;
      }
      if (group.kind === 'moment' && group.id === item.id) keys.add(group.key);
    }
    if (!keys.size && item.kind !== 'moment') {
      for (const group of groups) if ((group.nodes || []).some(node => nodeIds.has(node.id))) keys.add(group.key);
    }
    return keys;
  }

  function lineLabelCharacterId(element) {
    if (element.dataset.character) return element.dataset.character;
    const text = element.textContent.trim();
    if (typeof entityMap === 'undefined' || !entityMap) return null;
    for (const id of entityMap.keys()) if (name(id) === text || fullName(id) === text) return id;
    return null;
  }

  function scopeVisibility(element, hidden) {
    if (hidden) {
      if (element.hasAttribute('tabindex') && element.dataset.storyTabindex === undefined) element.dataset.storyTabindex = element.getAttribute('tabindex');
      if (element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
      element.setAttribute('aria-hidden', 'true');
      element.dataset.storyHidden = 'true';
    } else if (element.dataset.storyHidden) {
      if (element.dataset.storyTabindex !== undefined) { element.setAttribute('tabindex', element.dataset.storyTabindex); delete element.dataset.storyTabindex; }
      element.removeAttribute('aria-hidden');
      delete element.dataset.storyHidden;
    }
    if (element.classList.contains('story-title-label')) element.inert = hidden;
  }

  function applyDomFocus(item, mode) {
    const timeline = document.getElementById('timeline');
    if (!timeline || !item) return;
    const nodeIds = relatedNodeIds(item);
    const characterIds = new Set((item.events || []).flatMap(event => event.tracks || []));
    const cloudKeys = relatedCloudKeys(item, nodeIds);
    const fixed = mode === 'fixed';

    window.__storyScaleFocus = {
      active:true,
      mode,
      key:item.key,
      eventIds:new Set((item.events || []).map(event => event.id)),
      characterIds,
      cloudKeys
    };

    timeline.querySelectorAll('.node').forEach(element => {
      const related = nodeIds.has(element.dataset.event);
      element.classList.toggle('is-story-scale-hover-muted', !fixed && !related);
      element.classList.toggle('is-story-scale-fixed-hidden', fixed && !related);
      scopeVisibility(element, fixed && !related);
    });
    timeline.querySelectorAll('.node-hit').forEach(element => {
      const related = nodeIds.has(element.dataset.nodeId);
      element.classList.toggle('is-story-scale-hover-muted', !fixed && !related);
      element.classList.toggle('is-story-scale-fixed-hidden', fixed && !related);
      scopeVisibility(element, fixed && !related);
    });
    timeline.querySelectorAll('.thread,.thread-hit,.focus-guest-entry').forEach(element => {
      const related = characterIds.has(element.dataset.character) && (!element.dataset.nodeId || nodeIds.has(element.dataset.nodeId));
      element.classList.toggle('is-story-scale-hover-muted', !fixed && !related);
      element.classList.toggle('is-story-scale-fixed-hidden', fixed && !related);
      scopeVisibility(element, fixed && !related);
    });
    timeline.querySelectorAll('.line-label').forEach(element => {
      const id = lineLabelCharacterId(element);
      const related = id ? characterIds.has(id) : false;
      element.classList.toggle('is-story-scale-hover-muted', !fixed && !related);
      element.classList.toggle('is-story-scale-fixed-hidden', fixed && !related);
      scopeVisibility(element, fixed && !related);
    });

    scaleRoot?.classList.toggle('is-hovering', !fixed);
    scaleRoot?.classList.toggle('is-fixed', fixed);
    scaleRoot?.querySelectorAll('.story-title-label').forEach(label => {
      label.classList.toggle('is-active', label.dataset.storyKey === item.key);
      scopeVisibility(label, fixed && label.dataset.storyKey !== item.key);
    });
    updateFocusBar();
    cloudRenderer?.refresh();
  }

  function clearDomFocusClasses() {
    document.querySelectorAll('#timeline .is-story-scale-hover-muted,#timeline .is-story-scale-fixed-hidden').forEach(element => {
      element.classList.remove('is-story-scale-hover-muted','is-story-scale-fixed-hidden');
      scopeVisibility(element, false);
    });
    scaleRoot?.classList.remove('is-hovering','is-fixed');
    scaleRoot?.querySelectorAll('.story-title-label').forEach(label => { label.classList.remove('is-active'); scopeVisibility(label, false); });
  }

  function clearStoryFocus() {
    if (!window.__storyScaleFocus.active) return;
    clearDomFocusClasses();
    window.__storyScaleFocus = {
      active:false,
      mode:null,
      key:null,
      eventIds:new Set(),
      characterIds:new Set(),
      cloudKeys:new Set()
    };
    updateFocusBar();
    cloudRenderer?.refresh();
  }

  function focusItem(item, mode) {
    clearDomFocusClasses();
    applyDomFocus(item, mode);
  }

  function bindLabel(button, key) {
    const current = () => currentItems.get(key);
    const activateHover = event => {
      if (fixedKey) return;
      if (hoverSuspended && event.type !== 'focus' && dismissedPointer && event.clientX === dismissedPointer.x && event.clientY === dismissedPointer.y) return;
      hoverSuspended = false;
      const item = current(); if (!item) return;
      hoverKey = key;
      focusItem(item,'hover');
    };
    const deactivateHover = () => {
      if (fixedKey || hoverKey !== key) return;
      hoverKey = null;
      clearStoryFocus();
    };
    button.addEventListener('pointerenter', event => { if (canHover(event)) activateHover(event); });
    button.addEventListener('pointermove', event => { if (hoverSuspended && canHover(event)) activateHover(event); });
    button.addEventListener('pointerleave',deactivateHover);
    button.addEventListener('focus', event => { if (document.documentElement.dataset.input === 'keyboard') activateHover(event); });
    button.addEventListener('blur',deactivateHover);
    button.addEventListener('click',event => {
      const item = current(); if (!item) return;
      event.preventDefault();
      event.stopPropagation();
      hoverKey = null;
      if (fixedKey === item.key) {
        StoryTitleScale.clear();
        return;
      }
      if (typeof closeCard === 'function' && document.getElementById('eventCard') && !document.getElementById('eventCard').hidden) closeCard();
      fixedKey = item.key;
      hoverSuspended = false;
      focusItem(item,'fixed');
      focusViewport(item.kind, item.id);
    });
  }

  function renderScale() {
    ensureScale();
    if (!scaleLevel) scaleLevel = currentSemanticLevel();
    if (!LEVELS.includes(scaleLevel)) scaleLevel = 'episode';
    levelSelect.value = scaleLevel;

    const items = layoutItems(buildItems(scaleLevel));
    currentItems = new Map(items.map(item => [item.key,item]));
    const previous = new Map([...scaleTrack.children].map(slot => [slot.dataset.key, slot]));
    previous.forEach((slot, key) => { if (!currentItems.has(key)) { slot.remove(); previous.delete(key); } });
    let cursor = scaleTrack.firstChild;
    for (const item of items) {
      let slot = previous.get(item.key);
      previous.delete(item.key);
      if (!slot) {
        slot = document.createElement('div');
        slot.className = 'story-title-slot';
        slot.dataset.key = item.key;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'story-title-label';
        button.dataset.storyKey = item.key;
        button.textContent = item.title;
        button.dataset.tooltip = item.title;
        button.setAttribute('aria-label',`${LEVEL_LABELS[item.kind]}: ${item.title}`);
        bindLabel(button, item.key);
        slot.append(button);
      }
      if (slot !== cursor) scaleTrack.insertBefore(slot, cursor);
      cursor = slot.nextSibling;
      const button=slot.querySelector('button');
      if(button.textContent!==item.title){button.textContent=item.title;button.dataset.tooltip=item.title;button.setAttribute('aria-label',`${LEVEL_LABELS[item.kind]}: ${item.title}`);}
    }
    previous.forEach(slot => slot.remove());

    const activeKey = fixedKey || hoverKey;
    if (activeKey) {
      const item = currentItems.get(activeKey);
      if (item) focusItem(item,fixedKey ? 'fixed' : 'hover');
      else {
        fixedKey = null;
        hoverKey = null;
        clearStoryFocus();
      }
    } else clearStoryFocus();
  }

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

    zoom = Math.min(MAX_ZOOM, Math.max(zoom, desiredZoom));
    center = clampAxisCenter((first + last) / 2, zoom);

    const canvas = document.getElementById('canvas');
    if (canvas) canvas.scrollTop = 0;
    render();
  }


  return {
    update: renderScale,
    clear() { hoverSuspended = true; dismissedPointer = pointerPosition; fixedKey = null; hoverKey = null; clearStoryFocus(); },
    escape() { if (!fixedKey) return false; this.clear(); return true; },
    dismissTransient() { if (!fixedKey) this.clear(); },
    allows(event) { return window.__storyScaleFocus.mode !== 'fixed' || window.__storyScaleFocus.eventIds.has(event.id); },
    palette(colors, kind, key) {
      const focus = window.__storyScaleFocus;
      if (!focus?.active) return colors;
      if (focus.cloudKeys.has(key)) return {...colors, alpha: Math.min(1, Math.max(colors.alpha, focus.mode === 'fixed' ? .88 : .78))};
      return {...colors, alpha: colors.alpha * (focus.mode === 'fixed' ? .025 : .13)};
    }
  };
})();
