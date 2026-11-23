import React, { useState } from 'react';
import { Download, FileText, FolderOpen } from 'lucide-react';
import { btnSecondary } from '../../design';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import LoadingState from '../../components/LoadingState';

const SOURCE_LABEL = {
  chat: 'Chat',
  submission: 'Submission',
  work: 'Work item',
};

const SOURCE_COLOR = {
  chat: 'text-[#1F6B5C] bg-[#E8F4F1]',
  submission: 'text-[#4A6079] bg-[#EEF1F4]',
  work: 'text-[#7C3AED] bg-[#F3E8FF]',
};

const FilesTab = ({ files, loading, error, onRetry, onGoChat }) => {
  const [busyId, setBusyId] = useState(null);
  const [downloadError, setDownloadError] = useState('');

  const download = async (file) => {
    setBusyId(file.id);
    setDownloadError('');
    try {
      const response = await fetch(file.url, { headers: { Authorization: `Bearer ${localStorage.getItem('access_token') || ''}` } });
      if (!response.ok) throw new Error('download failed');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name || 'shared-file';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('That file could not be downloaded.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingState label="Loading shared files…" />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!files.length) return <EmptyState icon={FolderOpen} title="No files shared yet" description="Files you attach in the group chat, and files attached to submissions and work items, show up here." actionLabel="Go to chat" onAction={onGoChat} />;

  return (
    <section className="overflow-hidden rounded-xl border border-[#D7DEE6] bg-white" aria-label="Shared files">
      {downloadError ? <p role="alert" className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700">{downloadError}</p> : null}
      <table className="w-full text-left text-sm">
        <thead className="bg-[#EEF1F4] text-[13px] uppercase tracking-wide text-[#4F5F73]"><tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Shared by</th><th className="px-4 py-2">Source</th><th className="px-4 py-2">Date</th><th className="px-4 py-2"><span className="sr-only">Download</span></th></tr></thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id} className="border-t border-[#E3EAF2]">
              <td className="px-4 py-3"><span className="inline-flex items-center gap-2 font-medium text-[#1F2D3D]"><FileText size={16} className="text-[#4A6079]" aria-hidden="true" />{file.name}</span></td>
              <td className="px-4 py-3 text-[#33445A]">{file.sharedBy}</td>
              <td className="px-4 py-3"><span className={`inline-flex items-center rounded text-[10px] font-bold px-2 py-0.5 ${SOURCE_COLOR[file.source] || SOURCE_COLOR.chat}`}>{SOURCE_LABEL[file.source] || 'File'}</span></td>
              <td className="px-4 py-3 text-[#4F5F73]">{file.date ? new Date(file.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
              <td className="px-4 py-3 text-right"><button type="button" disabled={busyId === file.id} onClick={() => download(file)} className={btnSecondary}><Download size={16} aria-hidden="true" /> Download</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};

export default FilesTab;
