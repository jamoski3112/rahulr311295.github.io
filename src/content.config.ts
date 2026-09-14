import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  // id = filename without extension, case preserved (Jekyll's :title permalink behaviour)
  loader: glob({
    pattern: '*.md',
    base: './src/content/posts',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().default(''),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    /** URL slug override; defaults to the file name */
    slug: z.string().optional(),
    teaser: z.string().optional(),
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    /** Present only on HackTheBox machine writeups – renders the machine info box */
    htb: z
      .object({
        machine: z.string(),
        os: z.string().optional(),
        difficulty: z.enum(['Easy', 'Medium', 'Hard', 'Insane']).optional(),
        points: z.number().optional(),
        ip: z.string().optional(),
        retired: z.coerce.date().optional(),
        profile: z.string().optional(),
        icon: z.string().optional(),
      })
      .optional(),
  }),
});

export const collections = { posts };
