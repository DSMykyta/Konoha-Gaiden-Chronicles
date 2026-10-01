'use strict';

(() => {
  let active = false;
  let focusedEventIds = new Set();
  let focusedCharacters = new Set();
  let hoveredCharacter = null;
  let lastLayoutFocus = null;

  const style = document.createElement('style');
  style.textContent = `
    #timeline .thread,
    #timeline .node,
    #timeline .cloud-label,
    #timeline .line-label {
      transition: opacity 180ms ease;
    }
    #timeline .thread.is-context-muted { opacity: .07 !important; }
    #timeline .thread.is-character-hover-muted { opacity: .055 !important; }
    #timeline .thread.is-character-hover-active { opacity: 1 !important; stroke-width: 3px; }
    #timeline .node.is-context-muted { opacity: .14; }
    #timeline .cloud-label.is-context-muted,
    #timeline .line-label.is-context-muted { opacity: .14; }
    #timeline .line-label.is-character-hover-muted { opacity: .08 !important; }
    #timeline .line-label.is-character-hover-active { opacity: 1 !important; }

    /* Single-character concentration is one story lane, never an overview. */
    #timeline.is-single-character-focus .thread.is-single-focus-hidden,
    #timeline.is-single-character-focus .thread-hit.is-single-focus-hidden,
    #timeline.is-single-character-focus .line-label.is-single-focus-hidden {
      display: none !important;
    }
    #timeline .focus-guest-entry {
      pointer-events: none;
      fill: none;
      stroke-linecap: round;
      stroke-width: 1.8;
    }

    @media (prefers-reduced-motion: reduce) {
      #timeline .thread,
      #timeline .node,
      #timeline .cloud-label,
      #timeline .line-label { transition: none; }
    }
  `;
  document.head.append(style);

  const basePalette = StoryClouds.palette.bind(StoryClouds);
  StoryClouds.palette = function focusedCloudPalette(kind, key) {
    const colors = basePalette(kind, key);
    const focus = window.__timelineSelectionFocus;
    const activeKeys = window.__timelineActiveCloudKeys;
    if (!focus?.enabled || !(activeKeys instanceof Set) || activeKeys.has(key)) return colors;
    return { ...colors, alpha: colors.alpha * .16 };
  };

  /* Single-character concentration is a true straight lane. */
  const baseSeparateNodes = TimelineCore.separateNodes.bind(TimelineCore);
  TimelineCore.separateNodes = function separateNodesWithFocusedLane(nodes, top, bottom, clearance = 46) {
    const result = baseSeparateNodes(nodes, top, bottom, clearance);
    if (!focusedCharacter) return result;
    const y = (top + bottom) / 2;
    return result.map(node => {
      const belongs = (node.cast || []).includes(focusedCharacter) || (node.group || []).some(event => (event.tracks || []).includes(focusedCharacter));
      return belongs ? { ...node, y } : node;
    });
  };

  const baseStrand = TimelineCore.strand.bind(TimelineCore);
  TimelineCore.strand = function strandWithFocusedLane(anchors, id, middle, amplitude, lead = 1, pixelsPerDay = 24) {
    if (!focusedCharacter || id !== focusedCharacter || !anchors.length) {
      return baseStrand(anchors, id, middle, amplitude, lead, pixelsPerDay);
    }
    const y = anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length;
    const first = anchors[0];
    const last = anchors.at(-1);
    return [
      { day: Math.max(0, first.day - lead), y, id: 'start', flat: true },
      ...anchors.map(point => ({ ...point, y, node: true, flat: true })),
      { day: Math.min(365, last.day + lead), y, id: 'end', flat: true }
    ];
  };

  function normalizeEvents(items) {
    return (items || []).filter(Boolean);
  }

  function setSurfaceFocus(items) {
    const events = normalizeEvents(items);
    active = Boolean(pinnedNodeId && events.length);
    focusedEventIds = new Set(events.map(event => event.id).filter(Boolean));
    focusedCharacters = new Set(events.flatMap(event => {
      const physical = Array.isArray(event.physical) ? event.physical : [];
      return physical.length ? physical : (event.tracks || []);
    }));
    window.__timelineSelectionFocus = {
      enabled: active,
      eventIds: focusedEventIds,
      characterIds: focusedCharacters
    };
    applySelectionFocus();
  }

  function clearSurfaceFocus() {
    active = false;
    focusedEventIds = new Set();
    focusedCharacters = new Set();
    window.__timelineSelectionFocus = { enabled: false, eventIds: focusedEventIds, characterIds: focusedCharacters };
    window.__timelineActiveCloudKeys = null;
    applySelectionFocus();
  }

  function lineCharacterMap() {
    const map = new Map();
    if (typeof entityMap === 'undefined' || !entityMap) return map;
    for (const id of entityMap.keys()) {
      map.set(name(id), id);
      map.set(fullName(id), id);
    }
    return map;
  }

  function redrawClouds() {
    if (typeof cloudRenderer !== 'undefined' && cloudRenderer?.scroll) {
      const canvas = document.getElementById('canvas');
      cloudRenderer.scroll(canvas?.scrollTop || 0);
    }
  }

  function applyCharacterHover() {
    const labels = lineCharacterMap();
    document.querySelectorAll('#timeline .thread').forEach(element => {
      const id = element.dataset.character;
      element.classList.toggle('is-character-hover-muted', Boolean(hoveredCharacter && id !== hoveredCharacter));
      element.classList.toggle('is-character-hover-active', Boolean(hoveredCharacter && id === hoveredCharacter));
    });
    document.querySelectorAll('#timeline .line-label').forEach(element => {
      const id = labels.get(element.textContent.trim());
      element.classList.toggle('is-character-hover-muted', Boolean(hoveredCharacter && id && id !== hoveredCharacter));
      element.classList.toggle('is-character-hover-active', Boolean(hoveredCharacter && id === hoveredCharacter));
    });
  }

  function guestCharacters(node) {
    const ids = new Set();
    for (const event of node?.group || []) {
      const physical = Array.isArray(event.physical) && event.physical.length ? event.physical : (event.tracks || []);
      physical.forEach(id => {
        if (id && id !== focusedCharacter && entityMap?.has?.(id)) ids.add(id);
      });
    }
    return [...ids];
  }

  function renderFocusedGuestEntries() {
    const timeline = document.getElementById('timeline');
    timeline?.querySelector('.focus-guest-layer')?.remove();
    if (!timeline || !focusedCharacter || !Array.isArray(graphNodes) || !graphNodes.length) return;

    const group = document.createElementNS(NS, 'g');
    group.setAttribute('class', 'focus-guest-layer');
    group.setAttribute('aria-hidden', 'true');

    graphNodes.forEach(node => {
      const guests = guestCharacters(node);
      guests.forEach((id, index) => {
        const direction = index % 2 === 0 ? -1 : 1;
        const tier = Math.floor(index / 2);
        const startX = node.x - 34 - Math.min(18, tier * 4);
        const startY = node.y + direction * (24 + tier * 11);
        const gradientId = `focus-guest-${String(node.id).replace(/[^a-z0-9_-]/gi,'_')}-${String(id).replace(/[^a-z0-9_-]/gi,'_')}`;

        let defs = timeline.querySelector('defs');
        if (!defs) {
          defs = document.createElementNS(NS, 'defs');
          timeline.prepend(defs);
        }
        const gradient = document.createElementNS(NS, 'linearGradient');
        gradient.setAttribute('id', gradientId);
        gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
        gradient.setAttribute('x1', String(startX));
        gradient.setAttribute('x2', String(node.x));
        gradient.setAttribute('y1', String(startY));
        gradient.setAttribute('y2', String(node.y));
        const start = document.createElementNS(NS, 'stop');
        start.setAttribute('offset', '0');
        start.setAttribute('stop-color', color(id));
        start.setAttribute('stop-opacity', '0');
        const end = document.createElementNS(NS, 'stop');
        end.setAttribute('offset', '1');
        end.setAttribute('stop-color', color(id));
        end.setAttribute('stop-opacity', '.82');
        gradient.append(start, end);
        defs.append(gradient);

        const path = document.createElementNS(NS, 'path');
        path.setAttribute('class', 'focus-guest-entry');
        path.setAttribute('data-character', id);
        path.setAttribute('stroke', `url(#${gradientId})`);
        path.setAttribute('d', `M${startX.toFixed(2)},${startY.toFixed(2)} C${(node.x-24).toFixed(2)},${startY.toFixed(2)} ${(node.x-16).toFixed(2)},${node.y.toFixed(2)} ${node.x.toFixed(2)},${node.y.toFixed(2)}`);
        group.append(path);
      });
    });

    const firstNode = timeline.querySelector('.node');
    timeline.insertBefore(group, firstNode || null);
  }

  function applySelectionFocus() {
    const nodes = typeof graphNodes !== 'undefined' && Array.isArray(graphNodes) ? graphNodes : [];
    const relatedNodeIds = new Set();
    const timeline = document.getElementById('timeline');
    const singleFocus = Boolean(focusedCharacter);
    timeline?.classList.toggle('is-single-character-focus', singleFocus);

    if (active) {
      for (const node of nodes) {
        if ((node.group || []).some(event => focusedEventIds.has(event.id))) relatedNodeIds.add(node.id);
      }
    }

    const hasVisibleRelation = active && relatedNodeIds.size > 0;

    document.querySelectorAll('#timeline .node').forEach(element => {
      element.classList.toggle('is-context-muted', hasVisibleRelation && !relatedNodeIds.has(element.dataset.event));
    });

    document.querySelectorAll('#timeline .thread').forEach(element => {
      const id = element.dataset.character;
      element.classList.toggle('is-context-muted', active && !focusedCharacters.has(id));
      element.classList.toggle('is-single-focus-hidden', singleFocus && id !== focusedCharacter);
    });
    document.querySelectorAll('#timeline .thread-hit').forEach(element => {
      element.classList.toggle('is-single-focus-hidden', singleFocus && element.dataset.character !== focusedCharacter);
    });

    const labels = lineCharacterMap();
    document.querySelectorAll('#timeline .line-label').forEach(element => {
      const characterId = labels.get(element.textContent.trim());
      element.classList.toggle('is-context-muted', active && characterId && !focusedCharacters.has(characterId));
      element.classList.toggle('is-single-focus-hidden', singleFocus && characterId && characterId !== focusedCharacter);
    });

    const activeCloudKeys = new Set();
    if (typeof graphClouds !== 'undefined' && Array.isArray(graphClouds)) {
      for (const group of graphClouds) {
        const related = !hasVisibleRelation || group.nodes.some(node => relatedNodeIds.has(node.id));
        if (related) activeCloudKeys.add(group.key);
      }
    }
    window.__timelineActiveCloudKeys = active ? activeCloudKeys : null;

    document.querySelectorAll('#timeline .cloud-label').forEach(element => {
      const key = `${element.dataset.cloudKind}:${element.dataset.cloudId}`;
      element.classList.toggle('is-context-muted', active && !activeCloudKeys.has(key));
    });

    applyCharacterHover();
    redrawClouds();
  }

  function characterTrigger(target) {
    if (!(target instanceof Element)) return null;
    return target.closest('.person[data-event-focus-character],.character-name[data-focus-character]');
  }

  function triggerCharacter(trigger) {
    return trigger?.dataset.eventFocusCharacter || trigger?.dataset.focusCharacter || null;
  }

  document.addEventListener('pointerover', event => {
    const trigger = characterTrigger(event.target);
    if (!trigger || !canHover(event)) return;
    const related = characterTrigger(event.relatedTarget);
    if (related === trigger) return;
    hoveredCharacter = triggerCharacter(trigger);
    applyCharacterHover();
  }, true);

  document.addEventListener('pointerout', event => {
    const trigger = characterTrigger(event.target);
    if (!trigger) return;
    const related = characterTrigger(event.relatedTarget);
    if (related === trigger) return;
    if (event.relatedTarget instanceof Node && trigger.contains(event.relatedTarget)) return;
    hoveredCharacter = null;
    applyCharacterHover();
  }, true);

  const baseShowEvent = showEvent;
  showEvent = function showEventWithMapFocus(event) {
    const result = baseShowEvent(event);
    if (pinnedNodeId) setSurfaceFocus([event]);
    else clearSurfaceFocus();
    return result;
  };

  const baseShowSceneCard = showSceneCard;
  showSceneCard = function showSceneCardWithMapFocus(scene, group) {
    const result = baseShowSceneCard(scene, group);
    if (pinnedNodeId) setSurfaceFocus(group);
    else clearSurfaceFocus();
    return result;
  };

  const baseShowStoryGroup = showStoryGroup;
  showStoryGroup = function showStoryGroupWithMapFocus(point) {
    const result = baseShowStoryGroup(point);
    if (pinnedNodeId) setSurfaceFocus(point?.group || []);
    else clearSurfaceFocus();
    return result;
  };

  const baseCloseCard = closeCard;
  closeCard = function closeCardAndMapFocus(restoreFocus = false) {
    clearSurfaceFocus();
    return baseCloseCard(restoreFocus);
  };

  const basePaintNodes = paintNodes;
  paintNodes = function paintNodesWithMapFocus() {
    const result = basePaintNodes.apply(this, arguments);
    applySelectionFocus();
    return result;
  };

  const baseRender = render;
  render = function renderWithMapFocus() {
    if (lastLayoutFocus !== focusedCharacter) {
      layoutCache?.clear?.();
      baseLayoutCache?.clear?.();
      lastLayoutFocus = focusedCharacter;
    }
    const result = baseRender.apply(this, arguments);
    renderFocusedGuestEntries();
    requestAnimationFrame(applySelectionFocus);
    return result;
  };

  window.addEventListener('resize', () => requestAnimationFrame(applySelectionFocus));
})();
