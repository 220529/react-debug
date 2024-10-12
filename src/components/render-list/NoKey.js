import React, { useState } from 'react';

function StaticListNoKey() {
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

  return (
    <div className='List Nokey'>
      <button onClick={updateItems}>NoKey List</button>
      <ul>
        {items.map(item => (
          <li>{item.content}</li>
        ))}
      </ul>
    </div>
  );
}

export default StaticListNoKey;
