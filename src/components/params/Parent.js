import { useState } from 'react';
import ChildComponent from './ChildComponent';

const ParentComponent = () => {
  const [name, setName] = useState('');

  const handleNameChange = (event) => {
    setName(event.target.value);
  };

  return (
    <div>
      <span>Parent Component</span>
      <input
        type="text"
        value={name}
        onChange={handleNameChange}
        placeholder="Enter your name"
      />
      <ChildComponent name={name} setName={setName} />
    </div>
  );
};

export default ParentComponent;
