export type Explod = { id: number; animNo: number; x: number; y: number; facing: 1 | -1; age: number; removeTime: number | null };
export type ExplodState = { explods: Explod[]; nextExplodId: number };

export function createInitialExplodState(): ExplodState {
  return { explods: [], nextExplodId: 1 };
}

export function addExplod(state: ExplodState, input: Omit<Explod, 'id' | 'age'> & { id?: number }): ExplodState {
  const id = input.id ?? state.nextExplodId;
  return {
    explods: [...state.explods, { id, animNo: input.animNo, x: input.x, y: input.y, facing: input.facing, removeTime: input.removeTime, age: 0 }],
    nextExplodId: Math.max(state.nextExplodId, id + 1),
  };
}

export function removeExplod(state: ExplodState, id: number): ExplodState {
  return { ...state, explods: state.explods.filter((explod) => explod.id !== id) };
}

export function stepExplods(state: ExplodState): ExplodState {
  return { ...state, explods: state.explods.map((e) => ({ ...e, age: e.age + 1 })).filter((e) => e.removeTime === null || e.age < e.removeTime) };
}
