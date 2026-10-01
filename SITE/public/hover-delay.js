'use strict';

(() => {
  const HOVER_OPEN_DELAY = 260;
  let hoverOpenTimer = null;
  let hoveredNodeId = null;
  let pendingNodeId = null;

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
  }

  function scheduleNodeHover(event) {
    const element = nodeElement(event.target);
    if (!element || !canHover(event)) return;

    const id = nodeId(element);
    if (!id) return;

    // Block the immediate hover handlers already attached in app.js.
    event.stopImmediatePropagation();

    const related = nodeElement(event.relatedTarget);
    if (related && nodeId(related) === id) {
      hoveredNodeId = id;
      return;
    }

    hoveredNodeId = id;
    clearPendingHover();
    pendingNodeId = id;
    hoverOpenTimer = setTimeout(() => {
      const idToOpen = pendingNodeId;
      clearPendingHover();
      if (!idToOpen || hoveredNodeId !== idToOpen) return;
      const node = graphNodes.find(item => item.id === idToOpen);
      if (node) openNode(node);
    }, HOVER_OPEN_DELAY);
  }

  function cancelNodeHover(event) {
    const element = nodeElement(event.target);
    if (!element) return;

    const id = nodeId(element);
    const related = nodeElement(event.relatedTarget);
    if (related && nodeId(related) === id) return;

    if (hoveredNodeId === id) hoveredNodeId = null;
    if (pendingNodeId === id) clearPendingHover();
  }

  document.addEventListener('pointerenter', scheduleNodeHover, true);
  document.addEventListener('pointerover', scheduleNodeHover, true);
  document.addEventListener('pointerleave', cancelNodeHover, true);
  document.addEventListener('pointerout', cancelNodeHover, true);
  document.addEventListener('pointerdown', () => {
    hoveredNodeId = null;
    clearPendingHover();
  }, true);
})();
