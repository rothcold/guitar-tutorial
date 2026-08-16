import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";

export type Lesson = CollectionEntry<"lessons">;

export async function getOrderedLessons() {
  return (await getCollection("lessons")).sort(
    (left, right) => left.data.order - right.data.order,
  );
}

export function getLessonPath(lesson: Lesson) {
  return `/lessons/${lesson.data.slug}`;
}

export function resolveLessonReferences(
  references: Lesson["data"]["previous"],
  lessonsById: Map<string, Lesson>,
) {
  return references.map(({ id }) => {
    const lesson = lessonsById.get(id);

    if (!lesson) {
      throw new Error(`Unknown lesson reference: ${id}`);
    }

    return lesson;
  });
}
