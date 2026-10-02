'use strict';

const ProfileTechniques = (() => {
  const kindLabels = {ninjutsu:'Ніндзюцу',chakra_control:'Контроль чакри',summoning:'Призов',jinchuriki:'Джінчюрікі'};
  function abilityRegistry() {
    return new Map((data?.abilities || []).map(ability => [ability.id, ability]));
  }

  function techniqueCard(item, index, registry) {
    const source = registry.get(item.id) || {};
    const ability = { ...source, ...item };
    const classifications = Array.isArray(ability.classification) ? ability.classification : ability.kind ? [kindLabels[ability.kind] || ability.kind] : [];
    const facts = [
      ability.mechanics ? ['Принцип', ability.mechanics] : null,
      ability.limitation ? ['Обмеження', ability.limitation] : null
    ].filter(Boolean);
    return `<article class="profile-entry technique-card" data-ability="${esc(ability.id || '')}" tabindex="0"><div class="technique-card-top"><span class="technique-card-index">${String(index + 1).padStart(2, '0')}</span>${ability.rank ? `<span class="technique-card-rank">Ранг ${esc(ability.rank)}</span>` : ''}</div><strong class="technique-card-name">${esc(ability.name || ability.label || ability.id || 'Техніка')}</strong>${ability.romanized_name ? `<p class="technique-card-romanized">${esc(ability.romanized_name)}</p>` : ''}${classifications.length ? `<p class="technique-card-tags">${classifications.map(value => `<span>${esc(value)}</span>`).join('')}</p>` : ''}${ability.summary ? `<p class="technique-card-summary">${esc(ability.summary)}</p>` : ''}${facts.length ? `<dl class="technique-card-facts">${facts.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>` : ''}${item.status ? `<div class="technique-card-status"><span>Статус</span><strong>${esc(item.status)}</strong></div>` : ''}</article>`;
  }

  function bindTechniqueTrack(track) {
    if (!track || track.dataset.techniqueTrackBound === 'true') return;
    track.dataset.techniqueTrackBound = 'true';
    track.tabIndex = 0;
    track.setAttribute('aria-label', 'Картотека технік');
    let drag = null;
    track.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.pointerType === 'touch') return;
      drag = { id: event.pointerId, x: event.clientX, left: track.scrollLeft };
      track.setPointerCapture?.(event.pointerId);
      track.classList.add('is-dragging');
    });
    track.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      if (Math.abs(dx) > 2) event.preventDefault();
      track.scrollLeft = drag.left - dx;
    });
    const end = event => {
      if (!drag || (event?.pointerId !== undefined && drag.id !== event.pointerId)) return;
      drag = null;
      track.classList.remove('is-dragging');
    };
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    track.addEventListener('lostpointercapture', end);
    track.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const card = track.querySelector('.technique-card');
      const step = card ? card.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0) : track.clientWidth * .8;
      track.scrollBy({ left: event.key === 'ArrowRight' ? step : -step, behavior: 'instant' });
    });
  }

  function decorateTechniqueCards() {
    const root = $('profileContent');
    if (!root || !profileEntity) return;
    const profile = profileMap.get(profileEntity);
    const versions = profile?.versions?.length ? profile.versions : [{ id: 'general', label: 'Профіль' }];
    const index = Math.max(0, versions.findIndex(version => version.id === profileVersion));
    const version = mergedProfileVersion(versions, index);
    const abilities = version.abilities || [];
    if (!abilities.length) return;
    const section = [...root.querySelectorAll('.profile-section')].find(node => node.querySelector(':scope > h3')?.textContent.trim() === 'Здібності');
    const track = section?.querySelector('.profile-entry-list');
    if (!track) return;
    const registry = abilityRegistry();
    track.classList.add('technique-card-track');
    track.innerHTML = abilities.map((item, abilityIndex) => techniqueCard(item, abilityIndex, registry)).join('');
    bindTechniqueTrack(track);
  }

  return { decorate: decorateTechniqueCards };
})();
