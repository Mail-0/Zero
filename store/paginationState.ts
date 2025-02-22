import { atom } from "jotai";

interface PaginationType {
  pageNo: number;
  pageToken: string | undefined;
}

export const paginationAtom = atom<PaginationType[]>([{ pageNo: 0, pageToken: undefined }]);

export const currentPageAtom = atom(0);

export const folderAtom = atom<string | undefined>(undefined);

export const setFolderAtom = atom(
  (get) => get(folderAtom),
  (get, set, newFolder: string) => {
    const currentFolder = get(folderAtom);

    if (currentFolder !== newFolder) {
      set(folderAtom, newFolder);
      set(paginationAtom, [{ pageNo: 0, pageToken: undefined }]);
      set(currentPageAtom, 0);
    }
  },
);

export const addPageTokenAtom = atom(
  (get) => get(paginationAtom),
  (get, set, { pageNo, pageToken }: PaginationType) => {
    const currentPagination = get(paginationAtom);

    const existingPage = currentPagination.find((page) => page.pageNo === pageNo);
    if (existingPage) {
      set(
        paginationAtom,
        currentPagination.map((page) => (page.pageNo === pageNo ? { ...page, pageToken } : page)),
      );
    } else {
      set(paginationAtom, [...currentPagination, { pageNo, pageToken }]);
    }
  },
);

export const getPageTokenAtom = atom((get) => {
  const pageNo = get(currentPageAtom);
  const pagination = get(paginationAtom);
  return pagination.find((p) => p.pageNo === pageNo)?.pageToken;
});
