import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

export const lessonIds = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08A",
  "08B",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
] as const;

const lessonSlugs = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08a",
  "08b",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
] as const;

export const lessonSchema = z.object({
  id: z.enum(lessonIds),
  slug: z.enum(lessonSlugs),
  title: z.string().min(1),
  description: z.string().min(1),
  level: z.enum(["1", "2", "3", "4", "5A", "5B", "6"]),
  track: z.enum(["common", "acoustic", "electric"]),
  order: z.number().int().min(1).max(15),
  previous: z.array(reference("lessons")).max(2),
  next: z.array(reference("lessons")).max(2),
});

export type LessonData = z.infer<typeof lessonSchema>;

const lessons = defineCollection({
  loader: glob({
    base: "./docs",
    pattern: "*.md",
    generateId: ({ data }) => String(data.id),
  }),
  schema: lessonSchema,
});

export const collections = { lessons };
