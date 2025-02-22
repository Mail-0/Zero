"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { currentPageAtom } from "@/store/paginationState";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAtom } from "jotai";

export const Pagination = () => {
  const [currentPage, setCurrentPage] = useAtom(currentPageAtom);
  return (
    <div className="mx-2 flex flex-row gap-x-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={currentPage === 0 ? "opacity-50" : ""}
            onClick={() => {
              setCurrentPage(currentPage - 1);
            }}
            disabled={currentPage === 0}
          >
            <ChevronLeft size={20} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Newer</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              setCurrentPage(currentPage + 1);
            }}
          >
            <ChevronRight size={20} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Older</TooltipContent>
      </Tooltip>
    </div>
  );
};
