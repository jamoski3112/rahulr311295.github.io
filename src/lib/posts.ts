import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const postSlug = (post: Post) => post.data.slug ?? post.id;
export const postUrl = (post: Post) => `/${postSlug(post)}/`;

export async function getPosts(): Promise<Post[]> {
  const all = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function readingTime(body: string | undefined, wpm = 200) {
  const words = (body ?? '').replace(/```[\s\S]*?```/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / wpm));
}

export type Taxonomy = { name: string; slug: string; posts: Post[] };

function collect(posts: Post[], pick: (p: Post) => string[]): Taxonomy[] {
  const map = new Map<string, Taxonomy>();
  for (const post of posts) {
    for (const name of pick(post)) {
      const slug = slugify(name);
      const t = map.get(slug) ?? { name, slug, posts: [] };
      t.posts.push(post);
      map.set(slug, t);
    }
  }
  return [...map.values()].sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name));
}

export const getCategories = (posts: Post[]) => collect(posts, (p) => p.data.categories);
export const getTags = (posts: Post[]) => collect(posts, (p) => p.data.tags);

export function groupByYear(posts: Post[]) {
  const map = new Map<number, Post[]>();
  for (const p of posts) {
    const y = p.data.date.getFullYear();
    map.set(y, [...(map.get(y) ?? []), p]);
  }
  return [...map.entries()].sort((a, b) => b[0] - a[0]);
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
