import * as React from 'react';
import { createContext, useContext, useState } from 'react';

// 创建一个上下文
const MyContext = createContext();

// 提供者组件
function MyProvider({ children }) {
  const [count, setCount] = useState(0);

  const increment = () => {
    setCount(prevCount => prevCount + 1);
  };

  return (
    <MyContext.Provider value={{ count, increment }}>
      {children}
    </MyContext.Provider>
  );
}

// 消费者组件
function Counter() {
  const { count, increment } = useContext(MyContext);
  return (
    <div>
      <span>Count: {count}</span>
      <button onClick={increment}>Increment</button>
    </div>
  );
}

function App() {
  return (
    <MyProvider>
      <Counter />
    </MyProvider>
  );
}

export default App;
