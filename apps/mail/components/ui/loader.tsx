import React from "react";
interface LoaderProps {
  title: string;
}
const Loader = ({ title }: LoaderProps) => {
  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{title}</p>
      </div>
    </div>
  );
};

export default Loader;
