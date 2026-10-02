'use strict';

const SelectionFocus = (() => {
  let hoverTrigger = null;
  let activeCloudKeys = null;

  function visibility(element, hidden) {
    element.classList.toggle('is-line-focus-hidden', hidden);
    if (hidden) {
      if (element.hasAttribute('tabindex') && element.dataset.focusTabindex === undefined) element.dataset.focusTabindex = element.getAttribute('tabindex');
      if (element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1');
      element.setAttribute('aria-hidden', 'true');
      element.dataset.focusHidden = 'true';
    } else if (element.dataset.focusHidden) {
      if (!element.dataset.storyHidden) {
        if (element.dataset.focusTabindex !== undefined) element.setAttribute('tabindex', element.dataset.focusTabindex);
        if (!element.classList.contains('node-hit') && !element.classList.contains('cloud-label-guide')) element.removeAttribute('aria-hidden');
      }
      delete element.dataset.focusTabindex;
      delete element.dataset.focusHidden;
    }
  }

  function update() {
    if (hoverTrigger && !hoverTrigger.isConnected) hoverTrigger = null;
    const hovered = hoverTrigger?.dataset.eventFocusCharacter || hoverTrigger?.dataset.focusCharacter || hoverTrigger?.dataset.character;
    const events = cardSelection?.events || [];
    const active = !!pinnedNodeId && events.length > 0;
    const eventIds = new Set(events.map(event => event.id));
    const characters = new Set(events.flatMap(event => event.physical?.length ? event.physical : event.tracks || []));
    const related = new Set(graphNodes.filter(node => node.group.some(event => eventIds.has(event.id))).map(node => node.id));
    const hasRelated = active && related.size > 0;
    const labels = new Map([...entityMap.keys()].flatMap(id => [[name(id), id], [fullName(id), id]]));

    const focusedNodes = new Set(graphNodes.filter(node => node.cast.includes(focusedCharacter)).map(node => node.id));
    document.querySelectorAll('#timeline .node,#timeline .node-hit').forEach(element => {
      const id = element.dataset.event || element.dataset.nodeId;
      visibility(element, !!focusedCharacter && !focusedNodes.has(id));
      element.classList.toggle('is-context-muted', hasRelated && !related.has(id));
    });
    document.querySelectorAll('#timeline .thread,#timeline .thread-hit,#timeline .line-label').forEach(element => {
      const id = element.dataset.character || labels.get(element.textContent.trim());
      const connected = (element.dataset.companions || '').split(' ').includes(focusedCharacter);
      visibility(element, !!focusedCharacter && id !== focusedCharacter && !connected);
      element.classList.toggle('is-line-focus-main', !!focusedCharacter && id === focusedCharacter);
      element.classList.toggle('is-line-focus-related', !!focusedCharacter && id !== focusedCharacter && connected);
      if (element.classList.contains('thread-hit')) element.setAttribute('aria-pressed', String(id === focusedCharacter));
      element.classList.toggle('is-context-muted', active && !!id && !characters.has(id));
      element.classList.toggle('is-character-hover-muted', !!hovered && id !== hovered);
      element.classList.toggle('is-character-hover-active', !!hovered && id === hovered);
    });
    const previousKeys = activeCloudKeys;
    document.querySelectorAll('#timeline .cloud-label,#timeline .cloud-label-guide').forEach(element => {
      const label = graphLabels.find(label => label.kind === element.dataset.titleKind && label.id === element.dataset.titleId);
      const group = graphClouds.find(group => group.key === label?.key);
      visibility(element, !!focusedCharacter && !group?.nodes.some(node => focusedNodes.has(node.id)) && !focusedNodes.has(label?.anchor?.id));
    });
    activeCloudKeys = focusedCharacter || active ? new Set(graphClouds.filter(group => group.nodes.some(node => (!focusedCharacter || focusedNodes.has(node.id)) && (!hasRelated || related.has(node.id)))).map(group => group.key)) : null;
    if (Boolean(previousKeys) !== Boolean(activeCloudKeys) || activeCloudKeys && (activeCloudKeys.size !== previousKeys.size || [...activeCloudKeys].some(key => !previousKeys.has(key)))) cloudRenderer?.refresh();
  }

  function bind() {
    const trigger = node => node?.closest?.('.person[data-event-focus-character],.character-name[data-focus-character],.thread-hit[data-character],.line-label[data-character]');
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
    document.addEventListener('focusin', event => {
      const next = trigger(event.target);
      if (!next || !next.matches('.thread-hit,.line-label')) return;
      hoverTrigger = next;
      update();
    });
    document.addEventListener('focusout', event => {
      if (!hoverTrigger?.contains(event.target)) return;
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
