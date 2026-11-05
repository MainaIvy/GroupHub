// Single source of truth for the task weight scale (mirrors backend/accounts/weights.py).
export const WEIGHT_MIN = 1;
export const WEIGHT_MAX = 5;

export const WEIGHT_SCALE = [
  { value: 1, label: 'Tiny', description: 'A quick job, under an hour, nothing new to learn.', example: 'Fix a typo, rename a file.' },
  { value: 2, label: 'Small', description: 'A couple of hours of familiar work.', example: 'Write the README or one short section.' },
  { value: 3, label: 'Medium', description: 'Half a day to a day, some thinking required.', example: 'Build one page or write a report chapter.' },
  { value: 4, label: 'Large', description: 'Several days of work, or tricky and detailed.', example: 'Design and implement a database layer.' },
  { value: 5, label: 'Very large', description: 'The biggest job a single task should hold.', example: 'Build the full login and permissions flow.' },
];

export const WEIGHT_SPLIT_RULE = 'If it feels bigger than 5, split it into subtasks.';

// Group points needed before workload balance is judged; unrelated to the weight scale.
export const MIN_TOTAL_POINTS_FOR_BALANCE = 6;

export const weightInfo = (weight) => WEIGHT_SCALE.find((item) => item.value === Number(weight));

export const weightLabel = (weight) => {
  const info = weightInfo(weight);
  return info ? `Weight ${info.value} · ${info.label}` : `Weight ${weight}`;
};

export const clampWeight = (weight) => Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, Math.round(Number(weight) || WEIGHT_MIN)));
