'use strict';

(() => {
  const HOVER_OPEN_DELAY = 260;
  let hoverOpenTimer = null;
  let pendingNodeId = null;
  let pendingElement = null;

  function nodeElement(target) {
    return target instanceof Element ? target.closest('.node,.node-hit') : null;
  }

  function nodeId(element) {
    return element?.dataset?.nodeId || element?.dataset?.event || null;
  }

  function clearPendingHover() {
    clearTimeout(hoverOpenTimer);
    hoverOpenTimer = null;
    pendingNodeId = null;
    pendingElement = null;
  }

  function scheduleNodeHover(event) {
    const element = nodeElement(event.target);
    if (!element || !canHover(event)) return;

    const id = nodeId(element);
    if (!id) return;

    // Prevent the timeline's immediate pointerenter/pointerover handlers from
    // opening every node the pointer merely crosses.
    event.stopImmediatePropagation();

    const related = nodeElement(event.relatedTarget);
    if (related && nodeId(related) === id) return;
    if (pendingNodeId === id && pendingElement === element) return;

    clearPendingHover();
    pendingNodeId = id;
    pendingElement = element;
    hoverOpenTimer = setTimeout(() => {
      const stillHovered = pendingElement?.isConnected && pendingElement.matches(':hover');
      const node = stillHovered ? graphNodes.find(item => item.id === pendingNodeId) : null;
      clearPendingHover();
      if (node) openNode(node);
    }, HOVER_OPEN_DELAY);
  }

  function cancelNodeHover(event) {
    const element = nodeElement(event.target);
    if (!element) return;

    const id = nodeId(element);
    const related = nodeElement(event.relatedTarget);
    if (related && nodeId(related) === id) return;
    if (pendingNodeId === id) clearPendingHover();
  }

  document.addEventListener('pointerenter', scheduleNodeHover, true);
  document.addEventListener('pointerover', scheduleNodeHover, true);
  document.addEventListener('pointerleave', cancelNodeHover, true);
  document.addEventListener('pointerout', cancelNodeHover, true);
  document.addEventListener('pointerdown', clearPendingHover, true);
})();
