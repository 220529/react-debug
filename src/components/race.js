import { useState, useEffect } from "react"
import { useRequest } from 'ahooks';

const fakeFetch = person => {
  return new Promise(res => {
    setTimeout(() => res(`${person}'s data`), Math.random() * 5000);
  });
};

const App = () => {

  const [data, setData] = useState('');
  const [loading, setLoading] = useState(false);
  const [person, setPerson] = useState(null);

  useEffect(() => {
    let bool = false;
    setLoading(true);

    fakeFetch(person).then(data => {
      if (!bool) {
        setData(data);
      }
      setLoading(false);
    });

    return () => {
      bool = true
    }

  }, [person]);

  const handleClick = (name) => () => {
    setPerson(name)
  }

  return (
    <>
      <button onClick={handleClick('Nick')}>Nick's Profile</button>
      <button onClick={handleClick('Deb')}>Deb's Profile</button>
      <button onClick={handleClick('Joe')}>Joe's Profile</button>
      {person && (
        <>
          <h1>{person}</h1>
          <p>{loading ? 'Loading...' : data}</p>
        </>
      )}
    </>
  );
};

const App2 = () => {
  const [person, setPerson] = useState('Nick');

  const { data, loading } = useRequest(() => fakeFetch(person), {
    refreshDeps: [person],
  });

  const handleClick = (name) => () => {
    setPerson(name)
  }

  return (
    <>
      <button onClick={handleClick('Nick')}>Nick's Profile</button>
      <button onClick={handleClick('Deb')}>Deb's Profile</button>
      <button onClick={() => setPerson('Joe')}>Joe's Profile</button>

      {person && (
        <>
          <h1>{person}</h1>
          <p>{loading ? 'Loading...' : data}</p>
        </>
      )}
    </>
  );
};


export default App2