document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const taskInput = document.getElementById('task-input');
    const addButton = document.getElementById('add-button');
    const todoList = document.getElementById('todo-list');
    const emptyState = document.getElementById('empty-state');
    const todoCount = document.getElementById('todo-count');
    const clearCompletedBtn = document.getElementById('clear-completed');
    const filterButtons = document.querySelectorAll('.filter-button');
    // App state
    let tasks = [];
    let currentFilter = 'all';
    const API_URL = '/api/tasks';
    // Initialize the app
    fetchTasks();
    // Event listeners
    addButton.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addTask();
        }
    });
    clearCompletedBtn.addEventListener('click', clearCompleted);
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderTasks();
        });
    });
    // API Functions
    async function fetchTasks() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) {
                throw new Error('Failed to fetch tasks');
            }
            tasks = await response.json();
            renderTasks();
            updateEmptyState();
            updateTodoCount();
        } catch (error) {
            console.error('Error fetching tasks:', error);
            // Fallback to local storage if API fails
            tasks = JSON.parse(localStorage.getItem('tasks') || '[]');
            renderTasks();
            updateEmptyState();
            updateTodoCount();
        }
    }
    async function addTask() {
        const taskText = taskInput.value.trim();
        if (taskText === '') return;
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: taskText })
            });
            if (!response.ok) {
                throw new Error('Failed to add task');
            }
            const newTask = await response.json();
            tasks.push(newTask);
            renderTasks();
            updateEmptyState();
            updateTodoCount();
            
        } catch (error) {
            console.error('Error adding task:', error);
            // Fallback to local method if API fails
            const newTask = {
                id: Date.now().toString(),
                text: taskText,
                completed: false,
                createdAt: new Date().toISOString()
            };
            tasks.push(newTask);
            saveTasksToLocalStorage();
        }
        
        taskInput.value = '';
        taskInput.focus();
    }
    
    async function toggleTaskComplete(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        
        const newCompletedStatus = !task.completed;
        
        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ completed: newCompletedStatus })
            });
            
            if (!response.ok) {
                throw new Error('Failed to update task');
            }
            
            const updatedTask = await response.json();
            tasks = tasks.map(t => t.id === id ? updatedTask : t);
            
        } catch (error) {
            console.error('Error updating task:', error);
            // Fallback to local method if API fails
            tasks = tasks.map(t => {
                if (t.id === id) {
                    return { ...t, completed: newCompletedStatus };
                }
                return t;
            });
            saveTasksToLocalStorage();
        }
        
        renderTasks();
        updateTodoCount();
    }
    
    async function deleteTask(id) {
        try {
            const response = await fetch(`${API_URL}/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to delete task');
            }
            
        } catch (error) {
            console.error('Error deleting task:', error);
        }
        
        // Remove from local array regardless of API success
        tasks = tasks.filter(task => task.id !== id);
        renderTasks();
        updateEmptyState();
        updateTodoCount();
        saveTasksToLocalStorage(); // Backup to local storage
    }
    
    async function clearCompleted() {
        try {
            const response = await fetch(`${API_URL}/clear-completed`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Failed to clear completed tasks');
            }
            
        } catch (error) {
            console.error('Error clearing completed tasks:', error);
        }
        
        // Remove from local array regardless of API success
        tasks = tasks.filter(task => !task.completed);
        renderTasks();
        updateEmptyState();
        updateTodoCount();
        saveTasksToLocalStorage(); // Backup to local storage
    }
    
    // UI Functions
    function renderTasks() {
        todoList.innerHTML = '';
        
        const filteredTasks = tasks.filter(task => {
            if (currentFilter === 'active') return !task.completed;
            if (currentFilter === 'completed') return task.completed;
            return true; // 'all' filter
        });
        
        filteredTasks.forEach(task => {
            const taskItem = document.createElement('li');
            taskItem.className = `todo-item ${task.completed ? 'completed' : ''}`;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'todo-checkbox';
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', () => toggleTaskComplete(task.id));
            
            const taskText = document.createElement('span');
            taskText.className = 'todo-text';
            taskText.textContent = task.text;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-button';
            deleteBtn.textContent = '×';
            deleteBtn.addEventListener('click', () => deleteTask(task.id));
            
            taskItem.appendChild(checkbox);
            taskItem.appendChild(taskText);
            taskItem.appendChild(deleteBtn);
            
            todoList.appendChild(taskItem);
        });
    }
    
    function updateEmptyState() {
        if (tasks.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
        }
    }
    
    function updateTodoCount() {
        const activeTasks = tasks.filter(task => !task.completed).length;
        todoCount.textContent = `${activeTasks} item${activeTasks !== 1 ? 's' : ''} left`;
    }
    
    function saveTasksToLocalStorage() {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    }
});