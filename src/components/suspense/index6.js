const fakeFetch = person => {
  return new Promise(res => {
    setTimeout(() => res(`${person}'s data`), Math.random() * 5000);
  });
};

function fetchData(userId) {
  return wrapPromise(fakeFetch(userId))
}

const initialResource = fetchData('Nick');

function User({ resource }) {
  const data = resource.read();
  return <p>{data}</p>
}

const App = () => {

  const [person, setPerson] = useState('Nick');

  const [resource, setResource] = useState(initialResource);

  const handleClick = (name) => () => {
    setPerson(name)
    setResource(fetchData(name));
  }

  return (
    <>
      <button onClick={handleClick('Nick')}>Nick's Profile</button>
      <button onClick={handleClick('Deb')}>Deb's Profile</button>
      <button onClick={handleClick('Joe')}>Joe's Profile</button>
      <>
        <h1>{person}</h1>
        <Suspense fallback={'loading'}>
          <User resource={resource} />
        </Suspense>
      </>
    </>
  );
};
