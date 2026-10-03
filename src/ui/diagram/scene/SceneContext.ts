import { createContext, useContext } from 'react';
import type { Scene } from './buildScene';

/** Provides the current scene (node rectangles and routes) to edge components. */
export const SceneContext = createContext<Scene>({ nodes: [], edges: [], routes: new Map() });

export function useScene(): Scene {
  return useContext(SceneContext);
}
