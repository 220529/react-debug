import React, { useLayoutEffect, useRef } from 'react';

const blockingFunction = (duration) => {
  const start = Date.now();
  while (Date.now() - start < duration * 1000) {
    // 这段代码会阻塞主线程
  }
};

const App = () => {
  const divRef = useRef();

  useLayoutEffect(() => {
    // 读取 DOM 信息并同步操作
    const { height } = divRef.current.getBoundingClientRect();
    console.log('元素高度：', height);
    blockingFunction(2)
  });

  return <div ref={divRef}>这是一个示例组件</div>;
};

export default App;