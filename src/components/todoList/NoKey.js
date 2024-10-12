import React, { useState } from 'react';

const TodoListWithoutKey = () => {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');

  const handleAddTodo = () => {
    if (input.trim()) {
      setTodos([...todos, { text: input }]);
      setInput('');
    }
  };

  const handleChange = (e) => {
    setInput(e.target.value);
  };

  const handleTextChange = (index, newText) => {
    setTodos(todos.map((todo, i) =>
      i === index ? { ...todo, text: newText } : todo
    ));
  };

  const handleDelete = (index) => {
    setTodos(todos.filter((_, i) => i !== index));
  };

  return (
    <div>
      <span>Todo List without Key</span>
      <input type="text" value={input} onChange={handleChange} />
      <button onClick={handleAddTodo}>Add Todo</button>
      <ul>
        {todos.map((todo, index) => (
          <li key={index}>
            <span>{todo.text}----</span>
            <input type="text" />
            <button onClick={() => handleDelete(index)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TodoListWithoutKey;
