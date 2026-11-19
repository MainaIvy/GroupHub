import os

path = r'C:\Users\Administrator\Desktop\GroupHub\backend\accounts\view.py'
if not os.path.exists(path):
    path = r'C:\Users\Administrator\Desktop\GroupHub\backend\accounts views.py'
if not os.path.exists(path):
    path = r'C:\Users\Administrator\Desktop\GroupHub\backend\accounts\view.py'

print(f"Trying path: {path}")
print(f"Exists: {os.path.exists(path)}")

# Try all possible names
base = r'C:\Users\Administrator\Desktop\GroupHub\backend\accounts'
for f in os.listdir(base):
    if 'view' in f.lower() and f.endswith('.py'):
        full = os.path.join(base, f)
        print(f"Found: {full}")