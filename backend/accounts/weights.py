"""Single source of truth for the task weight scale and the workload-balance threshold."""

WEIGHT_MIN = 1
WEIGHT_MAX = 5
WEIGHT_RANGE = range(WEIGHT_MIN, WEIGHT_MAX + 1)
WEIGHT_LABELS = {1: 'Tiny', 2: 'Small', 3: 'Medium', 4: 'Large', 5: 'Very large'}

# Total group points needed before workload balance is judged; unrelated to the weight scale.
MIN_TOTAL_POINTS_FOR_BALANCE = 6


def weight_label(weight):
    return f"Weight {weight} \u00b7 {WEIGHT_LABELS.get(weight, '')}".strip(' \u00b7')
