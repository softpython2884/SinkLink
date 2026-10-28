// Immutable access to nested plain objects through dotted paths ("tune.contrast",
// "zones.2.exposure"). Untouched branches are shared between versions, which keeps
// history snapshots cheap.

const split = (path) => (Array.isArray(path) ? path : String(path).split('.'));

export function getIn(obj, path) {
  let value = obj;
  for (const key of split(path)) {
    if (value == null) return undefined;
    value = value[key];
  }
  return value;
}

export function setIn(obj, path, value) {
  const [key, ...rest] = split(path);
  const current = obj?.[key];
  const next = rest.length ? setIn(current ?? {}, rest, value) : value;
  if (Object.is(current, next)) return obj;
  if (Array.isArray(obj)) {
    const copy = obj.slice();
    copy[key] = next;
    return copy;
  }
  return { ...obj, [key]: next };
}

export function updateIn(obj, path, fn) {
  return setIn(obj, path, fn(getIn(obj, path)));
}

export function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const value of Object.values(obj)) deepFreeze(value);
  }
  return obj;
}
