import { useState, Suspense } from "react"

const fakeFetch = (id) => {
  return new Promise(res => {
    setTimeout(() => res(`${id} data fetched`), 3000);
  });
};

// 1. 依然是直接请求数据
const initialResource = wrapPromise(fakeFetch(1));

function Content({ resource }) {
  // 3. 通过 resource.read() 获取接口返回结果
  const data = resource.read();
  return <p>{data}</p>
}

function App() {

  // 2. 将 wrapPromise 返回的对象作为 props 传递给组件
  const [resource, setResource] = useState(initialResource);

  // 4. 重新请求
  const handleClick = (id) => () => {
    setResource(wrapPromise(fakeFetch(id)));
  }

  return (
    <>
      <button onClick={handleClick(1)}>tab 1</button>
      <button onClick={handleClick(2)}>tab 2</button>
      <Suspense fallback={'loading data'}>
        <Content resource={resource} />
      </Suspense>
    </>
  )
}
