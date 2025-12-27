# React Diff 算法

## 核心思想

React Diff 基于三个假设优化：
1. 不同类型的元素产生不同的树
2. 通过 key 标识哪些子元素在不同渲染中保持稳定
3. 只对同级元素进行 Diff

## 入口函数

```javascript
// ReactChildFiber.js
function reconcileChildFibersImpl(returnFiber, currentFirstChild, newChild, lanes) {
  // 处理 Fragment
  if (isUnkeyedTopLevelFragment) {
    newChild = newChild.props.children;
  }
  
  if (typeof newChild === 'object' && newChild !== null) {
    switch (newChild.$typeof) {
      case REACT_ELEMENT_TYPE:
        // 单节点 Diff
        return reconcileSingleElement(returnFiber, currentFirstChild, newChild, lanes);
      case REACT_PORTAL_TYPE:
        return reconcileSinglePortal(...);
      case REACT_LAZY_TYPE:
        // 递归处理 Lazy
        return reconcileChildFibersImpl(returnFiber, currentFirstChild, result, lanes);
    }
    
    if (isArray(newChild)) {
      // 多节点 Diff
      return reconcileChildrenArray(returnFiber, currentFirstChild, newChild, lanes);
    }
  }
  
  // 文本节点
  if (typeof newChild === 'string' || typeof newChild === 'number') {
    return reconcileSingleTextNode(...);
  }
  
  // 删除所有旧节点
  return deleteRemainingChildren(returnFiber, currentFirstChild);
}
```

## 单节点 Diff

```javascript
function reconcileSingleElement(returnFiber, currentFirstChild, element, lanes) {
  const key = element.key;
  let child = currentFirstChild;
  
  // 遍历旧的子节点
  while (child !== null) {
    if (child.key === key) {
      // key 相同
      if (child.elementType === element.type) {
        // type 也相同，可以复用
        deleteRemainingChildren(returnFiber, child.sibling);  // 删除其他兄弟
        const existing = useFiber(child, element.props);      // 复用 Fiber
        existing.return = returnFiber;
        return existing;
      }
      // key 相同但 type 不同，删除所有旧节点
      deleteRemainingChildren(returnFiber, child);
      break;
    } else {
      // key 不同，删除当前节点，继续遍历
      deleteChild(returnFiber, child);
    }
    child = child.sibling;
  }
  
  // 没有可复用的，创建新 Fiber
  const created = createFiberFromElement(element, returnFiber.mode, lanes);
  created.return = returnFiber;
  return created;
}
```

### 单节点 Diff 流程图

```
旧: A → B → C
新: B

1. 比较 A.key vs B.key → 不同 → 删除 A
2. 比较 B.key vs B.key → 相同
   比较 B.type vs B.type → 相同 → 复用 B，删除 C
```

## 多节点 Diff

多节点 Diff 分三轮遍历：

### 第一轮：处理更新

```javascript
function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren, lanes) {
  let oldFiber = currentFirstChild;
  let newIdx = 0;
  let lastPlacedIndex = 0;
  
  // 第一轮：从左到右遍历，处理更新
  for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
    const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx], lanes);
    
    if (newFiber === null) {
      // key 不同，跳出第一轮
      break;
    }
    
    // 标记位置
    lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
    oldFiber = oldFiber.sibling;
  }
```

### 第二轮：处理新增/删除

```javascript
  // 新节点遍历完，删除剩余旧节点
  if (newIdx === newChildren.length) {
    deleteRemainingChildren(returnFiber, oldFiber);
    return resultingFirstChild;
  }
  
  // 旧节点遍历完，新增剩余新节点
  if (oldFiber === null) {
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = createChild(returnFiber, newChildren[newIdx], lanes);
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
    }
    return resultingFirstChild;
  }
```

### 第三轮：处理移动

```javascript
  // 将剩余旧节点放入 Map
  const existingChildren = mapRemainingChildren(oldFiber);
  
  // 遍历剩余新节点
  for (; newIdx < newChildren.length; newIdx++) {
    // 从 Map 中查找可复用的节点
    const newFiber = updateFromMap(
      existingChildren,
      returnFiber,
      newIdx,
      newChildren[newIdx],
      lanes,
    );
    
    if (newFiber !== null) {
      if (newFiber.alternate !== null) {
        // 复用了旧节点，从 Map 中删除
        existingChildren.delete(newFiber.key === null ? newIdx : newFiber.key);
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
    }
  }
  
  // 删除 Map 中剩余的旧节点
  existingChildren.forEach(child => deleteChild(returnFiber, child));
  
  return resultingFirstChild;
}
```

## placeChild（标记移动）

```javascript
function placeChild(newFiber, lastPlacedIndex, newIndex) {
  newFiber.index = newIndex;
  
  const current = newFiber.alternate;
  if (current !== null) {
    const oldIndex = current.index;
    if (oldIndex < lastPlacedIndex) {
      // 需要移动
      newFiber.flags |= Placement;
      return lastPlacedIndex;
    } else {
      // 不需要移动
      return oldIndex;
    }
  } else {
    // 新增节点
    newFiber.flags |= Placement;
    return lastPlacedIndex;
  }
}
```

## 移动判断示例

```
旧: A(0) → B(1) → C(2) → D(3)
新: A → C → D → B

遍历新节点：
1. A: oldIndex=0, lastPlacedIndex=0 → 不移动, lastPlacedIndex=0
2. C: oldIndex=2, lastPlacedIndex=0 → 不移动, lastPlacedIndex=2
3. D: oldIndex=3, lastPlacedIndex=2 → 不移动, lastPlacedIndex=3
4. B: oldIndex=1, lastPlacedIndex=3 → 1<3, 需要移动

结果：只移动 B
```

## key 的作用

```jsx
// ❌ 没有 key，可能导致错误复用
{items.map(item => <Item data={item} />)}

// ✅ 有 key，正确识别节点
{items.map(item => <Item key={item.id} data={item} />)}
```

没有 key 时，React 使用 index 作为隐式 key，可能导致：
- 状态错乱
- 不必要的 DOM 操作
- 性能问题

## 调试技巧

```javascript
// 在以下位置打断点：
// 1. reconcileSingleElement - 单节点 Diff
// 2. reconcileChildrenArray - 多节点 Diff
// 3. placeChild - 观察移动判断
// 4. deleteChild - 观察删除标记
```
