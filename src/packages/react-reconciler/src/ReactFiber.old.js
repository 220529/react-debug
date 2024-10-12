/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {ReactElement} from 'shared/ReactElementType';
import type {ReactFragment, ReactPortal, ReactScope} from 'shared/ReactTypes';
import type {Fiber} from './ReactInternalTypes';
import type {RootTag} from './ReactRootTags';
import type {WorkTag} from './ReactWorkTags';
import type {TypeOfMode} from './ReactTypeOfMode';
import type {Lanes} from './ReactFiberLane.old';
import type {SuspenseInstance} from './ReactFiberHostConfig';
import type {
  OffscreenProps,
  OffscreenInstance,
} from './ReactFiberOffscreenComponent';

import {
  createRootStrictEffectsByDefault,
  enableCache,
  enableStrictEffects,
  enableProfilerTimer,
  enableScopeAPI,
  enableLegacyHidden,
  enableSyncDefaultUpdates,
  allowConcurrentByDefault,
  enableTransitionTracing,
  enableDebugTracing,
} from 'shared/ReactFeatureFlags';
import {NoFlags, Placement, StaticMask} from './ReactFiberFlags';
import {ConcurrentRoot} from './ReactRootTags';
import {
  IndeterminateComponent,
  ClassComponent,
  HostRoot,
  HostComponent,
  HostText,
  HostPortal,
  ForwardRef,
  Fragment,
  Mode,
  ContextProvider,
  ContextConsumer,
  Profiler,
  SuspenseComponent,
  SuspenseListComponent,
  DehydratedFragment,
  FunctionComponent,
  MemoComponent,
  SimpleMemoComponent,
  LazyComponent,
  ScopeComponent,
  OffscreenComponent,
  LegacyHiddenComponent,
  CacheComponent,
  TracingMarkerComponent,
} from './ReactWorkTags';
import getComponentNameFromFiber from 'react-reconciler/src/getComponentNameFromFiber';

import {isDevToolsPresent} from './ReactFiberDevToolsHook.old';
import {
  resolveClassForHotReloading,
  resolveFunctionForHotReloading,
  resolveForwardRefForHotReloading,
} from './ReactFiberHotReloading.old';
import {NoLanes} from './ReactFiberLane.old';
import {
  NoMode,
  ConcurrentMode,
  DebugTracingMode,
  ProfileMode,
  StrictLegacyMode,
  StrictEffectsMode,
  ConcurrentUpdatesByDefaultMode,
} from './ReactTypeOfMode';
import {
  REACT_FORWARD_REF_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_DEBUG_TRACING_MODE_TYPE,
  REACT_STRICT_MODE_TYPE,
  REACT_PROFILER_TYPE,
  REACT_PROVIDER_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_SUSPENSE_TYPE,
  REACT_SUSPENSE_LIST_TYPE,
  REACT_MEMO_TYPE,
  REACT_LAZY_TYPE,
  REACT_SCOPE_TYPE,
  REACT_OFFSCREEN_TYPE,
  REACT_LEGACY_HIDDEN_TYPE,
  REACT_CACHE_TYPE,
  REACT_TRACING_MARKER_TYPE,
} from 'shared/ReactSymbols';

export type {Fiber};

let hasBadMapPolyfill;

if (__DEV__) {
  hasBadMapPolyfill = false;
  try {
    const nonExtensibleObject = Object.preventExtensions({});
    /* eslint-disable no-new */
    new Map([[nonExtensibleObject, null]]);
    new Set([nonExtensibleObject]);
    /* eslint-enable no-new */
  } catch (e) {
    // TODO: Consider warning about bad polyfills
    hasBadMapPolyfill = true;
  }
}

// 定义 FiberNode 类的构造函数，用于创建 React 的 Fiber 节点
function FiberNode(
  tag: WorkTag,           // 表示 Fiber 节点的类型（如 FunctionComponent、ClassComponent）
  pendingProps: mixed,    // 此 Fiber 对应组件传入的最新属性（props）
  key: null | string,     // 用于列表渲染中标识唯一性的 key
  mode: TypeOfMode        // 当前 Fiber 节点的模式，如 ConcurrentMode 或 NoMode
) {
  // 组件实例相关的字段
  this.tag = tag;                     // 节点的类型（如 HostComponent, ClassComponent 等）
  this.key = key;                     // key 属性，用于优化列表渲染
  this.elementType = null;            // JSX 元素的类型（如函数组件的函数本身）
  this.type = null;                   // 组件的具体类型，可能是类或函数（与 elementType 类似）
  this.stateNode = null;              // 与此 Fiber 节点关联的实际 DOM 或类实例

  // Fiber 树结构中的关系
  this.return = null;                 // 指向父 Fiber
  this.child = null;                  // 指向子 Fiber
  this.sibling = null;                // 指向兄弟 Fiber
  this.index = 0;                     // 该 Fiber 在父节点中的位置索引

  this.ref = null;                    // 保存对 DOM 或类实例的引用，便于 ref 回调函数

  // 与更新相关的字段
  this.pendingProps = pendingProps;   // 最新的 props
  this.memoizedProps = null;          // 已保存的上一次渲染的 props
  this.updateQueue = null;            // 更新队列，包含待处理的更新
  this.memoizedState = null;          // 已保存的上一次渲染的 state
  this.dependencies = null;           // 与此 Fiber 相关的上下文依赖

  this.mode = mode;                   // 当前 Fiber 所处的模式，如同步或异步模式

  // 副作用相关的字段
  this.flags = NoFlags;               // 当前节点的副作用标志位，指示哪些操作需要执行（如更新、删除）
  this.subtreeFlags = NoFlags;        // 子树的副作用标志位，指示整个子树中是否有需要处理的副作用
  this.deletions = null;              // 需要删除的 Fiber 子节点数组

  // 优先级调度相关的字段
  this.lanes = NoLanes;               // 当前 Fiber 节点的更新优先级
  this.childLanes = NoLanes;          // 子树的更新优先级

  // 双缓存（alternate）相关
  this.alternate = null;              // 用于指向当前 Fiber 的替代版本（即双缓存机制中的另一份 Fiber）

  // 如果启用了 Profiler 计时器
  if (enableProfilerTimer) {
    // 初始化以下字段为 NaN，以避免 V8 引擎的性能问题
    this.actualDuration = Number.NaN;     // 当前 Fiber 执行的实际持续时间
    this.actualStartTime = Number.NaN;    // 当前 Fiber 开始执行的时间
    this.selfBaseDuration = Number.NaN;   // 不包括子 Fiber 的基础执行时间
    this.treeBaseDuration = Number.NaN;   // 包括子 Fiber 的基础执行时间

    // 将这些字段初始化为实际值，以避免性能下降问题
    this.actualDuration = 0;
    this.actualStartTime = -1;
    this.selfBaseDuration = 0;
    this.treeBaseDuration = 0;
  }

  // 开发模式下的调试字段
  if (__DEV__) {
    // 这些字段用于调试 Fiber 节点的内部状态
    this._debugSource = null;            // 组件的源代码位置
    this._debugOwner = null;             // 该 Fiber 的所有者（创建它的组件）
    this._debugNeedsRemount = false;     // 用于指示是否需要重新挂载
    this._debugHookTypes = null;         // 记录 hook 的类型
    // 如果 Object.preventExtensions 可用，则防止该 Fiber 节点被扩展（提高调试安全性）
    if (!hasBadMapPolyfill && typeof Object.preventExtensions === 'function') {
      Object.preventExtensions(this);    // 禁止为此对象添加新属性
    }
  }
}

// This is a constructor function, rather than a POJO constructor, still
// please ensure we do the following:
// 1) Nobody should add any instance methods on this. Instance methods can be
//    more difficult to predict when they get optimized and they are almost
//    never inlined properly in static compilers.
// 2) Nobody should rely on `instanceof Fiber` for type testing. We should
//    always know when it is a fiber.
// 3) We might want to experiment with using numeric keys since they are easier
//    to optimize in a non-JIT environment.
// 4) We can easily go from a constructor to a createFiber object literal if that
//    is faster.
// 5) It should be easy to port this to a C struct and keep a C implementation
//    compatible.
const createFiber = function(
  tag: WorkTag,
  pendingProps: mixed,
  key: null | string,
  mode: TypeOfMode,
): Fiber {
  // $FlowFixMe: the shapes are exact here but Flow doesn't like constructors
  return new FiberNode(tag, pendingProps, key, mode);
};

function shouldConstruct(Component: Function) {
  const prototype = Component.prototype;
  return !!(prototype && prototype.isReactComponent);
}

export function isSimpleFunctionComponent(type: any) {
  return (
    typeof type === 'function' &&
    !shouldConstruct(type) &&
    type.defaultProps === undefined
  );
}

export function resolveLazyComponentTag(Component: Function): WorkTag {
  if (typeof Component === 'function') {
    return shouldConstruct(Component) ? ClassComponent : FunctionComponent;
  } else if (Component !== undefined && Component !== null) {
    const $$typeof = Component.$$typeof;
    if ($$typeof === REACT_FORWARD_REF_TYPE) {
      return ForwardRef;
    }
    if ($$typeof === REACT_MEMO_TYPE) {
      return MemoComponent;
    }
  }
  return IndeterminateComponent;
}

/**
 * 该函数用于创建当前 Fiber 节点的 alternate（备用 fiber 节点），
 * 用于在新的渲染周期中进行工作。
 *
 * @param current 当前正在工作的 Fiber 节点。
 * @param pendingProps 传入的新的待处理属性。
 * @returns 返回一个新的或者复用的 Fiber 节点。
 */
export function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {
  // 检查当前 Fiber 节点是否已经有一个备用节点
  let workInProgress = current.alternate;

  if (workInProgress === null) {
    // 如果没有备用 Fiber 节点，创建一个新的
    // 使用双缓冲技术来减少对象分配，保证最多有两份 Fiber 树
    // 懒加载创建 alternate 以避免不必要的内存分配
    // 这样当节点不更新时可以回收内存
    workInProgress = createFiber(
      current.tag,
      pendingProps,
      current.key,
      current.mode,
    );

    // 复制现有 Fiber 节点的一些属性到备用节点上
    workInProgress.elementType = current.elementType;
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;

    // 开发模式下，复制一些调试相关的字段
    if (__DEV__) {
      workInProgress._debugSource = current._debugSource;
      workInProgress._debugOwner = current._debugOwner;
      workInProgress._debugHookTypes = current._debugHookTypes;
    }

    // 互相引用 alternate，形成双向链接
    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    // 如果已经有一个备用 Fiber 节点，则复用它
    workInProgress.pendingProps = pendingProps;

    // 更新 type，Blocks 类型组件会存储数据在 type 上
    workInProgress.type = current.type;

    // 重置 effect 标记，因为已经有 alternate 节点
    workInProgress.flags = NoFlags;

    // 清除无效的子树效果
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;

    // 如果启用了 Profiler Timer，则重置时间相关的属性
    if (enableProfilerTimer) {
      workInProgress.actualDuration = 0;
      workInProgress.actualStartTime = -1;
    }
  }

  // 重置所有非静态的效果标记
  workInProgress.flags = current.flags & StaticMask;

  // 复制 lanes 和 childLanes 用于调度优先级
  workInProgress.childLanes = current.childLanes;
  workInProgress.lanes = current.lanes;

  // 复制 Fiber 节点的子节点、已记忆的属性和状态
  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;

  // 克隆依赖关系对象，防止渲染阶段修改时与当前 Fiber 共享
  const currentDependencies = current.dependencies;
  workInProgress.dependencies =
    currentDependencies === null
      ? null
      : {
        lanes: currentDependencies.lanes,
        firstContext: currentDependencies.firstContext,
      };

  // 这些字段在父组件的协调过程中会被覆盖
  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  workInProgress.ref = current.ref;

  // 如果启用了 Profiler Timer，复制一些基础持续时间数据
  if (enableProfilerTimer) {
    workInProgress.selfBaseDuration = current.selfBaseDuration;
    workInProgress.treeBaseDuration = current.treeBaseDuration;
  }

  // 开发模式下，处理热重载相关逻辑
  if (__DEV__) {
    workInProgress._debugNeedsRemount = current._debugNeedsRemount;
    switch (workInProgress.tag) {
      case IndeterminateComponent:
      case FunctionComponent:
      case SimpleMemoComponent:
        workInProgress.type = resolveFunctionForHotReloading(current.type);
        break;
      case ClassComponent:
        workInProgress.type = resolveClassForHotReloading(current.type);
        break;
      case ForwardRef:
        workInProgress.type = resolveForwardRefForHotReloading(current.type);
        break;
      default:
        break;
    }
  }

  return workInProgress;
}

// Used to reuse a Fiber for a second pass.
export function resetWorkInProgress(workInProgress: Fiber, renderLanes: Lanes) {
  // This resets the Fiber to what createFiber or createWorkInProgress would
  // have set the values to before during the first pass. Ideally this wouldn't
  // be necessary but unfortunately many code paths reads from the workInProgress
  // when they should be reading from current and writing to workInProgress.

  // We assume pendingProps, index, key, ref, return are still untouched to
  // avoid doing another reconciliation.

  // Reset the effect flags but keep any Placement tags, since that's something
  // that child fiber is setting, not the reconciliation.
  workInProgress.flags &= StaticMask | Placement;

  // The effects are no longer valid.

  const current = workInProgress.alternate;
  if (current === null) {
    // Reset to createFiber's initial values.
    workInProgress.childLanes = NoLanes;
    workInProgress.lanes = renderLanes;

    workInProgress.child = null;
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.memoizedProps = null;
    workInProgress.memoizedState = null;
    workInProgress.updateQueue = null;

    workInProgress.dependencies = null;

    workInProgress.stateNode = null;

    if (enableProfilerTimer) {
      // Note: We don't reset the actualTime counts. It's useful to accumulate
      // actual time across multiple render passes.
      workInProgress.selfBaseDuration = 0;
      workInProgress.treeBaseDuration = 0;
    }
  } else {
    // Reset to the cloned values that createWorkInProgress would've.
    workInProgress.childLanes = current.childLanes;
    workInProgress.lanes = current.lanes;

    workInProgress.child = current.child;
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;
    workInProgress.memoizedProps = current.memoizedProps;
    workInProgress.memoizedState = current.memoizedState;
    workInProgress.updateQueue = current.updateQueue;
    // Needed because Blocks store data on type.
    workInProgress.type = current.type;

    // Clone the dependencies object. This is mutated during the render phase, so
    // it cannot be shared with the current fiber.
    const currentDependencies = current.dependencies;
    workInProgress.dependencies =
      currentDependencies === null
        ? null
        : {
            lanes: currentDependencies.lanes,
            firstContext: currentDependencies.firstContext,
          };

    if (enableProfilerTimer) {
      // Note: We don't reset the actualTime counts. It's useful to accumulate
      // actual time across multiple render passes.
      workInProgress.selfBaseDuration = current.selfBaseDuration;
      workInProgress.treeBaseDuration = current.treeBaseDuration;
    }
  }

  return workInProgress;
}

export function createHostRootFiber(
  tag: RootTag,                                // 根节点的类型，可能是 ConcurrentRoot 或 LegacyRoot
  isStrictMode: boolean,                       // 是否开启严格模式
  concurrentUpdatesByDefaultOverride: null | boolean, // 强制并发更新模式的覆盖选项
): Fiber {
  let mode;                                    // 用于定义 Fiber 节点的工作模式

  // 检查根节点类型是否为 ConcurrentRoot，即是否启用并发模式
  if (tag === ConcurrentRoot) {
    mode = ConcurrentMode;                     // 并发模式
    if (isStrictMode === true) {
      mode |= StrictLegacyMode;                // 开启严格模式的遗留支持

      // 如果启用了 StrictEffectsMode，则启用严格的副作用模式
      if (enableStrictEffects) {
        mode |= StrictEffectsMode;             // 严格模式下的副作用检测
      }
    }
    // 如果默认情况下开启严格的副作用模式
    else if (enableStrictEffects && createRootStrictEffectsByDefault) {
      mode |= StrictLegacyMode | StrictEffectsMode; // 严格模式和副作用模式
    }

    // 针对同步默认更新和内部实验的处理
    if (
      !enableSyncDefaultUpdates ||             // 如果未启用同步默认更新
      (allowConcurrentByDefault && concurrentUpdatesByDefaultOverride) // 或者强制并发更新模式
    ) {
      mode |= ConcurrentUpdatesByDefaultMode;  // 启用并发更新模式
    }
  } else {
    // 如果不是并发模式的根节点，则设置为没有特殊模式
    mode = NoMode;
  }

  // 如果启用了 Profiler 定时器，并且存在开发工具
  if (enableProfilerTimer && isDevToolsPresent) {
    // 启用 Profile 模式以收集性能剖析信息
    mode |= ProfileMode;                       // 启用性能分析模式
  }

  // 创建根 Fiber 节点，类型为 HostRoot，传递 null 作为 key 和 type，模式为刚刚确定的 mode
  return createFiber(HostRoot, null, null, mode);
}

export function createFiberFromTypeAndProps(
  type: any, // React$ElementType
  key: null | string,
  pendingProps: any,
  owner: null | Fiber,
  mode: TypeOfMode,
  lanes: Lanes,
): Fiber {
  let fiberTag = IndeterminateComponent;
  // The resolved type is set if we know what the final type will be. I.e. it's not lazy.
  let resolvedType = type;
  if (typeof type === 'function') {
    if (shouldConstruct(type)) {
      fiberTag = ClassComponent;
      if (__DEV__) {
        resolvedType = resolveClassForHotReloading(resolvedType);
      }
    } else {
      if (__DEV__) {
        resolvedType = resolveFunctionForHotReloading(resolvedType);
      }
    }
  } else if (typeof type === 'string') {
    fiberTag = HostComponent;
  } else {
    getTag: switch (type) {
      case REACT_FRAGMENT_TYPE:
        return createFiberFromFragment(pendingProps.children, mode, lanes, key);
      case REACT_STRICT_MODE_TYPE:
        fiberTag = Mode;
        mode |= StrictLegacyMode;
        if (enableStrictEffects && (mode & ConcurrentMode) !== NoMode) {
          // Strict effects should never run on legacy roots
          mode |= StrictEffectsMode;
        }
        break;
      case REACT_PROFILER_TYPE:
        return createFiberFromProfiler(pendingProps, mode, lanes, key);
      case REACT_SUSPENSE_TYPE:
        return createFiberFromSuspense(pendingProps, mode, lanes, key);
      case REACT_SUSPENSE_LIST_TYPE:
        return createFiberFromSuspenseList(pendingProps, mode, lanes, key);
      case REACT_OFFSCREEN_TYPE:
        return createFiberFromOffscreen(pendingProps, mode, lanes, key);
      case REACT_LEGACY_HIDDEN_TYPE:
        if (enableLegacyHidden) {
          return createFiberFromLegacyHidden(pendingProps, mode, lanes, key);
        }
      // eslint-disable-next-line no-fallthrough
      case REACT_SCOPE_TYPE:
        if (enableScopeAPI) {
          return createFiberFromScope(type, pendingProps, mode, lanes, key);
        }
      // eslint-disable-next-line no-fallthrough
      case REACT_CACHE_TYPE:
        if (enableCache) {
          return createFiberFromCache(pendingProps, mode, lanes, key);
        }
      // eslint-disable-next-line no-fallthrough
      case REACT_TRACING_MARKER_TYPE:
        if (enableTransitionTracing) {
          return createFiberFromTracingMarker(pendingProps, mode, lanes, key);
        }
      // eslint-disable-next-line no-fallthrough
      case REACT_DEBUG_TRACING_MODE_TYPE:
        if (enableDebugTracing) {
          fiberTag = Mode;
          mode |= DebugTracingMode;
          break;
        }
      // eslint-disable-next-line no-fallthrough
      default: {
        if (typeof type === 'object' && type !== null) {
          switch (type.$$typeof) {
            case REACT_PROVIDER_TYPE:
              fiberTag = ContextProvider;
              break getTag;
            case REACT_CONTEXT_TYPE:
              // This is a consumer
              fiberTag = ContextConsumer;
              break getTag;
            case REACT_FORWARD_REF_TYPE:
              fiberTag = ForwardRef;
              if (__DEV__) {
                resolvedType = resolveForwardRefForHotReloading(resolvedType);
              }
              break getTag;
            case REACT_MEMO_TYPE:
              fiberTag = MemoComponent;
              break getTag;
            case REACT_LAZY_TYPE:
              fiberTag = LazyComponent;
              resolvedType = null;
              break getTag;
          }
        }
        let info = '';
        if (__DEV__) {
          if (
            type === undefined ||
            (typeof type === 'object' &&
              type !== null &&
              Object.keys(type).length === 0)
          ) {
            info +=
              ' You likely forgot to export your component from the file ' +
              "it's defined in, or you might have mixed up default and " +
              'named imports.';
          }
          const ownerName = owner ? getComponentNameFromFiber(owner) : null;
          if (ownerName) {
            info += '\n\nCheck the render method of `' + ownerName + '`.';
          }
        }

        throw new Error(
          'Element type is invalid: expected a string (for built-in ' +
            'components) or a class/function (for composite components) ' +
            `but got: ${type == null ? type : typeof type}.${info}`,
        );
      }
    }
  }

  const fiber = createFiber(fiberTag, pendingProps, key, mode);
  fiber.elementType = type;
  fiber.type = resolvedType;
  fiber.lanes = lanes;

  if (__DEV__) {
    fiber._debugOwner = owner;
  }

  return fiber;
}

export function createFiberFromElement(
  element: ReactElement,
  mode: TypeOfMode,
  lanes: Lanes,
): Fiber {
  let owner = null;
  if (__DEV__) {
    owner = element._owner;
  }
  const type = element.type;
  const key = element.key;
  const pendingProps = element.props;
  const fiber = createFiberFromTypeAndProps(
    type,
    key,
    pendingProps,
    owner,
    mode,
    lanes,
  );
  if (__DEV__) {
    fiber._debugSource = element._source;
    fiber._debugOwner = element._owner;
  }
  return fiber;
}

export function createFiberFromFragment(
  elements: ReactFragment,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string,
): Fiber {
  const fiber = createFiber(Fragment, elements, key, mode);
  fiber.lanes = lanes;
  return fiber;
}

function createFiberFromScope(
  scope: ReactScope,
  pendingProps: any,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string,
) {
  const fiber = createFiber(ScopeComponent, pendingProps, key, mode);
  fiber.type = scope;
  fiber.elementType = scope;
  fiber.lanes = lanes;
  return fiber;
}

function createFiberFromProfiler(
  pendingProps: any,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string,
): Fiber {
  if (__DEV__) {
    if (typeof pendingProps.id !== 'string') {
      console.error(
        'Profiler must specify an "id" of type `string` as a prop. Received the type `%s` instead.',
        typeof pendingProps.id,
      );
    }
  }

  const fiber = createFiber(Profiler, pendingProps, key, mode | ProfileMode);
  fiber.elementType = REACT_PROFILER_TYPE;
  fiber.lanes = lanes;

  if (enableProfilerTimer) {
    fiber.stateNode = {
      effectDuration: 0,
      passiveEffectDuration: 0,
    };
  }

  return fiber;
}

export function createFiberFromSuspense(
  pendingProps: any,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string,
) {
  const fiber = createFiber(SuspenseComponent, pendingProps, key, mode);
  fiber.elementType = REACT_SUSPENSE_TYPE;
  fiber.lanes = lanes;
  return fiber;
}

export function createFiberFromSuspenseList(
  pendingProps: any,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string,
) {
  const fiber = createFiber(SuspenseListComponent, pendingProps, key, mode);
  fiber.elementType = REACT_SUSPENSE_LIST_TYPE;
  fiber.lanes = lanes;
  return fiber;
}

export function createFiberFromOffscreen(
  pendingProps: OffscreenProps,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string,
) {
  const fiber = createFiber(OffscreenComponent, pendingProps, key, mode);
  fiber.elementType = REACT_OFFSCREEN_TYPE;
  fiber.lanes = lanes;
  const primaryChildInstance: OffscreenInstance = {
    isHidden: false,
  };
  fiber.stateNode = primaryChildInstance;
  return fiber;
}

export function createFiberFromLegacyHidden(
  pendingProps: OffscreenProps,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string,
) {
  const fiber = createFiber(LegacyHiddenComponent, pendingProps, key, mode);
  fiber.elementType = REACT_LEGACY_HIDDEN_TYPE;
  fiber.lanes = lanes;
  return fiber;
}

export function createFiberFromCache(
  pendingProps: any,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string,
) {
  const fiber = createFiber(CacheComponent, pendingProps, key, mode);
  fiber.elementType = REACT_CACHE_TYPE;
  fiber.lanes = lanes;
  return fiber;
}

export function createFiberFromTracingMarker(
  pendingProps: any,
  mode: TypeOfMode,
  lanes: Lanes,
  key: null | string,
) {
  const fiber = createFiber(TracingMarkerComponent, pendingProps, key, mode);
  fiber.elementType = REACT_TRACING_MARKER_TYPE;
  fiber.lanes = lanes;
  return fiber;
}

export function createFiberFromText(
  content: string,
  mode: TypeOfMode,
  lanes: Lanes,
): Fiber {
  const fiber = createFiber(HostText, content, null, mode);
  fiber.lanes = lanes;
  return fiber;
}

export function createFiberFromHostInstanceForDeletion(): Fiber {
  const fiber = createFiber(HostComponent, null, null, NoMode);
  fiber.elementType = 'DELETED';
  return fiber;
}

export function createFiberFromDehydratedFragment(
  dehydratedNode: SuspenseInstance,
): Fiber {
  const fiber = createFiber(DehydratedFragment, null, null, NoMode);
  fiber.stateNode = dehydratedNode;
  return fiber;
}

export function createFiberFromPortal(
  portal: ReactPortal,
  mode: TypeOfMode,
  lanes: Lanes,
): Fiber {
  const pendingProps = portal.children !== null ? portal.children : [];
  const fiber = createFiber(HostPortal, pendingProps, portal.key, mode);
  fiber.lanes = lanes;
  fiber.stateNode = {
    containerInfo: portal.containerInfo,
    pendingChildren: null, // Used by persistent updates
    implementation: portal.implementation,
  };
  return fiber;
}

// Used for stashing WIP properties to replay failed work in DEV.
export function assignFiberPropertiesInDEV(
  target: Fiber | null,
  source: Fiber,
): Fiber {
  if (target === null) {
    // This Fiber's initial properties will always be overwritten.
    // We only use a Fiber to ensure the same hidden class so DEV isn't slow.
    target = createFiber(IndeterminateComponent, null, null, NoMode);
  }

  // This is intentionally written as a list of all properties.
  // We tried to use Object.assign() instead but this is called in
  // the hottest path, and Object.assign() was too slow:
  // https://github.com/facebook/react/issues/12502
  // This code is DEV-only so size is not a concern.

  target.tag = source.tag;
  target.key = source.key;
  target.elementType = source.elementType;
  target.type = source.type;
  target.stateNode = source.stateNode;
  target.return = source.return;
  target.child = source.child;
  target.sibling = source.sibling;
  target.index = source.index;
  target.ref = source.ref;
  target.pendingProps = source.pendingProps;
  target.memoizedProps = source.memoizedProps;
  target.updateQueue = source.updateQueue;
  target.memoizedState = source.memoizedState;
  target.dependencies = source.dependencies;
  target.mode = source.mode;
  target.flags = source.flags;
  target.subtreeFlags = source.subtreeFlags;
  target.deletions = source.deletions;
  target.lanes = source.lanes;
  target.childLanes = source.childLanes;
  target.alternate = source.alternate;
  if (enableProfilerTimer) {
    target.actualDuration = source.actualDuration;
    target.actualStartTime = source.actualStartTime;
    target.selfBaseDuration = source.selfBaseDuration;
    target.treeBaseDuration = source.treeBaseDuration;
  }

  target._debugSource = source._debugSource;
  target._debugOwner = source._debugOwner;
  target._debugNeedsRemount = source._debugNeedsRemount;
  target._debugHookTypes = source._debugHookTypes;
  return target;
}
