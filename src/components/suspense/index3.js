import { useState, Suspense } from "react"

// 1. 通用的 wrapPromise 函数
function wrapPromise(promise) {
  let status = "pending";
  let result;
  let suspender = promise.then(
    r => {
      status = "success";
      result = r;
    },
    e => {
      status = "error";
      result = e;
    }
  );
  return {
    read() {
      if (status === "pending") {
        throw suspender;
      } else if (status === "error") {
        throw result;
      } else if (status === "success") {
        return result;
      }
    }
  };
}

// 这里我们模拟了请求过程
const fakeFetch = () => {
  return new Promise(res => {
    setTimeout(() => res('data fetched'), 3000);
  });
};

// 2. 在渲染前发起请求
const resource = wrapPromise(fakeFetch());

function Content() {
  // 3. 通过 resource.read() 获取接口返回结果
  const data = resource.read();
  return <p>{data}</p>
}

function App() {
  return (
    <Suspense fallback={'loading data'}>
      <Content />
    </Suspense>
  )
}

export default App
