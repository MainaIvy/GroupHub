import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';

const API_BASE_URL = 'http://1192.168.0.61:8000/api';

export default function StudentDashboardScreen({ route, navigation, user: propUser, onNavigate }) {
  const currentUser = propUser || route?.params?.user || {};

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  // Unit Interaction Modal State
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [modalMode, setModalMode] = useState('select'); // 'select' | 'create' | 'join'
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedPeers, setSelectedPeers] = useState([]);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [dbClassmates, setDbClassmates] = useState([]);
  const [loadingClassmates, setLoadingClassmates] = useState(false);

  // Group Details & Task Assignment Modal State
  const [activeGroupModal, setActiveGroupModal] = useState(null); // group object
  const [groupDetailsData, setGroupDetailsData] = useState(null);
  const [loadingGroupDetails, setLoadingGroupDetails] = useState(false);
  const [showAssignTaskView, setShowAssignTaskView] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState('High');
  const [assignedMemberId, setAssignedMemberId] = useState(null);
  const [submittingTask, setSubmittingTask] = useState(false);

  const greeting = useMemo(() => {
    const hours = new Date().getHours();
    if (hours < 12) return 'Good morning';
    if (hours < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const userId = currentUser?.id || '';
  const userEmail = currentUser?.email || '';
  const regNo = currentUser?.registration_no || currentUser?.registrationNo || '';

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const endpoint = `${API_BASE_URL}/dashboard/student/live/?user_id=${encodeURIComponent(
        userId
      )}&email=${encodeURIComponent(userEmail)}&registration_no=${encodeURIComponent(regNo)}`;

      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [userId, userEmail, regNo]);

  const student = dashboardData?.student || currentUser || {};
  const studentName =
    student?.full_name || student?.fullName || currentUser?.full_name || currentUser?.first_name || 'Student';
  const progressPct = dashboardData?.tasks?.progress_percentage ?? 0;

  // Open Detailed Group Workspace (Members + Workload Scale + Tasks)
  const openGroupDetailModal = async (group) => {
    setActiveGroupModal(group);
    setShowAssignTaskView(false);
    setLoadingGroupDetails(true);
    try {
      const res = await fetch(`${API_BASE_URL}/groups/${group.id}/details/`);
      if (res.ok) {
        const data = await res.json();
        setGroupDetailsData(data);
        if (data.members?.length > 0) {
          setAssignedMemberId(data.members[0].id);
        }
      } else {
        Alert.alert('Error', 'Unable to fetch group details from server.');
      }
    } catch (e) {
      Alert.alert('Connection Error', 'Failed to connect to group hub.');
    } finally {
      setLoadingGroupDetails(false);
    }
  };

  // Assign Task Handler
  const handleAssignTaskSubmit = async () => {
    if (!taskTitle.trim()) {
      Alert.alert('Required Field', 'Please provide a title for the task.');
      return;
    }
    if (!assignedMemberId) {
      Alert.alert('Select Member', 'Please select which group member will handle this task.');
      return;
    }

    setSubmittingTask(true);
    try {
      const res = await fetch(`${API_BASE_URL}/groups/${activeGroupModal.id}/tasks/assign/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDesc.trim(),
          priority: taskPriority,
          assigned_to_id: assignedMemberId,
        }),
      });

      if (res.ok) {
        Alert.alert('Task Assigned!', 'Task was added to the member and workload scales updated.');
        setTaskTitle('');
        setTaskDesc('');
        setShowAssignTaskView(false);
        // Refresh group details to update the workload scale live
        openGroupDetailModal(activeGroupModal);
        fetchDashboardData();
      } else {
        Alert.alert('Error', 'Failed to assign task.');
      }
    } catch (err) {
      Alert.alert('Network Error', 'Could not assign task.');
    } finally {
      setSubmittingTask(false);
    }
  };

  // Sign out handler
  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await fetch(`${API_BASE_URL}/logout/`, { method: 'POST' }).catch(() => {});
          setDashboardData(null);
          onNavigate('login', { user: null });
        },
      },
    ]);
  };

  // Unit Action Modal Open
  const openUnitActionModal = async (unit) => {
    setSelectedUnit(unit);
    setModalMode('select');
    setJoinCodeInput('');
    setNewGroupName(`${unit.code} Project Team`);
    setSelectedPeers([]);
    setLoadingClassmates(true);
    try {
      const url = `${API_BASE_URL}/unit-students/?unit_code=${encodeURIComponent(
        unit.code
      )}&course=${encodeURIComponent(student.course || '')}&exclude_id=${encodeURIComponent(
        student.id || userId
      )}&exclude_email=${encodeURIComponent(userEmail)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDbClassmates(data);
      }
    } catch (e) {
      setDbClassmates([]);
    } finally {
      setLoadingClassmates(false);
    }
  };

  const togglePeerSelection = (peerId) => {
    setSelectedPeers((prev) =>
      prev.includes(peerId) ? prev.filter((id) => id !== peerId) : [...prev, peerId]
    );
  };

  const handleCreateGroupSubmit = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Missing Field', 'Please enter a name for your group.');
      return;
    }

    setSubmittingAction(true);
    try {
      const response = await fetch(`${API_BASE_URL}/groups/create/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          course: student.course || 'Diploma in Computer Science',
          year_of_study: student.year_of_study || '2',
          student_id: student.id || userId,
          unit_code: selectedUnit?.code,
          invited_students: selectedPeers,
        }),
      });

      const resData = await response.json();
      if (response.ok) {
        Alert.alert(
          'Group Created!',
          `Team "${newGroupName}" established.\nJoin Code: ${resData.group?.join_code}`,
          [{ text: 'Open Group Hub', onPress: () => { setSelectedUnit(null); fetchDashboardData(); setActiveTab('chat'); } }]
        );
      } else {
        Alert.alert('Error', resData.error || 'Could not register group.');
      }
    } catch (err) {
      Alert.alert('Network Error', 'Unable to reach backend server.');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleJoinGroupSubmit = async () => {
    const cleanCode = joinCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      Alert.alert('Code Required', 'Please enter your group room key.');
      return;
    }

    setSubmittingAction(true);
    try {
      const response = await fetch(`${API_BASE_URL}/groups/join/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_code: cleanCode,
          student_id: student.id || userId,
        }),
      });

      const resData = await response.json();
      if (response.ok) {
        Alert.alert('Joined!', resData.message, [
          { text: 'View Group', onPress: () => { setSelectedUnit(null); fetchDashboardData(); setActiveTab('chat'); } },
        ]);
      } else {
        Alert.alert('Join Failed', resData.error || 'Invalid code.');
      }
    } catch (err) {
      Alert.alert('Network Error', 'Unable to verify group code.');
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2e4a1f" />
        <Text style={styles.loaderText}>Connecting to campus servers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top App Bar */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingSub}>{greeting},</Text>
          <Text style={styles.greetingName} numberOfLines={1}>
            {studentName}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.regBadgePill}
          onPress={() => setActiveTab('settings')}
          activeOpacity={0.8}
        >
          <Text style={styles.regBadgeText}>{student.registration_no || regNo || 'STUDENT'}</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Sub-Tabs */}
      <View style={styles.navBar}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'chat', label: 'Group Chats' },
          { key: 'files', label: 'Documents' },
          { key: 'settings', label: 'Settings' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Overview Screen Tab */}
      {activeTab === 'overview' && (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Academic Banner */}
          <View style={styles.academicCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.uniBadge}>
                <Text style={styles.uniBadgeText}>{student.university || 'ZETECH UNIVERSITY'}</Text>
              </View>
              <Text style={styles.termBadge}>Y{student.year_of_study || '2'} Sem {student.semester || '2'}</Text>
            </View>

            <Text style={styles.programTitle}>{student.course || 'Diploma in Computer Science'}</Text>

            <View style={styles.progressSection}>
              <View style={styles.progressLabelRow}>
                <Text style={styles.progressScaleTitle}>Milestone Progress</Text>
                <Text style={styles.progressScaleValue}>You have done {progressPct}% of your tasks</Text>
              </View>
              <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarActive, { width: `${Math.min(Math.max(progressPct, 5), 100)}%` }]} />
              </View>
            </View>
          </View>

          {/* Enrolled Units Section */}
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Enrolled Semester Units</Text>
              <Text style={styles.sectionSubtitle}>Tap a unit to collaborate, create, or join teams</Text>
            </View>
            <Text style={styles.countBadge}>{dashboardData?.units?.length || 0} Registered</Text>
          </View>

          {dashboardData?.units?.length > 0 ? (
            dashboardData.units.map((unit) => (
              <TouchableOpacity
                key={unit.id || unit.code}
                style={styles.unitCard}
                activeOpacity={0.7}
                onPress={() => openUnitActionModal(unit)}
              >
                <View style={styles.unitPill}>
                  <Text style={styles.unitPillText}>{unit.code}</Text>
                </View>
                <View style={styles.unitDetails}>
                  <Text style={styles.unitNameText}>{unit.name}</Text>
                  <Text style={styles.unitMetaText}>Year {unit.year} • Semester {unit.semester}</Text>
                </View>
                <View style={styles.unitActionPill}>
                  <Text style={styles.unitActionPillText}>Group Action ›</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Units Found</Text>
              <Text style={styles.emptySub}>Course units will be populated once registered.</Text>
            </View>
          )}

          {/* Active Tasks Checklist */}
          <View style={[styles.sectionHeader, { marginTop: 22 }]}>
            <Text style={styles.sectionTitle}>Action Required</Text>
            <Text style={styles.countBadge}>{dashboardData?.tasks?.pending?.length || 0} Pending</Text>
          </View>

          {dashboardData?.tasks?.pending?.length > 0 ? (
            dashboardData.tasks.pending.map((task) => (
              <View key={task.id} style={styles.taskCard}>
                <View style={styles.taskIndicator} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskMeta}>Status: {String(task.status).toUpperCase()} • Priority: {task.priority}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySub}>No outstanding assignments pending.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Group Chats Tab: Clickable for Task Allocation & Roster */}
      {activeTab === 'chat' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Collaboration Hubs</Text>
              <Text style={styles.sectionSubtitle}>Tap a group to manage members, assign tasks, and view workload scale</Text>
            </View>
            <Text style={styles.countBadge}>{dashboardData?.groups?.length || 0} Active</Text>
          </View>

          {dashboardData?.groups?.length > 0 ? (
            dashboardData.groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.chatGroupCard}
                onPress={() => openGroupDetailModal(group)}
                activeOpacity={0.7}
              >
                <View style={styles.chatAvatar}>
                  <Text style={styles.chatAvatarText}>{group.name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatGroupName}>{group.name}</Text>
                  <Text style={styles.chatGroupSub}>
                    {group.members_count} Members • Code: <Text style={{ fontWeight: '800', color: '#2e4a1f' }}>{group.join_code}</Text>
                  </Text>
                </View>
                <View style={styles.manageBadgePill}>
                  <Text style={styles.manageBadgeText}>Manage & Assign ›</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No Groups Created Yet</Text>
              <Text style={styles.emptySub}>Tap on any unit in the Overview tab to create or join a group.</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.settingsBox}>
            <Text style={styles.settingsHeader}>Account & Security</Text>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Full Name</Text>
              <Text style={styles.settingsVal}>{student.full_name || studentName}</Text>
            </View>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Registration Number</Text>
              <Text style={styles.settingsVal}>{student.registration_no || regNo}</Text>
            </View>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Email Address</Text>
              <Text style={styles.settingsVal}>{student.email || userEmail}</Text>
            </View>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Department / Programme</Text>
              <Text style={styles.settingsVal}>{student.course}</Text>
            </View>

            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <Text style={styles.signOutButtonText}>Sign Out of Workspace</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* MODAL 1: Group Member & Task Allocation Hub */}
      <Modal
        visible={!!activeGroupModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActiveGroupModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalUnitCode}>Room Code: {activeGroupModal?.join_code}</Text>
                <Text style={styles.modalUnitName} numberOfLines={1}>{activeGroupModal?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setActiveGroupModal(null)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingGroupDetails ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2e4a1f" />
                <Text style={{ marginTop: 10, color: '#64748b', fontWeight: '700' }}>Fetching group roster & tasks...</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Mode A: View Roster, Workload Scale, and Tasks */}
                {!showAssignTaskView ? (
                  <>
                    {/* Header Action Bar */}
                    <View style={styles.groupRosterHeader}>
                      <View>
                        <Text style={styles.sectionTitle}>Group Members</Text>
                        <Text style={styles.sectionSubtitle}>{groupDetailsData?.members?.length || 0} Registered Collaborators</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.assignTaskBtn}
                        onPress={() => setShowAssignTaskView(true)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.assignTaskBtnText}>+ Assign Task</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Member Cards */}
                    {groupDetailsData?.members?.map((m) => (
                      <View key={m.id} style={styles.memberCard}>
                        <View style={styles.memberAvatar}>
                          <Text style={styles.memberAvatarText}>{m.name.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>{m.name}</Text>
                          <Text style={styles.memberMeta}>{m.regNo} • {m.course}</Text>
                        </View>
                        <View style={[styles.rolePill, m.role === 'leader' ? styles.leaderPill : styles.memberPill]}>
                          <Text style={[styles.rolePillText, m.role === 'leader' ? styles.leaderPillText : styles.memberPillText]}>
                            {m.role.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    ))}

                    {/* WORKLOAD DISTRIBUTION SCALE */}
                    <View style={[styles.sectionHeader, { marginTop: 22 }]}>
                      <View>
                        <Text style={styles.sectionTitle}>Workload Distribution Scale</Text>
                        <Text style={styles.sectionSubtitle}>Compares tasks assigned across team members</Text>
                      </View>
                      <Text style={styles.countBadge}>{groupDetailsData?.total_tasks || 0} Total Tasks</Text>
                    </View>

                    {groupDetailsData?.workload_distribution?.map((item) => (
                      <View key={item.student_id} style={styles.workloadCard}>
                        <View style={styles.workloadRow}>
                          <Text style={styles.workloadName}>{item.name}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {item.is_higher_load && (
                              <View style={styles.higherLoadBadge}>
                                <Text style={styles.higherLoadBadgeText}>Higher Task Load ⚠️</Text>
                              </View>
                            )}
                            <Text style={styles.workloadCount}>{item.tasks_count} Tasks ({item.share_percentage}%)</Text>
                          </View>
                        </View>
                        <View style={styles.workloadBarBg}>
                          <View
                            style={[
                              styles.workloadBarFill,
                              {
                                width: `${Math.max(item.share_percentage, 5)}%`,
                                backgroundColor: item.is_higher_load ? '#ea580c' : '#2e4a1f',
                              },
                            ]}
                          />
                        </View>
                      </View>
                    ))}

                    {/* Group Tasks List */}
                    <View style={[styles.sectionHeader, { marginTop: 22 }]}>
                      <Text style={styles.sectionTitle}>Project Tasks</Text>
                    </View>

                    {groupDetailsData?.tasks?.length > 0 ? (
                      groupDetailsData.tasks.map((task) => (
                        <View key={task.id} style={styles.taskItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.taskItemTitle}>{task.title}</Text>
                            <Text style={styles.taskItemMeta}>
                              Assigned to: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{task.assigned_to_name}</Text>
                            </Text>
                          </View>
                          <View style={styles.priorityBadge}>
                            <Text style={styles.priorityBadgeText}>{task.priority}</Text>
                          </View>
                        </View>
                      ))
                    ) : (
                      <View style={styles.emptyCard}>
                        <Text style={styles.emptyTitle}>No Tasks Created Yet</Text>
                        <Text style={styles.emptySub}>Tap "+ Assign Task" above to delegate responsibilities.</Text>
                      </View>
                    )}
                  </>
                ) : (
                  /* Mode B: Assign Task Form */
                  <View>
                    <Text style={styles.inputLabel}>Task Title</Text>
                    <TextInput
                      style={styles.textInput}
                      value={taskTitle}
                      onChangeText={setTaskTitle}
                      placeholder="e.g. Write Literature Review & Background"
                    />

                    <Text style={styles.inputLabel}>Description / Instructions</Text>
                    <TextInput
                      style={[styles.textInput, { height: 75, textAlignVertical: 'top' }]}
                      value={taskDesc}
                      onChangeText={setTaskDesc}
                      placeholder="Specify deliverables or milestones..."
                      multiline
                    />

                    <Text style={styles.inputLabel}>Assign To Team Member</Text>
                    {groupDetailsData?.members?.map((m) => {
                      const isSelected = assignedMemberId === m.id;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.peerRow, isSelected && styles.peerRowSelected]}
                          onPress={() => setAssignedMemberId(m.id)}
                        >
                          <View style={styles.peerAvatar}>
                            <Text style={styles.peerAvatarText}>{m.name.charAt(0)}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.peerName}>{m.name}</Text>
                            <Text style={styles.peerMeta}>{m.regNo}</Text>
                          </View>
                          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                            {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>Priority Scale</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                      {['Low', 'Medium', 'High', 'Urgent'].map((pri) => (
                        <TouchableOpacity
                          key={pri}
                          style={[styles.priBtn, taskPriority === pri && styles.priBtnActive]}
                          onPress={() => setTaskPriority(pri)}
                        >
                          <Text style={[styles.priBtnText, taskPriority === pri && styles.priBtnTextActive]}>{pri}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.modalFooterRow}>
                      <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => setShowAssignTaskView(false)}
                      >
                        <Text style={styles.backBtnText}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.submitBtn}
                        onPress={handleAssignTaskSubmit}
                        disabled={submittingTask}
                      >
                        {submittingTask ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text style={styles.submitBtnText}>Confirm Assignment</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Create or Join Group Modal */}
      <Modal
        visible={!!selectedUnit}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedUnit(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalUnitCode}>{selectedUnit?.code}</Text>
                <Text style={styles.modalUnitName}>{selectedUnit?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedUnit(null)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {modalMode === 'select' && (
              <View style={styles.modalBody}>
                <Text style={styles.modalPrompt}>Choose your collaboration action for this unit:</Text>

                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: '#2e4a1f' }]}
                  onPress={() => setModalMode('create')}
                >
                  <Text style={styles.primaryActionBtnTitle}>Create Project Group</Text>
                  <Text style={styles.primaryActionBtnSubtitle}>Registers team in the database and generates a join code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryActionBtn, { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#2e4a1f' }]}
                  onPress={() => setModalMode('join')}
                >
                  <Text style={[styles.primaryActionBtnTitle, { color: '#2e4a1f' }]}>Join with Code</Text>
                  <Text style={[styles.primaryActionBtnSubtitle, { color: '#64748b' }]}>Enter database code from team leader</Text>
                </TouchableOpacity>
              </View>
            )}

            {modalMode === 'create' && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
                <Text style={styles.inputLabel}>Group / Project Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  placeholder="e.g. Distributed Systems Lab Team"
                />

                <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                  Registered Students ({student.course || 'Shared Coursework'})
                </Text>
                <Text style={styles.peerHelpText}>Select peers to invite to your group directly:</Text>

                {loadingClassmates ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#2e4a1f" />
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Loading students...</Text>
                  </View>
                ) : dbClassmates.length > 0 ? (
                  dbClassmates.map((peer) => {
                    const isSelected = selectedPeers.includes(peer.id);
                    return (
                      <TouchableOpacity
                        key={peer.id}
                        style={[styles.peerRow, isSelected && styles.peerRowSelected]}
                        onPress={() => togglePeerSelection(peer.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.peerAvatar}>
                          <Text style={styles.peerAvatarText}>{peer.name.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.peerName}>{peer.name}</Text>
                          <Text style={styles.peerMeta}>{peer.regNo} • {peer.course}</Text>
                        </View>
                        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                          {isSelected && <Text style={styles.checkboxCheck}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyTitle}>No other students yet</Text>
                  </View>
                )}

                <View style={styles.modalFooterRow}>
                  <TouchableOpacity style={styles.backBtn} onPress={() => setModalMode('select')}>
                    <Text style={styles.backBtnText}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleCreateGroupSubmit}
                    disabled={submittingAction}
                  >
                    {submittingAction ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.submitBtnText}>Create Group & Code</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {modalMode === 'join' && (
              <View style={styles.modalBody}>
                <Text style={styles.inputLabel}>Enter Group Join Code</Text>
                <TextInput
                  style={[styles.textInput, styles.joinCodeInput]}
                  value={joinCodeInput}
                  onChangeText={setJoinCodeInput}
                  placeholder="e.g. DCS-9281"
                  autoCapitalize="characters"
                  maxLength={10}
                />

                <View style={[styles.modalFooterRow, { marginTop: 28 }]}>
                  <TouchableOpacity style={styles.backBtn} onPress={() => setModalMode('select')}>
                    <Text style={styles.backBtnText}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.submitBtn}
                    onPress={handleJoinGroupSubmit}
                    disabled={submittingAction}
                  >
                    {submittingAction ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.submitBtnText}>Join Group</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff', gap: 12 },
  loaderText: { fontSize: 14, color: '#64748b', fontWeight: '700' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  greetingSub: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  greetingName: { fontSize: 21, fontWeight: '900', color: '#0f172a', letterSpacing: -0.4 },
  regBadgePill: { backgroundColor: '#ecfccb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  regBadgeText: { color: '#365314', fontSize: 11, fontWeight: '800' },
  navBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  tabButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  tabButtonActive: { backgroundColor: '#2e4a1f' },
  tabButtonText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  tabButtonTextActive: { color: '#ffffff', fontWeight: '800' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
  academicCard: {
    backgroundColor: '#2e4a1f',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  uniBadge: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  uniBadgeText: { color: '#ffffff', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  termBadge: { color: '#ecfccb', fontSize: 12, fontWeight: '800' },
  programTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff', marginBottom: 18, lineHeight: 24 },
  progressSection: { backgroundColor: 'rgba(0,0,0,0.22)', padding: 14, borderRadius: 12 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressScaleTitle: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  progressScaleValue: { color: '#ecfccb', fontSize: 11, fontWeight: '800' },
  progressBarBackground: { height: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden' },
  progressBarActive: { height: '100%', backgroundColor: '#a3e635' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  sectionSubtitle: { fontSize: 11, color: '#64748b', fontWeight: '600', marginTop: 2 },
  countBadge: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  unitCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  unitPill: { backgroundColor: '#ecfccb', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 12 },
  unitPillText: { color: '#365314', fontSize: 12, fontWeight: '800' },
  unitDetails: { flex: 1 },
  unitNameText: { fontSize: 13.5, fontWeight: '700', color: '#0f172a' },
  unitMetaText: { fontSize: 11, color: '#64748b', marginTop: 2 },
  unitActionPill: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  unitActionPillText: { fontSize: 11, fontWeight: '700', color: '#2e4a1f' },
  taskCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  taskIndicator: { width: 5, height: 28, backgroundColor: '#2e4a1f', borderRadius: 3, marginRight: 12 },
  taskTitle: { fontSize: 13.5, fontWeight: '700', color: '#0f172a' },
  taskMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  emptyCard: { backgroundColor: '#ffffff', padding: 22, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  emptySub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4 },
  chatGroupCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chatAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ecfccb', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  chatAvatarText: { fontSize: 17, fontWeight: '800', color: '#2e4a1f' },
  chatGroupName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  chatGroupSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  manageBadgePill: { backgroundColor: '#ecfccb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  manageBadgeText: { fontSize: 11, fontWeight: '800', color: '#2e4a1f' },

  /* Group Detail Modal Roster & Scale */
  groupRosterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  assignTaskBtn: { backgroundColor: '#2e4a1f', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  assignTaskBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  memberAvatarText: { fontSize: 15, fontWeight: '800', color: '#334155' },
  memberName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  memberMeta: { fontSize: 11, color: '#64748b', marginTop: 1 },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  leaderPill: { backgroundColor: '#fef3c7' },
  leaderPillText: { color: '#92400e', fontSize: 10, fontWeight: '800' },
  memberPill: { backgroundColor: '#e2e8f0' },
  memberPillText: { color: '#475569', fontSize: 10, fontWeight: '800' },

  /* Workload Scale Styles */
  workloadCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', padding: 12, borderRadius: 10, marginBottom: 8 },
  workloadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  workloadName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  workloadCount: { fontSize: 11.5, color: '#64748b', fontWeight: '700' },
  higherLoadBadge: { backgroundColor: '#ffedd5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 4 },
  higherLoadBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#c2410c' },
  workloadBarBg: { height: 7, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  workloadBarFill: { height: '100%', borderRadius: 4 },

  /* Tasks Items inside modal */
  taskItem: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskItemTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  taskItemMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  priorityBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priorityBadgeText: { color: '#b91c1c', fontSize: 10.5, fontWeight: '800' },

  /* Form Elements inside modal */
  priBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  priBtnActive: { backgroundColor: '#2e4a1f', borderColor: '#2e4a1f' },
  priBtnText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  priBtnTextActive: { color: '#ffffff' },

  settingsBox: { backgroundColor: '#ffffff', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#e2e8f0' },
  settingsHeader: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 14 },
  settingsRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  settingsLabel: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  settingsVal: { fontSize: 13.5, fontWeight: '700', color: '#0f172a', marginTop: 3 },
  signOutButton: { marginTop: 22, backgroundColor: '#fee2e2', paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  signOutButtonText: { color: '#b91c1c', fontSize: 13.5, fontWeight: '800' },

  /* Base Modal Styles */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalUnitCode: { fontSize: 12, fontWeight: '800', color: '#2e4a1f', textTransform: 'uppercase' },
  modalUnitName: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginTop: 2, maxWidth: 280 },
  modalCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  modalCloseBtnText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  modalBody: { padding: 20 },
  modalPrompt: { fontSize: 13.5, color: '#64748b', fontWeight: '600', marginBottom: 16 },
  primaryActionBtn: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
  },
  primaryActionBtnTitle: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
  primaryActionBtnSubtitle: { fontSize: 12, color: '#e2e8f0', marginTop: 3 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  joinCodeInput: { fontSize: 18, fontWeight: '800', letterSpacing: 2, textAlign: 'center' },
  peerHelpText: { fontSize: 11.5, color: '#64748b', marginBottom: 10 },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  peerRowSelected: { backgroundColor: '#f0fdf4', borderColor: '#2e4a1f' },
  peerAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#ecfccb', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  peerAvatarText: { fontSize: 14, fontWeight: '800', color: '#2e4a1f' },
  peerName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  peerMeta: { fontSize: 10.5, color: '#64748b', marginTop: 1 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#cbd5e1', justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: '#2e4a1f', borderColor: '#2e4a1f' },
  checkboxCheck: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  modalFooterRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  backBtn: { flex: 1, paddingVertical: 14, backgroundColor: '#f1f5f9', borderRadius: 10, alignItems: 'center' },
  backBtnText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  submitBtn: { flex: 2, paddingVertical: 14, backgroundColor: '#2e4a1f', borderRadius: 10, alignItems: 'center' },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
});