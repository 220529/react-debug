/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type { ReactElement } from 'shared/ReactElementType';
import type { ReactPortal } from 'shared/ReactTypes';
import type { Fiber } from './ReactInternalTypes';
import type { Lanes } from './ReactFiberLane.old';

import getComponentNameFromFiber from 'react-reconciler/src/getComponentNameFromFiber';
import { Placement, ChildDeletion, Forked } from './ReactFiberFlags';
import {
  getIteratorFn,
  REACT_ELEMENT_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_PORTAL_TYPE,
  REACT_LAZY_TYPE,
} from 'shared/ReactSymbols';
import { ClassComponent, HostText, HostPortal, Fragment } from './ReactWorkTags';
import isArray from 'shared/isArray';
import { warnAboutStringRefs } from 'shared/ReactFeatureFlags';
import { checkPropStringCoercion } from 'shared/CheckStringCoercion';

import {
  createWorkInProgress,
  resetWorkInProgress,
  createFiberFromElement,
  createFiberFromFragment,
  createFiberFromText,
  createFiberFromPortal,
} from './ReactFiber.old';
import { emptyRefsObject } from './ReactFiberClassComponent.old';
import { isCompatibleFamilyForHotReloading } from './ReactFiberHotReloading.old';
import { StrictLegacyMode } from './ReactTypeOfMode';
import { getIsHydrating } from './ReactFiberHydrationContext.old';
import { pushTreeFork } from './ReactFiberTreeContext.old';

let didWarnAboutMaps;
let didWarnAboutGenerators;
let didWarnAboutStringRefs;
let ownerHasKeyUseWarning;
let ownerHasFunctionTypeWarning;
let warnForMissingKey = (child: mixed, returnFiber: Fiber) => { };

if (__DEV__) {
  didWarnAboutMaps = false;
  didWarnAboutGenerators = false;
  didWarnAboutStringRefs = {};

  /**
   * Warn if there's no key explicitly set on dynamic arrays of children or
   * object keys are not valid. This allows us to keep track of children between
   * updates.
   */
  ownerHasKeyUseWarning = {};
  ownerHasFunctionTypeWarning = {};

  warnForMissingKey = (child: mixed, returnFiber: Fiber) => {
    if (child === null || typeof child !== 'object') {
      return;
    }
    if (!child._store || child._store.validated || child.key != null) {
      return;
    }

    if (typeof child._store !== 'object') {
      throw new Error(
        'React Component in warnForMissingKey should have a _store. ' +
        'This error is likely caused by a bug in React. Please file an issue.',
      );
    }

    child._store.validated = true;

    const componentName = getComponentNameFromFiber(returnFiber) || 'Component';

    if (ownerHasKeyUseWarning[componentName]) {
      return;
    }
    ownerHasKeyUseWarning[componentName] = true;

    console.error(
      'Each child in a list should have a unique ' +
      '"key" prop. See https://reactjs.org/link/warning-keys for ' +
      'more information.',
    );
  };
}

function coerceRef(
  returnFiber: Fiber,
  current: Fiber | null,
  element: ReactElement,
) {
  const mixedRef = element.ref;
  if (
    mixedRef !== null &&
    typeof mixedRef !== 'function' &&
    typeof mixedRef !== 'object'
  ) {
    if (__DEV__) {
      // TODO: Clean this up once we turn on the string ref warning for
      // everyone, because the strict mode case will no longer be relevant
      if (
        (returnFiber.mode & StrictLegacyMode || warnAboutStringRefs) &&
        // We warn in ReactElement.js if owner and self are equal for string refs
        // because these cannot be automatically converted to an arrow function
        // using a codemod. Therefore, we don't have to warn about string refs again.
        !(
          element._owner &&
          element._self &&
          element._owner.stateNode !== element._self
        )
      ) {
        const componentName =
          getComponentNameFromFiber(returnFiber) || 'Component';
        if (!didWarnAboutStringRefs[componentName]) {
          if (warnAboutStringRefs) {
            console.error(
              'Component "%s" contains the string ref "%s". Support for string refs ' +
              'will be removed in a future major release. We recommend using ' +
              'useRef() or createRef() instead. ' +
              'Learn more about using refs safely here: ' +
              'https://reactjs.org/link/strict-mode-string-ref',
              componentName,
              mixedRef,
            );
          } else {
            console.error(
              'A string ref, "%s", has been found within a strict mode tree. ' +
              'String refs are a source of potential bugs and should be avoided. ' +
              'We recommend using useRef() or createRef() instead. ' +
              'Learn more about using refs safely here: ' +
              'https://reactjs.org/link/strict-mode-string-ref',
              mixedRef,
            );
          }
          didWarnAboutStringRefs[componentName] = true;
        }
      }
    }

    if (element._owner) {
      const owner: ?Fiber = (element._owner: any);
      let inst;
      if (owner) {
        const ownerFiber = ((owner: any): Fiber);

        if (ownerFiber.tag !== ClassComponent) {
          throw new Error(
            'Function components cannot have string refs. ' +
            'We recommend using useRef() instead. ' +
            'Learn more about using refs safely here: ' +
            'https://reactjs.org/link/strict-mode-string-ref',
          );
        }

        inst = ownerFiber.stateNode;
      }

      if (!inst) {
        throw new Error(
          `Missing owner for string ref ${mixedRef}. This error is likely caused by a ` +
          'bug in React. Please file an issue.',
        );
      }
      // Assigning this to a const so Flow knows it won't change in the closure
      const resolvedInst = inst;

      if (__DEV__) {
        checkPropStringCoercion(mixedRef, 'ref');
      }
      const stringRef = '' + mixedRef;
      // Check if previous string ref matches new string ref
      if (
        current !== null &&
        current.ref !== null &&
        typeof current.ref === 'function' &&
        current.ref._stringRef === stringRef
      ) {
        return current.ref;
      }
      const ref = function (value) {
        let refs = resolvedInst.refs;
        if (refs === emptyRefsObject) {
          // This is a lazy pooled frozen object, so we need to initialize.
          refs = resolvedInst.refs = {};
        }
        if (value === null) {
          delete refs[stringRef];
        } else {
          refs[stringRef] = value;
        }
      };
      ref._stringRef = stringRef;
      return ref;
    } else {
      if (typeof mixedRef !== 'string') {
        throw new Error(
          'Expected ref to be a function, a string, an object returned by React.createRef(), or null.',
        );
      }

      if (!element._owner) {
        throw new Error(
          `Element ref was specified as a string (${mixedRef}) but no owner was set. This could happen for one of` +
          ' the following reasons:\n' +
          '1. You may be adding a ref to a function component\n' +
          "2. You may be adding a ref to a component that was not created inside a component's render method\n" +
          '3. You have multiple copies of React loaded\n' +
          'See https://reactjs.org/link/refs-must-have-owner for more information.',
        );
      }
    }
  }
  return mixedRef;
}

function throwOnInvalidObjectType(returnFiber: Fiber, newChild: Object) {
  const childString = Object.prototype.toString.call(newChild);

  throw new Error(
    `Objects are not valid as a React child (found: ${childString === '[object Object]'
      ? 'object with keys {' + Object.keys(newChild).join(', ') + '}'
      : childString
    }). ` +
    'If you meant to render a collection of children, use an array ' +
    'instead.',
  );
}

function warnOnFunctionType(returnFiber: Fiber) {
  if (__DEV__) {
    const componentName = getComponentNameFromFiber(returnFiber) || 'Component';

    if (ownerHasFunctionTypeWarning[componentName]) {
      return;
    }
    ownerHasFunctionTypeWarning[componentName] = true;

    console.error(
      'Functions are not valid as a React child. This may happen if ' +
      'you return a Component instead of <Component /> from render. ' +
      'Or maybe you meant to call this function rather than return it.',
    );
  }
}

function resolveLazy(lazyType) {
  const payload = lazyType._payload;
  const init = lazyType._init;
  return init(payload);
}

// This wrapper function exists because I expect to clone the code in each path
// to be able to optimize each path individually by branching early. This needs
// a compiler or we can do it manually. Helpers that don't need this branching
// live outside of this function.
function ChildReconciler(shouldTrackSideEffects) {
  function deleteChild(returnFiber: Fiber, childToDelete: Fiber): void {
    if (!shouldTrackSideEffects) {
      // Noop.
      return;
    }
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }

  function deleteRemainingChildren(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
  ): null {
    if (!shouldTrackSideEffects) {
      // Noop.
      return null;
    }

    // TODO: For the shouldClone case, this could be micro-optimized a bit by
    // assuming that after the first child we've already added everything.
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
    return null;
  }

  function mapRemainingChildren(
    returnFiber: Fiber,
    currentFirstChild: Fiber,
  ): Map<string | number, Fiber> {
    // Add the remaining children to a temporary map so that we can find them by
    // keys quickly. Implicit (null) keys get added to this set with their index
    // instead.
    const existingChildren: Map<string | number, Fiber> = new Map();

    let existingChild = currentFirstChild;
    while (existingChild !== null) {
      if (existingChild.key !== null) {
        existingChildren.set(existingChild.key, existingChild);
      } else {
        existingChildren.set(existingChild.index, existingChild);
      }
      existingChild = existingChild.sibling;
    }
    return existingChildren;
  }

  /**
   * 使用给定的 Fiber 节点和待处理属性创建一个新的 Fiber 节点副本。
   *
   * @param fiber 当前的 Fiber 节点。
   * @param pendingProps 新的待处理属性。
   * @returns 返回新的 Fiber 节点副本。
   */
  function useFiber(fiber: Fiber, pendingProps: mixed): Fiber {
    // 使用当前 Fiber 节点和待处理属性创建一个新的备用 Fiber 节点副本
    // 这里将 sibling 设置为 null 和 index 设置为 0 是为了避免在返回之前忘记做这些设置。
    // 例如，在处理只有一个子节点的情况时，这一点尤为重要。
    const clone = createWorkInProgress(fiber, pendingProps);

    // 初始化新节点的 sibling 和 index 属性
    // sibling 设置为 null 表示该节点没有兄弟节点
    clone.index = 0;
    // index 设置为 0 以确保在遍历子节点时保持一致
    clone.sibling = null;

    return clone;
  }

  /**
 * Determines the placement of a child fiber in the list of new children.
 *
 * 该函数决定一个子节点（fiber）在新子节点列表中的位置，并设置相应的 `flags` 标志以指示是否需要移动或插入该节点。
 *
 * @param {Fiber} newFiber - 新创建或更新的子节点（fiber）。
 * @param {number} lastPlacedIndex - 上一个已正确放置的子节点的索引。
 * @param {number} newIndex - 当前新子节点的索引。
 * @returns {number} - 返回此子节点的实际放置索引，用于下一个子节点的比较。
 */
  function placeChild(
    newFiber: Fiber,
    lastPlacedIndex: number,
    newIndex: number,
  ): number {
    // 将当前子节点的 index 属性设置为新的索引值。
    newFiber.index = newIndex;

    // 如果不需要跟踪副作用，则意味着是在 hydration（服务端渲染后的客户端激活）过程中。
    // 在这种情况下，useId 算法需要知道哪些 fiber 是属于子节点列表的一部分（数组、迭代器）。
    if (!shouldTrackSideEffects) {
      // 标记这个 fiber 为 Forked，以指示它是分叉节点（可能需要特殊处理）。
      newFiber.flags |= Forked;
      return lastPlacedIndex;
    }

    // 获取当前 fiber 对应的上一次渲染的 fiber 对象（current fiber）。
    const current = newFiber.alternate;

    // 如果 current 不为 null，说明这个 fiber 不是新创建的，而是更新的。
    if (current !== null) {
      // 获取上一次渲染时该 fiber 在列表中的索引。
      const oldIndex = current.index;

      // 如果上一次渲染的索引小于 lastPlacedIndex，说明它在更新后的列表中需要移动位置。
      if (oldIndex < lastPlacedIndex) {
        // 标记这个 fiber 为 Placement，以指示它需要被移动。
        newFiber.flags |= Placement;
        // 返回 lastPlacedIndex，表示当前 fiber 需要被放置在 lastPlacedIndex 之后。
        return lastPlacedIndex;
      } else {
        // 否则，说明这个 fiber 可以保持在原位，不需要移动。
        return oldIndex;
      }
    } else {
      // 如果 current 为 null，说明这是一个新插入的 fiber，需要被插入到列表中。
      // 标记这个 fiber 为 Placement，以指示它需要被插入。
      newFiber.flags |= Placement;
      // 返回 lastPlacedIndex，表示当前 fiber 是插入的，所以索引不变。
      return lastPlacedIndex;
    }
  }

  function placeSingleChild(newFiber: Fiber): Fiber {
    // This is simpler for the single child case. We only need to do a
    // placement for inserting new children.
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.flags |= Placement;
    }
    return newFiber;
  }

  function updateTextNode(
    returnFiber: Fiber,
    current: Fiber | null,
    textContent: string,
    lanes: Lanes,
  ) {
    if (current === null || current.tag !== HostText) {
      // Insert
      const created = createFiberFromText(textContent, returnFiber.mode, lanes);
      created.return = returnFiber;
      return created;
    } else {
      // Update
      const existing = useFiber(current, textContent);
      existing.return = returnFiber;
      return existing;
    }
  }

  function updateElement(
    returnFiber: Fiber,
    current: Fiber | null,
    element: ReactElement,
    lanes: Lanes,
  ): Fiber {
    const elementType = element.type;
    if (elementType === REACT_FRAGMENT_TYPE) {
      return updateFragment(
        returnFiber,
        current,
        element.props.children,
        lanes,
        element.key,
      );
    }
    if (current !== null) {
      if (
        current.elementType === elementType ||
        // Keep this check inline so it only runs on the false path:
        (__DEV__
          ? isCompatibleFamilyForHotReloading(current, element)
          : false) ||
        // Lazy types should reconcile their resolved type.
        // We need to do this after the Hot Reloading check above,
        // because hot reloading has different semantics than prod because
        // it doesn't resuspend. So we can't let the call below suspend.
        (typeof elementType === 'object' &&
          elementType !== null &&
          elementType.$$typeof === REACT_LAZY_TYPE &&
          resolveLazy(elementType) === current.type)
      ) {
        // Move based on index
        const existing = useFiber(current, element.props);
        existing.ref = coerceRef(returnFiber, current, element);
        existing.return = returnFiber;
        if (__DEV__) {
          existing._debugSource = element._source;
          existing._debugOwner = element._owner;
        }
        return existing;
      }
    }
    // Insert
    const created = createFiberFromElement(element, returnFiber.mode, lanes);
    created.ref = coerceRef(returnFiber, current, element);
    created.return = returnFiber;
    return created;
  }

  function updatePortal(
    returnFiber: Fiber,
    current: Fiber | null,
    portal: ReactPortal,
    lanes: Lanes,
  ): Fiber {
    if (
      current === null ||
      current.tag !== HostPortal ||
      current.stateNode.containerInfo !== portal.containerInfo ||
      current.stateNode.implementation !== portal.implementation
    ) {
      // Insert
      const created = createFiberFromPortal(portal, returnFiber.mode, lanes);
      created.return = returnFiber;
      return created;
    } else {
      // Update
      const existing = useFiber(current, portal.children || []);
      existing.return = returnFiber;
      return existing;
    }
  }

  function updateFragment(
    returnFiber: Fiber,
    current: Fiber | null,
    fragment: Iterable<*>,
    lanes: Lanes,
    key: null | string,
  ): Fiber {
    if (current === null || current.tag !== Fragment) {
      // Insert
      const created = createFiberFromFragment(
        fragment,
        returnFiber.mode,
        lanes,
        key,
      );
      created.return = returnFiber;
      return created;
    } else {
      // Update
      const existing = useFiber(current, fragment);
      existing.return = returnFiber;
      return existing;
    }
  }

  function createChild(
    returnFiber: Fiber,
    newChild: any,
    lanes: Lanes,
  ): Fiber | null {
    if (
      (typeof newChild === 'string' && newChild !== '') ||
      typeof newChild === 'number'
    ) {
      // Text nodes don't have keys. If the previous node is implicitly keyed
      // we can continue to replace it without aborting even if it is not a text
      // node.
      const created = createFiberFromText(
        '' + newChild,
        returnFiber.mode,
        lanes,
      );
      created.return = returnFiber;
      return created;
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const created = createFiberFromElement(
            newChild,
            returnFiber.mode,
            lanes,
          );
          created.ref = coerceRef(returnFiber, null, newChild);
          created.return = returnFiber;
          return created;
        }
        case REACT_PORTAL_TYPE: {
          const created = createFiberFromPortal(
            newChild,
            returnFiber.mode,
            lanes,
          );
          created.return = returnFiber;
          return created;
        }
        case REACT_LAZY_TYPE: {
          const payload = newChild._payload;
          const init = newChild._init;
          return createChild(returnFiber, init(payload), lanes);
        }
      }

      if (isArray(newChild) || getIteratorFn(newChild)) {
        const created = createFiberFromFragment(
          newChild,
          returnFiber.mode,
          lanes,
          null,
        );
        created.return = returnFiber;
        return created;
      }

      throwOnInvalidObjectType(returnFiber, newChild);
    }

    if (__DEV__) {
      if (typeof newChild === 'function') {
        warnOnFunctionType(returnFiber);
      }
    }

    return null;
  }

  function updateSlot(
    returnFiber: Fiber,
    oldFiber: Fiber | null,
    newChild: any,
    lanes: Lanes,
  ): Fiber | null {
    // 获取旧节点的 key，如果旧节点存在的话。
    const key = oldFiber !== null ? oldFiber.key : null;

    // 如果新节点是一个非空字符串或数字，这意味着它是一个文本节点。
    // 文本节点没有 key，如果旧节点有 key，则不能复用，返回 null。
    if (
      (typeof newChild === 'string' && newChild !== '') ||
      typeof newChild === 'number'
    ) {
      // 如果旧节点有 key，则不能复用旧节点，直接返回 null。
      if (key !== null) {
        return null;
      }
      // 如果没有 key 或者 key 为空，则更新为一个新的文本节点。
      return updateTextNode(returnFiber, oldFiber, '' + newChild, lanes);
    }

    // 如果新节点是一个对象且不为 null，进一步检查其类型。
    if (typeof newChild === 'object' && newChild !== null) {
      // 根据新节点的类型执行不同的更新操作。
      switch (newChild.$$typeof) {
        // 如果新节点是一个 React 元素。
        case REACT_ELEMENT_TYPE: {
          // 如果新节点的 key 与旧节点的 key 相同，可以复用旧节点。
          if (newChild.key === key) {
            return updateElement(returnFiber, oldFiber, newChild, lanes);
          } else {
            // 如果 key 不匹配，不能复用，返回 null。
            return null;
          }
        }
        // 如果新节点是一个 Portal（React Portal）。
        case REACT_PORTAL_TYPE: {
          // 同样检查 key 是否匹配以决定是否复用。
          if (newChild.key === key) {
            return updatePortal(returnFiber, oldFiber, newChild, lanes);
          } else {
            return null;
          }
        }
        // 如果新节点是一个 Lazy（React Lazy 加载组件）。
        case REACT_LAZY_TYPE: {
          const payload = newChild._payload;
          const init = newChild._init;
          // 调用 lazy 组件的初始化函数，递归调用 updateSlot 处理。
          return updateSlot(returnFiber, oldFiber, init(payload), lanes);
        }
      }

      // 如果新节点是一个数组或可迭代对象。
      if (isArray(newChild) || getIteratorFn(newChild)) {
        // 如果旧节点有 key，则不能复用，返回 null。
        if (key !== null) {
          return null;
        }
        // 否则，将其更新为一个 Fragment。
        return updateFragment(returnFiber, oldFiber, newChild, lanes, null);
      }

      // 如果新节点是无效的对象类型，抛出错误。
      throwOnInvalidObjectType(returnFiber, newChild);
    }

    // 在开发环境中，如果新节点是一个函数类型，发出警告。
    if (__DEV__) {
      if (typeof newChild === 'function') {
        warnOnFunctionType(returnFiber);
      }
    }

    // 如果没有匹配到任何类型，则返回 null。
    return null;
  }

  function updateFromMap(
    existingChildren: Map<string | number, Fiber>,
    returnFiber: Fiber,
    newIdx: number,
    newChild: any,
    lanes: Lanes,
  ): Fiber | null {
    if (
      (typeof newChild === 'string' && newChild !== '') ||
      typeof newChild === 'number'
    ) {
      // Text nodes don't have keys, so we neither have to check the old nor
      // new node for the key. If both are text nodes, they match.
      const matchedFiber = existingChildren.get(newIdx) || null;
      return updateTextNode(returnFiber, matchedFiber, '' + newChild, lanes);
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const matchedFiber =
            existingChildren.get(
              newChild.key === null ? newIdx : newChild.key,
            ) || null;
          return updateElement(returnFiber, matchedFiber, newChild, lanes);
        }
        case REACT_PORTAL_TYPE: {
          const matchedFiber =
            existingChildren.get(
              newChild.key === null ? newIdx : newChild.key,
            ) || null;
          return updatePortal(returnFiber, matchedFiber, newChild, lanes);
        }
        case REACT_LAZY_TYPE:
          const payload = newChild._payload;
          const init = newChild._init;
          return updateFromMap(
            existingChildren,
            returnFiber,
            newIdx,
            init(payload),
            lanes,
          );
      }

      if (isArray(newChild) || getIteratorFn(newChild)) {
        const matchedFiber = existingChildren.get(newIdx) || null;
        return updateFragment(returnFiber, matchedFiber, newChild, lanes, null);
      }

      throwOnInvalidObjectType(returnFiber, newChild);
    }

    if (__DEV__) {
      if (typeof newChild === 'function') {
        warnOnFunctionType(returnFiber);
      }
    }

    return null;
  }

  /**
   * Warns if there is a duplicate or missing key
   */
  function warnOnInvalidKey(
    child: mixed,
    knownKeys: Set<string> | null,
    returnFiber: Fiber,
  ): Set<string> | null {
    if (__DEV__) {
      if (typeof child !== 'object' || child === null) {
        return knownKeys;
      }
      switch (child.$$typeof) {
        case REACT_ELEMENT_TYPE:
        case REACT_PORTAL_TYPE:
          warnForMissingKey(child, returnFiber);
          const key = child.key;
          if (typeof key !== 'string') {
            break;
          }
          if (knownKeys === null) {
            knownKeys = new Set();
            knownKeys.add(key);
            break;
          }
          if (!knownKeys.has(key)) {
            knownKeys.add(key);
            break;
          }
          console.error(
            'Encountered two children with the same key, `%s`. ' +
            'Keys should be unique so that components maintain their identity ' +
            'across updates. Non-unique keys may cause children to be ' +
            'duplicated and/or omitted — the behavior is unsupported and ' +
            'could change in a future version.',
            key,
          );
          break;
        case REACT_LAZY_TYPE:
          const payload = child._payload;
          const init = (child._init: any);
          warnOnInvalidKey(init(payload), knownKeys, returnFiber);
          break;
        default:
          break;
      }
    }
    return knownKeys;
  }
  function reconcileChildrenArray(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChildren: Array<*>,
    lanes: Lanes,
  ): Fiber | null {
    // console.log("reconcileChildrenArray", newChildren);
    // 这个算法不能通过从两端同时搜索来优化，因为我们没有在 fiber 上的回溯指针。
    // 我们尝试看看在这个模型下能做到什么。如果发现不值得这种权衡，我们可以稍后添加。

    // 即使有两端优化，我们也希望优化少量更改的情况，并且通过暴力比较，而不是使用 Map。
    // 我们希望先探索在前向模式下击中那个路径，然后只有在发现我们需要大量预读时才使用 Map。
    // 这并不处理逆序搜索，但这是不常见的。再者，要使两端优化在 Iterable 上有效，我们需要复制整个集合。

    // 在这个初始版本中，我们将忍受在每次插入/移动时都进入 Map 的慢路径。

    // 如果在开发环境中，首先验证 keys。
    if (__DEV__) {
      let knownKeys = null;
      for (let i = 0; i < newChildren.length; i++) {
        const child = newChildren[i];
        // 警告无效的 key。
        knownKeys = warnOnInvalidKey(child, knownKeys, returnFiber);
      }
    }

    let resultingFirstChild: Fiber | null = null;
    let previousNewFiber: Fiber | null = null;

    // 开始遍历旧的 Fiber 子节点。
    let oldFiber = currentFirstChild;
    let lastPlacedIndex = 0;
    let newIdx = 0;
    let nextOldFiber = null;

    // 遍历旧的 Fiber 子节点和新的子节点数组。
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      if (oldFiber.index > newIdx) {
        // 如果旧节点的 index 大于当前的新节点 index，说明我们需要跳过旧节点。
        nextOldFiber = oldFiber;
        oldFiber = null;
      } else {
        // 否则，获取下一个兄弟节点。
        nextOldFiber = oldFiber.sibling;
      }
      // 更新当前的新节点。
      const newFiber = updateSlot(
        returnFiber,
        oldFiber,
        newChildren[newIdx],
        lanes,
      );
      if (newFiber === null) {
        // 如果新 Fiber 为空，表示更新失败。
        if (oldFiber === null) {
          // 如果旧节点也为空，则继续处理下一个节点。
          oldFiber = nextOldFiber;
        }
        break;
      }
      if (shouldTrackSideEffects) {
        if (oldFiber && newFiber.alternate === null) {
          // 如果旧 Fiber 存在，但新 Fiber 没有 alternate（表示没有复用），需要删除旧节点。
          deleteChild(returnFiber, oldFiber);
        }
      }
      // 更新当前子节点的位置。
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (previousNewFiber === null) {
        // 如果这是第一次创建新节点，设置为结果的第一个子节点。
        resultingFirstChild = newFiber;
      } else {
        // 否则，将其作为上一个新节点的兄弟节点。
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
      oldFiber = nextOldFiber;
    }

    if (newIdx === newChildren.length) {
      // 如果已经遍历完新的子节点数组，删除剩余的旧子节点。
      deleteRemainingChildren(returnFiber, oldFiber);
      if (getIsHydrating()) {
        // 如果正在进行 hydration（服务器端渲染），记录树的分叉。
        const numberOfForks = newIdx;
        pushTreeFork(returnFiber, numberOfForks);
      }
      return resultingFirstChild;
    }

    if (oldFiber === null) {
      // 如果没有更多的旧子节点，可以选择快速路径处理剩余的节点（插入新节点）。
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = createChild(returnFiber, newChildren[newIdx], lanes);
        if (newFiber === null) {
          continue;
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          // 如果这是第一次创建新节点，设置为结果的第一个子节点。
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
      if (getIsHydrating()) {
        // 如果正在进行 hydration，记录树的分叉。
        const numberOfForks = newIdx;
        pushTreeFork(returnFiber, numberOfForks);
      }
      return resultingFirstChild;
    }

    // 将所有剩余的旧子节点添加到 key 映射中以进行快速查找。
    const existingChildren = mapRemainingChildren(returnFiber, oldFiber);

    // 扫描新的子节点，使用映射恢复删除的节点作为移动。
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        newChildren[newIdx],
        lanes,
      );
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          if (newFiber.alternate !== null) {
            // 新 Fiber 是正在工作的，但如果存在当前 Fiber，表示我们复用了它。
            // 需要从 child 列表中删除它，以便我们不将其添加到删除列表中。
            existingChildren.delete(
              newFiber.key === null ? newIdx : newFiber.key,
            );
          }
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          // 如果这是第一次创建新节点，设置为结果的第一个子节点。
          resultingFirstChild = newFiber;
        } else {
          // 否则，将其作为上一个新节点的兄弟节点。
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
    }

    if (shouldTrackSideEffects) {
      // 对于未被上面处理的旧子节点，需要将其添加到删除列表中。
      existingChildren.forEach(child => deleteChild(returnFiber, child));
    }

    if (getIsHydrating()) {
      // 如果正在进行 hydration，记录树的分叉。
      const numberOfForks = newIdx;
      pushTreeFork(returnFiber, numberOfForks);
    }
    return resultingFirstChild;
  }

  function reconcileChildrenIterator(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChildrenIterable: Iterable<*>,
    lanes: Lanes,
  ): Fiber | null {
    // This is the same implementation as reconcileChildrenArray(),
    // but using the iterator instead.

    const iteratorFn = getIteratorFn(newChildrenIterable);

    if (typeof iteratorFn !== 'function') {
      throw new Error(
        'An object is not an iterable. This error is likely caused by a bug in ' +
        'React. Please file an issue.',
      );
    }

    if (__DEV__) {
      // We don't support rendering Generators because it's a mutation.
      // See https://github.com/facebook/react/issues/12995
      if (
        typeof Symbol === 'function' &&
        // $FlowFixMe Flow doesn't know about toStringTag
        newChildrenIterable[Symbol.toStringTag] === 'Generator'
      ) {
        if (!didWarnAboutGenerators) {
          console.error(
            'Using Generators as children is unsupported and will likely yield ' +
            'unexpected results because enumerating a generator mutates it. ' +
            'You may convert it to an array with `Array.from()` or the ' +
            '`[...spread]` operator before rendering. Keep in mind ' +
            'you might need to polyfill these features for older browsers.',
          );
        }
        didWarnAboutGenerators = true;
      }

      // Warn about using Maps as children
      if ((newChildrenIterable: any).entries === iteratorFn) {
        if (!didWarnAboutMaps) {
          console.error(
            'Using Maps as children is not supported. ' +
            'Use an array of keyed ReactElements instead.',
          );
        }
        didWarnAboutMaps = true;
      }

      // First, validate keys.
      // We'll get a different iterator later for the main pass.
      const newChildren = iteratorFn.call(newChildrenIterable);
      if (newChildren) {
        let knownKeys = null;
        let step = newChildren.next();
        for (; !step.done; step = newChildren.next()) {
          const child = step.value;
          knownKeys = warnOnInvalidKey(child, knownKeys, returnFiber);
        }
      }
    }

    const newChildren = iteratorFn.call(newChildrenIterable);

    if (newChildren == null) {
      throw new Error('An iterable object provided no iterator.');
    }

    let resultingFirstChild: Fiber | null = null;
    let previousNewFiber: Fiber | null = null;

    let oldFiber = currentFirstChild;
    let lastPlacedIndex = 0;
    let newIdx = 0;
    let nextOldFiber = null;

    let step = newChildren.next();
    for (
      ;
      oldFiber !== null && !step.done;
      newIdx++, step = newChildren.next()
    ) {
      if (oldFiber.index > newIdx) {
        nextOldFiber = oldFiber;
        oldFiber = null;
      } else {
        nextOldFiber = oldFiber.sibling;
      }
      const newFiber = updateSlot(returnFiber, oldFiber, step.value, lanes);
      if (newFiber === null) {
        // TODO: This breaks on empty slots like null children. That's
        // unfortunate because it triggers the slow path all the time. We need
        // a better way to communicate whether this was a miss or null,
        // boolean, undefined, etc.
        if (oldFiber === null) {
          oldFiber = nextOldFiber;
        }
        break;
      }
      if (shouldTrackSideEffects) {
        if (oldFiber && newFiber.alternate === null) {
          // We matched the slot, but we didn't reuse the existing fiber, so we
          // need to delete the existing child.
          deleteChild(returnFiber, oldFiber);
        }
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (previousNewFiber === null) {
        // TODO: Move out of the loop. This only happens for the first run.
        resultingFirstChild = newFiber;
      } else {
        // TODO: Defer siblings if we're not at the right index for this slot.
        // I.e. if we had null values before, then we want to defer this
        // for each null value. However, we also don't want to call updateSlot
        // with the previous one.
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
      oldFiber = nextOldFiber;
    }

    if (step.done) {
      // We've reached the end of the new children. We can delete the rest.
      deleteRemainingChildren(returnFiber, oldFiber);
      if (getIsHydrating()) {
        const numberOfForks = newIdx;
        pushTreeFork(returnFiber, numberOfForks);
      }
      return resultingFirstChild;
    }

    if (oldFiber === null) {
      // If we don't have any more existing children we can choose a fast path
      // since the rest will all be insertions.
      for (; !step.done; newIdx++, step = newChildren.next()) {
        const newFiber = createChild(returnFiber, step.value, lanes);
        if (newFiber === null) {
          continue;
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          // TODO: Move out of the loop. This only happens for the first run.
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
      if (getIsHydrating()) {
        const numberOfForks = newIdx;
        pushTreeFork(returnFiber, numberOfForks);
      }
      return resultingFirstChild;
    }

    // Add all children to a key map for quick lookups.
    const existingChildren = mapRemainingChildren(returnFiber, oldFiber);

    // Keep scanning and use the map to restore deleted items as moves.
    for (; !step.done; newIdx++, step = newChildren.next()) {
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        step.value,
        lanes,
      );
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          if (newFiber.alternate !== null) {
            // The new fiber is a work in progress, but if there exists a
            // current, that means that we reused the fiber. We need to delete
            // it from the child list so that we don't add it to the deletion
            // list.
            existingChildren.delete(
              newFiber.key === null ? newIdx : newFiber.key,
            );
          }
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
    }

    if (shouldTrackSideEffects) {
      // Any existing children that weren't consumed above were deleted. We need
      // to add them to the deletion list.
      existingChildren.forEach(child => deleteChild(returnFiber, child));
    }

    if (getIsHydrating()) {
      const numberOfForks = newIdx;
      pushTreeFork(returnFiber, numberOfForks);
    }
    return resultingFirstChild;
  }

  function reconcileSingleTextNode(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    textContent: string,
    lanes: Lanes,
  ): Fiber {
    // There's no need to check for keys on text nodes since we don't have a
    // way to define them.
    if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
      // We already have an existing node so let's just update it and delete
      // the rest.
      deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
      const existing = useFiber(currentFirstChild, textContent);
      existing.return = returnFiber;
      return existing;
    }
    // The existing first child is not a text node so we need to create one
    // and delete the existing ones.
    deleteRemainingChildren(returnFiber, currentFirstChild);
    const created = createFiberFromText(textContent, returnFiber.mode, lanes);
    created.return = returnFiber;
    return created;
  }

  function reconcileSingleElement(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    element: ReactElement,
    lanes: Lanes,
  ): Fiber {
    const key = element.key;
    let child = currentFirstChild;
    while (child !== null) {
      // TODO: If key === null and child.key === null, then this only applies to
      // the first item in the list.
      if (child.key === key) {
        const elementType = element.type;
        if (elementType === REACT_FRAGMENT_TYPE) {
          if (child.tag === Fragment) {
            deleteRemainingChildren(returnFiber, child.sibling);
            const existing = useFiber(child, element.props.children);
            existing.return = returnFiber;
            if (__DEV__) {
              existing._debugSource = element._source;
              existing._debugOwner = element._owner;
            }
            return existing;
          }
        } else {
          if (
            child.elementType === elementType ||
            // Keep this check inline so it only runs on the false path:
            (__DEV__
              ? isCompatibleFamilyForHotReloading(child, element)
              : false) ||
            // Lazy types should reconcile their resolved type.
            // We need to do this after the Hot Reloading check above,
            // because hot reloading has different semantics than prod because
            // it doesn't resuspend. So we can't let the call below suspend.
            (typeof elementType === 'object' &&
              elementType !== null &&
              elementType.$$typeof === REACT_LAZY_TYPE &&
              resolveLazy(elementType) === child.type)
          ) {
            deleteRemainingChildren(returnFiber, child.sibling);
            const existing = useFiber(child, element.props);
            existing.ref = coerceRef(returnFiber, child, element);
            existing.return = returnFiber;
            if (__DEV__) {
              existing._debugSource = element._source;
              existing._debugOwner = element._owner;
            }
            return existing;
          }
        }
        // Didn't match.
        deleteRemainingChildren(returnFiber, child);
        break;
      } else {
        deleteChild(returnFiber, child);
      }
      child = child.sibling;
    }

    if (element.type === REACT_FRAGMENT_TYPE) {
      const created = createFiberFromFragment(
        element.props.children,
        returnFiber.mode,
        lanes,
        element.key,
      );
      created.return = returnFiber;
      return created;
    } else {
      const created = createFiberFromElement(element, returnFiber.mode, lanes);
      created.ref = coerceRef(returnFiber, currentFirstChild, element);
      created.return = returnFiber;
      return created;
    }
  }

  function reconcileSinglePortal(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    portal: ReactPortal,
    lanes: Lanes,
  ): Fiber {
    const key = portal.key;
    let child = currentFirstChild;
    while (child !== null) {
      // TODO: If key === null and child.key === null, then this only applies to
      // the first item in the list.
      if (child.key === key) {
        if (
          child.tag === HostPortal &&
          child.stateNode.containerInfo === portal.containerInfo &&
          child.stateNode.implementation === portal.implementation
        ) {
          deleteRemainingChildren(returnFiber, child.sibling);
          const existing = useFiber(child, portal.children || []);
          existing.return = returnFiber;
          return existing;
        } else {
          deleteRemainingChildren(returnFiber, child);
          break;
        }
      } else {
        deleteChild(returnFiber, child);
      }
      child = child.sibling;
    }

    const created = createFiberFromPortal(portal, returnFiber.mode, lanes);
    created.return = returnFiber;
    return created;
  }

  /**
 * Reconciles the children of a Fiber node with the new children.
 *
 * 这个函数负责协调（reconcile）Fiber节点的子节点与新子节点之间的差异，并生成新的Fiber结构。
 * 这个过程会遍历子节点树，并根据新旧节点的差异来决定如何更新、插入或删除节点。
 *
 * @param {Fiber} returnFiber - 当前Fiber节点的父节点。
 * @param {Fiber | null} currentFirstChild - 当前Fiber子节点链表的第一个节点。
 * @param {any} newChild - 新的子节点，可以是单一节点、数组、迭代器或其他类型。
 * @param {Lanes} lanes - 更新优先级，决定哪些更新应优先处理。
 * @returns {Fiber | null} - 返回新的子节点Fiber树的第一个节点。
 */
  function reconcileChildFibers(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChild: any,
    lanes: Lanes,
  ): Fiber | null {
    // 这个函数不是递归的。
    // 如果顶层元素是数组，我们将其视为一组子节点，而不是片段。
    // 然而，对于嵌套数组，我们会将其视为片段节点进行处理。
    // 递归发生在正常的流程中。

    // 处理顶层无键片段（unkeyed fragments），将它们视为数组。
    // 这会导致 <>{[...]}</> 和 <>...</> 之间的歧义。
    // 我们对以上的模糊情况采用相同的处理方式。
    const isUnkeyedTopLevelFragment =
      typeof newChild === 'object' &&
      newChild !== null &&
      newChild.type === REACT_FRAGMENT_TYPE &&
      newChild.key === null;
    if (isUnkeyedTopLevelFragment) {
      // 如果是无键片段，则直接取其子节点作为新的子节点。
      newChild = newChild.props.children;
    }

    // 处理对象类型的子节点
    if (typeof newChild === 'object' && newChild !== null) {
      // console.log("newChild.$$typeof", newChild.$$typeof);
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          // 如果新子节点是一个 React 元素，则调用 `reconcileSingleElement` 函数进行协调，
          // 并使用 `placeSingleChild` 确定其位置。
          return placeSingleChild(
            reconcileSingleElement(
              returnFiber,
              currentFirstChild,
              newChild,
              lanes,
            ),
          );
        case REACT_PORTAL_TYPE:
          // 如果新子节点是一个 React 门户（Portal），则调用 `reconcileSinglePortal` 函数，
          // 并使用 `placeSingleChild` 确定其位置。
          return placeSingleChild(
            reconcileSinglePortal(
              returnFiber,
              currentFirstChild,
              newChild,
              lanes,
            ),
          );
        case REACT_LAZY_TYPE:
          // 如果新子节点是一个 React 懒加载组件（Lazy Component），
          // 则递归调用 `reconcileChildFibers` 函数，对懒加载组件进行协调。
          const payload = newChild._payload;
          const init = newChild._init;
          return reconcileChildFibers(
            returnFiber,
            currentFirstChild,
            init(payload),
            lanes,
          );
      }

      // 如果新子节点是一个数组，则调用 `reconcileChildrenArray` 函数进行协调。
      if (isArray(newChild)) {
        return reconcileChildrenArray(
          returnFiber,
          currentFirstChild,
          newChild,
          lanes,
        );
      }

      // 如果新子节点是一个迭代器，则调用 `reconcileChildrenIterator` 函数进行协调。
      if (getIteratorFn(newChild)) {
        return reconcileChildrenIterator(
          returnFiber,
          currentFirstChild,
          newChild,
          lanes,
        );
      }

      // 如果子节点的对象类型无效，则抛出错误。
      throwOnInvalidObjectType(returnFiber, newChild);
    }

    // 如果新子节点是字符串或数字类型的文本节点，则调用 `reconcileSingleTextNode` 进行协调，
    // 并使用 `placeSingleChild` 确定其位置。
    if (
      (typeof newChild === 'string' && newChild !== '') ||
      typeof newChild === 'number'
    ) {
      return placeSingleChild(
        reconcileSingleTextNode(
          returnFiber,
          currentFirstChild,
          '' + newChild,
          lanes,
        ),
      );
    }

    // 在开发环境下，如果新子节点是函数类型，则发出警告。
    if (__DEV__) {
      if (typeof newChild === 'function') {
        warnOnFunctionType(returnFiber);
      }
    }

    // 其他所有情况都视为空节点处理，删除剩余的旧子节点。
    return deleteRemainingChildren(returnFiber, currentFirstChild);
  }

  return reconcileChildFibers;
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);

export function cloneChildFibers(
  current: Fiber | null,
  workInProgress: Fiber,
): void {
  if (current !== null && workInProgress.child !== current.child) {
    throw new Error('Resuming work not yet implemented.');
  }

  if (workInProgress.child === null) {
    return;
  }

  let currentChild = workInProgress.child;
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
  workInProgress.child = newChild;

  newChild.return = workInProgress;
  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling;
    newChild = newChild.sibling = createWorkInProgress(
      currentChild,
      currentChild.pendingProps,
    );
    newChild.return = workInProgress;
  }
  newChild.sibling = null;
}

// Reset a workInProgress child set to prepare it for a second pass.
export function resetChildFibers(workInProgress: Fiber, lanes: Lanes): void {
  let child = workInProgress.child;
  while (child !== null) {
    resetWorkInProgress(child, lanes);
    child = child.sibling;
  }
}
