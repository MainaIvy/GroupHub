"""Shared profile-completion logic for Google login and the profile endpoint."""
from .models import UnitAssignment


def compute_profile_complete(user):
    """Return True when the user's profile is considered complete.

    - Lecturers: complete once they have a first and last name.
    - Students: complete once they have an admission number (username),
      an enrolled course, year of study and semester.
    """
    if user.user_type == 'lecturer':
        return bool(user.first_name and user.last_name)
    return bool(
        user.username
        and user.enrolled_course_id
        and user.year_of_study
        and user.semester
    )


def lecturer_setup_required(user):
    """True for lecturers who have not yet been assigned any teaching unit."""
    return (
        user.user_type == 'lecturer'
        and not UnitAssignment.objects.filter(lecturer=user).exists()
    )