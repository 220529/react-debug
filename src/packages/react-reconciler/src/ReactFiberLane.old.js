/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {FiberRoot} from './ReactInternalTypes';
import type {Transition} from './ReactFiberTracingMarkerComponent.old';

// TODO: Ideally these types would be opaque but that doesn't work well with
// our reconciler fork infra, since these leak into non-reconciler packages.

export type Lanes = number;
export type Lane = number;
export type LaneMap<T> = Array<T>;

import {
  enableSchedulingProfiler,
  enableUpdaterTracking,
  allowConcurrentByDefault,
  enableTransitionTracing,
} from 'shared/ReactFeatureFlags';
import {isDevToolsPresent} from './ReactFiberDevToolsHook.old';
import {ConcurrentUpdatesByDefaultMode, NoMode} from './ReactTypeOfMode';
import {clz32} from './clz32';

// Lane values below should be kept in sync with getLabelForLane(), used by react-devtools-timeline.
// If those values are changed that package should be rebuilt and redeployed.

export const TotalLanes = 31;

export const NoLanes: Lanes = /*                        */ 0b0000000000000000000000000000000;
export const NoLane: Lane = /*                          */ 0b0000000000000000000000000000000;

export const SyncLane: Lane = /*                        */ 0b0000000000000000000000000000001;

export const InputContinuousHydrationLane: Lane = /*    */ 0b0000000000000000000000000000010;
export const InputContinuousLane: Lane = /*             */ 0b0000000000000000000000000000100;

export const DefaultHydrationLane: Lane = /*            */ 0b0000000000000000000000000001000;
export const DefaultLane: Lane = /*                     */ 0b0000000000000000000000000010000;

const TransitionHydrationLane: Lane = /*                */ 0b0000000000000000000000000100000;
const TransitionLanes: Lanes = /*                       */ 0b0000000001111111111111111000000;
const TransitionLane1: Lane = /*                        */ 0b0000000000000000000000001000000;
const TransitionLane2: Lane = /*                        */ 0b0000000000000000000000010000000;
const TransitionLane3: Lane = /*                        */ 0b0000000000000000000000100000000;
const TransitionLane4: Lane = /*                        */ 0b0000000000000000000001000000000;
const TransitionLane5: Lane = /*                        */ 0b0000000000000000000010000000000;
const TransitionLane6: Lane = /*                        */ 0b0000000000000000000100000000000;
const TransitionLane7: Lane = /*                        */ 0b0000000000000000001000000000000;
const TransitionLane8: Lane = /*                        */ 0b0000000000000000010000000000000;
const TransitionLane9: Lane = /*                        */ 0b0000000000000000100000000000000;
const TransitionLane10: Lane = /*                       */ 0b0000000000000001000000000000000;
const TransitionLane11: Lane = /*                       */ 0b0000000000000010000000000000000;
const TransitionLane12: Lane = /*                       */ 0b0000000000000100000000000000000;
const TransitionLane13: Lane = /*                       */ 0b0000000000001000000000000000000;
const TransitionLane14: Lane = /*                       */ 0b0000000000010000000000000000000;
const TransitionLane15: Lane = /*                       */ 0b0000000000100000000000000000000;
const TransitionLane16: Lane = /*                       */ 0b0000000001000000000000000000000;

const RetryLanes: Lanes = /*                            */ 0b0000111110000000000000000000000;
const RetryLane1: Lane = /*                             */ 0b0000000010000000000000000000000;
const RetryLane2: Lane = /*                             */ 0b0000000100000000000000000000000;
const RetryLane3: Lane = /*                             */ 0b0000001000000000000000000000000;
const RetryLane4: Lane = /*                             */ 0b0000010000000000000000000000000;
const RetryLane5: Lane = /*                             */ 0b0000100000000000000000000000000;

export const SomeRetryLane: Lane = RetryLane1;

export const SelectiveHydrationLane: Lane = /*          */ 0b0001000000000000000000000000000;

const NonIdleLanes: Lanes = /*                          */ 0b0001111111111111111111111111111;

export const IdleHydrationLane: Lane = /*               */ 0b0010000000000000000000000000000;
export const IdleLane: Lane = /*                        */ 0b0100000000000000000000000000000;

export const OffscreenLane: Lane = /*                   */ 0b1000000000000000000000000000000;

// This function is used for the experimental timeline (react-devtools-timeline)
// It should be kept in sync with the Lanes values above.
export function getLabelForLane(lane: Lane): string | void {
  if (enableSchedulingProfiler) {
    if (lane & SyncLane) {
      return 'Sync';
    }
    if (lane & InputContinuousHydrationLane) {
      return 'InputContinuousHydration';
    }
    if (lane & InputContinuousLane) {
      return 'InputContinuous';
    }
    if (lane & DefaultHydrationLane) {
      return 'DefaultHydration';
    }
    if (lane & DefaultLane) {
      return 'Default';
    }
    if (lane & TransitionHydrationLane) {
      return 'TransitionHydration';
    }
    if (lane & TransitionLanes) {
      return 'Transition';
    }
    if (lane & RetryLanes) {
      return 'Retry';
    }
    if (lane & SelectiveHydrationLane) {
      return 'SelectiveHydration';
    }
    if (lane & IdleHydrationLane) {
      return 'IdleHydration';
    }
    if (lane & IdleLane) {
      return 'Idle';
    }
    if (lane & OffscreenLane) {
      return 'Offscreen';
    }
  }
}

export const NoTimestamp = -1;

let nextTransitionLane: Lane = TransitionLane1;
let nextRetryLane: Lane = RetryLane1;

function getHighestPriorityLanes(lanes: Lanes | Lane): Lanes {
  switch (getHighestPriorityLane(lanes)) {
    case SyncLane:
      return SyncLane;
    case InputContinuousHydrationLane:
      return InputContinuousHydrationLane;
    case InputContinuousLane:
      return InputContinuousLane;
    case DefaultHydrationLane:
      return DefaultHydrationLane;
    case DefaultLane:
      return DefaultLane;
    case TransitionHydrationLane:
      return TransitionHydrationLane;
    case TransitionLane1:
    case TransitionLane2:
    case TransitionLane3:
    case TransitionLane4:
    case TransitionLane5:
    case TransitionLane6:
    case TransitionLane7:
    case TransitionLane8:
    case TransitionLane9:
    case TransitionLane10:
    case TransitionLane11:
    case TransitionLane12:
    case TransitionLane13:
    case TransitionLane14:
    case TransitionLane15:
    case TransitionLane16:
      return lanes & TransitionLanes;
    case RetryLane1:
    case RetryLane2:
    case RetryLane3:
    case RetryLane4:
    case RetryLane5:
      return lanes & RetryLanes;
    case SelectiveHydrationLane:
      return SelectiveHydrationLane;
    case IdleHydrationLane:
      return IdleHydrationLane;
    case IdleLane:
      return IdleLane;
    case OffscreenLane:
      return OffscreenLane;
    default:
      if (__DEV__) {
        console.error(
          'Should have found matching lanes. This is a bug in React.',
        );
      }
      // This shouldn't be reachable, but as a fallback, return the entire bitmask.
      return lanes;
  }
}

export function getNextLanes(root: FiberRoot, wipLanes: Lanes): Lanes {
  // 提前终止：如果没有待处理的工作，直接返回 NoLanes
  const pendingLanes = root.pendingLanes;
  if (pendingLanes === NoLanes) {
    return NoLanes;
  }

  let nextLanes = NoLanes;

  // 获取挂起和重新激活的 lanes
  const suspendedLanes = root.suspendedLanes;
  const pingedLanes = root.pingedLanes;

  // 处理非空闲任务（优先级较高的任务），直到所有非空闲任务完成
  const nonIdlePendingLanes = pendingLanes & NonIdleLanes;
  if (nonIdlePendingLanes !== NoLanes) {
    // 找到所有未挂起的非空闲任务
    const nonIdleUnblockedLanes = nonIdlePendingLanes & ~suspendedLanes;
    if (nonIdleUnblockedLanes !== NoLanes) {
      // 获取优先级最高的 lane
      nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes);
    } else {
      // 否则查看是否有已激活的非空闲任务
      const nonIdlePingedLanes = nonIdlePendingLanes & pingedLanes;
      if (nonIdlePingedLanes !== NoLanes) {
        // 获取优先级最高的 lane
        nextLanes = getHighestPriorityLanes(nonIdlePingedLanes);
      }
    }
  } else {
    // 如果没有非空闲任务，只剩下空闲任务
    const unblockedLanes = pendingLanes & ~suspendedLanes;
    if (unblockedLanes !== NoLanes) {
      // 获取优先级最高的空闲任务
      nextLanes = getHighestPriorityLanes(unblockedLanes);
    } else {
      // 如果有重新激活的空闲任务，获取优先级最高的任务
      if (pingedLanes !== NoLanes) {
        nextLanes = getHighestPriorityLanes(pingedLanes);
      }
    }
  }

  // 如果没有找到可执行的任务，返回 NoLanes
  if (nextLanes === NoLanes) {
    // 这个情况只会发生在所有任务被挂起时
    return NoLanes;
  }

  // 如果当前有正在处理的任务，不要轻易切换任务，除非新任务优先级更高
  if (
    wipLanes !== NoLanes &&
    wipLanes !== nextLanes &&
    (wipLanes & suspendedLanes) === NoLanes
  ) {
    const nextLane = getHighestPriorityLane(nextLanes);
    const wipLane = getHighestPriorityLane(wipLanes);
    if (
      // 如果新任务优先级小于等于正在处理的任务优先级，则继续处理当前任务
      nextLane >= wipLane ||
      // 默认优先级任务不应该打断 transition 更新
      (nextLane === DefaultLane && (wipLane & TransitionLanes) !== NoLanes)
    ) {
      return wipLanes;
    }
  }

  // 处理并发模式
  if (
    allowConcurrentByDefault &&
    (root.current.mode & ConcurrentUpdatesByDefaultMode) !== NoMode
  ) {
    // 什么都不做，继续使用分配的 lanes
  } else if ((nextLanes & InputContinuousLane) !== NoLanes) {
    // 在同步默认更新时，将连续优先级更新和默认更新绑定在一起
    nextLanes |= pendingLanes & DefaultLane;
  }

  // 检查并处理被牵连的 lanes
  const entangledLanes = root.entangledLanes;
  if (entangledLanes !== NoLanes) {
    const entanglements = root.entanglements;
    let lanes = nextLanes & entangledLanes;
    while (lanes > 0) {
      const index = pickArbitraryLaneIndex(lanes);
      const lane = 1 << index;

      // 把被牵连的 lanes 加入当前要处理的 lanes 中
      nextLanes |= entanglements[index];

      // 清除当前 lane
      lanes &= ~lane;
    }
  }

  // 返回最终的 nextLanes
  return nextLanes;
}

export function getMostRecentEventTime(root: FiberRoot, lanes: Lanes): number {
  const eventTimes = root.eventTimes;

  let mostRecentEventTime = NoTimestamp;
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;

    const eventTime = eventTimes[index];
    if (eventTime > mostRecentEventTime) {
      mostRecentEventTime = eventTime;
    }

    lanes &= ~lane;
  }

  return mostRecentEventTime;
}

function computeExpirationTime(lane: Lane, currentTime: number) {
  switch (lane) {
    case SyncLane:
    case InputContinuousHydrationLane:
    case InputContinuousLane:
      // User interactions should expire slightly more quickly.
      //
      // NOTE: This is set to the corresponding constant as in Scheduler.js.
      // When we made it larger, a product metric in www regressed, suggesting
      // there's a user interaction that's being starved by a series of
      // synchronous updates. If that theory is correct, the proper solution is
      // to fix the starvation. However, this scenario supports the idea that
      // expiration times are an important safeguard when starvation
      // does happen.
      return currentTime + 250;
    case DefaultHydrationLane:
    case DefaultLane:
    case TransitionHydrationLane:
    case TransitionLane1:
    case TransitionLane2:
    case TransitionLane3:
    case TransitionLane4:
    case TransitionLane5:
    case TransitionLane6:
    case TransitionLane7:
    case TransitionLane8:
    case TransitionLane9:
    case TransitionLane10:
    case TransitionLane11:
    case TransitionLane12:
    case TransitionLane13:
    case TransitionLane14:
    case TransitionLane15:
    case TransitionLane16:
      return currentTime + 5000;
    case RetryLane1:
    case RetryLane2:
    case RetryLane3:
    case RetryLane4:
    case RetryLane5:
      // TODO: Retries should be allowed to expire if they are CPU bound for
      // too long, but when I made this change it caused a spike in browser
      // crashes. There must be some other underlying bug; not super urgent but
      // ideally should figure out why and fix it. Unfortunately we don't have
      // a repro for the crashes, only detected via production metrics.
      return NoTimestamp;
    case SelectiveHydrationLane:
    case IdleHydrationLane:
    case IdleLane:
    case OffscreenLane:
      // Anything idle priority or lower should never expire.
      return NoTimestamp;
    default:
      if (__DEV__) {
        console.error(
          'Should have found matching lanes. This is a bug in React.',
        );
      }
      return NoTimestamp;
  }
}

export function markStarvedLanesAsExpired(
  root: FiberRoot,
  currentTime: number,
): void {
  // TODO: This gets called every time we yield. We can optimize by storing
  // the earliest expiration time on the root. Then use that to quickly bail out
  // of this function.

  const pendingLanes = root.pendingLanes;
  const suspendedLanes = root.suspendedLanes;
  const pingedLanes = root.pingedLanes;
  const expirationTimes = root.expirationTimes;

  // Iterate through the pending lanes and check if we've reached their
  // expiration time. If so, we'll assume the update is being starved and mark
  // it as expired to force it to finish.
  let lanes = pendingLanes;
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;

    const expirationTime = expirationTimes[index];
    if (expirationTime === NoTimestamp) {
      // Found a pending lane with no expiration time. If it's not suspended, or
      // if it's pinged, assume it's CPU-bound. Compute a new expiration time
      // using the current time.
      if (
        (lane & suspendedLanes) === NoLanes ||
        (lane & pingedLanes) !== NoLanes
      ) {
        // Assumes timestamps are monotonically increasing.
        expirationTimes[index] = computeExpirationTime(lane, currentTime);
      }
    } else if (expirationTime <= currentTime) {
      // This lane expired
      root.expiredLanes |= lane;
    }

    lanes &= ~lane;
  }
}

// This returns the highest priority pending lanes regardless of whether they
// are suspended.
export function getHighestPriorityPendingLanes(root: FiberRoot) {
  return getHighestPriorityLanes(root.pendingLanes);
}

export function getLanesToRetrySynchronouslyOnError(root: FiberRoot): Lanes {
  const everythingButOffscreen = root.pendingLanes & ~OffscreenLane;
  if (everythingButOffscreen !== NoLanes) {
    return everythingButOffscreen;
  }
  if (everythingButOffscreen & OffscreenLane) {
    return OffscreenLane;
  }
  return NoLanes;
}

export function includesSyncLane(lanes: Lanes) {
  return (lanes & SyncLane) !== NoLanes;
}

export function includesNonIdleWork(lanes: Lanes) {
  return (lanes & NonIdleLanes) !== NoLanes;
}
export function includesOnlyRetries(lanes: Lanes) {
  return (lanes & RetryLanes) === lanes;
}
export function includesOnlyNonUrgentLanes(lanes: Lanes) {
  const UrgentLanes = SyncLane | InputContinuousLane | DefaultLane;
  return (lanes & UrgentLanes) === NoLanes;
}
export function includesOnlyTransitions(lanes: Lanes) {
  return (lanes & TransitionLanes) === lanes;
}

export function includesBlockingLane(root: FiberRoot, lanes: Lanes) {
  if (
    allowConcurrentByDefault &&
    (root.current.mode & ConcurrentUpdatesByDefaultMode) !== NoMode
  ) {
    // Concurrent updates by default always use time slicing.
    return false;
  }
  const SyncDefaultLanes =
    InputContinuousHydrationLane |
    InputContinuousLane |
    DefaultHydrationLane |
    DefaultLane;
  return (lanes & SyncDefaultLanes) !== NoLanes;
}

export function includesExpiredLane(root: FiberRoot, lanes: Lanes) {
  // This is a separate check from includesBlockingLane because a lane can
  // expire after a render has already started.
  return (lanes & root.expiredLanes) !== NoLanes;
}

export function isTransitionLane(lane: Lane) {
  return (lane & TransitionLanes) !== NoLanes;
}

export function claimNextTransitionLane(): Lane {
  // Cycle through the lanes, assigning each new transition to the next lane.
  // In most cases, this means every transition gets its own lane, until we
  // run out of lanes and cycle back to the beginning.
  const lane = nextTransitionLane;
  nextTransitionLane <<= 1;
  if ((nextTransitionLane & TransitionLanes) === NoLanes) {
    nextTransitionLane = TransitionLane1;
  }
  return lane;
}

export function claimNextRetryLane(): Lane {
  const lane = nextRetryLane;
  nextRetryLane <<= 1;
  if ((nextRetryLane & RetryLanes) === NoLanes) {
    nextRetryLane = RetryLane1;
  }
  return lane;
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

export function pickArbitraryLane(lanes: Lanes): Lane {
  // This wrapper function gets inlined. Only exists so to communicate that it
  // doesn't matter which bit is selected; you can pick any bit without
  // affecting the algorithms where its used. Here I'm using
  // getHighestPriorityLane because it requires the fewest operations.
  return getHighestPriorityLane(lanes);
}

function pickArbitraryLaneIndex(lanes: Lanes) {
  return 31 - clz32(lanes);
}

function laneToIndex(lane: Lane) {
  return pickArbitraryLaneIndex(lane);
}

export function includesSomeLane(a: Lanes | Lane, b: Lanes | Lane) {
  return (a & b) !== NoLanes;
}

export function isSubsetOfLanes(set: Lanes, subset: Lanes | Lane) {
  return (set & subset) === subset;
}

export function mergeLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a | b;
}

export function removeLanes(set: Lanes, subset: Lanes | Lane): Lanes {
  return set & ~subset;
}

export function intersectLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a & b;
}

// Seems redundant, but it changes the type from a single lane (used for
// updates) to a group of lanes (used for flushing work).
export function laneToLanes(lane: Lane): Lanes {
  return lane;
}

export function higherPriorityLane(a: Lane, b: Lane) {
  // This works because the bit ranges decrease in priority as you go left.
  return a !== NoLane && a < b ? a : b;
}

export function createLaneMap<T>(initial: T): LaneMap<T> {
  // Intentionally pushing one by one.
  // https://v8.dev/blog/elements-kinds#avoid-creating-holes
  const laneMap = [];
  for (let i = 0; i < TotalLanes; i++) {
    laneMap.push(initial);
  }
  return laneMap;
}

export function markRootUpdated(
  root: FiberRoot,
  updateLane: Lane,
  eventTime: number,
) {
  root.pendingLanes |= updateLane;

  // If there are any suspended transitions, it's possible this new update
  // could unblock them. Clear the suspended lanes so that we can try rendering
  // them again.
  //
  // TODO: We really only need to unsuspend only lanes that are in the
  // `subtreeLanes` of the updated fiber, or the update lanes of the return
  // path. This would exclude suspended updates in an unrelated sibling tree,
  // since there's no way for this update to unblock it.
  //
  // We don't do this if the incoming update is idle, because we never process
  // idle updates until after all the regular updates have finished; there's no
  // way it could unblock a transition.
  if (updateLane !== IdleLane) {
    root.suspendedLanes = NoLanes;
    root.pingedLanes = NoLanes;
  }

  const eventTimes = root.eventTimes;
  const index = laneToIndex(updateLane);
  // We can always overwrite an existing timestamp because we prefer the most
  // recent event, and we assume time is monotonically increasing.
  eventTimes[index] = eventTime;
}

export function markRootSuspended(root: FiberRoot, suspendedLanes: Lanes) {
  root.suspendedLanes |= suspendedLanes;
  root.pingedLanes &= ~suspendedLanes;

  // The suspended lanes are no longer CPU-bound. Clear their expiration times.
  const expirationTimes = root.expirationTimes;
  let lanes = suspendedLanes;
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;

    expirationTimes[index] = NoTimestamp;

    lanes &= ~lane;
  }
}

export function markRootPinged(
  root: FiberRoot,
  pingedLanes: Lanes,
  eventTime: number,
) {
  root.pingedLanes |= root.suspendedLanes & pingedLanes;
}

export function markRootMutableRead(root: FiberRoot, updateLane: Lane) {
  root.mutableReadLanes |= updateLane & root.pendingLanes;
}

export function markRootFinished(root: FiberRoot, remainingLanes: Lanes) {
  const noLongerPendingLanes = root.pendingLanes & ~remainingLanes;

  root.pendingLanes = remainingLanes;

  // Let's try everything again
  root.suspendedLanes = NoLanes;
  root.pingedLanes = NoLanes;

  root.expiredLanes &= remainingLanes;
  root.mutableReadLanes &= remainingLanes;

  root.entangledLanes &= remainingLanes;

  const entanglements = root.entanglements;
  const eventTimes = root.eventTimes;
  const expirationTimes = root.expirationTimes;

  // Clear the lanes that no longer have pending work
  let lanes = noLongerPendingLanes;
  while (lanes > 0) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;

    entanglements[index] = NoLanes;
    eventTimes[index] = NoTimestamp;
    expirationTimes[index] = NoTimestamp;

    lanes &= ~lane;
  }
}

export function markRootEntangled(root: FiberRoot, entangledLanes: Lanes) {
  // In addition to entangling each of the given lanes with each other, we also
  // have to consider _transitive_ entanglements. For each lane that is already
  // entangled with *any* of the given lanes, that lane is now transitively
  // entangled with *all* the given lanes.
  //
  // Translated: If C is entangled with A, then entangling A with B also
  // entangles C with B.
  //
  // If this is hard to grasp, it might help to intentionally break this
  // function and look at the tests that fail in ReactTransition-test.js. Try
  // commenting out one of the conditions below.

  const rootEntangledLanes = (root.entangledLanes |= entangledLanes);
  const entanglements = root.entanglements;
  let lanes = rootEntangledLanes;
  while (lanes) {
    const index = pickArbitraryLaneIndex(lanes);
    const lane = 1 << index;
    if (
      // Is this one of the newly entangled lanes?
      (lane & entangledLanes) |
      // Is this lane transitively entangled with the newly entangled lanes?
      (entanglements[index] & entangledLanes)
    ) {
      entanglements[index] |= entangledLanes;
    }
    lanes &= ~lane;
  }
}

export function getBumpedLaneForHydration(
  root: FiberRoot,
  renderLanes: Lanes,
): Lane {
  const renderLane = getHighestPriorityLane(renderLanes);

  let lane;
  switch (renderLane) {
    case InputContinuousLane:
      lane = InputContinuousHydrationLane;
      break;
    case DefaultLane:
      lane = DefaultHydrationLane;
      break;
    case TransitionLane1:
    case TransitionLane2:
    case TransitionLane3:
    case TransitionLane4:
    case TransitionLane5:
    case TransitionLane6:
    case TransitionLane7:
    case TransitionLane8:
    case TransitionLane9:
    case TransitionLane10:
    case TransitionLane11:
    case TransitionLane12:
    case TransitionLane13:
    case TransitionLane14:
    case TransitionLane15:
    case TransitionLane16:
    case RetryLane1:
    case RetryLane2:
    case RetryLane3:
    case RetryLane4:
    case RetryLane5:
      lane = TransitionHydrationLane;
      break;
    case IdleLane:
      lane = IdleHydrationLane;
      break;
    default:
      // Everything else is already either a hydration lane, or shouldn't
      // be retried at a hydration lane.
      lane = NoLane;
      break;
  }

  // Check if the lane we chose is suspended. If so, that indicates that we
  // already attempted and failed to hydrate at that level. Also check if we're
  // already rendering that lane, which is rare but could happen.
  if ((lane & (root.suspendedLanes | renderLanes)) !== NoLane) {
    // Give up trying to hydrate and fall back to client render.
    return NoLane;
  }

  return lane;
}

export function addFiberToLanesMap(
  root: FiberRoot, // Fiber 树的根节点
  fiber: Fiber, // 当前需要更新的 Fiber 节点
  lanes: Lanes | Lane, // 本次更新的 lane（更新优先级）
) {
  // 如果没有启用 Updater 跟踪，则直接返回
  if (!enableUpdaterTracking) {
    return;
  }
  // 如果 DevTools 不存在，则不需要进行任何操作
  if (!isDevToolsPresent) {
    return;
  }

  // 从根节点获取 pendingUpdatersLaneMap，记录待处理的更新
  const pendingUpdatersLaneMap = root.pendingUpdatersLaneMap;

  // 循环处理 lanes，直到所有位都处理完
  while (lanes > 0) {
    // 将 lanes 转换为索引，用于找到对应的 lane
    const index = laneToIndex(lanes);

    // 使用位运算提取当前 lane
    const lane = 1 << index;

    // 获取对应 lane 的更新器集合
    const updaters = pendingUpdatersLaneMap[index];

    // 将当前 Fiber 节点添加到该 lane 对应的更新器集合中
    updaters.add(fiber);

    // 移除已处理的 lane，继续处理下一个
    lanes &= ~lane;
  }
}

export function movePendingFibersToMemoized(root: FiberRoot, lanes: Lanes) {
  if (!enableUpdaterTracking) {
    return;
  }
  if (!isDevToolsPresent) {
    return;
  }
  const pendingUpdatersLaneMap = root.pendingUpdatersLaneMap;
  const memoizedUpdaters = root.memoizedUpdaters;
  while (lanes > 0) {
    const index = laneToIndex(lanes);
    const lane = 1 << index;

    const updaters = pendingUpdatersLaneMap[index];
    if (updaters.size > 0) {
      updaters.forEach(fiber => {
        const alternate = fiber.alternate;
        if (alternate === null || !memoizedUpdaters.has(alternate)) {
          memoizedUpdaters.add(fiber);
        }
      });
      updaters.clear();
    }

    lanes &= ~lane;
  }
}

export function addTransitionToLanesMap(
  root: FiberRoot,
  transition: Transition,
  lane: Lane,
) {
  if (enableTransitionTracing) {
    const transitionLanesMap = root.transitionLanes;
    const index = laneToIndex(lane);
    let transitions = transitionLanesMap[index];
    if (transitions === null) {
      transitions = [];
    }
    transitions.push(transition);

    transitionLanesMap[index] = transitions;
  }
}

export function getTransitionsForLanes(
  root: FiberRoot,
  lanes: Lane | Lanes,
): Array<Transition> | null {
  if (!enableTransitionTracing) {
    return null;
  }

  const transitionsForLanes = [];
  while (lanes > 0) {
    const index = laneToIndex(lanes);
    const lane = 1 << index;
    const transitions = root.transitionLanes[index];
    if (transitions !== null) {
      transitions.forEach(transition => {
        transitionsForLanes.push(transition);
      });
    }

    lanes &= ~lane;
  }

  if (transitionsForLanes.length === 0) {
    return null;
  }

  return transitionsForLanes;
}

export function clearTransitionsForLanes(root: FiberRoot, lanes: Lane | Lanes) {
  if (!enableTransitionTracing) {
    return;
  }

  while (lanes > 0) {
    const index = laneToIndex(lanes);
    const lane = 1 << index;

    const transitions = root.transitionLanes[index];
    if (transitions !== null) {
      root.transitionLanes[index] = null;
    }

    lanes &= ~lane;
  }
}
