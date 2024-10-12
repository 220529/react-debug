import { useState, Suspense } from "react"

let data, promise;

function fetchData() {
  if (data) return data;
  promise = new Promise(resolve => {
    setTimeout(() => {
      data = 'data fetched'
      resolve()
    }, 3000)
  })
  throw promise;
}

function Content() {
  const data = fetchData();
  console.log("data", data);
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