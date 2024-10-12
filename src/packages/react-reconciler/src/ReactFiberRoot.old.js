/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {ReactNodeList} from 'shared/ReactTypes';
import type {
  FiberRoot,
  SuspenseHydrationCallbacks,
  TransitionTracingCallbacks,
} from './ReactInternalTypes';
import type {RootTag} from './ReactRootTags';
import type {Cache} from './ReactFiberCacheComponent.old';
import type {
  PendingSuspenseBoundaries,
  Transition,
} from './ReactFiberTracingMarkerComponent.old';

import {noTimeout, supportsHydration} from './ReactFiberHostConfig';
import {createHostRootFiber} from './ReactFiber.old';
import {
  NoLane,
  NoLanes,
  NoTimestamp,
  TotalLanes,
  createLaneMap,
} from './ReactFiberLane.old';
import {
  enableSuspenseCallback,
  enableCache,
  enableProfilerCommitHooks,
  enableProfilerTimer,
  enableUpdaterTracking,
  enableTransitionTracing,
} from 'shared/ReactFeatureFlags';
import {initializeUpdateQueue} from './ReactFiberClassUpdateQueue.old';
import {LegacyRoot, ConcurrentRoot} from './ReactRootTags';
import {createCache, retainCache} from './ReactFiberCacheComponent.old';

export type RootState = {
  element: any,
  isDehydrated: boolean,
  cache: Cache,
  pendingSuspenseBoundaries: PendingSuspenseBoundaries | null,
  transitions: Set<Transition> | null,
};

function FiberRootNode(
  containerInfo,           // 容器信息，例如 DOM 节点
  tag,                     // 标签，表示根节点类型，如 ConcurrentRoot 或 LegacyRoot
  hydrate,                 // 是否是服务端渲染的 hydrate 模式
  identifierPrefix,        // 标识符前缀，主要用于生成 DOM 元素的唯一标识
  onRecoverableError       // 当遇到可恢复错误时的回调函数
) {
  this.tag = tag;                             // 存储根节点类型
  this.containerInfo = containerInfo;         // 存储与根节点关联的容器信息（DOM 或其他容器）
  this.pendingChildren = null;                // 用于存储挂起的子节点
  this.current = null;                        // 指向当前的 Fiber 树（workInProgress Fiber）
  this.pingCache = null;                      // 用于存储在 ping 时恢复的工作
  this.finishedWork = null;                   // 存储已完成的工作（完成的 Fiber 树）
  this.timeoutHandle = noTimeout;             // 超时处理的句柄，默认值为 noTimeout
  this.context = null;                        // 存储与根节点关联的上下文信息
  this.pendingContext = null;                 // 挂起的上下文信息
  this.callbackNode = null;                   // 调度中的回调节点
  this.callbackPriority = NoLane;             // 当前回调的优先级，默认为 NoLane
  this.eventTimes = createLaneMap(NoLanes);   // 存储每条车道的事件时间
  this.expirationTimes = createLaneMap(NoTimestamp); // 每条车道的过期时间

  // 调度相关的 lane 状态，用于跟踪 Fiber 树的更新优先级
  this.pendingLanes = NoLanes;                // 挂起的 lanes，表示哪些工作正在等待执行
  this.suspendedLanes = NoLanes;              // 被挂起的 lanes
  this.pingedLanes = NoLanes;                 // 已被 ping 的 lanes，表示需要被唤醒的任务
  this.expiredLanes = NoLanes;                // 已过期的 lanes，需要尽快执行
  this.mutableReadLanes = NoLanes;            // 进行可变读取的 lanes
  this.finishedLanes = NoLanes;               // 已完成的 lanes，表示已处理完的更新

  this.entangledLanes = NoLanes;              // 表示 lanes 被纠缠（entangled），影响优先级调度
  this.entanglements = createLaneMap(NoLanes); // 用于记录 lanes 的纠缠关系

  // 额外的标识符前缀，用于生成唯一 ID
  this.identifierPrefix = identifierPrefix;

  // 当遇到可恢复的错误时执行的回调函数
  this.onRecoverableError = onRecoverableError;

  // 启用缓存时的相关字段
  if (enableCache) {
    this.pooledCache = null;                  // 缓存池
    this.pooledCacheLanes = NoLanes;          // 与缓存关联的 lanes
  }

  // 如果支持 Hydration（SSR 渲染），则存储相关的 hydration 数据
  if (supportsHydration) {
    this.mutableSourceEagerHydrationData = null;
  }

  // 如果启用了 Suspense 的回调处理，则初始化 hydration 回调
  if (enableSuspenseCallback) {
    this.hydrationCallbacks = null;           // 用于存储与 Suspense 相关的回调
  }

  // 如果启用 Transition Tracing，初始化 transitionLanes 映射
  if (enableTransitionTracing) {
    this.transitionCallbacks = null;          // 用于存储与 Transition 相关的回调
    const transitionLanesMap = (this.transitionLanes = []); // 存储 Transition 相关的 lanes
    for (let i = 0; i < TotalLanes; i++) {
      transitionLanesMap.push(null);          // 为每个 lane 初始化为 null
    }
  }

  // 如果启用了 Profiler，初始化相关的持续时间字段
  if (enableProfilerTimer && enableProfilerCommitHooks) {
    this.effectDuration = 0;                  // 用于记录 effect 的持续时间
    this.passiveEffectDuration = 0;           // 用于记录 passive effect 的持续时间
  }

  // 如果启用了更新追踪功能，初始化相关字段
  if (enableUpdaterTracking) {
    this.memoizedUpdaters = new Set();        // 用于存储 memoized 的更新
    const pendingUpdatersLaneMap = (this.pendingUpdatersLaneMap = []); // 存储待处理更新的 lanes 映射
    for (let i = 0; i < TotalLanes; i++) {
      pendingUpdatersLaneMap.push(new Set()); // 每个 lane 初始化为一个空 Set
    }
  }

  // 在开发模式下，用于调试的根类型标识
  if (__DEV__) {
    switch (tag) {
      case ConcurrentRoot:
        this._debugRootType = hydrate ? 'hydrateRoot()' : 'createRoot()'; // Concurrent 模式下的根类型调试信息
        break;
      case LegacyRoot:
        this._debugRootType = hydrate ? 'hydrate()' : 'render()';         // Legacy 模式下的根类型调试信息
        break;
    }
  }
}

export function createFiberRoot(
  containerInfo: any,                      // 容器的详细信息，通常是 DOM 容器节点
  tag: RootTag,                            // 表示根节点的类型（并发模式或遗留模式）
  hydrate: boolean,                        // 是否执行 SSR（服务器端渲染）的 "hydrate" 操作
  initialChildren: ReactNodeList,          // 根节点的初始子元素
  hydrationCallbacks: null | SuspenseHydrationCallbacks, // SSR 过程中 Suspense 的回调函数
  isStrictMode: boolean,                   // 是否开启严格模式
  concurrentUpdatesByDefaultOverride: null | boolean, // 是否强制启用并发更新模式
  identifierPrefix: string,                // DOM 节点 ID 前缀，用于避免冲突
  onRecoverableError: null | ((error: mixed) => void), // 可恢复错误的处理回调
  transitionCallbacks: null | TransitionTracingCallbacks, // 跟踪 transition 的回调
): FiberRoot {
  // 创建一个新的 FiberRootNode 实例，它是整个渲染树的根节点
  const root: FiberRoot = (new FiberRootNode(
    containerInfo,               // 传入 DOM 容器节点
    tag,                         // 指定根节点类型
    hydrate,                     // 是否启用 hydrate 模式
    identifierPrefix,            // 节点 ID 的前缀
    onRecoverableError,          // 可恢复错误的处理函数
  ): any);

  // 如果 Suspense 回调功能启用，则将其添加到根节点
  if (enableSuspenseCallback) {
    root.hydrationCallbacks = hydrationCallbacks;
  }

  // 如果启用了 transition tracing 功能，添加相应的回调函数
  if (enableTransitionTracing) {
    root.transitionCallbacks = transitionCallbacks;
  }

  // 创建未初始化的 Fiber 节点，标记其为根节点的初始 Fiber（即虚拟 DOM 节点）
  const uninitializedFiber = createHostRootFiber(
    tag,                                   // 传入根节点类型
    isStrictMode,                          // 传入是否启用严格模式
    concurrentUpdatesByDefaultOverride,    // 是否强制启用并发模式
  );

  // 将 FiberRoot 与创建的 Fiber 节点连接（Fiber 树的入口点）
  root.current = uninitializedFiber;        // 将 Fiber 根节点赋值给 root.current
  uninitializedFiber.stateNode = root;      // Fiber 节点的 stateNode 指向 FiberRoot

  // 如果启用了缓存功能，则创建一个初始缓存对象并进行引用管理
  if (enableCache) {
    const initialCache = createCache();      // 创建初始缓存对象
    retainCache(initialCache);              // 保留缓存，避免被清理

    // 将初始缓存分配给 `pooledCache`，用于暂时的渲染过程
    root.pooledCache = initialCache;
    retainCache(initialCache);              // 再次保留缓存以确保它的生命周期

    // 设置未初始化的 Fiber 的状态，包括初始渲染元素和缓存
    const initialState: RootState = {
      element: initialChildren,             // 初始渲染的子元素
      isDehydrated: hydrate,                // 是否在 hydrate 模式下
      cache: initialCache,                  // 缓存对象
      transitions: null,                    // 跟踪的过渡动画
      pendingSuspenseBoundaries: null,      // 待处理的 Suspense 边界
    };
    uninitializedFiber.memoizedState = initialState;  // 将初始状态赋值给 Fiber 节点的 memoizedState
  } else {
    // 如果缓存功能未启用，初始状态不包括缓存
    const initialState: RootState = {
      element: initialChildren,             // 初始渲染的子元素
      isDehydrated: hydrate,                // 是否在 hydrate 模式下
      cache: (null: any),                   // 无缓存
      transitions: null,                    // 无过渡动画跟踪
      pendingSuspenseBoundaries: null,      // 无待处理的 Suspense 边界
    };
    uninitializedFiber.memoizedState = initialState;  // 将初始状态赋值给 Fiber 节点的 memoizedState
  }

  // 初始化更新队列，这将允许 Fiber 节点处理后续的状态更新
  initializeUpdateQueue(uninitializedFiber);

  // 返回根节点对象，这将成为渲染器的入口点
  return root;
}
