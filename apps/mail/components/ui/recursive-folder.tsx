import { useActiveConnection, useConnections } from '@/hooks/use-connections';
import { LabelSidebarContextMenu } from '../context/label-sidebar-context';
import { useSearchValue } from '@/hooks/use-search-value';
import type { Label, Label as LabelType } from '@/types';
import { useSidebar } from '../context/sidebar-context';
import useSearchLabels from '@/hooks/use-labels-search';
import { Folder } from '../magicui/file-tree';
import { useNavigate } from 'react-router';
import { useQueryState } from 'nuqs';
import { useCallback } from 'react';
import * as React from 'react';

export const RecursiveFolder = ({
  label,
  activeAccount,
  count,
}: {
  label: Label & { originalLabel?: Label };
  activeAccount?: any;
  count?: number;
}) => {
  const { labels, setLabels } = useSearchLabels();
  const isActive = labels?.includes(label.id);
  const isFolderActive = isActive || window.location.pathname.includes(`/mail/label/${label.id}`);
  const navigate = useNavigate();
  const { setOpenMobile, isMobile } = useSidebar();

  const handleFilterByLabel = useCallback(
    (labelToFilter: LabelType) => {
      if (labels?.includes(labelToFilter.id)) {
        setLabels(labels.filter((l) => l !== labelToFilter.id));
      } else {
        setLabels([...(labels ?? []), labelToFilter.id]);
      }
    },
    [labels, setLabels],
  );

  const handleFolderClick = useCallback(
    (id: string) => {
      if (!activeAccount) return;

      if (id.startsWith('group-')) {
        return;
      }

      const labelToUse = label;

      if (activeAccount.providerId === 'microsoft') {
        navigate(`/mail/${id}`);
      } else {
        handleFilterByLabel(labelToUse);
      }

      if (isMobile) {
        setOpenMobile(false);
      }
    },
    [navigate, handleFilterByLabel, activeAccount, label, isMobile, setOpenMobile],
  );

  const hasChildren = label.labels && label.labels.length > 0;

  return (
    <LabelSidebarContextMenu
      labelId={label.id}
      key={label.id}
      hide={activeAccount?.providerId === 'microsoft' || hasChildren}
    >
      <Folder
        element={label.name}
        value={label.id}
        key={label.id}
        hasChildren={hasChildren}
        onFolderClick={handleFolderClick}
        isSelect={isFolderActive}
        count={count || 0}
        className="max-w-[192px]"
      >
        {label.labels?.map((childLabel: any) => (
          <RecursiveFolder
            key={childLabel.id}
            label={childLabel}
            activeAccount={activeAccount}
            count={count}
          />
        ))}
      </Folder>
    </LabelSidebarContextMenu>
  );
};
