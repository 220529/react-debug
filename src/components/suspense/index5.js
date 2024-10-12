import { useState, Suspense } from "react"

import wrapPromise from "./wrapPromise";

function fetchData(id) {
  return {
    user: wrapPromise(fakeFetchUser(id)),
    posts: wrapPromise(fakeFetchPosts(id))
  };
}

const fakeFetchUser = (id) => {
  return new Promise(res => {
    setTimeout(() => res(`user ${id} data fetched`), 5000 * Math.random());
  });
};

const fakeFetchPosts = (id) => {
  return new Promise(res => {
    setTimeout(() => res(`posts ${id} data fetched`), 5000 * Math.random());
  });
};

const initialResource = fetchData(1);

function User({ resource }) {
  const data = resource.user.read();
  return <p>{data}</p>
}

function Posts({ resource }) {
  const data = resource.posts.read();
  return <p>{data}</p>
}

function App() {

  const [resource, setResource] = useState(initialResource);

  const handleClick = (id) => () => {
    setResource(fetchData(id));
  }

  return (
    <>
      <p><button onClick={handleClick(Math.ceil(Math.random() * 10))}>next user</button></p>
      <Suspense fallback={'loading user'}>
        <User resource={resource} />
        <Suspense fallback={'loading posts'}>
          <Posts resource={resource} />
        </Suspense>
      </Suspense>
    </>
  )
}

export default App
