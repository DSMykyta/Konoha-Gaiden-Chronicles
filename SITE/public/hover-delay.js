'use strict';

(() => {
  const HOVER_OPEN_DELAY = 260;
  const READING_LAYOUT_MIN_WIDTH = 980;
  const READING_NODE_TARGET_RATIO = 0.72;
  const PREVIEW_LEFT_MARGIN = 20;
  const PREVIEW_CARD_GAP = 18;
  const PREVIEW_MIN_WIDTH = 390;
  const PREVIEW_MAX_WIDTH = 560;

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

  // Pinned reading mode keeps the existing vertical reveal, but also pans the
  // chronology toward earlier time so the selected node settles in the right
  // reading lane. That leaves a large, stable area for the secondary card on
  // the left instead of stacking both surfaces around the node.
  const originalRevealReadingNode = revealReadingNode;
  revealReadingNode = function revealReadingNodeWithReadingLane() {
    const canvas = $('canvas');
    let point = graphNodes.find(item => item.id === focusId);
    const width = canvas?.clientWidth || 1000;

    if (point && pinnedNodeId && width >= READING_LAYOUT_MIN_WIDTH) {
      const cardWidth = Math.min(600, width - 24);
      const targetX = clamp(
        width * READING_NODE_TARGET_RATIO,
        cardWidth / 2 + 24,
        width - cardWidth / 2 - 24
      );
      const pad = width < 600 ? 22 : 48;
      const plot = Math.max(1, width - pad * 2);
      const [lo, hi] = range();
      const span = Math.max(.001, hi - lo);
      const axisShift = (point.x - targetX) / plot * span;
      const nextCenter = clampAxisCenter(center + axisShift);

      if (Math.abs(point.x - targetX) > 8 && Math.abs(nextCenter - center) > .0001) {
        center = nextCenter;
        render();
        point = graphNodes.find(item => item.id === focusId);
      }
    }

    // Preserve the original downward reveal exactly as it was.
    originalRevealReadingNode();
  };

  // When a scene moment opens beside a pinned scene card, use the large free
  // left side of the viewport. The fallback keeps the old adjacent placement
  // on narrower layouts and whenever there is not enough room.
  const originalPositionEventPreview = positionEventPreview;
  positionEventPreview = function positionEventPreviewInLeftLane() {
    const preview = $('eventPreview');
    const card = $('eventCard');
    if (!preview || preview.hidden || !card || card.hidden || !pinnedNodeId) {
      originalPositionEventPreview();
      return;
    }

    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = document.documentElement.clientHeight || window.innerHeight;
    if (vw < READING_LAYOUT_MIN_WIDTH) {
      originalPositionEventPreview();
      return;
    }

    const cardRect = card.getBoundingClientRect();
    const availableLeft = cardRect.left - PREVIEW_CARD_GAP - PREVIEW_LEFT_MARGIN;
    if (availableLeft < PREVIEW_MIN_WIDTH) {
      originalPositionEventPreview();
      return;
    }

    const previewWidth = Math.min(PREVIEW_MAX_WIDTH, availableLeft);
    const topLimit = headerBottom();
    const bottomLimit = vh - 72;
    const maxHeight = Math.max(180, bottomLimit - topLimit - 12);

    preview.dataset.side = 'left';
    preview.dataset.overlay = 'false';
    preview.style.width = previewWidth + 'px';
    preview.style.left = PREVIEW_LEFT_MARGIN + 'px';
    preview.style.maxHeight = maxHeight + 'px';
    preview.style.top = clamp(cardRect.top, topLimit + 12, Math.max(topLimit + 12, bottomLimit - Math.min(preview.scrollHeight || maxHeight, maxHeight))) + 'px';
    card.setAttribute('data-preview-open', 'false');
  };
})();
