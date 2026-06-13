/**
 * Page content glue. Module pages author plain HTML with mount points:
 *
 *   <div data-widget="tip-to-tail" data-driven-by="01/add"></div>
 *   <div data-exercise="01/add"></div>
 *
 * mountAll() instantiates widgets from the page's factory map, mounts
 * exercise panels, and pipes each exercise's compiled learner functions to
 * every widget that declares data-driven-by with that exercise id.
 */

import type { UserFns } from '@/exercise/types'
import { getExercise } from '@/exercise/registry'
import { mountExercise } from '@/exercise/ExercisePanel'

export interface WidgetInstance {
  /**
   * Receive the learner's compiled functions, or null to detach (code no
   * longer valid / misbehaved on live input). Widgets must render something
   * sensible in the null state — typically the "waiting for your code" or
   * reference behavior.
   */
  setUserFns?: (fns: UserFns | null) => void
}

export type WidgetFactory = (container: HTMLElement) => WidgetInstance | void

export function mountAll(widgets: Record<string, WidgetFactory>): void {
  const driven = new Map<string, WidgetInstance[]>()

  for (const el of document.querySelectorAll<HTMLElement>('[data-widget]')) {
    const name = el.dataset.widget!
    const factory = widgets[name]
    if (!factory) {
      console.warn(`No widget factory registered for "${name}"`)
      continue
    }
    el.classList.add('widget')
    const instance = factory(el) ?? {}
    const exerciseId = el.dataset.drivenBy
    if (exerciseId) {
      const list = driven.get(exerciseId) ?? []
      list.push(instance)
      driven.set(exerciseId, list)
    }
  }

  for (const el of document.querySelectorAll<HTMLElement>('[data-exercise]')) {
    const id = el.dataset.exercise!
    mountExercise(el, getExercise(id), {
      onUserFns: (fns: UserFns | null) => {
        for (const w of driven.get(id) ?? []) w.setUserFns?.(fns)
      },
    })
  }
}
