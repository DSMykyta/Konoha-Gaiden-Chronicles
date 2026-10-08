'use strict';

/* One ticket renderer for the standalone archive and the character dossier. */
const ProfileTechniques = (() => {
  const kindLabels = {ninjutsu:'Ніндзюцу',chakra_control:'Контроль чакри',summoning:'Призов',jinchuriki:'Джінчюрікі'};
  const kindName = kind => kindLabels[kind] || kind || 'Не визначено';
  const registry = () => new Map((data?.abilities || []).map(ability => [ability.id, ability]));

  function card(item, index, options = {}) {
    const ability = {...(registry().get(item.id) || {}), ...item};
    const title = ability.name || ability.label || ability.id || 'Техніка';
    const tags = Array.isArray(ability.classification) ? ability.classification : [];
    const facts = [
      ability.mechanics && ['Принцип', ability.mechanics],
      ability.limitation && ['Обмеження', ability.limitation]
    ].filter(Boolean);
    const clickable = !!options.link && !!ability.id;
    const ident = String(index + 1).padStart(3, '0');
    return `<article class="profile-entry technique-card archive-ticket${options.expanded ? ' archive-ticket-expanded' : ''}" data-ability="${esc(ability.id || '')}"${clickable ? ` role="button" tabindex="0" aria-haspopup="dialog" data-open-ability="${esc(ability.id)}" aria-label="Відкрити картку: ${esc(title)}"` : ''}>
      <div class="ticket-stub" aria-hidden="true"><span>01</span><span>02</span><span>03</span></div>
      <div class="ticket-paper">
        <header class="ticket-head">
          <span class="ticket-seal" aria-hidden="true">木</span>
          <span class="ticket-series">КОНОХА / АРХІВ ЗДІБНОСТЕЙ</span>
          <span class="ticket-number">№ ${ident}</span>
        </header>
        <div class="ticket-metadata">
          <div><small>ТИП</small><strong>${esc(kindName(ability.kind))}</strong></div>
          <div><small>РАНГ</small><strong>${esc(ability.rank || '—')}</strong></div>
          <div><small>ІНДЕКС</small><strong>${esc(ability.id || '—')}</strong></div>
        </div>
        <div class="ticket-content">
          <span class="ticket-caption">НАЗВА / TECHNIQUE</span>
          <h3 class="technique-card-name">${esc(title)}</h3>
          ${ability.romanized_name ? `<p class="technique-card-romanized">${esc(ability.romanized_name)}</p>` : ''}
          ${tags.length ? `<p class="ticket-tags">${tags.map(t => `<span>${esc(t)}</span>`).join(' · ')}</p>` : ''}
          ${ability.summary ? `<p class="ticket-summary">${esc(ability.summary)}</p>` : ''}
          ${facts.length ? `<dl class="ticket-facts">${facts.map(([label,value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>` : ''}
        </div>
        <footer class="ticket-footer"><span>${ability.status || item.status ? `СТАТУС: ${esc(item.status || ability.status)}` : 'РЕЄСТР ТЕХНІК'}</span><span class="ticket-stamp">KG / ARCHIVE</span></footer>
      </div>
    </article>`;
  }

  function openCard(id, trigger) {
    if (typeof AbilityArchive === 'undefined') return;
    if (typeof closeProfile === 'function' && !document.getElementById('profileDialog')?.hidden) closeProfile();
    AbilityArchive.open(id, trigger);
  }

  function bindTrack(track) {
    if (!track || track.dataset.techniqueTrackBound === 'true') return;
    track.dataset.techniqueTrackBound = 'true';
    track.tabIndex = 0;
    track.setAttribute('aria-label', 'Картки здібностей. Натисніть Enter для відкриття.');
    let drag = null;
    track.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.pointerType === 'touch') return;
      drag = {id:event.pointerId, x:event.clientX, left:track.scrollLeft, moved:false};
    });
    track.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      if (Math.abs(dx) < 5 && !drag.moved) return;
      drag.moved = true;
      track.classList.add('is-dragging');
      track.scrollLeft = drag.left - dx;
    });
    track.addEventListener('pointerup', event => {
      if (drag?.id !== event.pointerId) return;
      track.dataset.preventCardClick = drag.moved ? 'true' : 'false';
      drag = null;
      track.classList.remove('is-dragging');
    });
    track.addEventListener('pointercancel', () => {drag = null;track.classList.remove('is-dragging');});
    track.addEventListener('pointerleave', () => {drag = null;track.classList.remove('is-dragging');});
    track.addEventListener('click', event => {
      if (track.dataset.preventCardClick === 'true') {track.dataset.preventCardClick = 'false';return;}
      const target = event.target.closest('[data-open-ability]');
      if (target) openCard(target.dataset.openAbility, target);
    });
    track.addEventListener('keydown', event => {
      const target = event.target.closest('[data-open-ability]');
      if (target && ['Enter',' '].includes(event.key)) {
        event.preventDefault();openCard(target.dataset.openAbility,target);return;
      }
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const first = track.querySelector('.archive-ticket');
      const step = first ? first.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0) : track.clientWidth * .8;
      track.scrollBy({left:event.key === 'ArrowRight' ? step : -step,behavior:'auto'});
    });
  }

  function decorate() {
    const root = document.getElementById('profileContent');
    if (!root || !profileEntity) return;
    const profile = profileMap.get(profileEntity);
    const versions = profile?.versions?.length ? profile.versions : [{id:'general',label:'Профіль'}];
    const index = Math.max(0, versions.findIndex(version => version.id === profileVersion));
    const abilities = mergedProfileVersion(versions,index).abilities || [];
    if (!abilities.length) return;
    const section = [...root.querySelectorAll('.profile-section')].find(node => node.querySelector(':scope > h3')?.textContent.trim() === 'Здібності');
    const track = section?.querySelector('.profile-entry-list');
    if (!track) return;
    track.classList.add('technique-card-track');
    track.innerHTML = abilities.map((item,i) => card(item,i,{link:true})).join('');
    bindTrack(track);
  }

  return {card,kindName,decorate};
})();
