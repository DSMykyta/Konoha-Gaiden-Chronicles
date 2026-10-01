'use strict';

(() => {
  if (typeof StoryClouds === 'undefined') return;

  const LEVEL_LABELS = {moment: 'Момент', scene: 'Сцена', episode: 'Епізод'};
  const LEVELS = Object.keys(LEVEL_LABELS);
  const LARGE_MIN = 96;
  const SMALL_MIN = 76;
  const MAX_WIDTH = 190;
  const GAP = 6;
  const localClamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const basePalette = StoryClouds.palette.bind(StoryClouds);

  window.__storyScaleFocus = {
    active: false,
    mode: null,
    key: null,
    eventIds: new Set(),
    characterIds: new Set(),
    cloudKeys: new Set()
  };

  StoryClouds.palette = function storyScalePalette(kind, key) {
    const colors = basePalette(kind, key);
    const focus = window.__storyScaleFocus;
    if (!focus?.active) return colors;
    if (focus.cloudKeys instanceof Set && focus.cloudKeys.has(key)) {
      return {...colors, alpha: Math.min(1, Math.max(colors.alpha, focus.mode === 'fixed' ? .88 : .78))};
    }
    return {...colors, alpha: colors.alpha * (focus.mode === 'fixed' ? .025 : .13)};
  };

  const baseCreate = StoryClouds.create.bind(StoryClouds);
  StoryClouds.create = function createStoryScaleCloudRenderer(canvas) {
    const renderer = baseCreate(canvas);
    let lastUpdate = null;
    const api = {
      update(next) {
        lastUpdate = {...(lastUpdate || {}), ...next};
        StoryClouds.__lastUpdate = lastUpdate;
        return renderer.update(next);
      },
      scroll(scrollTop) {
        if (lastUpdate) lastUpdate.scrollTop = scrollTop;
        return renderer.scroll(scrollTop);
      },
      refresh() {
        if (lastUpdate) return renderer.update(lastUpdate);
      }
    };
    StoryClouds.__storyLabelRenderer = api;
    return api;
  };

  const style = document.createElement('style');
  style.textContent = `
    .time-axis { bottom: calc(70px + env(safe-area-inset-bottom)) !important; }
    #timeline .cloud-label,
    #timeline .story-scale-label,
    #timeline .moment-inline-label { display: none !important; }

    .story-title-scale {
      position: fixed;
      z-index: var(--z-chrome);
      right: 0;
      bottom: 0;
      left: 0;
      height: calc(76px + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      border-top: 1px solid #dfe3e8c7;
      background: linear-gradient(180deg,#f8fafbd9,#f5f6f8f5 34%,#f5f6f8 100%);
      -webkit-backdrop-filter: blur(16px);
      backdrop-filter: blur(16px);
      overflow: hidden;
    }
    .story-title-level {
      position: absolute;
      z-index: 5;
      top: 20px;
      left: max(12px,env(safe-area-inset-left));
      width: 102px;
      height: 34px;
      padding: 0 28px 0 10px;
      border: 1px solid #d6dbe2;
      border-radius: 9px;
      background: #ffffffed;
      box-shadow: 0 1px 4px #27364c0b;
      color: #3f4854;
      font-size: 11px;
      font-weight: 700;
      appearance: auto;
      cursor: pointer;
    }
    .story-title-track {
      position: absolute;
      inset: 0;
      overflow: visible;
      pointer-events: none;
    }
    .story-title-slot {
      position: absolute;
      top: 0;
      height: 76px;
      overflow: visible;
      pointer-events: none;
    }
    .story-title-slot::before {
      content: '';
      position: absolute;
      top: 0;
      left: var(--story-anchor,50%);
      width: 1px;
      height: 10px;
      background: #aeb6c1;
      transform: translateX(-.5px);
      opacity: .82;
    }
    .story-title-label {
      position: absolute;
      inset: 11px 3px 4px;
      display: -webkit-box;
      width: calc(100% - 6px);
      height: 60px;
      min-width: 0;
      padding: 6px 7px;
      overflow: hidden;
      border-radius: 7px;
      color: #4a5461;
      background: transparent;
      text-align: left;
      white-space: normal;
      text-overflow: clip;
      overflow-wrap: anywhere;
      word-break: normal;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      font-size: 10.5px;
      font-weight: 560;
      line-height: 1.35;
      cursor: pointer;
      pointer-events: auto;
      transition: opacity 150ms ease, background 150ms ease, color 150ms ease, box-shadow 150ms ease;
    }
    .story-title-label:hover,
    .story-title-label:focus-visible,
    .story-title-label.is-active {
      z-index: 4;
      color: #20262e;
      background: #fffffff0;
      box-shadow: 0 2px 9px #27364c12;
    }
    .story-title-scale.is-hovering .story-title-label:not(.is-active) { opacity: .16; }
    .story-title-scale.is-fixed .story-title-label:not(.is-active) {
      opacity: 0;
      pointer-events: none;
    }
    .story-title-label.is-active { font-weight: 760; }

    #timeline .thread,
    #timeline .node,
    #timeline .line-label,
    #timeline .thread-hit,
    #timeline .node-hit { transition: opacity 150ms ease; }
    #timeline .is-story-scale-hover-muted { opacity: .1 !important; }
    #timeline .is-story-scale-fixed-hidden { opacity: 0 !important; pointer-events: none !important; }
    #timeline .thread-hit.is-story-scale-hover-muted,
    #timeline .node-hit.is-story-scale-hover-muted { pointer-events: none; }

    @media (min-width: 1400px) {
      .story-title-label { font-size: 11px; }
    }
    @media (max-width: 760px) {
      .time-axis { bottom: calc(66px + env(safe-area-inset-bottom)) !important; }
      .story-title-scale { height: calc(72px + env(safe-area-inset-bottom)); }
      .story-title-level { width: 90px; top: 18px; left: 8px; padding-left: 8px; font-size: 10px; }
      .story-title-slot { height: 72px; }
      .story-title-label { height: 56px; padding-inline: 5px; font-size: 9.5px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .story-title-label,
      #timeline .thread,
      #timeline .node,
      #timeline .line-label,
      #timeline .thread-hit,
      #timeline .node-hit { transition: none; }
    }
  `;
  document.head.append(style);

  let scaleLevel = null;
  let hoverKey = null;
  let fixedKey = null;
  let currentItems = new Map();
  let scheduled = false;
  let applying = false;
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

  function preferredWidth(title, minimum) {
    const length = String(title || '').trim().length;
    return Math.max(minimum, Math.min(MAX_WIDTH, 74 + Math.sqrt(Math.max(1, length)) * 15));
  }

  function packReadable(entries, width) {
    if (!entries.length) return [];
    const compact = width <= 760;
    const leftBound = compact ? 104 : 122;
    const rightBound = width - (compact ? 6 : 10);
    const available = Math.max(1, rightBound - leftBound);
    const minimum = compact ? SMALL_MIN : LARGE_MIN;
    let widths = entries.map(entry => preferredWidth(entry.title, minimum));
    const gaps = GAP * Math.max(0, entries.length - 1);
    const preferredTotal = widths.reduce((sum, itemWidth) => sum + itemWidth, 0) + gaps;

    if (preferredTotal > available) {
      const usable = Math.max(1, available - gaps);
      const idealTotal = widths.reduce((sum, itemWidth) => sum + itemWidth, 0);
      const scale = usable / idealTotal;
      const hardFloor = Math.max(compact ? 54 : 66, usable / entries.length * .78);
      widths = widths.map(itemWidth => Math.max(hardFloor, itemWidth * scale));
      const total = widths.reduce((sum, itemWidth) => sum + itemWidth, 0);
      if (total > usable) {
        const secondScale = usable / total;
        widths = widths.map(itemWidth => itemWidth * secondScale);
      }
    }

    const positions = [];
    let cursor = leftBound;
    for (let i = 0; i < entries.length; i++) {
      const itemWidth = widths[i];
      const desired = entries[i].x - itemWidth / 2;
      const left = Math.max(cursor, desired);
      positions.push(left);
      cursor = left + itemWidth + GAP;
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

    return entries.map((entry, index) => ({
      ...entry,
      slotLeft: positions[index],
      slotWidth: widths[index],
      anchor: ((entry.x - positions[index]) / Math.max(1, widths[index])) * 100
    }));
  }

  function layoutItems(items) {
    const canvas = document.getElementById('canvas');
    const width = canvas?.clientWidth || window.innerWidth || 1000;
    const pad = width < 600 ? 22 : 48;
    const plot = Math.max(1, width - pad * 2);
    if (typeof range !== 'function' || typeof makeTimeScale !== 'function' || typeof datedEvents !== 'function') return [];
    const [lo, hi] = range();
    const dated = datedEvents();
    const timeScale = makeTimeScale(lo, hi, pad, plot, dated);

    const visible = items
      .filter(item => {
        const axis = dayToAxis(item.day, dated);
        return axis >= lo && axis < hi;
      })
      .map(item => ({...item, x:timeScale.px(item.day)}))
      .sort((a,b) => a.x-b.x || a.key.localeCompare(b.key));

    return packReadable(visible, width);
  }

  function ensureScale() {
    if (scaleRoot?.isConnected) return;
    scaleRoot = document.createElement('section');
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
    const text = element.textContent.trim();
    if (typeof entityMap === 'undefined' || !entityMap) return null;
    for (const id of entityMap.keys()) if (name(id) === text || fullName(id) === text) return id;
    return null;
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
    });
    timeline.querySelectorAll('.node-hit').forEach(element => {
      const related = nodeIds.has(element.dataset.nodeId);
      element.classList.toggle('is-story-scale-hover-muted', !fixed && !related);
      element.classList.toggle('is-story-scale-fixed-hidden', fixed && !related);
    });
    timeline.querySelectorAll('.thread,.thread-hit').forEach(element => {
      const related = characterIds.has(element.dataset.character);
      element.classList.toggle('is-story-scale-hover-muted', !fixed && !related);
      element.classList.toggle('is-story-scale-fixed-hidden', fixed && !related);
    });
    timeline.querySelectorAll('.line-label').forEach(element => {
      const id = lineLabelCharacterId(element);
      const related = id ? characterIds.has(id) : false;
      element.classList.toggle('is-story-scale-hover-muted', !fixed && !related);
      element.classList.toggle('is-story-scale-fixed-hidden', fixed && !related);
    });

    scaleRoot?.classList.toggle('is-hovering', !fixed);
    scaleRoot?.classList.toggle('is-fixed', fixed);
    scaleRoot?.querySelectorAll('.story-title-label').forEach(label => {
      label.classList.toggle('is-active', label.dataset.storyKey === item.key);
    });
    StoryClouds.__storyLabelRenderer?.refresh();
  }

  function clearDomFocusClasses() {
    document.querySelectorAll('#timeline .is-story-scale-hover-muted,#timeline .is-story-scale-fixed-hidden').forEach(element => {
      element.classList.remove('is-story-scale-hover-muted','is-story-scale-fixed-hidden');
    });
    scaleRoot?.classList.remove('is-hovering','is-fixed');
    scaleRoot?.querySelectorAll('.story-title-label.is-active').forEach(label => label.classList.remove('is-active'));
  }

  function clearStoryFocus() {
    clearDomFocusClasses();
    window.__storyScaleFocus = {
      active:false,
      mode:null,
      key:null,
      eventIds:new Set(),
      characterIds:new Set(),
      cloudKeys:new Set()
    };
    StoryClouds.__storyLabelRenderer?.refresh();
  }

  function focusItem(item, mode) {
    clearDomFocusClasses();
    applyDomFocus(item, mode);
  }

  function bindLabel(button, item) {
    const activateHover = () => {
      if (fixedKey) return;
      hoverKey = item.key;
      focusItem(item,'hover');
    };
    const deactivateHover = () => {
      if (fixedKey || hoverKey !== item.key) return;
      hoverKey = null;
      clearStoryFocus();
    };
    button.addEventListener('pointerenter',activateHover);
    button.addEventListener('pointerleave',deactivateHover);
    button.addEventListener('focus',activateHover);
    button.addEventListener('blur',deactivateHover);
    button.addEventListener('click',event => {
      event.preventDefault();
      event.stopPropagation();
      hoverKey = null;
      if (fixedKey === item.key) {
        fixedKey = null;
        clearStoryFocus();
        return;
      }
      if (typeof closeCard === 'function' && document.getElementById('eventCard') && !document.getElementById('eventCard').hidden) closeCard();
      fixedKey = item.key;
      focusItem(item,'fixed');
    });
  }

  function renderScale() {
    ensureScale();
    if (!scaleLevel) scaleLevel = currentSemanticLevel();
    if (!LEVELS.includes(scaleLevel)) scaleLevel = 'episode';
    levelSelect.value = scaleLevel;

    const items = layoutItems(buildItems(scaleLevel));
    currentItems = new Map(items.map(item => [item.key,item]));
    scaleTrack.replaceChildren();

    for (const item of items) {
      const slot = document.createElement('div');
      slot.className = 'story-title-slot';
      slot.style.left = `${item.slotLeft}px`;
      slot.style.width = `${item.slotWidth}px`;
      slot.style.setProperty('--story-anchor',`${item.anchor}%`);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'story-title-label';
      button.dataset.storyKey = item.key;
      button.title = item.title;
      button.textContent = item.title;
      button.setAttribute('aria-label',`${LEVEL_LABELS[item.kind]}: ${item.title}`);
      bindLabel(button,item);
      slot.append(button);
      scaleTrack.append(slot);
    }

    document.querySelectorAll('#timeline .cloud-label,#timeline .story-scale-label,#timeline .moment-inline-label').forEach(node => node.remove());

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

  function scheduleRenderScale() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (applying) return;
      applying = true;
      try { renderScale(); }
      finally { applying = false; }
    });
  }

  function init() {
    ensureScale();
    scaleLevel = currentSemanticLevel();
    levelSelect.value = scaleLevel;

    const timeline = document.getElementById('timeline');
    if (timeline) new MutationObserver(scheduleRenderScale).observe(timeline,{childList:true});

    if (typeof render === 'function') {
      const baseRender = render;
      render = function renderWithStoryTitleScale() {
        const result = baseRender.apply(this,arguments);
        scheduleRenderScale();
        return result;
      };
    }

    document.addEventListener('keydown',event => {
      if (event.key !== 'Escape' || !fixedKey) return;
      fixedKey = null;
      hoverKey = null;
      clearStoryFocus();
    });
    window.addEventListener('resize',scheduleRenderScale);
    scheduleRenderScale();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
