'use strict';

const SelectionFocus = (() => {
  let hoverTrigger = null;
  let activeCloudKeys = null;
  let hoverElements = [], hoveredCharacter = null, lastStructure = null;
  // Hover changes only strand classes; it never recalculates masks or gradients.
  function updateHover(force = false) {
    if (hoverTrigger && !hoverTrigger.isConnected) hoverTrigger = null;
    const hovered = hoverTrigger?.dataset.eventFocusCharacter || hoverTrigger?.dataset.focusCharacter || hoverTrigger?.dataset.character || null;
    if (!force && hovered === hoveredCharacter) return;
    hoveredCharacter = hovered;
    for (const element of hoverElements) {
      const id = element.dataset.character;
      element.classList.toggle('is-character-hover-muted', !!hovered && id !== hovered);
      element.classList.toggle('is-character-hover-active', !!hovered && id === hovered);
    }
  }

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
    const events = pinnedNodeId ? cardSelection?.events || [] : [];
    const active = !!pinnedNodeId && events.length > 0;
    const context = active ? events : null;
    const timeline = document.getElementById('timeline');
    // The SVG changes when render() replaces the timeline's first child.
    if (lastStructure && lastStructure.focus === focusedCharacter &&
        lastStructure.context === context && lastStructure.nodes === graphNodes &&
        lastStructure.clouds === graphClouds && lastStructure.labels === graphLabels &&
        lastStructure.firstChild === timeline.firstChild) {
      updateHover();
      return;
    }
    lastStructure = {focus: focusedCharacter, context, nodes: graphNodes, clouds: graphClouds, labels: graphLabels, firstChild: timeline.firstChild};
    const eventIds = new Set(events.map(event => event.id));
    const characters = new Set(events.flatMap(event => event.physical?.length ? event.physical : event.tracks || []));
    const related = new Set(graphNodes.filter(node => node.group.some(event => eventIds.has(event.id))).map(node => node.id));
    const hasRelated = active && related.size > 0;

    const focusedNodes = new Set(graphNodes.filter(node => node.cast.includes(focusedCharacter)).map(node => node.id));
    document.querySelectorAll('#timeline .node,#timeline .node-hit').forEach(element => {
      const id = element.dataset.event || element.dataset.nodeId;
      visibility(element, !!focusedCharacter && !focusedNodes.has(id));
      element.classList.toggle('is-context-muted', hasRelated && !related.has(id));
    });
    // A hidden foreign mark must not leave a hole in another character's line.
    // Toggle its mask only; all recorded curves and activity runs stay intact.
    document.querySelectorAll('#timeline mask [data-node-id]').forEach(element => {
      element.classList.toggle('is-line-focus-hidden', !!focusedCharacter && !focusedNodes.has(element.dataset.nodeId));
    });
    hoverElements = [...document.querySelectorAll('#timeline .thread,#timeline .thread-hit,#timeline .thread-focus-continuous,#timeline .thread-focus-hit,#timeline .line-label')];
    hoverElements.forEach(element => {
      const id = element.dataset.character;
      const connected = (element.dataset.companions || '').split(' ').includes(focusedCharacter);
      const continuous=element.matches('.thread-focus-continuous,.thread-focus-hit'),hit=element.matches('.thread-hit,.thread-focus-hit'),label=element.classList.contains('line-label');
      const primary=!!focusedCharacter&&id===focusedCharacter;
      const hidden=continuous?!primary:!!focusedCharacter&&(primary&&!label||!primary&&(!connected||hit||label));
      visibility(element, hidden);
      element.classList.toggle('is-line-focus-main', !!focusedCharacter && id === focusedCharacter);
      element.classList.toggle('is-line-focus-related', !!focusedCharacter && id !== focusedCharacter && connected);
      if (hit) element.setAttribute('aria-pressed', String(id === focusedCharacter));
      if(element.classList.contains('thread')){
        if(focusedCharacter&&connected&&!primary){
          if(element.dataset.focusPaintCharacter!==focusedCharacter){
            const shared=JSON.parse(element.dataset.sharedAnchors||'[]').filter(anchor=>anchor.cast.includes(focusedCharacter)).map(anchor=>anchor.x);
            const gradient=document.getElementById(element.dataset.focusGradient),stops=TimelineCore.focusStops(Number(element.dataset.routeStart),Number(element.dataset.routeEnd),shared,150,Number(element.dataset.activeStart),Number(element.dataset.activeEnd));
            gradient?.replaceChildren();
            for(const stop of stops)svg('stop',{offset:stop.offset,'stop-color':color(id),'stop-opacity':stop.opacity},gradient);
            element.dataset.focusPaintCharacter=focusedCharacter;
          }
          element.setAttribute('stroke',`url(#${element.dataset.focusGradient})`);
        }else if(element.dataset.restStroke)element.setAttribute('stroke',element.dataset.restStroke);
      }
      element.classList.toggle('is-context-muted', active && !!id && !characters.has(id));
    });
    const previousKeys = activeCloudKeys;
    // Cloud labels can greatly outnumber visible groups. Index them once
    // instead of walking both arrays for every label on each focus change.
    const labelIndex = new Map(graphLabels.map(label => [JSON.stringify([label.kind,label.id]),label]));
    const focusedGroups = new Map(graphClouds.map(group => [group.key,group.nodes.some(node => focusedNodes.has(node.id))]));
    document.querySelectorAll('#timeline .cloud-label,#timeline .cloud-label-guide').forEach(element => {
      const label = labelIndex.get(JSON.stringify([element.dataset.titleKind,element.dataset.titleId]));
      visibility(element, !!focusedCharacter && !focusedGroups.get(label?.key) && !focusedNodes.has(label?.anchor?.id));
    });
    activeCloudKeys = focusedCharacter || active ? new Set(graphClouds.filter(group => group.nodes.some(node => (!focusedCharacter || focusedNodes.has(node.id)) && (!hasRelated || related.has(node.id)))).map(group => group.key)) : null;
    if (Boolean(previousKeys) !== Boolean(activeCloudKeys) || activeCloudKeys && (activeCloudKeys.size !== previousKeys.size || [...activeCloudKeys].some(key => !previousKeys.has(key)))) cloudRenderer?.refresh();
    updateHover(true);
  }

  function bind() {
    const trigger = node => node?.closest?.('.person[data-event-focus-character],.character-name[data-focus-character],.thread-hit[data-character],.thread-focus-hit[data-character],.line-label[data-character]');
    document.addEventListener('pointerover', event => {
      const next = trigger(event.target);
      if (!next || !canHover(event) || next === hoverTrigger) return;
      hoverTrigger = next;
      updateHover();
    });
    document.addEventListener('pointerout', event => {
      if (!hoverTrigger?.contains(event.target) || hoverTrigger.contains(event.relatedTarget)) return;
      hoverTrigger = null;
      updateHover();
    });
    document.addEventListener('focusin', event => {
      const next = trigger(event.target);
      if (!next || !next.matches('.thread-hit,.thread-focus-hit,.line-label')) return;
      hoverTrigger = next;
      updateHover();
    });
    document.addEventListener('focusout', event => {
      if (!hoverTrigger?.contains(event.target)) return;
      hoverTrigger = null;
      updateHover();
    });
    window.addEventListener('blur', () => { hoverTrigger = null; updateHover(); });
  }

  return {
    bind, update,
    palette(colors, kind, key) {
      return activeCloudKeys && !activeCloudKeys.has(key) ? { ...colors, alpha: colors.alpha * .16 } : colors;
    }
  };
})();
