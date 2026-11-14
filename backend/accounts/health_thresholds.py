"""Helpers for reading configurable thresholds from ``AdminSetting``.

Both ``balance.py`` and ``health.py`` need the same values, so they live here
instead of being duplicated or hard-coded.
"""
from .models import AdminSetting

# Defaults mirror admin_api.admin_settings defaults.
DEFAULT_MINIMUM_POINTS = 6
DEFAULT_WARNING_PERCENT = 15
DEFAULT_CRITICAL_PERCENT = 25
DEFAULT_QUIET_DAYS = 5
DEFAULT_OVERDUE_COUNT = 2


def _get_setting(key, default):
    setting = AdminSetting.objects.filter(key=key).first()
    if not setting:
        return default
    return setting.value


def get_minimum_points():
    value = _get_setting('minimum_points', DEFAULT_MINIMUM_POINTS)
    try:
        return int(value)
    except (TypeError, ValueError):
        return DEFAULT_MINIMUM_POINTS


def get_balance_thresholds():
    """Return (warning_percent, critical_percent) read from AdminSetting."""
    thresholds = _get_setting('balance_thresholds', {
        'warning': DEFAULT_WARNING_PERCENT,
        'critical': DEFAULT_CRITICAL_PERCENT,
    }) or {}
    try:
        warning = int(thresholds.get('warning', DEFAULT_WARNING_PERCENT))
    except (TypeError, ValueError):
        warning = DEFAULT_WARNING_PERCENT
    try:
        critical = int(thresholds.get('critical', DEFAULT_CRITICAL_PERCENT))
    except (TypeError, ValueError):
        critical = DEFAULT_CRITICAL_PERCENT
    return warning, critical


def get_quiet_days():
    value = _get_setting('quiet_days', DEFAULT_QUIET_DAYS)
    try:
        return int(value)
    except (TypeError, ValueError):
        return DEFAULT_QUIET_DAYS


def get_overdue_count():
    value = _get_setting('overdue_count', DEFAULT_OVERDUE_COUNT)
    try:
        return int(value)
    except (TypeError, ValueError):
        return DEFAULT_OVERDUE_COUNT