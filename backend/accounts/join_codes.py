"""Single source of truth for group join-code generation.

Uses a safe alphabet that excludes visually ambiguous characters
(I, O, 0, 1) so handwritten or spoken codes are not misread.
"""
from django.utils.crypto import get_random_string

from .models import Group

JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
JOIN_CODE_LENGTH = 6


def generate_join_code():
    """Return a unique 6-character join code drawn from the safe alphabet."""
    code = get_random_string(JOIN_CODE_LENGTH, allowed_chars=JOIN_CODE_ALPHABET)
    while Group.objects.filter(join_code=code).exists():
        code = get_random_string(JOIN_CODE_LENGTH, allowed_chars=JOIN_CODE_ALPHABET)
    return code