'use strict';

(() => {
  const HOVER_OPEN_DELAY = 260;
  const HOVER_SIDE_GAP = 18;
  const HOVER_SIDE_MIN_WIDTH = 360;
  const HOVER_SIDE_MAX_WIDTH = 480;
  const HOVER_CARD_MAX_HEIGHT = 420;
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

  // A child preview is already visually attached to its parent surface.
  // Do not repeat obvious hierarchy with labels such as "До сцени".
  // All hierarchy levels use the same neutral close affordance instead.
  const originalShowEventPreview = showEventPreview;
  showEventPreview = function showEventPreviewWithoutRedundantParentLabel(...args) {
    originalShowEventPreview(...args);
    const preview = $('eventPreview');
    const back = preview?.querySelector('.preview-back[data-close-preview]');
    if (!back) return;
    back.classList.remove('preview-back');
    back.classList.add('close');
    back.textContent = '×';
    back.setAttribute('aria-label', 'Закрити перегляд');
    back.setAttribute('title', 'Закрити');
    back.style.marginLeft = 'auto';
    back.parentElement?.append(back);
  };

  // Hover cards need readable space without becoming a full-screen overlay.
  // On desktop, prefer the larger side of the hovered node. This keeps the
  // node and most of the timeline visible while allowing a useful card height.
  const originalPositionCard = positionCard;
  positionCard = function positionHoverCard(point) {
    if (pinnedNodeId || window.innerWidth <= 760) {
      originalPositionCard(point);
      return;
    }

    const card = $('eventCard');
    const canvas = $('canvas');
    const viewportWidth = canvas.clientWidth || window.innerWidth || 1000;
    const viewportHeight = canvas.clientHeight || window.innerHeight || 700;
    const bounds = readingBounds();
    const screenX = point.x;
    const screenY = point.y - canvas.scrollTop;
    const bottom = Math.min(viewportHeight - 56, bounds.top + bounds.height);
    const usableHeight = Math.max(180, bottom - bounds.top);
    const cardHeight = Math.min(HOVER_CARD_MAX_HEIGHT, usableHeight);

    const roomLeft = Math.max(0, screenX - HOVER_SIDE_GAP - 12);
    const roomRight = Math.max(0, viewportWidth - screenX - HOVER_SIDE_GAP - 12);
    const bestSideRoom = Math.max(roomLeft, roomRight);

    card.hidden = false;
    card.dataset.placement = 'reading';

    if (bestSideRoom >= HOVER_SIDE_MIN_WIDTH) {
      const width = Math.min(HOVER_SIDE_MAX_WIDTH, bestSideRoom);
      const useRight = roomRight >= roomLeft;
      const centerX = useRight
        ? screenX + HOVER_SIDE_GAP + width / 2
        : screenX - HOVER_SIDE_GAP - width / 2;
      const top = clamp(screenY - cardHeight / 2, bounds.top, bottom - cardHeight);

      card.style.width = width + 'px';
      card.style.left = centerX + 'px';
      card.style.top = top + 'px';
      card.style.setProperty('--card-height', cardHeight + 'px');
      card.dataset.placement = useRight ? 'side-right' : 'side-left';
      positionEventPreview();
      return;
    }

    // Narrow fallback: use whichever vertical side has more room, but cap the
    // card so it never turns into a full-screen sheet.
    const width = Math.min(600, viewportWidth - 24);
    const above = Math.max(0, screenY - bounds.top - HOVER_SIDE_GAP);
    const below = Math.max(0, bottom - screenY - HOVER_SIDE_GAP);
    const useBelow = below > above;
    const available = Math.max(above, below);
    const verticalHeight = Math.min(HOVER_CARD_MAX_HEIGHT, Math.max(180, available));
    const top = useBelow
      ? clamp(screenY + HOVER_SIDE_GAP, bounds.top, bottom - verticalHeight)
      : clamp(screenY - HOVER_SIDE_GAP - verticalHeight, bounds.top, bottom - verticalHeight);

    card.style.width = width + 'px';
    card.style.left = clamp(screenX, width / 2 + 12, viewportWidth - width / 2 - 12) + 'px';
    card.style.top = top + 'px';
    card.style.setProperty('--card-height', verticalHeight + 'px');
    card.dataset.placement = useBelow ? 'below' : 'above';
    positionEventPreview();
  };

  document.addEventListener('pointerenter', scheduleNodeHover, true);
  document.addEventListener('pointerover', scheduleNodeHover, true);
  document.addEventListener('pointerleave', cancelNodeHover, true);
  document.addEventListener('pointerout', cancelNodeHover, true);
  document.addEventListener('pointerdown', () => {
    hoveredNodeId = null;
    clearPendingHover();
  }, true);
})();
