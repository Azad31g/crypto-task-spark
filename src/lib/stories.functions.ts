import { createServerFn } from '@tanstack/react-start';
export type { Story, StoriesResult, StoryInsights, InsightPerson } from './stories.server';
// Safe parsing happens server-side and returns typed errors rather than rejected RPCs.
export const listStories = createServerFn({ method: 'POST' }).inputValidator((input: { initData?: string }) => input).handler(async ({ data }) => (await import('./stories.server')).readStories(data));
export const markStoryViewed = createServerFn({ method: 'POST' }).inputValidator((input: { initData: string; storyId: string }) => input).handler(async ({ data }) => (await import('./stories.server')).viewStory(data));
export const toggleStoryLike = createServerFn({ method: 'POST' }).inputValidator((input: { initData: string; storyId: string }) => input).handler(async ({ data }) => (await import('./stories.server')).likeStory(data));
export const addStoryComment = createServerFn({ method: 'POST' }).inputValidator((input: { initData: string; storyId: string; body: string }) => input).handler(async ({ data }) => (await import('./stories.server')).commentStory(data));
export const getStoryInsights = createServerFn({ method: 'POST' }).inputValidator((input: { initData: string; storyId: string }) => input).handler(async ({ data }) => (await import('./stories.server')).storyInsights(data));
