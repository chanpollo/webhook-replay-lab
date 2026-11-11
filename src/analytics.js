export const outcomes = [
  ['unknown', 'Unknown delivery'], ['http_error', 'HTTP non-2xx'],
  ['blocked', 'Blocked before send'], ['http_ok', 'HTTP 2xx received'],
  ['active', 'In progress'], ['unclassified', 'Unclassified response']
];
export function outcomeKey(attempt) {
  if (attempt.outcome === 'unknown_delivery') return 'unknown';
  if (attempt.outcome === 'blocked') return 'blocked';
  if (['sending', 'validating'].includes(attempt.outcome)) return 'active';
  if (attempt.outcome === 'response_received' && Number.isInteger(attempt.status) && attempt.status >= 100 && attempt.status <= 599) return attempt.status >= 200 && attempt.status < 300 ? 'http_ok' : 'http_error';
  return 'unclassified';
}
export function attemptsOf(events) {
  return events.flatMap(event => (event.attempts || []).map(attempt => ({...attempt, eventId:event.id, eventLabel:event.label}))).sort((a,b) => (b.at || 0) - (a.at || 0));
}
export function activity(events, now, hours = 24) {
  const start = now - hours * 3600000;
  const within = at => Number.isFinite(at) && at > start && at <= now;
  const attempts = attemptsOf(events).filter(a => within(a.at));
  const captures = events.filter(e => within(e.createdAt));
  const buckets = Array.from({length:12}, (_,i) => ({start:start + i * hours * 300000, end:start + (i+1) * hours * 300000, captures:0, attempts:0}));
  const add = (at, key) => { const index=Math.min(11, Math.max(0, Math.ceil((at-start)/(hours*300000))-1)); buckets[index][key]++; };
  captures.forEach(e => add(e.createdAt, 'captures'));
  attempts.forEach(a => add(a.at, 'attempts'));
  const counts = Object.fromEntries(outcomes.map(([key]) => [key,0]));
  attempts.forEach(a => counts[outcomeKey(a)]++);
  const durations = attempts.filter(a => a.outcome === 'response_received' && Number.isFinite(a.durationMs) && a.durationMs >= 0).map(a => a.durationMs).sort((a,b) => a-b);
  const middle=Math.floor(durations.length/2);
  const medianMs=durations.length ? (durations.length%2 ? durations[middle] : (durations[middle-1]+durations[middle])/2) : null;
  return {start, end:now, captures:captures.length, attempts, buckets, counts, medianMs, durationCount:durations.length};
}
export function filterAttempts(attempts, query='', outcome='all') {
  const term=query.trim().toLowerCase();
  return attempts.filter(a => (outcome === 'all' || outcomeKey(a) === outcome) && [a.eventLabel,a.eventId,a.id,a.url].some(value => String(value || '').toLowerCase().includes(term)));
}
