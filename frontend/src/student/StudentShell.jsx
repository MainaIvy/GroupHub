import React, { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import './design.css';
import useStudentWorkspace from './hooks/useStudentWorkspace';
import useStudentNotifications from './hooks/useStudentNotifications';
import useGroupInsights from './hooks/useGroupInsights';
import useAccessActions from './hooks/useAccessActions';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CreateJoinModal from './components/CreateJoinModal';
import TaskModal from './components/TaskModal';
import LoadingState from './components/LoadingState';
import ProjectFormModal from '../components/ProjectFormModal';
import Overview from './pages/Overview';
import Groups from './pages/Groups';
import MyTasks from './pages/MyTasks';
import MyUnits from './pages/MyUnits';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import GroupWorkspace from './pages/GroupWorkspace';

const PAGES = {
  chat: Messages,
  settings: Settings,
  tasks: MyTasks,
  units: MyUnits,
  groups: Groups,
};

const StudentShell = () => {
  const workspace = useStudentWorkspace();
  const notif = useStudentNotifications();
  const insights = useGroupInsights(workspace.groups, workspace.user?.id);
  const access = useAccessActions({ notif, refreshGroups: workspace.refreshGroups, reloadInsights: insights.reload });
  const { groupId: routeGroupId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedTab = location.state?.tab;

  useEffect(() => {
    if (requestedTab && !routeGroupId) workspace.setActiveTab(requestedTab);
    // Only react to navigation, not to every workspace render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedTab, routeGroupId]);

  // On /student/groups/:groupId the sidebar acts as navigation back to the dashboard pages.
  const ctx = {
    ...workspace,
    notif,
    insights,
    access,
    activeTab: routeGroupId ? 'groups' : workspace.activeTab,
    setActiveTab: routeGroupId ? (tab) => navigate('/student/dashboard', { state: { tab } }) : workspace.setActiveTab,
    openGroupDetails: (group) => navigate(`/student/groups/${group.id}`),
  };
  const { loading, activeTab, error, setError, selectedTaskGroup, projectModal, setProjectModal, setTaskGroupProjects } = ctx;
  const Page = routeGroupId ? GroupWorkspace : PAGES[activeTab] || Overview;

  if (loading) {
    return (
      <div className="student-root flex min-h-screen items-center justify-center bg-[#E2E8F0] p-6">
        <div className="w-full max-w-sm"><LoadingState label="Loading your workspace…" /></div>
      </div>
    );
  }

  return (
    <div data-dashboard-theme="school" className="student-root flex min-h-screen flex-col bg-[#E2E8F0] antialiased selection:bg-[#D7DEE6] lg:flex-row">
      <Sidebar ctx={ctx} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-64">
        <Header ctx={ctx} />
        <main className="flex-1 bg-[#E2E8F0] p-4 sm:p-6 xl:p-8">
          {error ? (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')} className="h-10 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-800 hover:bg-red-100">Dismiss</button>
            </div>
          ) : null}
          <Page ctx={ctx} />
        </main>
      </div>
      <CreateJoinModal ctx={ctx} />
      {projectModal && selectedTaskGroup && (
        <ProjectFormModal
          groupId={selectedTaskGroup.id}
          initial={projectModal}
          onClose={() => setProjectModal(null)}
          onCreated={(project) => { setTaskGroupProjects((current) => [...current, project]); setProjectModal(null); }}
        />
      )}
      <TaskModal ctx={ctx} />
    </div>
  );
};

export default StudentShell;
