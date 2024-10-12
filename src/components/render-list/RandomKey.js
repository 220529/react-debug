import React, { useState } from 'react';

function RandomKeyList() {
  const [items, setItems] = useState([
    { id: 'a', content: `a - ${Date.now()}` },
    { id: 'b', content: `b - ${Date.now()}` },
    { id: 'c', content: `c - ${Date.now()}` },
    { id: 'd', content: `d - ${Date.now()}` },
  ]);

  const updateItems = () => {
    setItems([
      { id: 'a', content: `a - ${Date.now()}` },
      { id: 'b', content: `b - ${Date.now()}` },
      { id: 'c', content: `c - ${Date.now()}` },
      { id: 'd', content: `d - ${Date.now()}` },
    ]);
  };

  const generateRandomKey = () => Math.random().toString(36);

  return (
    <div className='List RandomKey'>
      <button onClick={updateItems}>RandomKey List</button>
      <ul>
        {items.map(item => (
          <li key={generateRandomKey()}>{item.content}</li>
        ))}
      </ul>
    </div>
  );
}

export default RandomKeyList;
