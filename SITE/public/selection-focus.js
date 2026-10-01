'use strict';

(() => {
  let active = false;
  let focusedEventIds = new Set();
  let focusedCharacters = new Set();
  let hoveredCharacter = null;

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

  function applySelectionFocus() {
    const nodes = typeof graphNodes !== 'undefined' && Array.isArray(graphNodes) ? graphNodes : [];
    const relatedNodeIds = new Set();

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
      element.classList.toggle('is-context-muted', active && !focusedCharacters.has(element.dataset.character));
    });

    const labels = lineCharacterMap();
    document.querySelectorAll('#timeline .line-label').forEach(element => {
      const characterId = labels.get(element.textContent.trim());
      element.classList.toggle('is-context-muted', active && characterId && !focusedCharacters.has(characterId));
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
    const result = baseRender.apply(this, arguments);
    requestAnimationFrame(applySelectionFocus);
    return result;
  };

  window.addEventListener('resize', () => requestAnimationFrame(applySelectionFocus));
})();