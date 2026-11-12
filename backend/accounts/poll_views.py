"""Group polls: create, list, vote, add option, close, results and tie-break."""
from datetime import datetime, time

from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Group, Poll, PollOption, PollVote, Notification
from .planning_rules import is_leader, is_member

MAX_OPTIONS = 20


def _error(message, code=status.HTTP_400_BAD_REQUEST):
    return Response({'error': message}, status=code)


def _can_use(user, group):
    return user.user_type == 'student' and (is_member(user, group) or is_leader(user, group))


def _sync_poll(poll):
    if poll.status == 'open' and poll.closes_at and poll.closes_at <= timezone.now():
        poll.status = 'closed'
        poll.save(update_fields=['status'])
    return poll


def _parse_closes_at(value):
    if not value:
        return None, None
    parsed = parse_datetime(str(value))
    if parsed is None:
        parsed_date = parse_date(str(value))
        if parsed_date is None:
            return None, 'Enter a valid closing time.'
        parsed = datetime.combine(parsed_date, time(23, 59))
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    if parsed <= timezone.now():
        return None, 'Choose a closing time in the future.'
    return parsed, None


def _person(user):
    return {'id': user.id, 'first_name': user.first_name, 'last_name': user.last_name}


def _name(user):
    return f'{user.first_name} {user.last_name}'.strip() or 'Student'


def _outcome(poll, counts):
    """Return (winner_option_id, is_tie, tied_option_ids) for a closed poll."""
    if poll.status != 'closed':
        return None, False, []
    if poll.winning_option_id:
        return poll.winning_option_id, False, []
    top = max(counts.values(), default=0)
    if top == 0:
        return None, False, []
    tied = [option_id for option_id, count in counts.items() if count == top]
    if len(tied) == 1:
        return tied[0], False, []
    return None, True, tied


def serialize_poll(poll, user):
    _sync_poll(poll)
    options = list(poll.options.select_related('added_by'))
    votes = list(poll.votes.select_related('user'))
    voters = {option.id: [] for option in options}
    for vote in votes:
        voters.setdefault(vote.option_id, []).append(_person(vote.user))
    counts = {option.id: len(voters[option.id]) for option in options}
    winner_id, is_tie, tied_ids = _outcome(poll, counts)
    winner = next((option for option in options if option.id == winner_id), None)
    group = poll.group
    leader = is_leader(user, group)
    open_poll = poll.status == 'open'
    member = _can_use(user, group)
    return {
        'id': poll.id,
        'group_id': poll.group_id,
        'question': poll.question,
        'status': poll.status,
        'closes_at': poll.closes_at.isoformat() if poll.closes_at else None,
        'allow_new_options': poll.allow_new_options,
        'created_by_id': poll.created_by_id,
        'created_by_name': _name(poll.created_by),
        'created_at': poll.created_at.isoformat(),
        'options': [{
            'id': option.id,
            'text': option.text,
            'pitch': option.pitch,
            'added_by_name': _name(option.added_by),
            'votes': counts[option.id],
            'voters': voters[option.id],
        } for option in options],
        'total_votes': len(votes),
        'my_vote': next((vote.option_id for vote in votes if vote.user_id == user.id), None),
        'winner_option_id': winner_id,
        'winner': {'id': winner.id, 'text': winner.text, 'pitch': winner.pitch} if winner else None,
        'is_tie': is_tie,
        'tied_option_ids': tied_ids,
        'needs_leader_pick': is_tie,
        'can_vote': open_poll and member,
        'can_add_option': open_poll and member and poll.allow_new_options,
        'can_close': open_poll and member and (leader or poll.created_by_id == user.id),
        'can_pick_winner': is_tie and leader,
    }


def _clean_option(raw):
    if isinstance(raw, dict):
        text, pitch = raw.get('text'), raw.get('pitch')
    else:
        text, pitch = raw, ''
    return str(text or '').strip()[:200], str(pitch or '').strip()


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def group_polls(request, group_id):
    group = Group.objects.select_related('lecturer', 'unit').filter(pk=group_id).first()
    if group is None:
        return _error('Group not found', status.HTTP_404_NOT_FOUND)
    user = request.user
    if not _can_use(user, group):
        return _error('Only group members can use polls.', status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        polls = group.polls.select_related('created_by', 'group')
        return Response([serialize_poll(poll, user) for poll in polls])

    question = str(request.data.get('question') or '').strip()
    if not question:
        return _error('Enter a question for the poll.')
    if len(question) > 300:
        return _error('Keep the question under 300 characters.')
    options = []
    seen = set()
    for raw in request.data.get('options') or []:
        text, pitch = _clean_option(raw)
        if text and text.casefold() not in seen:
            seen.add(text.casefold())
            options.append((text, pitch))
    if len(options) < 2:
        return _error('Add at least two different options.')
    if len(options) > MAX_OPTIONS:
        return _error(f'A poll can have at most {MAX_OPTIONS} options.')
    closes_at, message = _parse_closes_at(request.data.get('closes_at'))
    if message:
        return _error(message)
    allow_new = request.data.get('allow_new_options', True)
    if not isinstance(allow_new, bool):
        return _error('allow_new_options must be true or false.')

    with transaction.atomic():
        poll = Poll.objects.create(
            group=group, question=question, created_by=user, closes_at=closes_at, allow_new_options=allow_new,
        )
        PollOption.objects.bulk_create([
            PollOption(poll=poll, text=text, pitch=pitch, added_by=user) for text, pitch in options
        ])
    # Notify group members (except creator) about new poll
    from .models import GroupMembership
    members = GroupMembership.objects.filter(group=group).exclude(student=user).select_related('student')
    for membership in members:
        Notification.objects.create(
            user=membership.student,
            notification_type='poll_opened',
            title='New poll opened',
            message=f'{user.first_name} {user.last_name} opened a poll: "{question}" in {group.name}.',
            related_group=group,
        )
    if group.lecturer_id != user.id:
        Notification.objects.create(
            user=group.lecturer,
            notification_type='poll_opened',
            title='New poll opened',
            message=f'{user.first_name} {user.last_name} opened a poll: "{question}" in {group.name}.',
            related_group=group,
        )
    return Response(serialize_poll(poll, user), status=status.HTTP_201_CREATED)


def _load_poll(request, poll_id):
    poll = Poll.objects.select_related('group__lecturer', 'group__unit', 'created_by').filter(pk=poll_id).first()
    if poll is None:
        return None, _error('Poll not found', status.HTTP_404_NOT_FOUND)
    if not _can_use(request.user, poll.group):
        return None, _error('Only group members can use polls.', status.HTTP_403_FORBIDDEN)
    return _sync_poll(poll), None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def poll_results(request, poll_id):
    poll, error = _load_poll(request, poll_id)
    return error or Response(serialize_poll(poll, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def vote_on_poll(request, poll_id):
    poll, error = _load_poll(request, poll_id)
    if error:
        return error
    if poll.status != 'open':
        return _error('This poll is closed, so votes can no longer be changed.')
    option = poll.options.filter(pk=request.data.get('option_id')).first() if str(request.data.get('option_id') or '').isdigit() else None
    if option is None:
        return _error('Choose one of the options in this poll.')
    PollVote.objects.update_or_create(poll=poll, user=request.user, defaults={'option': option})
    return Response(serialize_poll(poll, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_poll_option(request, poll_id):
    poll, error = _load_poll(request, poll_id)
    if error:
        return error
    if poll.status != 'open':
        return _error('This poll is closed.')
    if not poll.allow_new_options:
        return _error('The poll creator has turned off new options for this poll.', status.HTTP_403_FORBIDDEN)
    text, pitch = _clean_option(request.data)
    if not text:
        return _error('Enter the option text.')
    if poll.options.count() >= MAX_OPTIONS:
        return _error(f'A poll can have at most {MAX_OPTIONS} options.')
    if any(existing.casefold() == text.casefold() for existing in poll.options.values_list('text', flat=True)):
        return _error('That option is already in the poll.')
    PollOption.objects.create(poll=poll, text=text, pitch=pitch, added_by=request.user)
    return Response(serialize_poll(poll, request.user), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def close_poll(request, poll_id):
    poll, error = _load_poll(request, poll_id)
    if error:
        return error
    if poll.status == 'closed':
        return _error('This poll is already closed.')
    if not (is_leader(request.user, poll.group) or poll.created_by_id == request.user.id):
        return _error('Only the poll creator or the group leader can close this poll.', status.HTTP_403_FORBIDDEN)
    poll.status = 'closed'
    poll.save(update_fields=['status'])
    return Response(serialize_poll(poll, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pick_poll_winner(request, poll_id):
    poll, error = _load_poll(request, poll_id)
    if error:
        return error
    if not is_leader(request.user, poll.group):
        return _error('Only the group leader can pick the winner of a tied poll.', status.HTTP_403_FORBIDDEN)
    current = serialize_poll(poll, request.user)
    if not current['is_tie']:
        return _error('There is no tie to break in this poll.')
    option_id = request.data.get('option_id')
    if not str(option_id or '').isdigit() or int(option_id) not in current['tied_option_ids']:
        return _error('Choose one of the tied options.')
    poll.winning_option_id = int(option_id)
    poll.save(update_fields=['winning_option'])
    return Response(serialize_poll(poll, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_poll(request, poll_id):
    poll, error = _load_poll(request, poll_id)
    if error:
        return error
    if not (is_leader(request.user, poll.group) or poll.created_by_id == request.user.id):
        return _error('Only the poll creator or the group leader can delete this poll.', status.HTTP_403_FORBIDDEN)
    poll.delete()
    return Response({'message': 'Poll deleted successfully'})
