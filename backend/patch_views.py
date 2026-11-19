import os

base = r'C:\Users\Administrator\Desktop\GroupHub\backend\accounts'
target = os.path.join(base, 'views.py')

with open(target, 'r') as f:
    content = f.read()

old = '''        if task.subtasks.exists():
            return Response({'error': 'Parent task progress is determined by its micro-tasks.'}, status=status.HTTP_400_BAD_REQUEST)

        progress_percentage = request.data.get('progress_percentage')'''

new = '''        if task.subtasks.exists():
            return Response({'error': 'Parent task progress is determined by its micro-tasks.'}, status=status.HTTP_400_BAD_REQUEST)

        if task.title.strip().lower() == 'compile and edit':
            from .planning_views import _compile_task_lock
            locked, reason = _compile_task_lock(task.project.group)
            if locked and not request.data.get('override_reason'):
                return Response({'error': reason or 'Compile and edit is locked until all other sections are complete.'}, status=status.HTTP_403_FORBIDDEN)

        progress_percentage = request.data.get('progress_percentage')'''

count = content.count(old)
print(f'Found {count} occurrences')
content = content.replace(old, new)
with open(target, 'w') as f:
    f.write(content)
print('Done')