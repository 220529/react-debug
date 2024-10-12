import React, { useState } from 'react';

function ReorderListTest() {
  const [items, setItems] = useState(['a', 'b', 'c', 'd']);
  const initialItems = ['a', 'b', 'c', 'd'];

  const reorder = () => {
    setItems(['d', 'a', 'b', 'c']);
  };

  const reset = () => {
    setItems(initialItems);
  };

  return (
    <div className='Reorder List'>
      <button onClick={reorder}>IdKey List</button>
      <button onClick={reset}>Reset List</button>
      <ul>
        {items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default ReorderListTest;
