'use strict';

const SelectionFocus = (() => {
  let hoverTrigger = null;
  let activeCloudKeys = null;

  function update() {
    if (hoverTrigger && !hoverTrigger.isConnected) hoverTrigger = null;
    const hovered = hoverTrigger?.dataset.eventFocusCharacter || hoverTrigger?.dataset.focusCharacter;
    const events = cardSelection?.events || [];
    const active = !!pinnedNodeId && events.length > 0;
    const eventIds = new Set(events.map(event => event.id));
    const characters = new Set(events.flatMap(event => event.physical?.length ? event.physical : event.tracks || []));
    const related = new Set(graphNodes.filter(node => node.group.some(event => eventIds.has(event.id))).map(node => node.id));
    const hasRelated = active && related.size > 0;
    const labels = new Map([...entityMap.keys()].flatMap(id => [[name(id), id], [fullName(id), id]]));

    document.querySelectorAll('#timeline .node').forEach(element => element.classList.toggle('is-context-muted', hasRelated && !related.has(element.dataset.event)));
    document.querySelectorAll('#timeline .thread,#timeline .focus-guest-entry,#timeline .line-label').forEach(element => {
      const id = element.dataset.character || labels.get(element.textContent.trim());
      element.classList.toggle('is-context-muted', active && !!id && !characters.has(id));
      element.classList.toggle('is-character-hover-muted', !!hovered && id !== hovered);
      element.classList.toggle('is-character-hover-active', !!hovered && id === hovered);
    });
    const previousKeys = activeCloudKeys;
    activeCloudKeys = active ? new Set(graphClouds.filter(group => !hasRelated || group.nodes.some(node => related.has(node.id))).map(group => group.key)) : null;
    if (Boolean(previousKeys) !== Boolean(activeCloudKeys) || activeCloudKeys && (activeCloudKeys.size !== previousKeys.size || [...activeCloudKeys].some(key => !previousKeys.has(key)))) cloudRenderer?.refresh();
  }

  function bind() {
    const trigger = node => node?.closest?.('.person[data-event-focus-character],.character-name[data-focus-character]');
    document.addEventListener('pointerover', event => {
      const next = trigger(event.target);
      if (!next || !canHover(event) || next === hoverTrigger) return;
      hoverTrigger = next;
      update();
    });
    document.addEventListener('pointerout', event => {
      if (!hoverTrigger?.contains(event.target) || hoverTrigger.contains(event.relatedTarget)) return;
      hoverTrigger = null;
      update();
    });
    window.addEventListener('blur', () => { hoverTrigger = null; update(); });
  }

  return {
    bind, update,
    palette(colors, kind, key) {
      return activeCloudKeys && !activeCloudKeys.has(key) ? { ...colors, alpha: colors.alpha * .16 } : colors;
    }
  };
})();
