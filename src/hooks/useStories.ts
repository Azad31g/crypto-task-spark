import { useCallback, useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { listStories, type StoriesResult } from '@/lib/stories.functions';
import { rawInitData } from '@/lib/azox-backend';

export function useStories() {
  const fetchStories = useServerFn(listStories);
  const [state, setState] = useState<StoriesResult>({ stories: [], engagement: false, isAdmin: false });
  const generation = useRef(0);
  const locallySeen = useRef(new Set<string>());
  const refetch = useCallback(async () => {
    const request = ++generation.current;
    try {
      const initData = rawInitData();
      const result = await fetchStories({ data: initData ? { initData } : {} });
      if (request !== generation.current) return;
      setState({ ...result, stories: result.stories.filter((s) => Date.parse(s.expires_at) > Date.now()).map((s) => ({ ...s, seen: s.seen || locallySeen.current.has(s.id) })) });
    } catch { /* Keep viewing available after transient connection failures. */ }
  }, [fetchStories]);
  useEffect(() => {
    void refetch();
    const focus = () => { if (document.visibilityState === 'visible') void refetch(); };
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    return () => { generation.current++; window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [refetch]);
  useEffect(() => {
    if (!state.stories.length) return;
    const expiry = Math.min(...state.stories.map((s) => Date.parse(s.expires_at)));
    const timer = window.setTimeout(() => setState((s) => ({ ...s, stories: s.stories.filter((story) => Date.parse(story.expires_at) > Date.now()) })), Math.max(0, expiry - Date.now()) + 25);
    return () => window.clearTimeout(timer);
  }, [state.stories]);
  const markSeen = useCallback((id: string) => {
    locallySeen.current.add(id);
    setState((s) => ({ ...s, stories: s.stories.map((story) => story.id === id ? { ...story, seen: true } : story) }));
  }, []);
  const setLiked = useCallback((id: string, liked: boolean) => setState((s) => ({ ...s, stories: s.stories.map((story) => story.id === id ? { ...story, liked } : story) })), []);
  return { ...state, refetch, markSeen, setLiked, hasUnseen: state.stories.some((s) => !s.seen) };
}
