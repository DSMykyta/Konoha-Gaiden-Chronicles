'use strict';

/* Read-only catalog of the authoritative data.abilities registry. */
const AbilityArchive = (() => {
  let initialized = false;
  let currentId = null;
  let returnFocus = null;
  const el = id => document.getElementById(id);
  const all = () => data?.abilities || [];

  function filtered() {
    const query = el('abilityQuery').value.trim().toLocaleLowerCase('uk');
    const kind = el('abilityKind').value;
    return all().filter(item => {
      if (kind && item.kind !== kind) return false;
      const text = [item.id,item.name,item.romanized_name,item.summary,item.mechanics,item.limitation,item.kind,ProfileTechniques.kindName(item.kind),...(item.classification || [])].filter(Boolean).join(' ').toLocaleLowerCase('uk');
      return !query || text.includes(query);
    });
  }

  function render(focusItem = false) {
    const items = filtered();
    if (!items.some(item => item.id === currentId)) currentId = items[0]?.id || null;
    const selected = items.find(item => item.id === currentId);
    el('abilityCount').textContent = `Знайдено ${items.length} із ${all().length} карток`;
    el('abilityList').innerHTML = items.map((item,index) => `<button type="button" class="archive-index-item" data-archive-ability="${esc(item.id)}" aria-current="${item.id === currentId}">
      <span class="archive-index-no">${String(index+1).padStart(2,'0')}</span>
      <span class="archive-index-name">${esc(item.name || item.id)}<small>${esc(ProfileTechniques.kindName(item.kind))}</small></span>
      <span class="archive-index-arrow" aria-hidden="true">↗</span>
    </button>`).join('') || '<p class="archive-no-results">Нічого не знайдено. Спробуйте іншу назву або тип техніки.</p>';
    const index = items.findIndex(item => item.id === currentId);
    el('abilityPosition').textContent = items.length ? `${index+1} / ${items.length}` : '0 / 0';
    el('abilityPrevious').disabled = index <= 0;
    el('abilityNext').disabled = index < 0 || index >= items.length-1;
    el('abilityDetail').innerHTML = selected
      ? ProfileTechniques.card(selected,all().findIndex(item => item.id === selected.id),{expanded:true})
      : '<p class="archive-no-results">Виберіть інші параметри пошуку, щоб відкрити картку.</p>';
    if (focusItem) {
      const button = [...el('abilityList').querySelectorAll('[data-archive-ability]')].find(item => item.dataset.archiveAbility === currentId);
      button?.focus();
    }
  }

  function select(id, focusItem = false) {
    if (!filtered().some(item => item.id === id)) return;
    currentId = id;
    render(focusItem);
  }

  function step(direction) {
    const items = filtered();
    const index = items.findIndex(item => item.id === currentId);
    const next = items[index + direction];
    if (next) select(next.id,true);
  }

  function open(id = null, trigger = null) {
    if (!initialized) init();
    if (!all().length) return;
    const dialog = el('abilityArchiveDialog');
    returnFocus = trigger || document.activeElement || el('abilitiesButton');
    if (id && all().some(item => item.id === id)) {
      el('abilityQuery').value = '';
      el('abilityKind').value = '';
      currentId = id;
    }
    if (!dialog.open) {
      if (typeof closePanels === 'function') closePanels();
      dialog.hidden = false;
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute('open','');
    }
    render();
    el('abilitiesButton').setAttribute('aria-expanded','true');
    (id ? el('abilityList').querySelector('[aria-current="true"]') : el('abilityQuery'))?.focus();
  }

  function close() {
    const dialog = el('abilityArchiveDialog');
    if (dialog.hidden) return;
    if (dialog.close && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    dialog.hidden = true;
    el('abilitiesButton').setAttribute('aria-expanded','false');
    const target = returnFocus?.isConnected && !returnFocus.closest('[hidden]') ? returnFocus : el('abilitiesButton');
    target?.focus();
    returnFocus = null;
  }

  function refresh() {
    if (!initialized) return;
    const kind = el('abilityKind'), previous = kind.value;
    const kinds = [...new Set(all().map(item => item.kind).filter(Boolean))].sort();
    kind.innerHTML = '<option value="">Усі типи</option>' + kinds.map(value => `<option value="${esc(value)}">${esc(ProfileTechniques.kindName(value))}</option>`).join('');
    kind.value = kinds.includes(previous) ? previous : '';
    if (!el('abilityArchiveDialog').hidden) render();
  }

  function init() {
    if (initialized) return;
    initialized = true;
    el('abilitiesButton').addEventListener('click', () => isOpen() ? close() : open(null,el('abilitiesButton')));
    el('closeAbilityArchive').addEventListener('click',close);
    el('abilityArchiveDialog').addEventListener('cancel',event => {event.preventDefault();close();});
    el('abilityQuery').addEventListener('input',() => render());
    el('abilityKind').addEventListener('change',() => render());
    el('abilityList').addEventListener('click',event => {
      const item = event.target.closest('[data-archive-ability]');
      if (item) select(item.dataset.archiveAbility,true);
    });
    el('abilityList').addEventListener('keydown',event => {
      const item = event.target.closest('[data-archive-ability]');
      if (!item || !['ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault();step(event.key === 'ArrowDown' ? 1 : -1);
    });
    el('abilityPrevious').addEventListener('click',() => step(-1));
    el('abilityNext').addEventListener('click',() => step(1));
    refresh();
    const deepLink = new URLSearchParams(window.location.search).get('ability');
    if (deepLink && all().some(item => item.id === deepLink)) open(deepLink,el('abilitiesButton'));
  }

  function isOpen() {return initialized && !el('abilityArchiveDialog').hidden;}
  return {init,open,close,refresh,isOpen};
})();
