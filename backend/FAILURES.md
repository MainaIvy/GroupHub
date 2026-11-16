# Test Failures Analysis

## Summary
- Total tests: 114
- Passed: 106
- Failed: 8
- Errors: 0

## Failures for Requested Test Classes

### 1. LoginEndpointTests
- `test_login_returns_user_payload_and_tokens_for_username` - **PASS**
- No failures in this class.

### 2. LoginRouteTests
- `test_views_login_routes_are_removed` - **PASS** (confirms old routes return 404)
- No failures in this class.

### 3. ProfileCompleteSharedTests
- `test_compute_profile_complete_lecturer` - **PASS**
- `test_compute_profile_complete_student` - **PASS**
- No failures in this class.

### 4. SeedDemoCommandTests
- `test_seed_demo_is_scenario_complete_safe_and_idempotent` - **FAIL**
  - **AssertionError: 10 != 8** (expected 8 root tasks, got 10)
  - **Analysis**: The test expects exactly 8 root tasks but the seed_demo command now creates more. This is a test that needs updating because the demo data has changed intentionally.
  - **Classification**: (a) Obsolete because we intentionally changed demo data - **FIX THE TEST**

### 5. SeedFromExcelTests
- `test_clean_workbook_rebuild_is_normalized_and_idempotent` - **PASS**
- No failures in this class.

## Other Failures (Not in Requested Classes)

### 6. GroupChatRealtimeTests
- `test_chat_consumer_broadcasts_persisted_message_payload` - **FAIL**
  - **AssertionError: 0 != 1** (notification not created for lecturer when message broadcast)
  - **Analysis**: Notification for lecturer not being created when message is broadcast via WebSocket. This could be a real regression or flaky test.
  - **Classification**: (c) Flaky - WebSocket timing issue, or (b) real regression in notification creation

### 7. GroupLifecycleTests
- `test_create_group_sets_display_only_leader_invites_and_chatroom` - **FAIL**
  - **AssertionError: 200 != 403** (non-leader can update group settings when they shouldn't)
  - **Analysis**: The test expects a 403 when non-leader tries to update group, but gets 200. This might be intentional behavior change.
  - **Classification**: (a) Obsolete if we intentionally allow non-leaders to update, or (b) regression

### 8. LecturerClaimFlowTests (4 failures)
- `test_lecturer_can_claim_and_release_unit` - **FAIL** (404 != 200)
  - Endpoint `/api/units/1/claim/` removed - **Classification: (a) Obsolete - endpoint intentionally removed**

- `test_lecturer_department_units_response_includes_group_archive_state` - **FAIL** (404 != 200)
  - Endpoint `/api/lecturer/oversight/` removed - **Classification: (a) Obsolete - endpoint intentionally removed**

- `test_lecturer_signup_assigns_selected_units` - **FAIL** (400 != 201)
  - Lecturer signup disabled, only admin can add lecturers - **Classification: (a) Obsolete - behavior intentionally changed**

### 9. LecturerSignupPayloadTests (2 failures)
- `test_departments_endpoint_returns_distinct_course_departments` - **FAIL** (404 != 200)
  - Endpoint `/api/departments/` removed - **Classification: (a) Obsolete - endpoint intentionally removed**

- `test_lecturer_signup_requires_full_name_department_and_matching_passwords` - **FAIL**
  - Lecturer signup disabled - **Classification: (a) Obsolete - behavior intentionally changed**

---

## Action Plan

1. **Fix SeedDemoCommandTests** - Update expected root task count from 8 to actual count (10)
2. **Fix/Delete obsolete tests** in LecturerClaimFlowTests and LecturerSignupPayloadTests (endpoints removed)
3. **Investigate** GroupChatRealtimeTests and GroupLifecycleTests failures