'use strict';

(() => {
  const baseBindCard = bindCard;
  const baseShowEventPreview = showEventPreview;

  function countLabel(n, one, few, many) {
    const mod100 = n % 100;
    const mod10 = n % 10;
    const form = mod100 >= 11 && mod100 <= 14 ? many : mod10 === 1 ? one : mod10 >= 2 && mod10 <= 4 ? few : many;
    return `${n} ${form}`;
  }

  function storyRange(items) {
    const days = items.map(item => item?.day).filter(day => day !== null && day !== undefined);
    if (!days.length) return { text: 'Без установленої дати', hasYear: false };
    const start = Math.min(...days), end = Math.max(...days);
    return { text: start === end ? dateText(start, true) : `${dateText(start, true)} — ${dateText(end, true)}`, hasYear: true };
  }

  function episodePreviewHtml(id) {
    const episode = episodeMap.get(id);
    if (!episode) return null;
    const scenes = (episode.scene_ids || []).map(sceneId => sceneMap.get(sceneId)).filter(Boolean);
    const moments = scenes.flatMap(scene => sceneEvents(scene.id));
    const range = storyRange(moments.length ? moments : scenes);
    const sceneRows = scenes.map(scene => {
      const group = sceneEvents(scene.id);
      const meta = [scene.day === null ? null : dateText(scene.day), scene.location_id ? name(scene.location_id) : null, actionCount(group.length)].filter(Boolean).join(' · ');
      return `<div class="result"><span><strong>${esc(scene.title)}</strong>${meta ? `<small class="result-context">${esc(meta)}</small>` : ''}</span></div>`;
    }).join('');
    return {
      label: 'Опис епізоду',
      html: `<div class="preview-top"><button class="preview-back" data-close-preview aria-label="Повернутися до арки">‹ До арки</button>${cardMetaLine('episode', range.text, range.hasYear)}</div><h2>${esc(episode.title)}</h2>${episode.description ? `<p class="event-text">${esc(episode.description)}</p>` : ''}<p class="scene-location">${countLabel(scenes.length, 'сцена', 'сцени', 'сцен')} · ${actionCount(moments.length)}</p>${sceneRows ? `<div class="story-children">${sceneRows}</div>` : ''}`
    };
  }

  function scenePreviewHtml(id) {
    const scene = sceneMap.get(id);
    if (!scene) return null;
    const group = sceneEvents(id);
    const cast = sceneCast(scene, group);
    const range = storyRange(group.length ? group : [scene]);
    const actions = group.map(event => `<li><div><div class="scene-action-title">${esc(event.title)}</div></div></li>`).join('');
    return {
      label: 'Опис сцени',
      html: `<div class="preview-top"><button class="preview-back" data-close-preview aria-label="Повернутися до епізоду">‹ До епізоду</button>${cardMetaLine('scene', range.text, range.hasYear)}</div><h2>${esc(scene.title)}</h2><button class="scene-context" data-open-scene="${esc(scene.id)}" title="Читати сцену цілком"><span>Сцена · ${actionCount(group.length)}</span>${esc(name(scene.location_id))} <span aria-hidden="true">↗</span></button>${cast.length ? `<div class="people scene-people">${cast.map(entityId => `<button class="person" data-event-focus-character="${esc(entityId)}" aria-label="Зосередитися на лінії ${esc(name(entityId))}" title="Зосередитися на лінії"><span class="swatch" style="background:${color(entityId)}"></span>${esc(name(entityId))}</button>`).join('')}</div>` : ''}${actions ? `<ol class="scene-actions">${actions}</ol>` : ''}`
    };
  }

  function showStoryPreview(kind, id) {
    const rendered = kind === 'episode' ? episodePreviewHtml(id) : kind === 'scene' ? scenePreviewHtml(id) : null;
    if (!rendered) return;
    clearTimeout(previewCloseTimer);
    const preview = ensureEventPreview();
    previewPinned = false;
    previewEventId = `${kind}:${id}`;
    preview.setAttribute('aria-label', rendered.label);
    $('eventPreviewContent').innerHTML = rendered.html;
    preview.hidden = false;
    positionEventPreview();
    bindEventPreview();
    preview.classList.add('is-visible');
  }

  function bindStoryPreviewTriggers() {
    $('cardContent').querySelectorAll('[data-story-episode],[data-story-scene]').forEach(trigger => {
      const kind = trigger.dataset.storyEpisode ? 'episode' : 'scene';
      const id = trigger.dataset.storyEpisode || trigger.dataset.storyScene;
      trigger.addEventListener('pointerenter', event => {
        clearTimeout(previewCloseTimer);
        if (!canHover(event)) return;
        const box = $('eventCard').getBoundingClientRect();
        const vw = document.documentElement.clientWidth || window.innerWidth;
        if (Math.max(box.left - 12, vw - box.right - 12) >= Math.min(390, vw - 24)) showStoryPreview(kind, id);
      });
      trigger.addEventListener('pointerleave', scheduleEventPreviewClose);
    });
  }

  bindCard = function bindCardWithHierarchyPreview() {
    closeEventPreview(true);
    baseBindCard();
    bindStoryPreviewTriggers();
  };

  showEventPreview = function showMomentPreview(id, pin = false) {
    ensureEventPreview().setAttribute('aria-label', 'Опис події');
    return baseShowEventPreview(id, pin);
  };
})();
