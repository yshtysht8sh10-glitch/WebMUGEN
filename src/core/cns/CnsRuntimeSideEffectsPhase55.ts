import type { PlayerState } from '../engine/types';
import type { CnsStateController } from '../../mugen/common/cnsTypes';

export type SideEffectCommand = 'explod' | 'removeExplod' | 'destroySelf' | 'changeAnim2';
export type SideEffectResult = { player: PlayerState; executed: boolean; name: string; command?: SideEffectCommand; payload?: unknown };

export function applyPhase55SideEffectController(player: PlayerState, controller: CnsStateController): SideEffectResult | null {
  const type = controller.type.toLowerCase();

  if (type === 'afterimage') return runtime(player, 'AfterImage', 'afterImageTime', num(controller, 'time') ?? 8);
  if (type === 'afterimagetime') return runtime(player, 'AfterImageTime', 'afterImageTime', num(controller, 'time') ?? num(controller, 'value') ?? 0);
  if (type === 'explod') return { player, executed: true, name: 'Explod', command: 'explod', payload: { id: num(controller, 'id'), animNo: num(controller, 'anim') ?? 0, removeTime: num(controller, 'removetime') } };
  if (type === 'removeexplod') return { player, executed: true, name: 'RemoveExplod', command: 'removeExplod', payload: { id: num(controller, 'id') ?? -1 } };
  if (type === 'destroyself') return { player, executed: true, name: 'DestroySelf', command: 'destroySelf' };
  if (type === 'changeanim2') return { player, executed: true, name: 'ChangeAnim2', command: 'changeAnim2', payload: { value: num(controller, 'value') } };

  return null;
}

function runtime(player: PlayerState, name: string, key: string, value: unknown): SideEffectResult {
  return { player: { ...player, runtime: { ...(player.runtime ?? {}), [key]: value } } as PlayerState, executed: true, name };
}

function num(controller: CnsStateController, key: string): number | null {
  const value = controller.params[key.toLowerCase()];
  if (typeof value === 'number') return value;
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}
