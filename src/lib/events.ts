type Listener = (paths: string[]) => void;
const listeners = new Set<Listener>();
export function subscribe(listener: Listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function publish(paths: string[]) { for (const listener of listeners) listener(paths); }
