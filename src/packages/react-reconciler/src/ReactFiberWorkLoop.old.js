/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Wakeable} from 'shared/ReactTypes';
import type {Fiber, FiberRoot} from './ReactInternalTypes';
import type {Lanes, Lane} from './ReactFiberLane.old';
import type {SuspenseState} from './ReactFiberSuspenseComponent.old';
import type {StackCursor} from './ReactFiberStack.old';
import type {Flags} from './ReactFiberFlags';
import type {FunctionComponentUpdateQueue} from './ReactFiberHooks.old';
import type {EventPriority} from './ReactEventPriorities.old';
import type {
  PendingTransitionCallbacks,
  TransitionObject,
  Transition,
} from './ReactFiberTracingMarkerComponent.old';

import {
  warnAboutDeprecatedLifecycles,
  replayFailedUnitOfWorkWithInvokeGuardedCallback,
  enableCreateEventHandleAPI,
  enableProfilerTimer,
  enableProfilerCommitHooks,
  enableProfilerNestedUpdatePhase,
  enableProfilerNestedUpdateScheduledHook,
  deferRenderPhaseUpdateToNextBatch,
  enableDebugTracing,
  enableSchedulingProfiler,
  disableSchedulerTimeoutInWorkLoop,
  enableStrictEffects,
  skipUnmountedBoundaries,
  enableUpdaterTracking,
  enableCache,
  enableTransitionTracing,
} from 'shared/ReactFeatureFlags';
import ReactSharedInternals from 'shared/ReactSharedInternals';
import is from 'shared/objectIs';

import {
  // Aliased because `act` will override and push to an internal queue
  scheduleCallback as Scheduler_scheduleCallback,
  cancelCallback as Scheduler_cancelCallback,
  shouldYield,
  requestPaint,
  now,
  ImmediatePriority as ImmediateSchedulerPriority,
  UserBlockingPriority as UserBlockingSchedulerPriority,
  NormalPriority as NormalSchedulerPriority,
  IdlePriority as IdleSchedulerPriority,
} from './Scheduler';
import {
  flushSyncCallbacks,
  flushSyncCallbacksOnlyInLegacyMode,
  scheduleSyncCallback,
  scheduleLegacySyncCallback,
} from './ReactFiberSyncTaskQueue.old';
import {
  logCommitStarted,
  logCommitStopped,
  logLayoutEffectsStarted,
  logLayoutEffectsStopped,
  logPassiveEffectsStarted,
  logPassiveEffectsStopped,
  logRenderStarted,
  logRenderStopped,
} from './DebugTracing';

import {
  resetAfterCommit,
  scheduleTimeout,
  cancelTimeout,
  noTimeout,
  afterActiveInstanceBlur,
  getCurrentEventPriority,
  supportsMicrotasks,
  errorHydratingContainer,
  scheduleMicrotask,
} from './ReactFiberHostConfig';

import {
  createWorkInProgress,
  assignFiberPropertiesInDEV,
} from './ReactFiber.old';
import {isRootDehydrated} from './ReactFiberShellHydration';
import {didSuspendOrErrorWhileHydratingDEV} from './ReactFiberHydrationContext.old';
import {NoMode, ProfileMode, ConcurrentMode} from './ReactTypeOfMode';
import {
  HostRoot,
  IndeterminateComponent,
  ClassComponent,
  SuspenseComponent,
  SuspenseListComponent,
  FunctionComponent,
  ForwardRef,
  MemoComponent,
  SimpleMemoComponent,
  Profiler,
} from './ReactWorkTags';
import {LegacyRoot} from './ReactRootTags';
import {
  NoFlags,
  Incomplete,
  StoreConsistency,
  HostEffectMask,
  ForceClientRender,
  BeforeMutationMask,
  MutationMask,
  LayoutMask,
  PassiveMask,
  MountPassiveDev,
  MountLayoutDev,
} from './ReactFiberFlags';
import {
  NoLanes,
  NoLane,
  SyncLane,
  NoTimestamp,
  claimNextTransitionLane,
  claimNextRetryLane,
  includesSomeLane,
  isSubsetOfLanes,
  mergeLanes,
  removeLanes,
  pickArbitraryLane,
  includesNonIdleWork,
  includesOnlyRetries,
  includesOnlyTransitions,
  includesBlockingLane,
  includesExpiredLane,
  getNextLanes,
  markStarvedLanesAsExpired,
  getLanesToRetrySynchronouslyOnError,
  getMostRecentEventTime,
  markRootUpdated,
  markRootSuspended as markRootSuspended_dontCallThisOneDirectly,
  markRootPinged,
  markRootEntangled,
  markRootFinished,
  getHighestPriorityLane,
  addFiberToLanesMap,
  movePendingFibersToMemoized,
  addTransitionToLanesMap,
  getTransitionsForLanes,
} from './ReactFiberLane.old';
import {
  DiscreteEventPriority,
  ContinuousEventPriority,
  DefaultEventPriority,
  IdleEventPriority,
  getCurrentUpdatePriority,
  setCurrentUpdatePriority,
  lowerEventPriority,
  lanesToEventPriority,
} from './ReactEventPriorities.old';
import {requestCurrentTransition, NoTransition} from './ReactFiberTransition';
import {beginWork as originalBeginWork} from './ReactFiberBeginWork.old';
import {completeWork} from './ReactFiberCompleteWork.old';
import {unwindWork, unwindInterruptedWork} from './ReactFiberUnwindWork.old';
import {
  throwException,
  createRootErrorUpdate,
  createClassErrorUpdate,
} from './ReactFiberThrow.old';
import {
  commitBeforeMutationEffects,
  commitLayoutEffects,
  commitMutationEffects,
  commitPassiveEffectDurations,
  commitPassiveMountEffects,
  commitPassiveUnmountEffects,
  invokeLayoutEffectMountInDEV,
  invokePassiveEffectMountInDEV,
  invokeLayoutEffectUnmountInDEV,
  invokePassiveEffectUnmountInDEV,
  reportUncaughtErrorInDEV,
} from './ReactFiberCommitWork.old';
import {enqueueUpdate} from './ReactFiberClassUpdateQueue.old';
import {resetContextDependencies} from './ReactFiberNewContext.old';
import {
  resetHooksAfterThrow,
  ContextOnlyDispatcher,
  getIsUpdatingOpaqueValueInRenderPhaseInDEV,
} from './ReactFiberHooks.old';
import {
  createCapturedValueAtFiber,
  type CapturedValue,
} from './ReactCapturedValue';
import {
  push as pushToStack,
  pop as popFromStack,
  createCursor,
} from './ReactFiberStack.old';
import {
  enqueueConcurrentRenderForLane,
  finishQueueingConcurrentUpdates,
} from './ReactFiberConcurrentUpdates.old';

import {
  markNestedUpdateScheduled,
  recordCommitTime,
  resetNestedUpdateFlag,
  startProfilerTimer,
  stopProfilerTimerIfRunningAndRecordDelta,
  syncNestedUpdateFlag,
} from './ReactProfilerTimer.old';

// DEV stuff
import getComponentNameFromFiber from 'react-reconciler/src/getComponentNameFromFiber';
import ReactStrictModeWarnings from './ReactStrictModeWarnings.old';
import {
  isRendering as ReactCurrentDebugFiberIsRenderingInDEV,
  current as ReactCurrentFiberCurrent,
  resetCurrentFiber as resetCurrentDebugFiberInDEV,
  setCurrentFiber as setCurrentDebugFiberInDEV,
} from './ReactCurrentFiber';
import {
  invokeGuardedCallback,
  hasCaughtError,
  clearCaughtError,
} from 'shared/ReactErrorUtils';
import {
  isDevToolsPresent,
  markCommitStarted,
  markCommitStopped,
  markComponentRenderStopped,
  markComponentSuspended,
  markComponentErrored,
  markLayoutEffectsStarted,
  markLayoutEffectsStopped,
  markPassiveEffectsStarted,
  markPassiveEffectsStopped,
  markRenderStarted,
  markRenderYielded,
  markRenderStopped,
  onCommitRoot as onCommitRootDevTools,
  onPostCommitRoot as onPostCommitRootDevTools,
} from './ReactFiberDevToolsHook.old';
import {onCommitRoot as onCommitRootTestSelector} from './ReactTestSelectors';
import {releaseCache} from './ReactFiberCacheComponent.old';
import {
  isLegacyActEnvironment,
  isConcurrentActEnvironment,
} from './ReactFiberAct.old';
import {processTransitionCallbacks} from './ReactFiberTracingMarkerComponent.old';

const ceil = Math.ceil;

const {
  ReactCurrentDispatcher,
  ReactCurrentOwner,
  ReactCurrentBatchConfig,
  ReactCurrentActQueue,
} = ReactSharedInternals;

type ExecutionContext = number;

export const NoContext = /*             */ 0b000;
const BatchedContext = /*               */ 0b001;
const RenderContext = /*                */ 0b010;
const CommitContext = /*                */ 0b100;

type RootExitStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const RootInProgress = 0;
const RootFatalErrored = 1;
const RootErrored = 2;
const RootSuspended = 3;
const RootSuspendedWithDelay = 4;
const RootCompleted = 5;
const RootDidNotComplete = 6;

// Describes where we are in the React execution stack
let executionContext: ExecutionContext = NoContext;
// The root we're working on
let workInProgressRoot: FiberRoot | null = null;
// The fiber we're working on
let workInProgress: Fiber | null = null;
// The lanes we're rendering
let workInProgressRootRenderLanes: Lanes = NoLanes;

// Stack that allows components to change the render lanes for its subtree
// This is a superset of the lanes we started working on at the root. The only
// case where it's different from `workInProgressRootRenderLanes` is when we
// enter a subtree that is hidden and needs to be unhidden: Suspense and
// Offscreen component.
//
// Most things in the work loop should deal with workInProgressRootRenderLanes.
// Most things in begin/complete phases should deal with subtreeRenderLanes.
export let subtreeRenderLanes: Lanes = NoLanes;
const subtreeRenderLanesCursor: StackCursor<Lanes> = createCursor(NoLanes);

// Whether to root completed, errored, suspended, etc.
let workInProgressRootExitStatus: RootExitStatus = RootInProgress;
// A fatal error, if one is thrown
let workInProgressRootFatalError: mixed = null;
// "Included" lanes refer to lanes that were worked on during this render. It's
// slightly different than `renderLanes` because `renderLanes` can change as you
// enter and exit an Offscreen tree. This value is the combination of all render
// lanes for the entire render phase.
let workInProgressRootIncludedLanes: Lanes = NoLanes;
// The work left over by components that were visited during this render. Only
// includes unprocessed updates, not work in bailed out children.
let workInProgressRootSkippedLanes: Lanes = NoLanes;
// Lanes that were updated (in an interleaved event) during this render.
let workInProgressRootInterleavedUpdatedLanes: Lanes = NoLanes;
// Lanes that were updated during the render phase (*not* an interleaved event).
let workInProgressRootRenderPhaseUpdatedLanes: Lanes = NoLanes;
// Lanes that were pinged (in an interleaved event) during this render.
let workInProgressRootPingedLanes: Lanes = NoLanes;
// Errors that are thrown during the render phase.
let workInProgressRootConcurrentErrors: Array<
  CapturedValue<mixed>,
> | null = null;
// These are errors that we recovered from without surfacing them to the UI.
// We will log them once the tree commits.
let workInProgressRootRecoverableErrors: Array<
  CapturedValue<mixed>,
> | null = null;

// The most recent time we committed a fallback. This lets us ensure a train
// model where we don't commit new loading states in too quick succession.
let globalMostRecentFallbackTime: number = 0;
const FALLBACK_THROTTLE_MS: number = 500;

// The absolute time for when we should start giving up on rendering
// more and prefer CPU suspense heuristics instead.
let workInProgressRootRenderTargetTime: number = Infinity;
// How long a render is supposed to take before we start following CPU
// suspense heuristics and opt out of rendering more content.
const RENDER_TIMEOUT_MS = 500;

let workInProgressTransitions: Array<Transition> | null = null;
export function getWorkInProgressTransitions() {
  return workInProgressTransitions;
}

let currentPendingTransitionCallbacks: PendingTransitionCallbacks | null = null;

export function addTransitionStartCallbackToPendingTransition(
  transition: TransitionObject,
) {
  if (enableTransitionTracing) {
    if (currentPendingTransitionCallbacks === null) {
      currentPendingTransitionCallbacks = {
        transitionStart: [],
        transitionComplete: null,
      };
    }

    if (currentPendingTransitionCallbacks.transitionStart === null) {
      currentPendingTransitionCallbacks.transitionStart = [];
    }

    currentPendingTransitionCallbacks.transitionStart.push(transition);
  }
}

export function addTransitionCompleteCallbackToPendingTransition(
  transition: TransitionObject,
) {
  if (enableTransitionTracing) {
    if (currentPendingTransitionCallbacks === null) {
      currentPendingTransitionCallbacks = {
        transitionStart: null,
        transitionComplete: [],
      };
    }

    if (currentPendingTransitionCallbacks.transitionComplete === null) {
      currentPendingTransitionCallbacks.transitionComplete = [];
    }

    currentPendingTransitionCallbacks.transitionComplete.push(transition);
  }
}

function resetRenderTimer() {
  workInProgressRootRenderTargetTime = now() + RENDER_TIMEOUT_MS;
}

export function getRenderTargetTime(): number {
  return workInProgressRootRenderTargetTime;
}

let hasUncaughtError = false;
let firstUncaughtError = null;
let legacyErrorBoundariesThatAlreadyFailed: Set<mixed> | null = null;

// Only used when enableProfilerNestedUpdateScheduledHook is true;
// to track which root is currently committing layout effects.
let rootCommittingMutationOrLayoutEffects: FiberRoot | null = null;

let rootDoesHavePassiveEffects: boolean = false;
let rootWithPendingPassiveEffects: FiberRoot | null = null;
let pendingPassiveEffectsLanes: Lanes = NoLanes;
let pendingPassiveProfilerEffects: Array<Fiber> = [];
let pendingPassiveEffectsRemainingLanes: Lanes = NoLanes;
let pendingPassiveTransitions: Array<Transition> | null = null;

// Use these to prevent an infinite loop of nested updates
const NESTED_UPDATE_LIMIT = 50;
let nestedUpdateCount: number = 0;
let rootWithNestedUpdates: FiberRoot | null = null;
let isFlushingPassiveEffects = false;
let didScheduleUpdateDuringPassiveEffects = false;

const NESTED_PASSIVE_UPDATE_LIMIT = 50;
let nestedPassiveUpdateCount: number = 0;
let rootWithPassiveNestedUpdates: FiberRoot | null = null;

// If two updates are scheduled within the same event, we should treat their
// event times as simultaneous, even if the actual clock time has advanced
// between the first and second call.
let currentEventTime: number = NoTimestamp;
let currentEventTransitionLane: Lanes = NoLanes;

let isRunningInsertionEffect = false;

export function getWorkInProgressRoot(): FiberRoot | null {
  return workInProgressRoot;
}

export function requestEventTime() {
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    // We're inside React, so it's fine to read the actual time.
    return now();
  }
  // We're not inside React, so we may be in the middle of a browser event.
  if (currentEventTime !== NoTimestamp) {
    // Use the same start time for all updates until we enter React again.
    return currentEventTime;
  }
  // This is the first update since React yielded. Compute a new start time.
  currentEventTime = now();
  return currentEventTime;
}

export function getCurrentTime() {
  return now();
}

export function requestUpdateLane(fiber: Fiber): Lane {
  // 获取当前 fiber 的 mode（例如是否是并发模式）
  const mode = fiber.mode;

  // 如果 fiber 不在并发模式下（ConcurrentMode），那么返回同步更新的 lane
  if ((mode & ConcurrentMode) === NoMode) {
    return (SyncLane: Lane);
  }
  // 检查是否处于渲染阶段的更新
  else if (
    !deferRenderPhaseUpdateToNextBatch && // 判断是否允许将渲染阶段更新推迟到下一批次
    (executionContext & RenderContext) !== NoContext && // 检查是否处于渲染上下文中
    workInProgressRootRenderLanes !== NoLanes // 检查是否有正在处理的 lane
  ) {
    // 渲染阶段的更新是不支持的特殊情况。旧行为是将这些更新分配到当前渲染的同一线程（lane）中。
    // 如果在渲染过程中调用 `setState`，它将在相同渲染过程中立即刷新。
    // 最终目标是消除这种特殊情况，未来这些更新将被视为来自于交错事件。
    return pickArbitraryLane(workInProgressRootRenderLanes);
  }

  // 检查是否处于 transition 过渡阶段
  const isTransition = requestCurrentTransition() !== NoTransition;
  if (isTransition) {
    if (__DEV__ && ReactCurrentBatchConfig.transition !== null) {
      const transition = ReactCurrentBatchConfig.transition;
      if (!transition._updatedFibers) {
        transition._updatedFibers = new Set();
      }
      // 将当前更新的 fiber 添加到 transition 的更新集合中
      transition._updatedFibers.add(fiber);
    }

    // 为了确保在相同事件内具有相同优先级的所有更新都分配到相同的 lane 中，
    // 我们缓存了这些输入的第一个值，并在事件结束后重置缓存。
    if (currentEventTransitionLane === NoLane) {
      // 将相同事件内的所有过渡更新分配到相同的 lane
      currentEventTransitionLane = claimNextTransitionLane();
    }
    return currentEventTransitionLane;
  }

  // 某些 React 方法内部生成的更新（如 flushSync）具有由上下文变量跟踪的优先级。
  // 获取当前更新的优先级，如果它不为 `NoLane`，则返回该优先级对应的 lane
  const updateLane: Lane = (getCurrentUpdatePriority(): any);
  if (updateLane !== NoLane) {
    return updateLane;
  }

  // 对于来自 React 外部的更新，询问宿主环境以确定合适的事件优先级
  // 例如用户交互事件、网络请求事件等，这些事件的优先级会由宿主环境（浏览器）确定
  const eventLane: Lane = (getCurrentEventPriority(): any);
  return eventLane;
}

function requestRetryLane(fiber: Fiber) {
  // This is a fork of `requestUpdateLane` designed specifically for Suspense
  // "retries" — a special update that attempts to flip a Suspense boundary
  // from its placeholder state to its primary/resolved state.

  // Special cases
  const mode = fiber.mode;
  if ((mode & ConcurrentMode) === NoMode) {
    return (SyncLane: Lane);
  }

  return claimNextRetryLane();
}

export function scheduleUpdateOnFiber(
  root: FiberRoot, // Fiber 树的根
  fiber: Fiber, // 需要更新的 Fiber 节点
  lane: Lane, // 更新的优先级等级
  eventTime: number, // 事件时间
) {
  // 检查是否有嵌套更新
  checkForNestedUpdates();

  // 开发模式下的检查
  if (__DEV__) {
    // 如果正在执行插入效果，抛出错误，因为插入效果不能调度更新
    if (isRunningInsertionEffect) {
      console.error('useInsertionEffect must not schedule updates.');
    }
  }

  // 开发模式下的检查
  if (__DEV__) {
    // 如果正在执行被动效果，标记为在被动效果期间调度了更新
    if (isFlushingPassiveEffects) {
      didScheduleUpdateDuringPassiveEffects = true;
    }
  }

  // 标记根节点有待处理的更新
  markRootUpdated(root, lane, eventTime);

  if (
    (executionContext & RenderContext) !== NoLanes &&
    root === workInProgressRoot
  ) {
    // 如果更新是在渲染阶段调度的，记录警告信息（除非是某些内部 React 特性）
    warnAboutRenderPhaseUpdatesInDEV(fiber);

    // 追踪在渲染阶段更新的优先级等级
    workInProgressRootRenderPhaseUpdatedLanes = mergeLanes(
      workInProgressRootRenderPhaseUpdatedLanes,
      lane,
    );
  } else {
    // 这是一个正常的更新，通常是在渲染阶段之外调度的（例如，输入事件）
    if (enableUpdaterTracking) {
      if (isDevToolsPresent) {
        // 将 Fiber 节点添加到 DevTools 的 lanes 映射中
        addFiberToLanesMap(root, fiber, lane);
      }
    }

    // 开发模式下检查更新是否被包裹在 `act` 中
    warnIfUpdatesNotWrappedWithActDEV(fiber);

    if (enableProfilerTimer && enableProfilerNestedUpdateScheduledHook) {
      if (
        (executionContext & CommitContext) !== NoContext &&
        root === rootCommittingMutationOrLayoutEffects
      ) {
        if (fiber.mode & ProfileMode) {
          let current = fiber;
          while (current !== null) {
            // 如果节点是 Profiler 类型，触发 `onNestedUpdateScheduled` 钩子
            if (current.tag === Profiler) {
              const { id, onNestedUpdateScheduled } = current.memoizedProps;
              if (typeof onNestedUpdateScheduled === 'function') {
                onNestedUpdateScheduled(id);
              }
            }
            current = current.return;
          }
        }
      }
    }

    if (enableTransitionTracing) {
      const transition = ReactCurrentBatchConfig.transition;
      if (transition !== null) {
        if (transition.startTime === -1) {
          // 记录过渡开始时间
          transition.startTime = now();
        }

        // 将过渡添加到优先级等级映射中
        addTransitionToLanesMap(root, transition, lane);
      }
    }

    if (root === workInProgressRoot) {
      // 如果更新目标是当前正在渲染的树，标记为中断更新
      if (
        deferRenderPhaseUpdateToNextBatch ||
        (executionContext & RenderContext) === NoContext
      ) {
        workInProgressRootInterleavedUpdatedLanes = mergeLanes(
          workInProgressRootInterleavedUpdatedLanes,
          lane,
        );
      }
      if (workInProgressRootExitStatus === RootSuspendedWithDelay) {
        // 如果根节点已经因延迟被挂起，标记为挂起
        markRootSuspended(root, workInProgressRootRenderLanes);
      }
    }

    // 确保根节点的更新被调度
    ensureRootIsScheduled(root, eventTime);

    if (
      lane === SyncLane &&
      executionContext === NoContext &&
      (fiber.mode & ConcurrentMode) === NoMode &&
      // `act` 行为类似于 `batchedUpdates`，即使在旧版模式下也如此
      !(__DEV__ && ReactCurrentActQueue.isBatchingLegacy)
    ) {
      // 如果是同步更新，且在 `act` 模式下，立即刷新更新
      resetRenderTimer();
      flushSyncCallbacksOnlyInLegacyMode();
    }
  }
}

export function scheduleInitialHydrationOnRoot(
  root: FiberRoot,
  lane: Lane,
  eventTime: number,
) {
  // This is a special fork of scheduleUpdateOnFiber that is only used to
  // schedule the initial hydration of a root that has just been created. Most
  // of the stuff in scheduleUpdateOnFiber can be skipped.
  //
  // The main reason for this separate path, though, is to distinguish the
  // initial children from subsequent updates. In fully client-rendered roots
  // (createRoot instead of hydrateRoot), all top-level renders are modeled as
  // updates, but hydration roots are special because the initial render must
  // match what was rendered on the server.
  const current = root.current;
  current.lanes = lane;
  markRootUpdated(root, lane, eventTime);
  ensureRootIsScheduled(root, eventTime);
}

export function isUnsafeClassRenderPhaseUpdate(fiber: Fiber) {
  // Check if this is a render phase update. Only called by class components,
  // which special (deprecated) behavior for UNSAFE_componentWillReceive props.
  return (
    // TODO: Remove outdated deferRenderPhaseUpdateToNextBatch experiment. We
    // decided not to enable it.
    (!deferRenderPhaseUpdateToNextBatch ||
      (fiber.mode & ConcurrentMode) === NoMode) &&
    (executionContext & RenderContext) !== NoContext
  );
}

// 确保为指定的 root 调度一个任务。每个 root 只有一个任务；如果已有任务被调度，
// 我们将检查现有任务的优先级是否与 root 在下一个层级的优先级相同。
// 这个函数在每次更新时被调用，并在任务即将结束时调用。
function ensureRootIsScheduled(root: FiberRoot, currentTime: number) {
  // console.log("ensureRootIsScheduled...", root, currentTime);
  // 获取现有的回调节点（如果存在）
  const existingCallbackNode = root.callbackNode;

  // 标记由于其他工作导致车道饿死的情况
  markStarvedLanesAsExpired(root, currentTime);

  // 确定接下来需要处理的车道以及它们的优先级
  const nextLanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes,
  );

  // 处理特殊情况：没有需要处理的车道
  if (nextLanes === NoLanes) {
    // 如果没有车道需要处理，取消现有的回调任务（如果存在）
    if (existingCallbackNode !== null) {
      cancelCallback(existingCallbackNode);
    }
    // 清空回调节点和回调优先级
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }

  // 确定新的回调优先级
  const newCallbackPriority = getHighestPriorityLane(nextLanes);

  // 检查现有任务是否可以重用
  const existingCallbackPriority = root.callbackPriority;
  if (
    existingCallbackPriority === newCallbackPriority &&
    // 特殊情况处理 `act` 任务，确保不将非 `act` 任务作为 `act` 任务
    !(
      __DEV__ &&
      ReactCurrentActQueue.current !== null &&
      existingCallbackNode !== fakeActCallbackNode
    )
  ) {
    if (__DEV__) {
      // 如果要重用现有任务，确保其存在
      if (
        existingCallbackNode == null &&
        existingCallbackPriority !== SyncLane
      ) {
        console.error(
          'Expected scheduled callback to exist. This error is likely caused by a bug in React. Please file an issue.',
        );
      }
    }
    // 优先级没有变化，现有任务可以重用，退出函数
    return;
  }

  // 取消现有回调任务（如果存在），并调度一个新的任务
  if (existingCallbackNode != null) {
    cancelCallback(existingCallbackNode);
  }

  // 根据新的回调优先级调度新的回调任务
  let newCallbackNode;
  if (newCallbackPriority === SyncLane) {
    // 特殊情况：同步 React 回调任务调度在特殊的内部队列
    if (root.tag === LegacyRoot) {
      // 处理 legacy 模式下的同步任务
      if (__DEV__ && ReactCurrentActQueue.isBatchingLegacy !== null) {
        ReactCurrentActQueue.didScheduleLegacyUpdate = true;
      }
      scheduleLegacySyncCallback(performSyncWorkOnRoot.bind(null, root));
    } else {
      // 调度同步回调任务
      scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    }
    if (supportsMicrotasks) {
      // 如果支持 microtasks，使用 microtask 刷新队列
      if (__DEV__ && ReactCurrentActQueue.current !== null) {
        // 在 `act` 中，使用内部 `act` 队列确保这些任务在当前作用域结束时刷新
        ReactCurrentActQueue.current.push(flushSyncCallbacks);
      } else {
        // 在其他情况下，使用 microtask 刷新队列
        scheduleMicrotask(() => {
          // Safari 特性，追加 iframe 强制执行 microtasks
          if (
            (executionContext & (RenderContext | CommitContext)) ===
            NoContext
          ) {
            // 在渲染或提交阶段外，提前刷新回调（例如在事件中）
            flushSyncCallbacks();
          }
        });
      }
    } else {
      // 不支持 microtasks，使用 Immediate 任务刷新队列
      scheduleCallback(ImmediateSchedulerPriority, flushSyncCallbacks);
    }
    newCallbackNode = null;
  } else {
    let schedulerPriorityLevel;
    // 将 `nextLanes` 转换为事件优先级
    // `lanesToEventPriority` 是一个函数，它将车道的优先级（例如 SyncLane, InputEventLane 等）转换为事件优先级。
    switch (lanesToEventPriority(nextLanes)) {
      // 如果事件优先级是离散事件优先级（例如用户点击或输入事件）
      case DiscreteEventPriority:
        // 对应的调度优先级是立即调度优先级（ImmediateSchedulerPriority）
        // 这通常用于需要立即处理的任务，例如用户的输入或点击事件
        schedulerPriorityLevel = ImmediateSchedulerPriority;
        break;

      // 如果事件优先级是连续事件优先级（例如滚动事件或动画帧更新）
      case ContinuousEventPriority:
        // 对应的调度优先级是用户阻塞调度优先级（UserBlockingSchedulerPriority）
        // 这些任务可能需要在用户感知到之前完成，但不如离散事件紧急
        schedulerPriorityLevel = UserBlockingSchedulerPriority;
        break;

      // 如果事件优先级是默认事件优先级（例如一般的异步任务）
      case DefaultEventPriority:
        // 对应的调度优先级是正常调度优先级（NormalSchedulerPriority）
        // 这是处理一般任务的默认优先级，既不是特别紧急也不是特别低
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;

      // 如果事件优先级是空闲事件优先级（例如浏览器空闲时的低优先级任务）
      case IdleEventPriority:
        // 对应的调度优先级是空闲调度优先级（IdleSchedulerPriority）
        // 这通常用于可以在主线程空闲时执行的低优先级任务
        schedulerPriorityLevel = IdleSchedulerPriority;
        break;

      // 如果事件优先级是未知的或不匹配的优先级
      default:
        // 将调度优先级设置为正常调度优先级（NormalSchedulerPriority）
        // 作为回退策略，处理不匹配的情况
        schedulerPriorityLevel = NormalSchedulerPriority;
        break;
    }

    // 使用确定的调度优先级调度回调任务
    // `scheduleCallback` 是一个函数，用于根据优先级调度回调任务
    // `performConcurrentWorkOnRoot` 是实际要执行的工作，绑定了根节点 `root`，在任务调度时会调用
    newCallbackNode = scheduleCallback(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root),
    );
  }

  // 更新 root 的回调优先级和回调节点
  root.callbackPriority = newCallbackPriority;
  root.callbackNode = newCallbackNode;
}

// 这是每个并发任务的入口点，即任何通过 Scheduler 执行的任务
function performConcurrentWorkOnRoot(root, didTimeout) {
  // 如果启用了性能分析器计时器，并且允许嵌套更新阶段，重置嵌套更新标志
  if (enableProfilerTimer && enableProfilerNestedUpdatePhase) {
    resetNestedUpdateFlag();
  }

  // 清除当前事件时间。因为我们知道我们在处理一个 React 事件，所以下一个更新将计算新的事件时间
  currentEventTime = NoTimestamp;
  currentEventTransitionLane = NoLanes;

  // 确保当前没有在进行中的渲染或提交上下文中
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error('Should not already be working.');
  }

  // 在决定处理哪些车道之前，刷新任何待处理的被动效果，以防它们安排了额外的工作
  const originalCallbackNode = root.callbackNode;
  const didFlushPassiveEffects = flushPassiveEffects();
  if (didFlushPassiveEffects) {
    // 如果被动效果阶段中的某些操作可能取消了当前任务
    if (root.callbackNode !== originalCallbackNode) {
      // 当前任务已被取消，退出
      // 不需要调用 `ensureRootIsScheduled`，因为上述检查意味着要么有新任务，要么没有剩余的工作
      return null;
    } else {
      // 当前任务未被取消，继续
    }
  }

  // 确定要处理的下一个车道，使用根节点存储的字段
  let lanes = getNextLanes(
    root,
    root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes,
  );
  if (lanes === NoLanes) {
    // 防御性编程，预期不应发生
    return null;
  }

  // 在某些情况下禁用时间切片：如果工作已经 CPU 绑定了太久（“过期”工作，以防止饿死），或者我们处于同步更新默认模式
  // TODO: 我们仅仅防御性地检查 `didTimeout`，以考虑 Scheduler 中我们仍在调查的 bug。修复 Scheduler 中的 bug 后，可以移除此检查，因为我们自己跟踪过期
  const shouldTimeSlice =
    !includesBlockingLane(root, lanes) &&
    !includesExpiredLane(root, lanes) &&
    (disableSchedulerTimeoutInWorkLoop || !didTimeout);
  let exitStatus = shouldTimeSlice
    ? renderRootConcurrent(root, lanes) // 如果支持时间切片，则使用并发模式渲染根节点
    : renderRootSync(root, lanes); // 否则，使用同步模式渲染根节点

  if (exitStatus !== RootInProgress) {
    if (exitStatus === RootErrored) {
      // 如果出现错误，尝试再渲染一次
      // 这次将同步渲染，以阻止并发数据变更，并包含所有待处理的更新
      // 如果第二次尝试仍然失败，我们将放弃并提交结果树
      const errorRetryLanes = getLanesToRetrySynchronouslyOnError(root);
      if (errorRetryLanes !== NoLanes) {
        lanes = errorRetryLanes;
        exitStatus = recoverFromConcurrentError(root, errorRetryLanes);
      }
    }
    if (exitStatus === RootFatalErrored) {
      // 如果发生致命错误
      const fatalError = workInProgressRootFatalError;
      // 准备一个新的堆栈
      prepareFreshStack(root, NoLanes);
      // 标记根节点为挂起状态
      markRootSuspended(root, lanes);
      // 确保根节点被调度
      ensureRootIsScheduled(root, now());
      // 抛出致命错误
      throw fatalError;
    }

    if (exitStatus === RootDidNotComplete) {
      // 渲染在没有完成树的情况下回溯
      // 这种情况仅在并发渲染期间发生，而不是离散或同步更新
      markRootSuspended(root, lanes);
    } else {
      // 渲染完成

      // 检查此渲染是否可能让出给并发事件
      // 如果是这样，确认任何新渲染的存储器是否一致
      // TODO: 即使并发渲染可能从未让出主线程，如果它足够快，或者它过期了，也可以跳过一致性检查
      const renderWasConcurrent = !includesBlockingLane(root, lanes);
      const finishedWork: Fiber = (root.current.alternate: any);
      if (
        renderWasConcurrent &&
        !isRenderConsistentWithExternalStores(finishedWork)
      ) {
        // 在交错事件中存储器被更改。再渲染一次，使用同步模式来阻止进一步的变更
        exitStatus = renderRootSync(root, lanes);

        // 再次检查是否出现了错误
        if (exitStatus === RootErrored) {
          const errorRetryLanes = getLanesToRetrySynchronouslyOnError(root);
          if (errorRetryLanes !== NoLanes) {
            lanes = errorRetryLanes;
            exitStatus = recoverFromConcurrentError(root, errorRetryLanes);
            // 假设树现在是一致的，因为我们没有让出给任何并发事件
          }
        }
        if (exitStatus === RootFatalErrored) {
          const fatalError = workInProgressRootFatalError;
          prepareFreshStack(root, NoLanes);
          markRootSuspended(root, lanes);
          ensureRootIsScheduled(root, now());
          throw fatalError;
        }
      }

      // 现在我们有了一致的树。下一步是提交它，或者如果有挂起，则在超时后提交
      root.finishedWork = finishedWork;
      root.finishedLanes = lanes;
      finishConcurrentRender(root, exitStatus, lanes);
    }
  }

  // 确保根节点被调度
  ensureRootIsScheduled(root, now());
  // 如果当前执行的任务节点与原始任务节点相同，需要返回一个继续执行的任务
  if (root.callbackNode === originalCallbackNode) {
    // 继续执行当前任务
    return performConcurrentWorkOnRoot.bind(null, root);
  }
  // 如果任务节点已更改或不再存在，则返回 null
  return null;
}

function recoverFromConcurrentError(root, errorRetryLanes) {
  // If an error occurred during hydration, discard server response and fall
  // back to client side render.

  // Before rendering again, save the errors from the previous attempt.
  const errorsFromFirstAttempt = workInProgressRootConcurrentErrors;

  if (isRootDehydrated(root)) {
    // The shell failed to hydrate. Set a flag to force a client rendering
    // during the next attempt. To do this, we call prepareFreshStack now
    // to create the root work-in-progress fiber. This is a bit weird in terms
    // of factoring, because it relies on renderRootSync not calling
    // prepareFreshStack again in the call below, which happens because the
    // root and lanes haven't changed.
    //
    // TODO: I think what we should do is set ForceClientRender inside
    // throwException, like we do for nested Suspense boundaries. The reason
    // it's here instead is so we can switch to the synchronous work loop, too.
    // Something to consider for a future refactor.
    const rootWorkInProgress = prepareFreshStack(root, errorRetryLanes);
    rootWorkInProgress.flags |= ForceClientRender;
    if (__DEV__) {
      errorHydratingContainer(root.containerInfo);
    }
  }

  const exitStatus = renderRootSync(root, errorRetryLanes);
  if (exitStatus !== RootErrored) {
    // Successfully finished rendering on retry

    // The errors from the failed first attempt have been recovered. Add
    // them to the collection of recoverable errors. We'll log them in the
    // commit phase.
    const errorsFromSecondAttempt = workInProgressRootRecoverableErrors;
    workInProgressRootRecoverableErrors = errorsFromFirstAttempt;
    // The errors from the second attempt should be queued after the errors
    // from the first attempt, to preserve the causal sequence.
    if (errorsFromSecondAttempt !== null) {
      queueRecoverableErrors(errorsFromSecondAttempt);
    }
  } else {
    // The UI failed to recover.
  }
  return exitStatus;
}

export function queueRecoverableErrors(errors: Array<CapturedValue<mixed>>) {
  if (workInProgressRootRecoverableErrors === null) {
    workInProgressRootRecoverableErrors = errors;
  } else {
    workInProgressRootRecoverableErrors.push.apply(
      workInProgressRootRecoverableErrors,
      errors,
    );
  }
}

function finishConcurrentRender(root, exitStatus, lanes) {
  switch (exitStatus) {
    case RootInProgress:
    case RootFatalErrored: {
      throw new Error('Root did not complete. This is a bug in React.');
    }
    // Flow knows about invariant, so it complains if I add a break
    // statement, but eslint doesn't know about invariant, so it complains
    // if I do. eslint-disable-next-line no-fallthrough
    case RootErrored: {
      // We should have already attempted to retry this tree. If we reached
      // this point, it errored again. Commit it.
      commitRoot(
        root,
        workInProgressRootRecoverableErrors,
        workInProgressTransitions,
      );
      break;
    }
    case RootSuspended: {
      markRootSuspended(root, lanes);

      // We have an acceptable loading state. We need to figure out if we
      // should immediately commit it or wait a bit.

      if (
        includesOnlyRetries(lanes) &&
        // do not delay if we're inside an act() scope
        !shouldForceFlushFallbacksInDEV()
      ) {
        // This render only included retries, no updates. Throttle committing
        // retries so that we don't show too many loading states too quickly.
        const msUntilTimeout =
          globalMostRecentFallbackTime + FALLBACK_THROTTLE_MS - now();
        // Don't bother with a very short suspense time.
        if (msUntilTimeout > 10) {
          const nextLanes = getNextLanes(root, NoLanes);
          if (nextLanes !== NoLanes) {
            // There's additional work on this root.
            break;
          }
          const suspendedLanes = root.suspendedLanes;
          if (!isSubsetOfLanes(suspendedLanes, lanes)) {
            // We should prefer to render the fallback of at the last
            // suspended level. Ping the last suspended level to try
            // rendering it again.
            // FIXME: What if the suspended lanes are Idle? Should not restart.
            const eventTime = requestEventTime();
            markRootPinged(root, suspendedLanes, eventTime);
            break;
          }

          // The render is suspended, it hasn't timed out, and there's no
          // lower priority work to do. Instead of committing the fallback
          // immediately, wait for more data to arrive.
          root.timeoutHandle = scheduleTimeout(
            commitRoot.bind(
              null,
              root,
              workInProgressRootRecoverableErrors,
              workInProgressTransitions,
            ),
            msUntilTimeout,
          );
          break;
        }
      }
      // The work expired. Commit immediately.
      commitRoot(
        root,
        workInProgressRootRecoverableErrors,
        workInProgressTransitions,
      );
      break;
    }
    case RootSuspendedWithDelay: {
      markRootSuspended(root, lanes);

      if (includesOnlyTransitions(lanes)) {
        // This is a transition, so we should exit without committing a
        // placeholder and without scheduling a timeout. Delay indefinitely
        // until we receive more data.
        break;
      }

      if (!shouldForceFlushFallbacksInDEV()) {
        // This is not a transition, but we did trigger an avoided state.
        // Schedule a placeholder to display after a short delay, using the Just
        // Noticeable Difference.
        // TODO: Is the JND optimization worth the added complexity? If this is
        // the only reason we track the event time, then probably not.
        // Consider removing.

        const mostRecentEventTime = getMostRecentEventTime(root, lanes);
        const eventTimeMs = mostRecentEventTime;
        const timeElapsedMs = now() - eventTimeMs;
        const msUntilTimeout = jnd(timeElapsedMs) - timeElapsedMs;

        // Don't bother with a very short suspense time.
        if (msUntilTimeout > 10) {
          // Instead of committing the fallback immediately, wait for more data
          // to arrive.
          root.timeoutHandle = scheduleTimeout(
            commitRoot.bind(
              null,
              root,
              workInProgressRootRecoverableErrors,
              workInProgressTransitions,
            ),
            msUntilTimeout,
          );
          break;
        }
      }

      // Commit the placeholder.
      commitRoot(
        root,
        workInProgressRootRecoverableErrors,
        workInProgressTransitions,
      );
      break;
    }
    case RootCompleted: {
      // The work completed. Ready to commit.
      commitRoot(
        root,
        workInProgressRootRecoverableErrors,
        workInProgressTransitions,
      );
      break;
    }
    default: {
      throw new Error('Unknown root exit status.');
    }
  }
}

function isRenderConsistentWithExternalStores(finishedWork: Fiber): boolean {
  // Search the rendered tree for external store reads, and check whether the
  // stores were mutated in a concurrent event. Intentionally using an iterative
  // loop instead of recursion so we can exit early.
  let node: Fiber = finishedWork;
  while (true) {
    if (node.flags & StoreConsistency) {
      const updateQueue: FunctionComponentUpdateQueue | null = (node.updateQueue: any);
      if (updateQueue !== null) {
        const checks = updateQueue.stores;
        if (checks !== null) {
          for (let i = 0; i < checks.length; i++) {
            const check = checks[i];
            const getSnapshot = check.getSnapshot;
            const renderedValue = check.value;
            try {
              if (!is(getSnapshot(), renderedValue)) {
                // Found an inconsistent store.
                return false;
              }
            } catch (error) {
              // If `getSnapshot` throws, return `false`. This will schedule
              // a re-render, and the error will be rethrown during render.
              return false;
            }
          }
        }
      }
    }
    const child = node.child;
    if (node.subtreeFlags & StoreConsistency && child !== null) {
      child.return = node;
      node = child;
      continue;
    }
    if (node === finishedWork) {
      return true;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === finishedWork) {
        return true;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
  // Flow doesn't know this is unreachable, but eslint does
  // eslint-disable-next-line no-unreachable
  return true;
}

function markRootSuspended(root, suspendedLanes) {
  // When suspending, we should always exclude lanes that were pinged or (more
  // rarely, since we try to avoid it) updated during the render phase.
  // TODO: Lol maybe there's a better way to factor this besides this
  // obnoxiously named function :)
  suspendedLanes = removeLanes(suspendedLanes, workInProgressRootPingedLanes);
  suspendedLanes = removeLanes(
    suspendedLanes,
    workInProgressRootInterleavedUpdatedLanes,
  );
  markRootSuspended_dontCallThisOneDirectly(root, suspendedLanes);
}

// This is the entry point for synchronous tasks that don't go
// through Scheduler
function performSyncWorkOnRoot(root) {
  if (enableProfilerTimer && enableProfilerNestedUpdatePhase) {
    syncNestedUpdateFlag();
  }

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error('Should not already be working.');
  }

  flushPassiveEffects();

  let lanes = getNextLanes(root, NoLanes);
  if (!includesSomeLane(lanes, SyncLane)) {
    // There's no remaining sync work left.
    ensureRootIsScheduled(root, now());
    return null;
  }

  let exitStatus = renderRootSync(root, lanes);
  if (root.tag !== LegacyRoot && exitStatus === RootErrored) {
    // If something threw an error, try rendering one more time. We'll render
    // synchronously to block concurrent data mutations, and we'll includes
    // all pending updates are included. If it still fails after the second
    // attempt, we'll give up and commit the resulting tree.
    const errorRetryLanes = getLanesToRetrySynchronouslyOnError(root);
    if (errorRetryLanes !== NoLanes) {
      lanes = errorRetryLanes;
      exitStatus = recoverFromConcurrentError(root, errorRetryLanes);
    }
  }

  if (exitStatus === RootFatalErrored) {
    const fatalError = workInProgressRootFatalError;
    prepareFreshStack(root, NoLanes);
    markRootSuspended(root, lanes);
    ensureRootIsScheduled(root, now());
    throw fatalError;
  }

  if (exitStatus === RootDidNotComplete) {
    throw new Error('Root did not complete. This is a bug in React.');
  }

  // We now have a consistent tree. Because this is a sync render, we
  // will commit it even if something suspended.
  const finishedWork: Fiber = (root.current.alternate: any);
  root.finishedWork = finishedWork;
  root.finishedLanes = lanes;
  commitRoot(
    root,
    workInProgressRootRecoverableErrors,
    workInProgressTransitions,
  );

  // Before exiting, make sure there's a callback scheduled for the next
  // pending level.
  ensureRootIsScheduled(root, now());

  return null;
}

export function flushRoot(root: FiberRoot, lanes: Lanes) {
  if (lanes !== NoLanes) {
    markRootEntangled(root, mergeLanes(lanes, SyncLane));
    ensureRootIsScheduled(root, now());
    if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
      resetRenderTimer();
      flushSyncCallbacks();
    }
  }
}

export function getExecutionContext(): ExecutionContext {
  return executionContext;
}

export function deferredUpdates<A>(fn: () => A): A {
  const previousPriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;

  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(DefaultEventPriority);
    return fn();
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
  }
}

export function batchedUpdates<A, R>(fn: A => R, a: A): R {
  const prevExecutionContext = executionContext;
  executionContext |= BatchedContext;
  try {
    return fn(a);
  } finally {
    executionContext = prevExecutionContext;
    // If there were legacy sync updates, flush them at the end of the outer
    // most batchedUpdates-like method.
    if (
      executionContext === NoContext &&
      // Treat `act` as if it's inside `batchedUpdates`, even in legacy mode.
      !(__DEV__ && ReactCurrentActQueue.isBatchingLegacy)
    ) {
      resetRenderTimer();
      flushSyncCallbacksOnlyInLegacyMode();
    }
  }
}

export function discreteUpdates<A, B, C, D, R>(
  fn: (A, B, C, D) => R,
  a: A,
  b: B,
  c: C,
  d: D,
): R {
  const previousPriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;
  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(DiscreteEventPriority);
    return fn(a, b, c, d);
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
    if (executionContext === NoContext) {
      resetRenderTimer();
    }
  }
}

// Overload the definition to the two valid signatures.
// Warning, this opts-out of checking the function body.
declare function flushSync<R>(fn: () => R): R;
// eslint-disable-next-line no-redeclare
declare function flushSync(): void;
// eslint-disable-next-line no-redeclare
export function flushSync(fn) {
  // In legacy mode, we flush pending passive effects at the beginning of the
  // next event, not at the end of the previous one.
  if (
    rootWithPendingPassiveEffects !== null &&
    rootWithPendingPassiveEffects.tag === LegacyRoot &&
    (executionContext & (RenderContext | CommitContext)) === NoContext
  ) {
    flushPassiveEffects();
  }

  const prevExecutionContext = executionContext;
  executionContext |= BatchedContext;

  const prevTransition = ReactCurrentBatchConfig.transition;
  const previousPriority = getCurrentUpdatePriority();

  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(DiscreteEventPriority);
    if (fn) {
      return fn();
    } else {
      return undefined;
    }
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;

    executionContext = prevExecutionContext;
    // Flush the immediate callbacks that were scheduled during this batch.
    // Note that this will happen even if batchedUpdates is higher up
    // the stack.
    if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
      flushSyncCallbacks();
    }
  }
}

export function isAlreadyRendering() {
  // Used by the renderer to print a warning if certain APIs are called from
  // the wrong context.
  return (
    __DEV__ &&
    (executionContext & (RenderContext | CommitContext)) !== NoContext
  );
}

export function flushControlled(fn: () => mixed): void {
  const prevExecutionContext = executionContext;
  executionContext |= BatchedContext;
  const prevTransition = ReactCurrentBatchConfig.transition;
  const previousPriority = getCurrentUpdatePriority();
  try {
    ReactCurrentBatchConfig.transition = null;
    setCurrentUpdatePriority(DiscreteEventPriority);
    fn();
  } finally {
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;

    executionContext = prevExecutionContext;
    if (executionContext === NoContext) {
      // Flush the immediate callbacks that were scheduled during this batch
      resetRenderTimer();
      flushSyncCallbacks();
    }
  }
}

export function pushRenderLanes(fiber: Fiber, lanes: Lanes) {
  pushToStack(subtreeRenderLanesCursor, subtreeRenderLanes, fiber);
  subtreeRenderLanes = mergeLanes(subtreeRenderLanes, lanes);
  workInProgressRootIncludedLanes = mergeLanes(
    workInProgressRootIncludedLanes,
    lanes,
  );
}

export function popRenderLanes(fiber: Fiber) {
  subtreeRenderLanes = subtreeRenderLanesCursor.current;
  popFromStack(subtreeRenderLanesCursor, fiber);
}

function prepareFreshStack(root: FiberRoot, lanes: Lanes): Fiber {
  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  const timeoutHandle = root.timeoutHandle;
  if (timeoutHandle !== noTimeout) {
    // The root previous suspended and scheduled a timeout to commit a fallback
    // state. Now that we have additional work, cancel the timeout.
    root.timeoutHandle = noTimeout;
    // $FlowFixMe Complains noTimeout is not a TimeoutID, despite the check above
    cancelTimeout(timeoutHandle);
  }

  if (workInProgress !== null) {
    let interruptedWork = workInProgress.return;
    while (interruptedWork !== null) {
      const current = interruptedWork.alternate;
      unwindInterruptedWork(
        current,
        interruptedWork,
        workInProgressRootRenderLanes,
      );
      interruptedWork = interruptedWork.return;
    }
  }
  workInProgressRoot = root;
  const rootWorkInProgress = createWorkInProgress(root.current, null);
  workInProgress = rootWorkInProgress;
  workInProgressRootRenderLanes = subtreeRenderLanes = workInProgressRootIncludedLanes = lanes;
  workInProgressRootExitStatus = RootInProgress;
  workInProgressRootFatalError = null;
  workInProgressRootSkippedLanes = NoLanes;
  workInProgressRootInterleavedUpdatedLanes = NoLanes;
  workInProgressRootRenderPhaseUpdatedLanes = NoLanes;
  workInProgressRootPingedLanes = NoLanes;
  workInProgressRootConcurrentErrors = null;
  workInProgressRootRecoverableErrors = null;

  finishQueueingConcurrentUpdates();

  if (__DEV__) {
    ReactStrictModeWarnings.discardPendingWarnings();
  }

  return rootWorkInProgress;
}

function handleError(root, thrownValue): void {
  do {
    let erroredWork = workInProgress;
    try {
      // Reset module-level state that was set during the render phase.
      resetContextDependencies();
      resetHooksAfterThrow();
      resetCurrentDebugFiberInDEV();
      // TODO: I found and added this missing line while investigating a
      // separate issue. Write a regression test using string refs.
      ReactCurrentOwner.current = null;

      if (erroredWork === null || erroredWork.return === null) {
        // Expected to be working on a non-root fiber. This is a fatal error
        // because there's no ancestor that can handle it; the root is
        // supposed to capture all errors that weren't caught by an error
        // boundary.
        workInProgressRootExitStatus = RootFatalErrored;
        workInProgressRootFatalError = thrownValue;
        // Set `workInProgress` to null. This represents advancing to the next
        // sibling, or the parent if there are no siblings. But since the root
        // has no siblings nor a parent, we set it to null. Usually this is
        // handled by `completeUnitOfWork` or `unwindWork`, but since we're
        // intentionally not calling those, we need set it here.
        // TODO: Consider calling `unwindWork` to pop the contexts.
        workInProgress = null;
        return;
      }

      if (enableProfilerTimer && erroredWork.mode & ProfileMode) {
        // Record the time spent rendering before an error was thrown. This
        // avoids inaccurate Profiler durations in the case of a
        // suspended render.
        stopProfilerTimerIfRunningAndRecordDelta(erroredWork, true);
      }

      if (enableSchedulingProfiler) {
        markComponentRenderStopped();

        if (
          thrownValue !== null &&
          typeof thrownValue === 'object' &&
          typeof thrownValue.then === 'function'
        ) {
          const wakeable: Wakeable = (thrownValue: any);
          markComponentSuspended(
            erroredWork,
            wakeable,
            workInProgressRootRenderLanes,
          );
        } else {
          markComponentErrored(
            erroredWork,
            thrownValue,
            workInProgressRootRenderLanes,
          );
        }
      }

      throwException(
        root,
        erroredWork.return,
        erroredWork,
        thrownValue,
        workInProgressRootRenderLanes,
      );
      completeUnitOfWork(erroredWork);
    } catch (yetAnotherThrownValue) {
      // Something in the return path also threw.
      thrownValue = yetAnotherThrownValue;
      if (workInProgress === erroredWork && erroredWork !== null) {
        // If this boundary has already errored, then we had trouble processing
        // the error. Bubble it to the next boundary.
        erroredWork = erroredWork.return;
        workInProgress = erroredWork;
      } else {
        erroredWork = workInProgress;
      }
      continue;
    }
    // Return to the normal work loop.
    return;
  } while (true);
}

function pushDispatcher() {
  const prevDispatcher = ReactCurrentDispatcher.current;
  ReactCurrentDispatcher.current = ContextOnlyDispatcher;
  if (prevDispatcher === null) {
    // The React isomorphic package does not include a default dispatcher.
    // Instead the first renderer will lazily attach one, in order to give
    // nicer error messages.
    return ContextOnlyDispatcher;
  } else {
    return prevDispatcher;
  }
}

function popDispatcher(prevDispatcher) {
  ReactCurrentDispatcher.current = prevDispatcher;
}

export function markCommitTimeOfFallback() {
  globalMostRecentFallbackTime = now();
}

export function markSkippedUpdateLanes(lane: Lane | Lanes): void {
  workInProgressRootSkippedLanes = mergeLanes(
    lane,
    workInProgressRootSkippedLanes,
  );
}

export function renderDidSuspend(): void {
  if (workInProgressRootExitStatus === RootInProgress) {
    workInProgressRootExitStatus = RootSuspended;
  }
}

export function renderDidSuspendDelayIfPossible(): void {
  if (
    workInProgressRootExitStatus === RootInProgress ||
    workInProgressRootExitStatus === RootSuspended ||
    workInProgressRootExitStatus === RootErrored
  ) {
    workInProgressRootExitStatus = RootSuspendedWithDelay;
  }

  // Check if there are updates that we skipped tree that might have unblocked
  // this render.
  if (
    workInProgressRoot !== null &&
    (includesNonIdleWork(workInProgressRootSkippedLanes) ||
      includesNonIdleWork(workInProgressRootInterleavedUpdatedLanes))
  ) {
    // Mark the current render as suspended so that we switch to working on
    // the updates that were skipped. Usually we only suspend at the end of
    // the render phase.
    // TODO: We should probably always mark the root as suspended immediately
    // (inside this function), since by suspending at the end of the render
    // phase introduces a potential mistake where we suspend lanes that were
    // pinged or updated while we were rendering.
    markRootSuspended(workInProgressRoot, workInProgressRootRenderLanes);
  }
}

export function renderDidError(error: CapturedValue<mixed>) {
  if (workInProgressRootExitStatus !== RootSuspendedWithDelay) {
    workInProgressRootExitStatus = RootErrored;
  }
  if (workInProgressRootConcurrentErrors === null) {
    workInProgressRootConcurrentErrors = [error];
  } else {
    workInProgressRootConcurrentErrors.push(error);
  }
}

// Called during render to determine if anything has suspended.
// Returns false if we're not sure.
export function renderHasNotSuspendedYet(): boolean {
  // If something errored or completed, we can't really be sure,
  // so those are false.
  return workInProgressRootExitStatus === RootInProgress;
}

function renderRootSync(root: FiberRoot, lanes: Lanes) {
  // 保存之前的执行上下文和调度器
  const prevExecutionContext = executionContext;
  executionContext |= RenderContext;
  const prevDispatcher = pushDispatcher();

  // 如果根节点或 lanes 发生变化，则丢弃现有的栈并准备一个新的栈
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    if (enableUpdaterTracking) {
      if (isDevToolsPresent) {
        // 如果存在开发者工具，将待处理的更新器恢复到根节点
        const memoizedUpdaters = root.memoizedUpdaters;
        if (memoizedUpdaters.size > 0) {
          restorePendingUpdaters(root, workInProgressRootRenderLanes);
          memoizedUpdaters.clear();
        }

        // 将调度了即将工作的 Fiber 从 Map 移动到 Set 中
        // 如果我们在此工作中中止，将它们移回去
        movePendingFibersToMemoized(root, lanes);
      }
    }

    // 获取当前渲染 lanes 的过渡信息
    workInProgressTransitions = getTransitionsForLanes(root, lanes);
    // 准备新的工作栈
    prepareFreshStack(root, lanes);
  }

  // 开发模式下，启用调试跟踪，记录渲染开始
  if (__DEV__) {
    if (enableDebugTracing) {
      logRenderStarted(lanes);
    }
  }

  // 启用调度性能分析，标记渲染开始
  if (enableSchedulingProfiler) {
    markRenderStarted(lanes);
  }

  // 开始工作循环，处理 Fiber 树的渲染
  do {
    try {
      workLoopSync(); // 同步执行工作循环
      break; // 如果没有异常，则退出循环
    } catch (thrownValue) {
      handleError(root, thrownValue); // 捕获并处理错误
    }
  } while (true);

  // 重置上下文依赖
  resetContextDependencies();

  // 恢复之前的执行上下文和调度器
  executionContext = prevExecutionContext;
  popDispatcher(prevDispatcher);

  // 检查是否渲染完成
  if (workInProgress !== null) {
    // 如果工作进度不为空，则抛出错误，表示渲染未完成
    throw new Error(
      'Cannot commit an incomplete root. This error is likely caused by a ' +
      'bug in React. Please file an issue.',
    );
  }

  // 开发模式下，启用调试跟踪，记录渲染停止
  if (__DEV__) {
    if (enableDebugTracing) {
      logRenderStopped();
    }
  }

  // 启用调度性能分析，标记渲染停止
  if (enableSchedulingProfiler) {
    markRenderStopped();
  }

  // 设置工作进度根节点为 null，表示没有进行中的渲染
  workInProgressRoot = null;
  workInProgressRootRenderLanes = NoLanes;

  // 返回当前渲染的状态
  return workInProgressRootExitStatus;
}

// The work loop is an extremely hot path. Tell Closure not to inline it.
/** @noinline */
function workLoopSync() {
  // console.log("workLoopSync...");
  // 已经超时，所以执行工作时不再检查是否需要让步给浏览器。
  // React 在并发模式下会定期检查是否需要暂停渲染，以避免长时间占用主线程导致界面卡顿。
  // 但在同步模式下（如这里的 `workLoopSync`），不需要做这种检查。

  while (workInProgress !== null) {
    // `workInProgress` 表示当前正在处理的 Fiber 节点。
    // 调用 `performUnitOfWork` 来处理当前的 Fiber 节点的工作。
    performUnitOfWork(workInProgress);
  }
}

function renderRootConcurrent(root: FiberRoot, lanes: Lanes) {
  console.log("renderRootConcurrent...");
  const prevExecutionContext = executionContext;
  executionContext |= RenderContext;
  const prevDispatcher = pushDispatcher();

  // If the root or lanes have changed, throw out the existing stack
  // and prepare a fresh one. Otherwise we'll continue where we left off.
  if (workInProgressRoot !== root || workInProgressRootRenderLanes !== lanes) {
    if (enableUpdaterTracking) {
      if (isDevToolsPresent) {
        const memoizedUpdaters = root.memoizedUpdaters;
        if (memoizedUpdaters.size > 0) {
          restorePendingUpdaters(root, workInProgressRootRenderLanes);
          memoizedUpdaters.clear();
        }

        // At this point, move Fibers that scheduled the upcoming work from the Map to the Set.
        // If we bailout on this work, we'll move them back (like above).
        // It's important to move them now in case the work spawns more work at the same priority with different updaters.
        // That way we can keep the current update and future updates separate.
        movePendingFibersToMemoized(root, lanes);
      }
    }

    workInProgressTransitions = getTransitionsForLanes(root, lanes);
    resetRenderTimer();
    prepareFreshStack(root, lanes);
  }

  if (__DEV__) {
    if (enableDebugTracing) {
      logRenderStarted(lanes);
    }
  }

  if (enableSchedulingProfiler) {
    markRenderStarted(lanes);
  }

  do {
    try {
      workLoopConcurrent();
      break;
    } catch (thrownValue) {
      handleError(root, thrownValue);
    }
  } while (true);
  resetContextDependencies();

  popDispatcher(prevDispatcher);
  executionContext = prevExecutionContext;

  if (__DEV__) {
    if (enableDebugTracing) {
      logRenderStopped();
    }
  }

  // Check if the tree has completed.
  if (workInProgress !== null) {
    // Still work remaining.
    if (enableSchedulingProfiler) {
      markRenderYielded();
    }
    return RootInProgress;
  } else {
    // Completed the tree.
    if (enableSchedulingProfiler) {
      markRenderStopped();
    }

    // Set this to null to indicate there's no in-progress render.
    workInProgressRoot = null;
    workInProgressRootRenderLanes = NoLanes;

    // Return the final exit status.
    return workInProgressRootExitStatus;
  }
}

/** @noinline */
function workLoopConcurrent() {
  // Perform work until Scheduler asks us to yield
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(unitOfWork: Fiber): void {
  // 获取当前 Fiber 的备用状态（alternate）
  // 理想情况下，其他代码不应依赖于此，但依赖于此可避免在工作进程中增加额外的字段
  const current = unitOfWork.alternate;

  // 设置当前调试 Fiber（仅在开发模式下）
  setCurrentDebugFiberInDEV(unitOfWork);

  let next;

  // 如果启用性能分析器且 Fiber 的模式包含 ProfileMode
  if (enableProfilerTimer && (unitOfWork.mode & ProfileMode) !== NoMode) {
    // 启动性能分析器计时器
    startProfilerTimer(unitOfWork);

    // 开始处理当前 Fiber 的工作
    next = beginWork(current, unitOfWork, subtreeRenderLanes);

    // 停止性能分析器计时器并记录时间差
    stopProfilerTimerIfRunningAndRecordDelta(unitOfWork, true);
  } else {
    // 不启用性能分析器，则直接处理当前 Fiber 的工作
    next = beginWork(current, unitOfWork, subtreeRenderLanes);
  }

  // 重置调试 Fiber（仅在开发模式下）
  resetCurrentDebugFiberInDEV();

  // 更新当前 Fiber 的 memoizedProps
  unitOfWork.memoizedProps = unitOfWork.pendingProps;

  // 如果 `next` 为 null，表示没有新工作被生成，完成当前工作
  if (next === null) {
    completeUnitOfWork(unitOfWork);
  } else {
    // 否则，将 `workInProgress` 设置为下一个工作单元
    workInProgress = next;
  }

  // 清空 ReactCurrentOwner
  ReactCurrentOwner.current = null;
}

function completeUnitOfWork(unitOfWork: Fiber): void {
  // Attempt to complete the current unit of work, then move to the next
  // sibling. If there are no more siblings, return to the parent fiber.
  let completedWork = unitOfWork;
  do {
    // The current, flushed, state of this fiber is the alternate. Ideally
    // nothing should rely on this, but relying on it here means that we don't
    // need an additional field on the work in progress.
    const current = completedWork.alternate;
    const returnFiber = completedWork.return;

    // Check if the work completed or if something threw.
    if ((completedWork.flags & Incomplete) === NoFlags) {
      setCurrentDebugFiberInDEV(completedWork);
      let next;
      if (
        !enableProfilerTimer ||
        (completedWork.mode & ProfileMode) === NoMode
      ) {
        next = completeWork(current, completedWork, subtreeRenderLanes);
      } else {
        startProfilerTimer(completedWork);
        next = completeWork(current, completedWork, subtreeRenderLanes);
        // Update render duration assuming we didn't error.
        stopProfilerTimerIfRunningAndRecordDelta(completedWork, false);
      }
      resetCurrentDebugFiberInDEV();

      if (next !== null) {
        // Completing this fiber spawned new work. Work on that next.
        workInProgress = next;
        return;
      }
    } else {
      // This fiber did not complete because something threw. Pop values off
      // the stack without entering the complete phase. If this is a boundary,
      // capture values if possible.
      const next = unwindWork(current, completedWork, subtreeRenderLanes);

      // Because this fiber did not complete, don't reset its lanes.

      if (next !== null) {
        // If completing this work spawned new work, do that next. We'll come
        // back here again.
        // Since we're restarting, remove anything that is not a host effect
        // from the effect tag.
        next.flags &= HostEffectMask;
        workInProgress = next;
        return;
      }

      if (
        enableProfilerTimer &&
        (completedWork.mode & ProfileMode) !== NoMode
      ) {
        // Record the render duration for the fiber that errored.
        stopProfilerTimerIfRunningAndRecordDelta(completedWork, false);

        // Include the time spent working on failed children before continuing.
        let actualDuration = completedWork.actualDuration;
        let child = completedWork.child;
        while (child !== null) {
          actualDuration += child.actualDuration;
          child = child.sibling;
        }
        completedWork.actualDuration = actualDuration;
      }

      if (returnFiber !== null) {
        // Mark the parent fiber as incomplete and clear its subtree flags.
        returnFiber.flags |= Incomplete;
        returnFiber.subtreeFlags = NoFlags;
        returnFiber.deletions = null;
      } else {
        // We've unwound all the way to the root.
        workInProgressRootExitStatus = RootDidNotComplete;
        workInProgress = null;
        return;
      }
    }

    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      // If there is more work to do in this returnFiber, do that next.
      workInProgress = siblingFiber;
      return;
    }
    // Otherwise, return to the parent
    completedWork = returnFiber;
    // Update the next thing we're working on in case something throws.
    workInProgress = completedWork;
  } while (completedWork !== null);

  // We've reached the root.
  if (workInProgressRootExitStatus === RootInProgress) {
    workInProgressRootExitStatus = RootCompleted;
  }
}

function commitRoot(
  root: FiberRoot,
  recoverableErrors: null | Array<CapturedValue<mixed>>,
  transitions: Array<Transition> | null,
) {
  // console.log("commitRoot...");
  // 记录当前的更新优先级和过渡配置
  const previousUpdateLanePriority = getCurrentUpdatePriority();
  const prevTransition = ReactCurrentBatchConfig.transition;

  try {
    // 在提交过程中，清除当前的过渡配置
    ReactCurrentBatchConfig.transition = null;

    // 设置当前更新的优先级为离散事件优先级
    setCurrentUpdatePriority(DiscreteEventPriority);

    // 调用实际的提交实现函数，处理根 Fiber 的提交
    commitRootImpl(
      root,
      recoverableErrors,
      transitions,
      previousUpdateLanePriority,
    );
  } finally {
    // 恢复之前保存的过渡配置
    ReactCurrentBatchConfig.transition = prevTransition;

    // 恢复之前保存的更新优先级
    setCurrentUpdatePriority(previousUpdateLanePriority);
  }

  // 函数执行完毕，返回 null
  return null;
}

function commitRootImpl(
  root: FiberRoot,
  recoverableErrors: null | Array<CapturedValue<mixed>>,
  transitions: Array<Transition> | null,
  renderPriorityLevel: EventPriority,
) {
  // 循环执行 `flushPassiveEffects` 以处理所有挂起的被动效果
  // 因为 `flushPassiveEffects` 会调用 `flushSyncUpdateQueue`，可能会导致额外的被动效果
  do {
    flushPassiveEffects();
  } while (rootWithPendingPassiveEffects !== null);

  // 在开发模式下，清理开发工具警告
  flushRenderPhaseStrictModeWarningsInDEV();

  // 确保没有在渲染或提交上下文中
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error('Should not already be working.');
  }

  // 获取根 Fiber 的 finishedWork 和 finishedLanes
  const finishedWork = root.finishedWork;
  const lanes = root.finishedLanes;

  // 在开发模式下，启用调试跟踪
  if (__DEV__) {
    if (enableDebugTracing) {
      logCommitStarted(lanes);
    }
  }

  // 启用调度分析器
  if (enableSchedulingProfiler) {
    markCommitStarted(lanes);
  }

  // 如果没有 finishedWork，停止调试和调度分析器
  if (finishedWork === null) {
    if (__DEV__) {
      if (enableDebugTracing) {
        logCommitStopped();
      }
    }

    if (enableSchedulingProfiler) {
      markCommitStopped();
    }

    return null;
  } else {
    if (__DEV__) {
      if (lanes === NoLanes) {
        console.error(
          'root.finishedLanes should not be empty during a commit. This is a ' +
          'bug in React.',
        );
      }
    }
  }

  // 清除根 Fiber 的 finishedWork 和 finishedLanes
  root.finishedWork = null;
  root.finishedLanes = NoLanes;

  // 确保无法提交相同的树
  if (finishedWork === root.current) {
    throw new Error(
      'Cannot commit the same tree as before. This error is likely caused by ' +
      'a bug in React. Please file an issue.',
    );
  }

  // 提交根从未返回续集；它总是同步完成的
  // 因此可以清除这些以允许新的回调调度
  root.callbackNode = null;
  root.callbackPriority = NoLane;

  // 更新根的首次和末次挂起时间
  let remainingLanes = mergeLanes(finishedWork.lanes, finishedWork.childLanes);
  markRootFinished(root, remainingLanes);

  // 重置当前根
  if (root === workInProgressRoot) {
    workInProgressRoot = null;
    workInProgress = null;
    workInProgressRootRenderLanes = NoLanes;
  }

  // 如果有挂起的被动效果，调度回调以处理它们
  if (
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags ||
    (finishedWork.flags & PassiveMask) !== NoFlags
  ) {
    if (!rootDoesHavePassiveEffects) {
      rootDoesHavePassiveEffects = true;
      pendingPassiveEffectsRemainingLanes = remainingLanes;
      pendingPassiveTransitions = transitions;
      scheduleCallback(NormalSchedulerPriority, () => {
        flushPassiveEffects();
        return null;
      });
    }
  }

  // 检查树中是否有任何效果
  const subtreeHasEffects =
    (finishedWork.subtreeFlags &
      (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
    NoFlags;
  const rootHasEffect =
    (finishedWork.flags &
      (BeforeMutationMask | MutationMask | LayoutMask | PassiveMask)) !==
    NoFlags;

  if (subtreeHasEffects || rootHasEffect) {
    const prevTransition = ReactCurrentBatchConfig.transition;
    ReactCurrentBatchConfig.transition = null;
    const previousPriority = getCurrentUpdatePriority();
    setCurrentUpdatePriority(DiscreteEventPriority);

    const prevExecutionContext = executionContext;
    executionContext |= CommitContext;

    ReactCurrentOwner.current = null;

    // 提交阶段分为几个子阶段：before mutation、mutation、layout
    // 第一个阶段是 "before mutation"，用来读取树的状态
    const shouldFireAfterActiveInstanceBlur = commitBeforeMutationEffects(
      root,
      finishedWork,
    );

    if (enableProfilerTimer) {
      recordCommitTime();
    }

    if (enableProfilerTimer && enableProfilerNestedUpdateScheduledHook) {
      rootCommittingMutationOrLayoutEffects = root;
    }

    // 进行 mutation 阶段，实际修改 DOM 树
    commitMutationEffects(root, finishedWork, lanes);

    if (enableCreateEventHandleAPI) {
      if (shouldFireAfterActiveInstanceBlur) {
        afterActiveInstanceBlur();
      }
    }
    resetAfterCommit(root.containerInfo);

    // 将工作中的树更新为当前树
    root.current = finishedWork;

    // 进行 layout 阶段，调用读操作
    if (__DEV__) {
      if (enableDebugTracing) {
        logLayoutEffectsStarted(lanes);
      }
    }
    if (enableSchedulingProfiler) {
      markLayoutEffectsStarted(lanes);
    }
    commitLayoutEffects(finishedWork, root, lanes);
    if (__DEV__) {
      if (enableDebugTracing) {
        logLayoutEffectsStopped();
      }
    }

    if (enableSchedulingProfiler) {
      markLayoutEffectsStopped();
    }

    if (enableProfilerTimer && enableProfilerNestedUpdateScheduledHook) {
      rootCommittingMutationOrLayoutEffects = null;
    }

    // 告诉调度器在帧结束时进行绘制
    requestPaint();

    executionContext = prevExecutionContext;

    // 恢复优先级
    setCurrentUpdatePriority(previousPriority);
    ReactCurrentBatchConfig.transition = prevTransition;
  } else {
    root.current = finishedWork;
    if (enableProfilerTimer) {
      recordCommitTime();
    }
  }

  const rootDidHavePassiveEffects = rootDoesHavePassiveEffects;

  if (rootDoesHavePassiveEffects) {
    rootDoesHavePassiveEffects = false;
    rootWithPendingPassiveEffects = root;
    pendingPassiveEffectsLanes = lanes;
  } else {
    releaseRootPooledCache(root, remainingLanes);
    if (__DEV__) {
      nestedPassiveUpdateCount = 0;
      rootWithPassiveNestedUpdates = null;
    }
  }

  remainingLanes = root.pendingLanes;

  if (remainingLanes === NoLanes) {
    legacyErrorBoundariesThatAlreadyFailed = null;
  }

  if (__DEV__ && enableStrictEffects) {
    if (!rootDidHavePassiveEffects) {
      commitDoubleInvokeEffectsInDEV(root.current, false);
    }
  }

  onCommitRootDevTools(finishedWork.stateNode, renderPriorityLevel);

  if (enableUpdaterTracking) {
    if (isDevToolsPresent) {
      root.memoizedUpdaters.clear();
    }
  }

  if (__DEV__) {
    onCommitRootTestSelector();
  }

  ensureRootIsScheduled(root, now());

  if (recoverableErrors !== null) {
    const onRecoverableError = root.onRecoverableError;
    for (let i = 0; i < recoverableErrors.length; i++) {
      const recoverableError = recoverableErrors[i];
      const componentStack = recoverableError.stack;
      const digest = recoverableError.digest;
      onRecoverableError(recoverableError.value, { componentStack, digest });
    }
  }

  if (hasUncaughtError) {
    hasUncaughtError = false;
    const error = firstUncaughtError;
    firstUncaughtError = null;
    throw error;
  }

  if (
    includesSomeLane(pendingPassiveEffectsLanes, SyncLane) &&
    root.tag !== LegacyRoot
  ) {
    flushPassiveEffects();
  }

  remainingLanes = root.pendingLanes;
  if (includesSomeLane(remainingLanes, (SyncLane: Lane))) {
    if (enableProfilerTimer && enableProfilerNestedUpdatePhase) {
      markNestedUpdateScheduled();
    }

    if (root === rootWithNestedUpdates) {
      nestedUpdateCount++;
    } else {
      nestedUpdateCount = 0;
      rootWithNestedUpdates = root;
    }
  } else {
    nestedUpdateCount = 0;
  }

  flushSyncCallbacks();

  if (__DEV__) {
    if (enableDebugTracing) {
      logCommitStopped();
    }
  }

  if (enableSchedulingProfiler) {
    markCommitStopped();
  }

  return null;
}

function releaseRootPooledCache(root: FiberRoot, remainingLanes: Lanes) {
  if (enableCache) {
    const pooledCacheLanes = (root.pooledCacheLanes &= remainingLanes);
    if (pooledCacheLanes === NoLanes) {
      // None of the remaining work relies on the cache pool. Clear it so
      // subsequent requests get a new cache
      const pooledCache = root.pooledCache;
      if (pooledCache != null) {
        root.pooledCache = null;
        releaseCache(pooledCache);
      }
    }
  }
}

export function flushPassiveEffects(): boolean {
  // Returns whether passive effects were flushed.
  // TODO: Combine this check with the one in flushPassiveEFfectsImpl. We should
  // probably just combine the two functions. I believe they were only separate
  // in the first place because we used to wrap it with
  // `Scheduler.runWithPriority`, which accepts a function. But now we track the
  // priority within React itself, so we can mutate the variable directly.
  if (rootWithPendingPassiveEffects !== null) {
    // Cache the root since rootWithPendingPassiveEffects is cleared in
    // flushPassiveEffectsImpl
    const root = rootWithPendingPassiveEffects;
    // Cache and clear the remaining lanes flag; it must be reset since this
    // method can be called from various places, not always from commitRoot
    // where the remaining lanes are known
    const remainingLanes = pendingPassiveEffectsRemainingLanes;
    pendingPassiveEffectsRemainingLanes = NoLanes;

    const renderPriority = lanesToEventPriority(pendingPassiveEffectsLanes);
    const priority = lowerEventPriority(DefaultEventPriority, renderPriority);
    const prevTransition = ReactCurrentBatchConfig.transition;
    const previousPriority = getCurrentUpdatePriority();

    try {
      ReactCurrentBatchConfig.transition = null;
      setCurrentUpdatePriority(priority);
      return flushPassiveEffectsImpl();
    } finally {
      setCurrentUpdatePriority(previousPriority);
      ReactCurrentBatchConfig.transition = prevTransition;

      // Once passive effects have run for the tree - giving components a
      // chance to retain cache instances they use - release the pooled
      // cache at the root (if there is one)
      releaseRootPooledCache(root, remainingLanes);
    }
  }
  return false;
}

export function enqueuePendingPassiveProfilerEffect(fiber: Fiber): void {
  if (enableProfilerTimer && enableProfilerCommitHooks) {
    pendingPassiveProfilerEffects.push(fiber);
    if (!rootDoesHavePassiveEffects) {
      rootDoesHavePassiveEffects = true;
      scheduleCallback(NormalSchedulerPriority, () => {
        flushPassiveEffects();
        return null;
      });
    }
  }
}

function flushPassiveEffectsImpl() {
  if (rootWithPendingPassiveEffects === null) {
    return false;
  }

  // Cache and clear the transitions flag
  const transitions = pendingPassiveTransitions;
  pendingPassiveTransitions = null;

  const root = rootWithPendingPassiveEffects;
  const lanes = pendingPassiveEffectsLanes;
  rootWithPendingPassiveEffects = null;
  // TODO: This is sometimes out of sync with rootWithPendingPassiveEffects.
  // Figure out why and fix it. It's not causing any known issues (probably
  // because it's only used for profiling), but it's a refactor hazard.
  pendingPassiveEffectsLanes = NoLanes;

  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    throw new Error('Cannot flush passive effects while already rendering.');
  }

  if (__DEV__) {
    isFlushingPassiveEffects = true;
    didScheduleUpdateDuringPassiveEffects = false;

    if (enableDebugTracing) {
      logPassiveEffectsStarted(lanes);
    }
  }

  if (enableSchedulingProfiler) {
    markPassiveEffectsStarted(lanes);
  }

  const prevExecutionContext = executionContext;
  executionContext |= CommitContext;

  commitPassiveUnmountEffects(root.current);
  commitPassiveMountEffects(root, root.current, lanes, transitions);

  // TODO: Move to commitPassiveMountEffects
  if (enableProfilerTimer && enableProfilerCommitHooks) {
    const profilerEffects = pendingPassiveProfilerEffects;
    pendingPassiveProfilerEffects = [];
    for (let i = 0; i < profilerEffects.length; i++) {
      const fiber = ((profilerEffects[i]: any): Fiber);
      commitPassiveEffectDurations(root, fiber);
    }
  }

  if (__DEV__) {
    if (enableDebugTracing) {
      logPassiveEffectsStopped();
    }
  }

  if (enableSchedulingProfiler) {
    markPassiveEffectsStopped();
  }

  if (__DEV__ && enableStrictEffects) {
    commitDoubleInvokeEffectsInDEV(root.current, true);
  }

  executionContext = prevExecutionContext;

  flushSyncCallbacks();

  if (enableTransitionTracing) {
    const prevPendingTransitionCallbacks = currentPendingTransitionCallbacks;
    const prevRootTransitionCallbacks = root.transitionCallbacks;
    if (
      prevPendingTransitionCallbacks !== null &&
      prevRootTransitionCallbacks !== null
    ) {
      // TODO(luna) Refactor this code into the Host Config
      // TODO(luna) The end time here is not necessarily accurate
      // because passive effects could be called before paint
      // (synchronously) or after paint (normally). We need
      // to come up with a way to get the correct end time for both cases.
      // One solution is in the host config, if the passive effects
      // have not yet been run, make a call to flush the passive effects
      // right after paint.
      const endTime = now();
      currentPendingTransitionCallbacks = null;

      scheduleCallback(IdleSchedulerPriority, () =>
        processTransitionCallbacks(
          prevPendingTransitionCallbacks,
          endTime,
          prevRootTransitionCallbacks,
        ),
      );
    }
  }

  if (__DEV__) {
    // If additional passive effects were scheduled, increment a counter. If this
    // exceeds the limit, we'll fire a warning.
    if (didScheduleUpdateDuringPassiveEffects) {
      if (root === rootWithPassiveNestedUpdates) {
        nestedPassiveUpdateCount++;
      } else {
        nestedPassiveUpdateCount = 0;
        rootWithPassiveNestedUpdates = root;
      }
    } else {
      nestedPassiveUpdateCount = 0;
    }
    isFlushingPassiveEffects = false;
    didScheduleUpdateDuringPassiveEffects = false;
  }

  // TODO: Move to commitPassiveMountEffects
  onPostCommitRootDevTools(root);
  if (enableProfilerTimer && enableProfilerCommitHooks) {
    const stateNode = root.current.stateNode;
    stateNode.effectDuration = 0;
    stateNode.passiveEffectDuration = 0;
  }

  return true;
}

export function isAlreadyFailedLegacyErrorBoundary(instance: mixed): boolean {
  return (
    legacyErrorBoundariesThatAlreadyFailed !== null &&
    legacyErrorBoundariesThatAlreadyFailed.has(instance)
  );
}

export function markLegacyErrorBoundaryAsFailed(instance: mixed) {
  if (legacyErrorBoundariesThatAlreadyFailed === null) {
    legacyErrorBoundariesThatAlreadyFailed = new Set([instance]);
  } else {
    legacyErrorBoundariesThatAlreadyFailed.add(instance);
  }
}

function prepareToThrowUncaughtError(error: mixed) {
  if (!hasUncaughtError) {
    hasUncaughtError = true;
    firstUncaughtError = error;
  }
}
export const onUncaughtError = prepareToThrowUncaughtError;

function captureCommitPhaseErrorOnRoot(
  rootFiber: Fiber,
  sourceFiber: Fiber,
  error: mixed,
) {
  const errorInfo = createCapturedValueAtFiber(error, sourceFiber);
  const update = createRootErrorUpdate(rootFiber, errorInfo, (SyncLane: Lane));
  const root = enqueueUpdate(rootFiber, update, (SyncLane: Lane));
  const eventTime = requestEventTime();
  if (root !== null) {
    markRootUpdated(root, SyncLane, eventTime);
    ensureRootIsScheduled(root, eventTime);
  }
}

export function captureCommitPhaseError(
  sourceFiber: Fiber,
  nearestMountedAncestor: Fiber | null,
  error: mixed,
) {
  if (__DEV__) {
    reportUncaughtErrorInDEV(error);
    setIsRunningInsertionEffect(false);
  }
  if (sourceFiber.tag === HostRoot) {
    // Error was thrown at the root. There is no parent, so the root
    // itself should capture it.
    captureCommitPhaseErrorOnRoot(sourceFiber, sourceFiber, error);
    return;
  }

  let fiber = null;
  if (skipUnmountedBoundaries) {
    fiber = nearestMountedAncestor;
  } else {
    fiber = sourceFiber.return;
  }

  while (fiber !== null) {
    if (fiber.tag === HostRoot) {
      captureCommitPhaseErrorOnRoot(fiber, sourceFiber, error);
      return;
    } else if (fiber.tag === ClassComponent) {
      const ctor = fiber.type;
      const instance = fiber.stateNode;
      if (
        typeof ctor.getDerivedStateFromError === 'function' ||
        (typeof instance.componentDidCatch === 'function' &&
          !isAlreadyFailedLegacyErrorBoundary(instance))
      ) {
        const errorInfo = createCapturedValueAtFiber(error, sourceFiber);
        const update = createClassErrorUpdate(
          fiber,
          errorInfo,
          (SyncLane: Lane),
        );
        const root = enqueueUpdate(fiber, update, (SyncLane: Lane));
        const eventTime = requestEventTime();
        if (root !== null) {
          markRootUpdated(root, SyncLane, eventTime);
          ensureRootIsScheduled(root, eventTime);
        }
        return;
      }
    }
    fiber = fiber.return;
  }

  if (__DEV__) {
    // TODO: Until we re-land skipUnmountedBoundaries (see #20147), this warning
    // will fire for errors that are thrown by destroy functions inside deleted
    // trees. What it should instead do is propagate the error to the parent of
    // the deleted tree. In the meantime, do not add this warning to the
    // allowlist; this is only for our internal use.
    console.error(
      'Internal React error: Attempted to capture a commit phase error ' +
        'inside a detached tree. This indicates a bug in React. Likely ' +
        'causes include deleting the same fiber more than once, committing an ' +
        'already-finished tree, or an inconsistent return pointer.\n\n' +
        'Error message:\n\n%s',
      error,
    );
  }
}

export function pingSuspendedRoot(
  root: FiberRoot,
  wakeable: Wakeable,
  pingedLanes: Lanes,
) {
  const pingCache = root.pingCache;
  if (pingCache !== null) {
    // The wakeable resolved, so we no longer need to memoize, because it will
    // never be thrown again.
    pingCache.delete(wakeable);
  }

  const eventTime = requestEventTime();
  markRootPinged(root, pingedLanes, eventTime);

  warnIfSuspenseResolutionNotWrappedWithActDEV(root);

  if (
    workInProgressRoot === root &&
    isSubsetOfLanes(workInProgressRootRenderLanes, pingedLanes)
  ) {
    // Received a ping at the same priority level at which we're currently
    // rendering. We might want to restart this render. This should mirror
    // the logic of whether or not a root suspends once it completes.

    // TODO: If we're rendering sync either due to Sync, Batched or expired,
    // we should probably never restart.

    // If we're suspended with delay, or if it's a retry, we'll always suspend
    // so we can always restart.
    if (
      workInProgressRootExitStatus === RootSuspendedWithDelay ||
      (workInProgressRootExitStatus === RootSuspended &&
        includesOnlyRetries(workInProgressRootRenderLanes) &&
        now() - globalMostRecentFallbackTime < FALLBACK_THROTTLE_MS)
    ) {
      // Restart from the root.
      prepareFreshStack(root, NoLanes);
    } else {
      // Even though we can't restart right now, we might get an
      // opportunity later. So we mark this render as having a ping.
      workInProgressRootPingedLanes = mergeLanes(
        workInProgressRootPingedLanes,
        pingedLanes,
      );
    }
  }

  ensureRootIsScheduled(root, eventTime);
}

function retryTimedOutBoundary(boundaryFiber: Fiber, retryLane: Lane) {
  // The boundary fiber (a Suspense component or SuspenseList component)
  // previously was rendered in its fallback state. One of the promises that
  // suspended it has resolved, which means at least part of the tree was
  // likely unblocked. Try rendering again, at a new lanes.
  if (retryLane === NoLane) {
    // TODO: Assign this to `suspenseState.retryLane`? to avoid
    // unnecessary entanglement?
    retryLane = requestRetryLane(boundaryFiber);
  }
  // TODO: Special case idle priority?
  const eventTime = requestEventTime();
  const root = enqueueConcurrentRenderForLane(boundaryFiber, retryLane);
  if (root !== null) {
    markRootUpdated(root, retryLane, eventTime);
    ensureRootIsScheduled(root, eventTime);
  }
}

export function retryDehydratedSuspenseBoundary(boundaryFiber: Fiber) {
  const suspenseState: null | SuspenseState = boundaryFiber.memoizedState;
  let retryLane = NoLane;
  if (suspenseState !== null) {
    retryLane = suspenseState.retryLane;
  }
  retryTimedOutBoundary(boundaryFiber, retryLane);
}

export function resolveRetryWakeable(boundaryFiber: Fiber, wakeable: Wakeable) {
  let retryLane = NoLane; // Default
  let retryCache: WeakSet<Wakeable> | Set<Wakeable> | null;
  switch (boundaryFiber.tag) {
    case SuspenseComponent:
      retryCache = boundaryFiber.stateNode;
      const suspenseState: null | SuspenseState = boundaryFiber.memoizedState;
      if (suspenseState !== null) {
        retryLane = suspenseState.retryLane;
      }
      break;
    case SuspenseListComponent:
      retryCache = boundaryFiber.stateNode;
      break;
    default:
      throw new Error(
        'Pinged unknown suspense boundary type. ' +
          'This is probably a bug in React.',
      );
  }

  if (retryCache !== null) {
    // The wakeable resolved, so we no longer need to memoize, because it will
    // never be thrown again.
    retryCache.delete(wakeable);
  }

  retryTimedOutBoundary(boundaryFiber, retryLane);
}

// Computes the next Just Noticeable Difference (JND) boundary.
// The theory is that a person can't tell the difference between small differences in time.
// Therefore, if we wait a bit longer than necessary that won't translate to a noticeable
// difference in the experience. However, waiting for longer might mean that we can avoid
// showing an intermediate loading state. The longer we have already waited, the harder it
// is to tell small differences in time. Therefore, the longer we've already waited,
// the longer we can wait additionally. At some point we have to give up though.
// We pick a train model where the next boundary commits at a consistent schedule.
// These particular numbers are vague estimates. We expect to adjust them based on research.
function jnd(timeElapsed: number) {
  return timeElapsed < 120
    ? 120
    : timeElapsed < 480
    ? 480
    : timeElapsed < 1080
    ? 1080
    : timeElapsed < 1920
    ? 1920
    : timeElapsed < 3000
    ? 3000
    : timeElapsed < 4320
    ? 4320
    : ceil(timeElapsed / 1960) * 1960;
}

function checkForNestedUpdates() {
  if (nestedUpdateCount > NESTED_UPDATE_LIMIT) {
    nestedUpdateCount = 0;
    rootWithNestedUpdates = null;

    throw new Error(
      'Maximum update depth exceeded. This can happen when a component ' +
        'repeatedly calls setState inside componentWillUpdate or ' +
        'componentDidUpdate. React limits the number of nested updates to ' +
        'prevent infinite loops.',
    );
  }

  if (__DEV__) {
    if (nestedPassiveUpdateCount > NESTED_PASSIVE_UPDATE_LIMIT) {
      nestedPassiveUpdateCount = 0;
      rootWithPassiveNestedUpdates = null;

      console.error(
        'Maximum update depth exceeded. This can happen when a component ' +
          "calls setState inside useEffect, but useEffect either doesn't " +
          'have a dependency array, or one of the dependencies changes on ' +
          'every render.',
      );
    }
  }
}

function flushRenderPhaseStrictModeWarningsInDEV() {
  if (__DEV__) {
    ReactStrictModeWarnings.flushLegacyContextWarning();

    if (warnAboutDeprecatedLifecycles) {
      ReactStrictModeWarnings.flushPendingUnsafeLifecycleWarnings();
    }
  }
}

function commitDoubleInvokeEffectsInDEV(
  fiber: Fiber,
  hasPassiveEffects: boolean,
) {
  if (__DEV__ && enableStrictEffects) {
    // TODO (StrictEffects) Should we set a marker on the root if it contains strict effects
    // so we don't traverse unnecessarily? similar to subtreeFlags but just at the root level.
    // Maybe not a big deal since this is DEV only behavior.

    setCurrentDebugFiberInDEV(fiber);
    invokeEffectsInDev(fiber, MountLayoutDev, invokeLayoutEffectUnmountInDEV);
    if (hasPassiveEffects) {
      invokeEffectsInDev(
        fiber,
        MountPassiveDev,
        invokePassiveEffectUnmountInDEV,
      );
    }

    invokeEffectsInDev(fiber, MountLayoutDev, invokeLayoutEffectMountInDEV);
    if (hasPassiveEffects) {
      invokeEffectsInDev(fiber, MountPassiveDev, invokePassiveEffectMountInDEV);
    }
    resetCurrentDebugFiberInDEV();
  }
}

function invokeEffectsInDev(
  firstChild: Fiber,
  fiberFlags: Flags,
  invokeEffectFn: (fiber: Fiber) => void,
): void {
  if (__DEV__ && enableStrictEffects) {
    // We don't need to re-check StrictEffectsMode here.
    // This function is only called if that check has already passed.

    let current = firstChild;
    let subtreeRoot = null;
    while (current !== null) {
      const primarySubtreeFlag = current.subtreeFlags & fiberFlags;
      if (
        current !== subtreeRoot &&
        current.child !== null &&
        primarySubtreeFlag !== NoFlags
      ) {
        current = current.child;
      } else {
        if ((current.flags & fiberFlags) !== NoFlags) {
          invokeEffectFn(current);
        }

        if (current.sibling !== null) {
          current = current.sibling;
        } else {
          current = subtreeRoot = current.return;
        }
      }
    }
  }
}

let didWarnStateUpdateForNotYetMountedComponent: Set<string> | null = null;
export function warnAboutUpdateOnNotYetMountedFiberInDEV(fiber: Fiber) {
  if (__DEV__) {
    if ((executionContext & RenderContext) !== NoContext) {
      // We let the other warning about render phase updates deal with this one.
      return;
    }

    if (!(fiber.mode & ConcurrentMode)) {
      return;
    }

    const tag = fiber.tag;
    if (
      tag !== IndeterminateComponent &&
      tag !== HostRoot &&
      tag !== ClassComponent &&
      tag !== FunctionComponent &&
      tag !== ForwardRef &&
      tag !== MemoComponent &&
      tag !== SimpleMemoComponent
    ) {
      // Only warn for user-defined components, not internal ones like Suspense.
      return;
    }

    // We show the whole stack but dedupe on the top component's name because
    // the problematic code almost always lies inside that component.
    const componentName = getComponentNameFromFiber(fiber) || 'ReactComponent';
    if (didWarnStateUpdateForNotYetMountedComponent !== null) {
      if (didWarnStateUpdateForNotYetMountedComponent.has(componentName)) {
        return;
      }
      didWarnStateUpdateForNotYetMountedComponent.add(componentName);
    } else {
      didWarnStateUpdateForNotYetMountedComponent = new Set([componentName]);
    }

    const previousFiber = ReactCurrentFiberCurrent;
    try {
      setCurrentDebugFiberInDEV(fiber);
      console.error(
        "Can't perform a React state update on a component that hasn't mounted yet. " +
          'This indicates that you have a side-effect in your render function that ' +
          'asynchronously later calls tries to update the component. Move this work to ' +
          'useEffect instead.',
      );
    } finally {
      if (previousFiber) {
        setCurrentDebugFiberInDEV(fiber);
      } else {
        resetCurrentDebugFiberInDEV();
      }
    }
  }
}

let beginWork;
if (__DEV__ && replayFailedUnitOfWorkWithInvokeGuardedCallback) {
  const dummyFiber = null;
  beginWork = (current, unitOfWork, lanes) => {
    // If a component throws an error, we replay it again in a synchronously
    // dispatched event, so that the debugger will treat it as an uncaught
    // error See ReactErrorUtils for more information.

    // Before entering the begin phase, copy the work-in-progress onto a dummy
    // fiber. If beginWork throws, we'll use this to reset the state.
    const originalWorkInProgressCopy = assignFiberPropertiesInDEV(
      dummyFiber,
      unitOfWork,
    );
    try {
      return originalBeginWork(current, unitOfWork, lanes);
    } catch (originalError) {
      if (
        didSuspendOrErrorWhileHydratingDEV() ||
        (originalError !== null &&
          typeof originalError === 'object' &&
          typeof originalError.then === 'function')
      ) {
        // Don't replay promises.
        // Don't replay errors if we are hydrating and have already suspended or handled an error
        throw originalError;
      }

      // Keep this code in sync with handleError; any changes here must have
      // corresponding changes there.
      resetContextDependencies();
      resetHooksAfterThrow();
      // Don't reset current debug fiber, since we're about to work on the
      // same fiber again.

      // Unwind the failed stack frame
      unwindInterruptedWork(current, unitOfWork, workInProgressRootRenderLanes);

      // Restore the original properties of the fiber.
      assignFiberPropertiesInDEV(unitOfWork, originalWorkInProgressCopy);

      if (enableProfilerTimer && unitOfWork.mode & ProfileMode) {
        // Reset the profiler timer.
        startProfilerTimer(unitOfWork);
      }

      // Run beginWork again.
      invokeGuardedCallback(
        null,
        originalBeginWork,
        null,
        current,
        unitOfWork,
        lanes,
      );

      if (hasCaughtError()) {
        const replayError = clearCaughtError();
        if (
          typeof replayError === 'object' &&
          replayError !== null &&
          replayError._suppressLogging &&
          typeof originalError === 'object' &&
          originalError !== null &&
          !originalError._suppressLogging
        ) {
          // If suppressed, let the flag carry over to the original error which is the one we'll rethrow.
          originalError._suppressLogging = true;
        }
      }
      // We always throw the original error in case the second render pass is not idempotent.
      // This can happen if a memoized function or CommonJS module doesn't throw after first invocation.
      throw originalError;
    }
  };
} else {
  beginWork = originalBeginWork;
}

let didWarnAboutUpdateInRender = false;
let didWarnAboutUpdateInRenderForAnotherComponent;
if (__DEV__) {
  didWarnAboutUpdateInRenderForAnotherComponent = new Set();
}

function warnAboutRenderPhaseUpdatesInDEV(fiber) {
  if (__DEV__) {
    if (
      ReactCurrentDebugFiberIsRenderingInDEV &&
      !getIsUpdatingOpaqueValueInRenderPhaseInDEV()
    ) {
      switch (fiber.tag) {
        case FunctionComponent:
        case ForwardRef:
        case SimpleMemoComponent: {
          const renderingComponentName =
            (workInProgress && getComponentNameFromFiber(workInProgress)) ||
            'Unknown';
          // Dedupe by the rendering component because it's the one that needs to be fixed.
          const dedupeKey = renderingComponentName;
          if (!didWarnAboutUpdateInRenderForAnotherComponent.has(dedupeKey)) {
            didWarnAboutUpdateInRenderForAnotherComponent.add(dedupeKey);
            const setStateComponentName =
              getComponentNameFromFiber(fiber) || 'Unknown';
            console.error(
              'Cannot update a component (`%s`) while rendering a ' +
                'different component (`%s`). To locate the bad setState() call inside `%s`, ' +
                'follow the stack trace as described in https://reactjs.org/link/setstate-in-render',
              setStateComponentName,
              renderingComponentName,
              renderingComponentName,
            );
          }
          break;
        }
        case ClassComponent: {
          if (!didWarnAboutUpdateInRender) {
            console.error(
              'Cannot update during an existing state transition (such as ' +
                'within `render`). Render methods should be a pure ' +
                'function of props and state.',
            );
            didWarnAboutUpdateInRender = true;
          }
          break;
        }
      }
    }
  }
}

export function restorePendingUpdaters(root: FiberRoot, lanes: Lanes): void {
  if (enableUpdaterTracking) {
    if (isDevToolsPresent) {
      const memoizedUpdaters = root.memoizedUpdaters;
      memoizedUpdaters.forEach(schedulingFiber => {
        addFiberToLanesMap(root, schedulingFiber, lanes);
      });

      // This function intentionally does not clear memoized updaters.
      // Those may still be relevant to the current commit
      // and a future one (e.g. Suspense).
    }
  }
}

const fakeActCallbackNode = {};
function scheduleCallback(priorityLevel, callback) {
  if (__DEV__) {
    // 如果在开发环境中
    // 检查当前是否在 `act` 范围内，如果是，则绕过调度器，将回调推入 `act` 队列中
    const actQueue = ReactCurrentActQueue.current;
    if (actQueue !== null) {
      // 如果 `actQueue` 存在，说明当前在 `act` 范围内
      actQueue.push(callback); // 将回调函数推入 `actQueue`
      return fakeActCallbackNode; // 返回一个假的回调节点（用于兼容性）
    } else {
      // 如果不在 `act` 范围内，调用调度器的 `scheduleCallback` 函数
      return Scheduler_scheduleCallback(priorityLevel, callback);
    }
  } else {
    // 在生产环境中，始终调用调度器的 `scheduleCallback` 函数
    // 此代码在生产环境下会被剥离
    return Scheduler_scheduleCallback(priorityLevel, callback);
  }
}

function cancelCallback(callbackNode) {
  if (__DEV__ && callbackNode === fakeActCallbackNode) {
    return;
  }
  // In production, always call Scheduler. This function will be stripped out.
  return Scheduler_cancelCallback(callbackNode);
}

function shouldForceFlushFallbacksInDEV() {
  // Never force flush in production. This function should get stripped out.
  return __DEV__ && ReactCurrentActQueue.current !== null;
}

function warnIfUpdatesNotWrappedWithActDEV(fiber: Fiber): void {
  if (__DEV__) {
    if (fiber.mode & ConcurrentMode) {
      if (!isConcurrentActEnvironment()) {
        // Not in an act environment. No need to warn.
        return;
      }
    } else {
      // Legacy mode has additional cases where we suppress a warning.
      if (!isLegacyActEnvironment(fiber)) {
        // Not in an act environment. No need to warn.
        return;
      }
      if (executionContext !== NoContext) {
        // Legacy mode doesn't warn if the update is batched, i.e.
        // batchedUpdates or flushSync.
        return;
      }
      if (
        fiber.tag !== FunctionComponent &&
        fiber.tag !== ForwardRef &&
        fiber.tag !== SimpleMemoComponent
      ) {
        // For backwards compatibility with pre-hooks code, legacy mode only
        // warns for updates that originate from a hook.
        return;
      }
    }

    if (ReactCurrentActQueue.current === null) {
      const previousFiber = ReactCurrentFiberCurrent;
      try {
        setCurrentDebugFiberInDEV(fiber);
        console.error(
          'An update to %s inside a test was not wrapped in act(...).\n\n' +
            'When testing, code that causes React state updates should be ' +
            'wrapped into act(...):\n\n' +
            'act(() => {\n' +
            '  /* fire events that update state */\n' +
            '});\n' +
            '/* assert on the output */\n\n' +
            "This ensures that you're testing the behavior the user would see " +
            'in the browser.' +
            ' Learn more at https://reactjs.org/link/wrap-tests-with-act',
          getComponentNameFromFiber(fiber),
        );
      } finally {
        if (previousFiber) {
          setCurrentDebugFiberInDEV(fiber);
        } else {
          resetCurrentDebugFiberInDEV();
        }
      }
    }
  }
}

function warnIfSuspenseResolutionNotWrappedWithActDEV(root: FiberRoot): void {
  if (__DEV__) {
    if (
      root.tag !== LegacyRoot &&
      isConcurrentActEnvironment() &&
      ReactCurrentActQueue.current === null
    ) {
      console.error(
        'A suspended resource finished loading inside a test, but the event ' +
          'was not wrapped in act(...).\n\n' +
          'When testing, code that resolves suspended data should be wrapped ' +
          'into act(...):\n\n' +
          'act(() => {\n' +
          '  /* finish loading suspended data */\n' +
          '});\n' +
          '/* assert on the output */\n\n' +
          "This ensures that you're testing the behavior the user would see " +
          'in the browser.' +
          ' Learn more at https://reactjs.org/link/wrap-tests-with-act',
      );
    }
  }
}

export function setIsRunningInsertionEffect(isRunning: boolean): void {
  if (__DEV__) {
    isRunningInsertionEffect = isRunning;
  }
}
