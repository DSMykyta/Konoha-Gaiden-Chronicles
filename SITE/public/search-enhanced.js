'use strict';

const TimelineSearchEnhanced = (() => {
  const TYPE_LABELS = {
    moment: 'Момент',
    scene: 'Сцена',
    episode: 'Епізод',
    arc: 'Арка',
    person: 'Персонаж',
    location: 'Місце'
  };
  const TYPE_WORDS = {
    moment: ['момент','моменти','подія','події','подію'],
    scene: ['сцена','сцени','сцену'],
    episode: ['епізод','епізоди','епізоду','серія','серії'],
    arc: ['арка','арки','арку'],
    person: ['персонаж','персонажі','герой','герої'],
    location: ['місце','місця','локація','локації']
  };
  const MONTH_NAMES = [
    ['січень','січня'],['лютий','лютого'],['березень','березня'],['квітень','квітня'],
    ['травень','травня'],['червень','червня'],['липень','липня'],['серпень','серпня'],
    ['вересень','вересня'],['жовтень','жовтня'],['листопад','листопада'],['грудень','грудня']
  ];
  const MONTH_LENGTHS = [31,28,31,30,31,30,31,31,30,31,30,31];
  const MONTH_STARTS = MONTH_LENGTHS.map((_, index) => MONTH_LENGTHS.slice(0, index).reduce((sum, value) => sum + value, 0));
  const FILLER = new Set([
    'де','що','було','була','був','були','усі','всі','покажи','показати','знайди','знайти','пошук','по','за','назвою','текстом',
    'з','із','зі','у','в','на','про','для','та','і','й','які','який','яка','яке','яких','будь','ласка',
    ...Object.values(TYPE_WORDS).flat(), ...MONTH_NAMES.flat()
  ]);
  const SOURCE_WORDS = {
    M: ['манга','манґа'], A: ['аніме','anime'], F: ['філер','філлер'], P: ['проєкт','авторська','авторське'],
    R: ['ретроспектива'], V: ['фільм','фильм'], N: ['новела'], G: ['гра','game'], O: ['інше']
  };

  let activeType = 'all';
  let cachedKey = '';
  let cachedDocs = [];
  let cachedCounts = {};
  let scheduled = false;

  function normalize(value) {
    return String(value ?? '')
      .toLowerCase()
      .replace(/[āăâäáàãå]/g, 'a')
      .replace(/[ēĕêëéè]/g, 'e')
      .replace(/[īĭîïíì]/g, 'i')
      .replace(/[ōŏôöóòõ]/g, 'o')
      .replace(/[ūŭûüúù]/g, 'u')
      .replace(/[ȳŷÿýỳ]/g, 'y')
      .replace(/ґ/g, 'г')
      .replace(/[’'`´]/g, '')
      .replace(/[^a-zа-яіїє0-9]+/giu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function html(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  function tokens(value) {
    return normalize(value).split(' ').filter(Boolean);
  }

  function unique(values) {
    return [...new Set(values.filter(value => value !== null && value !== undefined && value !== ''))];
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    if (Math.abs(a.length - b.length) > 4) return Math.max(a.length, b.length);
    const previous = Array.from({length: b.length + 1}, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
      let diagonal = previous[0];
      previous[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const above = previous[j];
        previous[j] = Math.min(
          previous[j] + 1,
          previous[j - 1] + 1,
          diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
        diagonal = above;
      }
    }
    return previous[b.length];
  }

  function similarity(a, b) {
    a = normalize(a); b = normalize(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a))) return .92;
    if (a[0] !== b[0] && Math.min(a.length, b.length) > 3) return 0;
    const longest = Math.max(a.length, b.length);
    return Math.max(0, 1 - levenshtein(a, b) / longest);
  }

  function parseDate(raw) {
    const text = String(raw ?? '').toLowerCase().replace(/,/g, ' ');
    const numeric = text.match(/\b([0-3]?\d)\s*[.\/-]\s*(0?\d|1[0-2])\b/);
    if (numeric) {
      const day = Number(numeric[1]), month = Number(numeric[2]) - 1;
      if (day >= 1 && day <= MONTH_LENGTHS[month]) return { day: MONTH_STARTS[month] + day - 1, match: numeric[0] };
    }
    for (let month = 0; month < MONTH_NAMES.length; month++) {
      const names = MONTH_NAMES[month].join('|');
      const match = text.match(new RegExp(`(?:^|\\s)([0-3]?\\d)\\s+(?:${names})(?=\\s|$)`, 'i'));
      if (!match) continue;
      const day = Number(match[1]);
      if (day >= 1 && day <= MONTH_LENGTHS[month]) return { day: MONTH_STARTS[month] + day - 1, match: match[0].trim() };
    }
    return null;
  }

  function inferType(raw) {
    const query = new Set(tokens(raw));
    for (const [kind, words] of Object.entries(TYPE_WORDS)) if (words.some(word => query.has(normalize(word)))) return kind;
    return null;
  }

  function inferSource(raw) {
    const query = new Set(tokens(raw));
    for (const [code, words] of Object.entries(SOURCE_WORDS)) if (words.some(word => query.has(normalize(word)))) return code;
    return '';
  }

  function entityLabel(entity) {
    if (!entity) return '';
    const aliases = Array.isArray(entity.aliases) ? entity.aliases : [];
    return aliases.find(alias => /[А-Яа-яІіЇїЄєҐґ]/.test(alias)) || entity.name || aliases[0] || entity.id;
  }

  function entityTerms(id) {
    if (typeof entityMap === 'undefined' || !entityMap?.has(id)) return [];
    const entity = entityMap.get(id);
    return unique([entity.name, ...(entity.aliases || [])]);
  }

  function eventOrigins(event) {
    return unique(Array.isArray(event?.origin) ? event.origin : [event?.origin]);
  }

  function peopleFor(event, scene) {
    return unique([
      ...(event?.tracks || []),
      ...(event?.physical || []),
      ...(event?.involvement || []).map(item => item.entity_id),
      ...(scene?.presence || []).map(item => item.entity_id)
    ]).filter(id => typeof entityMap !== 'undefined' && entityMap?.get(id)?.kind === 'person');
  }

  function locationFor(event, scene) {
    return event?.location_id || scene?.location_id || null;
  }

  function makeDoc(input) {
    const aliases = unique(input.aliases || []);
    const keywords = unique(input.keywords || []);
    const titleNorm = normalize(input.title);
    const aliasNorm = normalize(aliases.join(' '));
    const contextNorm = normalize(input.context);
    const bodyNorm = normalize(input.body);
    const keywordNorm = normalize(keywords.join(' '));
    const all = [titleNorm, aliasNorm, contextNorm, bodyNorm, keywordNorm].filter(Boolean).join(' ');
    return {
      ...input,
      aliases,
      keywords,
      titleNorm,
      aliasNorm,
      contextNorm,
      bodyNorm,
      allNorm: all,
      searchTokens: unique(tokens(all)).slice(0, 120),
      days: unique((input.days || []).filter(Number.isFinite).map(day => Math.floor(day))),
      personIds: unique(input.personIds || []),
      arcIds: unique(input.arcIds || []),
      origins: unique(input.origins || []),
      order: Number.isFinite(input.order) ? input.order : Number.MAX_SAFE_INTEGER
    };
  }

  function buildIndex() {
    if (typeof data === 'undefined' || !data) return [];
    const key = `${data.revision || 'unknown'}|${typeof continuity === 'undefined' ? 'main' : continuity}`;
    if (key === cachedKey) return cachedDocs;

    const activeEvents = typeof events === 'function' ? events() : (data.events || []).filter(event => !continuity || event.continuity === continuity);
    const ordered = typeof orderedScenes === 'function' ? orderedScenes().flatMap(scene => scene.group) : activeEvents;
    const eventOrder = new Map(ordered.map((event, index) => [event.id, index]));
    const groups = new Map();
    for (const event of activeEvents) {
      if (!groups.has(event.scene_id)) groups.set(event.scene_id, []);
      groups.get(event.scene_id).push(event);
    }

    const docs = [];
    const sceneDocs = new Map();
    const episodeDocs = new Map();
    const momentDocs = [];

    for (const event of activeEvents) {
      const scene = typeof sceneMap !== 'undefined' ? sceneMap?.get(event.scene_id) : null;
      const episode = scene && typeof episodeMap !== 'undefined' ? episodeMap?.get(scene.episode_id) : null;
      const arc = episode && typeof arcMap !== 'undefined' ? arcMap?.get(episode.arc_id) : null;
      const people = peopleFor(event, scene);
      const locationId = locationFor(event, scene);
      const context = [arc?.title, episode?.title, scene?.title || event.scene_title].filter(Boolean).join(' › ');
      const keywords = [
        ...people.flatMap(entityTerms),
        ...entityTerms(locationId),
        typeof origins !== 'undefined' ? origins[event.origin] : '',
        scene?.title, episode?.title, arc?.title
      ];
      const doc = makeDoc({
        kind: 'moment', id: event.id, title: event.title, body: event.text, context,
        day: event.day, days: [event.day], personIds: people, locationId,
        arcIds: arc?.id ? [arc.id] : [], origins: eventOrigins(event), keywords,
        firstEventId: event.id, order: eventOrder.get(event.id) ?? Number.MAX_SAFE_INTEGER
      });
      docs.push(doc); momentDocs.push(doc);
    }

    for (const [sceneId, group] of groups) {
      const scene = typeof sceneMap !== 'undefined' ? sceneMap?.get(sceneId) : null;
      if (!scene) continue;
      const episode = typeof episodeMap !== 'undefined' ? episodeMap?.get(scene.episode_id) : null;
      const arc = episode && typeof arcMap !== 'undefined' ? arcMap?.get(episode.arc_id) : null;
      const people = unique(group.flatMap(event => peopleFor(event, scene)));
      const locationId = scene.location_id || group.map(event => event.location_id).find(Boolean) || null;
      const doc = makeDoc({
        kind: 'scene', id: sceneId, title: scene.title || group[0]?.scene_title || sceneId,
        body: group.map(event => `${event.title} ${event.text || ''}`).join(' '),
        context: [arc?.title, episode?.title].filter(Boolean).join(' › '),
        days: group.map(event => event.day), personIds: people, locationId,
        arcIds: arc?.id ? [arc.id] : [], origins: unique(group.flatMap(eventOrigins)),
        keywords: [...people.flatMap(entityTerms), ...entityTerms(locationId), episode?.title, arc?.title],
        firstEventId: group.slice().sort((a,b)=>(eventOrder.get(a.id)??0)-(eventOrder.get(b.id)??0))[0]?.id,
        order: Math.min(...group.map(event => eventOrder.get(event.id) ?? Number.MAX_SAFE_INTEGER))
      });
      docs.push(doc); sceneDocs.set(sceneId, doc);
    }

    const episodeGroups = new Map();
    for (const sceneDoc of sceneDocs.values()) {
      const scene = typeof sceneMap !== 'undefined' ? sceneMap?.get(sceneDoc.id) : null;
      if (!scene?.episode_id) continue;
      if (!episodeGroups.has(scene.episode_id)) episodeGroups.set(scene.episode_id, []);
      episodeGroups.get(scene.episode_id).push(sceneDoc);
    }
    for (const [episodeId, scenes] of episodeGroups) {
      const episode = typeof episodeMap !== 'undefined' ? episodeMap?.get(episodeId) : null;
      if (!episode) continue;
      const arc = typeof arcMap !== 'undefined' ? arcMap?.get(episode.arc_id) : null;
      const doc = makeDoc({
        kind: 'episode', id: episodeId, title: episode.title || episodeId,
        body: scenes.map(scene => `${scene.title} ${scene.body}`).join(' '),
        context: arc?.title || '', days: scenes.flatMap(scene => scene.days),
        personIds: unique(scenes.flatMap(scene => scene.personIds)),
        arcIds: arc?.id ? [arc.id] : [], origins: unique(scenes.flatMap(scene => scene.origins)),
        keywords: [arc?.title, ...scenes.map(scene => scene.title)],
        firstEventId: scenes.slice().sort((a,b)=>a.order-b.order)[0]?.firstEventId,
        order: Math.min(...scenes.map(scene => scene.order))
      });
      docs.push(doc); episodeDocs.set(episodeId, doc);
    }

    const arcGroups = new Map();
    for (const episodeDoc of episodeDocs.values()) {
      for (const arcId of episodeDoc.arcIds) {
        if (!arcGroups.has(arcId)) arcGroups.set(arcId, []);
        arcGroups.get(arcId).push(episodeDoc);
      }
    }
    for (const [arcId, episodes] of arcGroups) {
      const arc = typeof arcMap !== 'undefined' ? arcMap?.get(arcId) : null;
      if (!arc) continue;
      docs.push(makeDoc({
        kind: 'arc', id: arcId, title: arc.title || arcId,
        body: episodes.map(episode => `${episode.title} ${episode.body}`).join(' '),
        context: `${episodes.length} ${episodes.length === 1 ? 'епізод' : 'епізодів'}`,
        days: episodes.flatMap(episode => episode.days), personIds: unique(episodes.flatMap(episode => episode.personIds)),
        arcIds: [arcId], origins: unique(episodes.flatMap(episode => episode.origins)),
        keywords: episodes.map(episode => episode.title),
        firstEventId: episodes.slice().sort((a,b)=>a.order-b.order)[0]?.firstEventId,
        order: Math.min(...episodes.map(episode => episode.order))
      }));
    }

    const relatedByPerson = new Map();
    const relatedByLocation = new Map();
    for (const doc of momentDocs) {
      for (const personId of doc.personIds) {
        if (!relatedByPerson.has(personId)) relatedByPerson.set(personId, []);
        relatedByPerson.get(personId).push(doc);
      }
      if (doc.locationId) {
        if (!relatedByLocation.has(doc.locationId)) relatedByLocation.set(doc.locationId, []);
        relatedByLocation.get(doc.locationId).push(doc);
      }
    }

    if (typeof entityMap !== 'undefined' && entityMap) {
      for (const [id, related] of relatedByPerson) {
        const entity = entityMap.get(id); if (!entity) continue;
        docs.push(makeDoc({
          kind: 'person', id, title: entityLabel(entity), aliases: unique([entity.name, ...(entity.aliases || [])]),
          context: `${related.length} ${related.length === 1 ? 'подія' : related.length >= 2 && related.length <= 4 ? 'події' : 'подій'} у хронології`,
          days: related.flatMap(doc => doc.days), personIds: [id], arcIds: unique(related.flatMap(doc => doc.arcIds)),
          origins: unique(related.flatMap(doc => doc.origins)), firstEventId: related.slice().sort((a,b)=>a.order-b.order)[0]?.id,
          order: Math.min(...related.map(doc => doc.order))
        }));
      }
      for (const [id, related] of relatedByLocation) {
        const entity = entityMap.get(id); if (!entity) continue;
        docs.push(makeDoc({
          kind: 'location', id, title: entityLabel(entity), aliases: unique([entity.name, ...(entity.aliases || [])]),
          context: `${related.length} ${related.length === 1 ? 'подія' : related.length >= 2 && related.length <= 4 ? 'події' : 'подій'} у цьому місці`,
          days: related.flatMap(doc => doc.days), locationId: id, personIds: unique(related.flatMap(doc => doc.personIds)),
          arcIds: unique(related.flatMap(doc => doc.arcIds)), origins: unique(related.flatMap(doc => doc.origins)),
          firstEventId: related.slice().sort((a,b)=>a.order-b.order)[0]?.id, order: Math.min(...related.map(doc => doc.order))
        }));
      }
    }

    cachedKey = key;
    cachedDocs = docs;
    cachedCounts = docs.reduce((counts, doc) => ((counts[doc.kind] = (counts[doc.kind] || 0) + 1), counts), {});
    return docs;
  }

  function cleanQuery(raw, parsedDate, source) {
    let working = String(raw ?? '');
    if (parsedDate?.match) working = working.replace(parsedDate.match, ' ');
    const relation = working.match(/(?:що\s+було\s+)?\b(перед|після)\s+(.+)/i);
    if (relation) working = relation[2];
    const sourceWords = source ? SOURCE_WORDS[source] || [] : [];
    return tokens(working)
      .filter(token => !FILLER.has(token) && !sourceWords.map(normalize).includes(token))
      .join(' ');
  }

  function parseIntent(raw) {
    const parsedDate = parseDate(raw);
    const source = inferSource(raw);
    const relationMatch = String(raw ?? '').match(/(?:що\s+було\s+)?\b(перед|після)\s+(.+)/i);
    return {
      type: inferType(raw),
      date: parsedDate?.day ?? null,
      source,
      relation: relationMatch ? relationMatch[1].toLowerCase() : null,
      relationText: relationMatch ? relationMatch[2] : '',
      query: cleanQuery(raw, parsedDate, source)
    };
  }

  function scoreDoc(doc, query) {
    const q = normalize(query);
    if (!q) return 1;
    let score = 0;
    if (doc.titleNorm === q) score += 260;
    else if (doc.titleNorm.startsWith(q)) score += 190;
    else if (doc.titleNorm.includes(q)) score += 145;
    if (doc.aliasNorm === q) score += 220;
    else if (doc.aliasNorm.includes(q)) score += 125;
    if (doc.contextNorm.includes(q)) score += 72;
    if (doc.bodyNorm.includes(q)) score += 48;
    if (doc.allNorm.includes(q)) score += 32;

    const queryTokens = tokens(q).filter(token => !FILLER.has(token));
    let matched = 0;
    for (const token of queryTokens) {
      let best = 0;
      if (doc.titleNorm.split(' ').includes(token)) best = 1;
      else if (doc.aliasNorm.split(' ').includes(token)) best = .98;
      else {
        for (const candidate of doc.searchTokens) {
          const value = similarity(token, candidate);
          if (value > best) best = value;
          if (best >= .98) break;
        }
      }
      if (best >= .68) {
        matched++;
        score += best >= .98 ? 34 : best >= .88 ? 24 : best >= .78 ? 16 : 10;
      }
    }
    if (queryTokens.length && matched < Math.ceil(queryTokens.length * .5) && score < 80) return 0;
    return score;
  }

  function selectedFilters(intent) {
    const person = document.getElementById('searchPerson')?.value || '';
    const arc = document.getElementById('searchArc')?.value || '';
    const source = document.getElementById('searchSource')?.value || intent.source || '';
    const dateValue = document.getElementById('searchDate')?.value.trim() || '';
    const parsedDate = dateValue ? parseDate(dateValue) : null;
    const dateInvalid = Boolean(dateValue && !parsedDate);
    const type = activeType !== 'all' ? activeType : (intent.type || 'all');
    return { person, arc, source, date: parsedDate?.day ?? intent.date, dateInvalid, type };
  }

  function passesFilters(doc, filters) {
    if (filters.type !== 'all' && doc.kind !== filters.type) return false;
    if (filters.person && !doc.personIds.includes(filters.person)) return false;
    if (filters.arc && !doc.arcIds.includes(filters.arc)) return false;
    if (filters.source && !doc.origins.includes(filters.source)) return false;
    if (Number.isFinite(filters.date) && !doc.days.includes(filters.date)) return false;
    return true;
  }

  function relationResult(docs, intent, filters) {
    if (!intent.relation || !intent.relationText) return null;
    const anchorQuery = cleanQuery(intent.relationText, parseDate(intent.relationText), inferSource(intent.relationText));
    const moments = docs.filter(doc => doc.kind === 'moment');
    const anchors = moments
      .map(doc => ({doc, score: scoreDoc(doc, anchorQuery || intent.relationText)}))
      .filter(item => item.score > 0)
      .sort((a,b) => b.score - a.score || a.doc.order - b.doc.order);
    const anchor = anchors[0]?.doc;
    if (!anchor) return { items: [], anchor: null };
    const ordered = moments.slice().sort((a,b) => a.order - b.order);
    let index = ordered.findIndex(doc => doc.id === anchor.id);
    const step = intent.relation === 'перед' ? -1 : 1;
    while (index + step >= 0 && index + step < ordered.length) {
      index += step;
      const candidate = ordered[index];
      if (passesFilters(candidate, {...filters, type:'moment'})) return { items: [candidate], anchor };
    }
    return { items: [], anchor };
  }

  function searchDocs(raw) {
    const docs = buildIndex();
    const intent = parseIntent(raw);
    const filters = selectedFilters(intent);
    if (filters.dateInvalid) return { items: [], total: 0, intent, filters, invalidDate: true };

    const relation = relationResult(docs, intent, filters);
    if (relation) return { items: relation.items, total: relation.items.length, intent, filters, relationAnchor: relation.anchor };

    const query = intent.query;
    const ranked = docs
      .filter(doc => passesFilters(doc, filters))
      .map(doc => ({doc, score: scoreDoc(doc, query)}))
      .filter(item => item.score > 0)
      .sort((a,b) => b.score - a.score || a.doc.order - b.doc.order || a.doc.title.localeCompare(b.doc.title, 'uk'));
    return { items: ranked.map(item => item.doc), total: ranked.length, intent, filters };
  }

  function dateLabel(doc) {
    if (!doc.days.length) return '';
    const min = Math.min(...doc.days), max = Math.max(...doc.days);
    const format = day => typeof dateText === 'function' ? dateText(day) : String(day + 1);
    return min === max ? format(min) : `${format(min)}–${format(max)}`;
  }

  function resultHtml(doc) {
    const type = TYPE_LABELS[doc.kind] || doc.kind;
    const side = doc.kind === 'person' || doc.kind === 'location' ? doc.context : dateLabel(doc);
    const context = doc.kind === 'person' || doc.kind === 'location' ? '' : doc.context;
    return `<button class="result search-result" data-search-kind="${html(doc.kind)}" data-search-id="${html(doc.id)}"><span class="search-result-copy"><span class="search-result-heading"><span class="search-kind">${html(type)}</span><strong>${html(doc.title)}</strong></span>${context ? `<span class="result-context">${html(context)}</span>` : ''}</span><small>${html(side)}</small></button>`;
  }

  function hasActiveUiFilters() {
    return activeType !== 'all' || Boolean(document.getElementById('searchPerson')?.value || document.getElementById('searchArc')?.value || document.getElementById('searchSource')?.value || document.getElementById('searchDate')?.value.trim());
  }

  function summaryText(result) {
    if (result.invalidDate) return 'Дата не розпізнана · використовуй 22.01 або 1 серпня';
    if (result.relationAnchor) {
      const relationWord = result.intent.relation === 'перед' ? 'Перед' : 'Після';
      return `${relationWord} «${result.relationAnchor.title}» · ${result.total} результат`;
    }
    const parts = [];
    if (result.filters.type !== 'all') parts.push(TYPE_LABELS[result.filters.type] || result.filters.type);
    if (result.filters.person && typeof entityMap !== 'undefined') parts.push(entityLabel(entityMap.get(result.filters.person)));
    if (Number.isFinite(result.filters.date)) parts.push(typeof dateText === 'function' ? dateText(result.filters.date) : String(result.filters.date + 1));
    if (result.filters.arc && typeof arcMap !== 'undefined') parts.push(arcMap.get(result.filters.arc)?.title || result.filters.arc);
    if (result.filters.source) parts.push(typeof origins !== 'undefined' ? (origins[result.filters.source] || result.filters.source) : result.filters.source);
    const count = `${result.total} ${result.total === 1 ? 'результат' : result.total >= 2 && result.total <= 4 ? 'результати' : 'результатів'}`;
    return parts.length ? `${count} · ${parts.join(' · ')}` : count;
  }

  function ensureFilters() {
    const docs = buildIndex();
    if (!docs.length) return;
    const personSelect = document.getElementById('searchPerson');
    const arcSelect = document.getElementById('searchArc');
    const sourceSelect = document.getElementById('searchSource');
    if (!personSelect || !arcSelect || !sourceSelect) return;
    const key = cachedKey;
    if (personSelect.dataset.searchOptionsKey === key) return;

    const keepPerson = personSelect.value, keepArc = arcSelect.value, keepSource = sourceSelect.value;
    const persons = docs.filter(doc => doc.kind === 'person').sort((a,b)=>a.title.localeCompare(b.title,'uk'));
    const arcs = docs.filter(doc => doc.kind === 'arc').sort((a,b)=>a.order-b.order);
    const sourceCodes = unique(docs.filter(doc => doc.kind === 'moment').flatMap(doc => doc.origins)).sort();
    personSelect.innerHTML = `<option value="">Усі персонажі</option>${persons.map(doc=>`<option value="${html(doc.id)}">${html(doc.title)}</option>`).join('')}`;
    arcSelect.innerHTML = `<option value="">Усі арки</option>${arcs.map(doc=>`<option value="${html(doc.id)}">${html(doc.title)}</option>`).join('')}`;
    sourceSelect.innerHTML = `<option value="">Усі джерела</option>${sourceCodes.map(code=>`<option value="${html(code)}">${html(typeof origins !== 'undefined' ? (origins[code] || code) : code)}</option>`).join('')}`;
    if ([...personSelect.options].some(option=>option.value===keepPerson)) personSelect.value=keepPerson;
    if ([...arcSelect.options].some(option=>option.value===keepArc)) arcSelect.value=keepArc;
    if ([...sourceSelect.options].some(option=>option.value===keepSource)) sourceSelect.value=keepSource;
    personSelect.dataset.searchOptionsKey = key;
  }

  function syncTypeButtons() {
    document.querySelectorAll('[data-search-type]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.searchType === activeType)));
  }

  function syncHoverGlass() {
    const root = document.getElementById('searchResults');
    if (!root) return;
    let glass = root.querySelector(':scope > .hierarchy-hover-glass');
    if (!glass) {
      glass = document.createElement('span');
      glass.className = 'hierarchy-hover-glass';
      glass.setAttribute('aria-hidden','true');
      root.prepend(glass);
    }
    const move = row => {
      glass.style.transform = `translate3d(0,${row.offsetTop}px,0)`;
      glass.style.height = `${row.offsetHeight}px`;
      glass.style.opacity = '1';
    };
    root.querySelectorAll(':scope > .search-result').forEach(row => {
      row.addEventListener('pointerenter', event => {
        if (event.pointerType === 'touch' || (window.matchMedia && !window.matchMedia('(any-hover: hover)').matches)) return;
        move(row);
      });
      row.addEventListener('focusin', () => move(row));
    });
    root.addEventListener('pointerleave', () => { glass.style.opacity = '0'; }, {once:true});
  }

  function render() {
    if (typeof data === 'undefined' || !data) return;
    const input = document.getElementById('eventSearch');
    const results = document.getElementById('searchResults');
    const summary = document.getElementById('searchSummary');
    const more = document.getElementById('moreResults');
    const suggestions = document.getElementById('searchSuggestions');
    if (!input || !results || !summary || !more) return;

    ensureFilters();
    syncTypeButtons();
    const raw = input.value.trim();
    const noIntent = !raw && !hasActiveUiFilters();
    if (suggestions) suggestions.hidden = !noIntent;

    if (noIntent) {
      buildIndex();
      const parts = Object.entries(TYPE_LABELS).map(([kind,label])=>`${cachedCounts[kind] || 0} ${label.toLowerCase()}`);
      summary.textContent = `Індекс: ${parts.join(' · ')}`;
      results.innerHTML = '<div class="search-empty-enhanced"><p>Шукай за назвою, описом, персонажем, місцем або просто сформулюй запит.</p></div>';
      more.hidden = true;
      return;
    }

    const result = searchDocs(raw);
    const limit = typeof searchLimit !== 'undefined' ? searchLimit : 30;
    const visible = result.items.slice(0, limit);
    summary.textContent = summaryText(result);
    results.innerHTML = visible.length
      ? visible.map(resultHtml).join('')
      : '<div class="search-empty-enhanced"><p>Нічого не знайдено. Спробуй коротший запит або очисти частину фільтрів.</p><button class="search-chip" data-enhanced-search-reset>Очистити</button></div>';
    more.hidden = result.total <= limit;
    syncHoverGlass();
  }

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; render(); }, 0);
  }

  function reset() {
    const input = document.getElementById('eventSearch');
    if (input) input.value = '';
    for (const id of ['searchPerson','searchArc','searchSource','searchDate']) {
      const control = document.getElementById(id);
      if (control) control.value = '';
    }
    activeType = 'all';
    if (typeof searchLimit !== 'undefined') searchLimit = 30;
    render();
    input?.focus();
  }

  function navigate(doc, trigger) {
    if (!doc) return;
    if (doc.kind === 'moment' && typeof navigateEvent === 'function') return navigateEvent(doc.id);
    if (doc.kind === 'scene') {
      if (doc.firstEventId && typeof navigateEvent === 'function') navigateEvent(doc.firstEventId);
      if (typeof readScene === 'function') return readScene(doc.id, document.getElementById('searchButton') || trigger);
      return;
    }
    if ((doc.kind === 'episode' || doc.kind === 'arc') && typeof navigateStory === 'function') return navigateStory(doc.kind, doc.id);
    if (doc.kind === 'person') {
      if (typeof closePanels === 'function') closePanels();
      if (typeof setFocus === 'function') setFocus(doc.id);
      if (typeof openProfile === 'function') openProfile(doc.id, document.getElementById('searchButton') || trigger);
      return;
    }
    if (doc.kind === 'location' && doc.firstEventId && typeof navigateEvent === 'function') navigateEvent(doc.firstEventId);
  }

  function boot() {
    const results = document.getElementById('searchResults');
    const panel = document.getElementById('searchPanel');
    if (!results || !panel) return;

    if (window.MutationObserver) {
      const observer = new window.MutationObserver(() => {
        if (results.querySelector('[data-search-kind],.search-empty-enhanced')) return;
        scheduleRender();
      });
      observer.observe(results, {childList:true});
    }

    document.querySelectorAll('[data-search-type]').forEach(button => button.addEventListener('click', () => {
      activeType = button.dataset.searchType || 'all';
      if (typeof searchLimit !== 'undefined') searchLimit = 30;
      render();
    }));
    for (const id of ['searchPerson','searchArc','searchSource']) document.getElementById(id)?.addEventListener('change', () => {
      if (typeof searchLimit !== 'undefined') searchLimit = 30;
      render();
    });
    document.getElementById('searchDate')?.addEventListener('input', () => {
      if (typeof searchLimit !== 'undefined') searchLimit = 30;
      render();
    });
    document.getElementById('clearSearchFilters')?.addEventListener('click', reset);
    document.getElementById('searchSuggestions')?.addEventListener('click', event => {
      const button = event.target.closest('[data-search-suggestion]');
      if (!button) return;
      const input = document.getElementById('eventSearch');
      input.value = button.dataset.searchSuggestion;
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.focus();
    });
    results.addEventListener('click', event => {
      const resetButton = event.target.closest('[data-enhanced-search-reset]');
      if (resetButton) return reset();
      const button = event.target.closest('[data-search-kind][data-search-id]');
      if (!button) return;
      const doc = buildIndex().find(item => item.kind === button.dataset.searchKind && item.id === button.dataset.searchId);
      navigate(doc, button);
    });
    panel.addEventListener('toggle', event => { if (event.newState === 'open') scheduleRender(); });
    document.getElementById('searchButton')?.addEventListener('click', scheduleRender);
    document.getElementById('continuity')?.addEventListener('change', () => {
      cachedKey = '';
      document.getElementById('searchPerson')?.removeAttribute('data-search-options-key');
      scheduleRender();
    });
  }

  return { boot, render, normalize, similarity, parseDate, inferType, parseIntent, buildIndex, searchDocs };
})();

if (typeof window !== 'undefined') window.TimelineSearchEnhanced = TimelineSearchEnhanced;
if (typeof document !== 'undefined') TimelineSearchEnhanced.boot();
