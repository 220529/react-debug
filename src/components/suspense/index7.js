import { useState, Suspense } from "react"
import ErrorBoundary from "./ErrorBoundary"

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
const fakeFetch = person => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // if (person === "err") {
      //   // reject(`${person}'s error`)
      //   // console.log(a)
      //   // throw "ajfljsadlfk"
      // } else {
      //   resolve(`${person}'s data`)
      // }
      resolve(`${person}'s data`)
    }, Math.random() * 5000);
  });
};

// 2. 在渲染前发起请求
// const resource = wrapPromise(fakeFetch());

function Content({ resource }) {
  // 3. 通过 resource.read() 获取接口返回结果
  const data = resource.read();
  console.log("Content.data", data);
  if (data.includes("err")) {
    console.log(abc);
    // throw "ajfljsadlfk"
  }
  return <p>{data}</p>
}

function fetchData(userId) {
  return wrapPromise(fakeFetch(userId))
}

const initialResource = fetchData('Nick');

function App() {
  const [person, setPerson] = useState('Nick');

  const [resource, setResource] = useState(initialResource);

  const handleClick = (name) => () => {
    setPerson(name)
    setResource(fetchData(name));
  }
  return (
    <>
      <ErrorBoundary>
        <button onClick={handleClick('Nick')}>Nick's Profile</button>
        <button onClick={handleClick('Deb')}>Deb's Profile</button>
        <button onClick={handleClick('err')}>err's Profile</button>
        <h1>{person}</h1>
        <Suspense fallback={'loading data'}>
          <Content resource={resource} />
        </Suspense>
      </ErrorBoundary>
    </>
  )
}

export default App
