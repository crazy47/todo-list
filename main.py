from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import uuid
from datetime import datetime

# Optional: Google Sheets integration
try:
    import gspread
    from google.oauth2.service_account import Credentials
    GOOGLE_SHEETS_ENABLED = True
except ImportError:
    GOOGLE_SHEETS_ENABLED = False

app = Flask(__name__, static_folder='static')
CORS(app)  # Enable CORS for all routes

# Task storage - can be replaced with database in production
TASKS_FILE = 'tasks.json'

def load_tasks():
    if os.path.exists(TASKS_FILE):
        with open(TASKS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_tasks(tasks):
    with open(TASKS_FILE, 'w') as f:
        json.dump(tasks, f)

# Initialize tasks from file or empty list
tasks = load_tasks()

# Google Sheets integration (optional)
def init_google_sheets():
    if not GOOGLE_SHEETS_ENABLED:
        return None
        
    try:
        scopes = ["https://www.googleapis.com/auth/spreadsheets"]
        # Load credentials from environment variable
        credentials_json = os.getenv('GOOGLE_CREDENTIALS')
        if not credentials_json:
            print("Google Sheets error: GOOGLE_CREDENTIALS environment variable not set")
            return None
        credentials_dict = json.loads(credentials_json)
        creds = Credentials.from_service_account_info(credentials_dict, scopes=scopes)
        client = gspread.authorize(creds)
        sheet_id = "1pcCUCjhsfqdM_e4AbojUaNSpWUkT7FtxXkkan79Q_F4"
        sheet = client.open_by_key(sheet_id)
        return sheet.sheet1
    except Exception as e:
        print(f"Google Sheets error: {e}")
        return None

# Initialize Google Sheets (if available)
worksheet = init_google_sheets()

# Sync tasks to Google Sheets (if enabled)
def sync_to_sheets(tasks):
    if worksheet:
        try:
            # Clear existing data
            worksheet.clear()
            
            # Add headers
            worksheet.append_row(["ID", "Text", "Completed", "Created At"])
            
            # Add task data
            for task in tasks:
                worksheet.append_row([
                    task['id'],
                    task['text'],
                    str(task['completed']),
                    task['createdAt']
                ])
                
            print("Tasks synced to Google Sheets")
        except Exception as e:
            print(f"Error syncing to Google Sheets: {e}")

# API Routes
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def add_task():
    data = request.json
    
    if not data or 'text' not in data:
        return jsonify({"error": "Task text is required"}), 400
        
    new_task = {
        'id': str(uuid.uuid4()),
        'text': data['text'],
        'completed': False,
        'createdAt': datetime.now().isoformat()
    }
    
    tasks.append(new_task)
    save_tasks(tasks)
    
    # Sync to Google Sheets if enabled
    if GOOGLE_SHEETS_ENABLED:
        sync_to_sheets(tasks)
        
    return jsonify(new_task), 201

@app.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    data = request.json
    
    for i, task in enumerate(tasks):
        if task['id'] == task_id:
            # Update task properties that are provided
            if 'text' in data:
                tasks[i]['text'] = data['text']
            if 'completed' in data:
                tasks[i]['completed'] = data['completed']
                
            save_tasks(tasks)
            
            # Sync to Google Sheets if enabled
            if GOOGLE_SHEETS_ENABLED:
                sync_to_sheets(tasks)
                
            return jsonify(tasks[i])
            
    return jsonify({"error": "Task not found"}), 404

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    global tasks
    original_length = len(tasks)
    tasks = [task for task in tasks if task['id'] != task_id]
    
    if len(tasks) < original_length:
        save_tasks(tasks)
        
        # Sync to Google Sheets if enabled
        if GOOGLE_SHEETS_ENABLED:
            sync_to_sheets(tasks)
            
        return jsonify({"message": "Task deleted"})
        
    return jsonify({"error": "Task not found"}), 404

@app.route('/api/tasks/clear-completed', methods=['DELETE'])
def clear_completed():
    global tasks
    original_length = len(tasks)
    tasks = [task for task in tasks if not task['completed']]
    
    if len(tasks) < original_length:
        save_tasks(tasks)
        
        # Sync to Google Sheets if enabled
        if GOOGLE_SHEETS_ENABLED:
            sync_to_sheets(tasks)
            
        return jsonify({"message": "Completed tasks cleared"})
        
    return jsonify({"message": "No completed tasks to clear"})

# Serve static files (HTML, CSS, JS)
@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    # Create static folder if it doesn't exist
    if not os.path.exists('static'):
        os.makedirs('static')
        
    app.run(debug=True, host='0.0.0.0', port=5000)