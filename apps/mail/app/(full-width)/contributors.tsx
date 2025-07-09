import {
  Github,
  Star,
  GitFork,
  MessageCircle,
  GitGraph,
  ChartAreaIcon,
  GitPullRequest,
  LayoutGrid,
  FileCode,
  ArrowLeft,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Discord, Twitter } from '@/components/icons/icons';
import { Separator } from '@/components/ui/separator';
import { Navigation } from '@/components/navigation';
import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import React from 'react';

interface Contributor {
  login: string;
  avatar_url: string;
  contributions: number;
  html_url: string;
}

interface TimelineData {
  date: string;
  stars: number;
  forks: number;
  watchers: number;
  commits: number;
}

interface ActivityData {
  date: string;
  commits: number;
  issues: number;
  pullRequests: number;
}

const excludedUsernames = [
  'bot1',
  'dependabot',
  'github-actions',
  'zerodotemail',
  'autofix-ci[bot]',
];
const coreTeamMembers = [
  'nizzyabi',
  'ahmetskilinc',
  'BlankParticle',
  'needlexo',
  'dakdevs',
  'mrgsub',
];
const REPOSITORY = 'Mail-0/Zero';

const specialRoles: Record<
  string,
  { role: string; position: number; x?: string; website?: string }
> = {
  nizzyabi: {
    role: 'Founder & CEO',
    position: 1,
    x: 'nizzyabi',
  },
  mrgsub: {
    role: 'Founder & CTO',
    position: 2,
    x: 'cmdhaus',
  },
  ahmetskilinc: {
    role: 'Lead Engineer',
    position: 3,
    x: 'bruvimtired',
    website: 'https://ahmetk.dev/',
  },
  needlexo: {
    role: 'Software Engineer',
    position: 5,
    x: 'needleXO',
    website: 'https://needle.rip',
  },
  dakdevs: {
    role: 'Software Engineer',
    position: 4,
    x: 'dakdevs',
    website: 'https://www.dak.dev/',
  },
  ripgrim: {
    role: 'Maintainer',
    position: 6,
    x: 'fuckgrimlabs',
    website: 'https://ripgrim.com',
  },
};

const ChartControls = ({
  showAll,
  setShowAll,
  total,
}: {
  showAll: boolean;
  setShowAll: (show: boolean) => void;
  total: number;
}) => (
  <div className="mb-4 flex items-center justify-between">
    <span className="text-muted-foreground text-sm">
      Showing {showAll ? 'all' : 'top 10'} contributors
    </span>
    <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)} className="text-xs">
      Show {showAll ? 'less' : 'all'} ({total})
    </Button>
  </div>
);

export default function OpenPage() {
  const [repoStats, setRepoStats] = useState({
    stars: 0,
    forks: 0,
    watchers: 0,
    openIssues: 0,
    openPRs: 0,
  });
  const [timelineData, setTimelineData] = useState<TimelineData[]>([]);
  const [activityData, setActivityData] = useState<ActivityData[]>([]);
  const [showAllContributors, setShowAllContributors] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allContributors, setAllContributors] = useState<Contributor[]>([]);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => setIsRendered(true), []);

  const { data: initialContributors } = useQuery({
    queryFn: () =>
      fetch(`https://api.github.com/repos/${REPOSITORY}/contributors?per_page=100&page=1`).then(
        (res) => res.json(),
      ) as Promise<Contributor[]>,
    queryKey: ['contributors', REPOSITORY],
  });

  const { data: additionalContributors } = useQuery({
    queryFn: () =>
      fetch(`https://api.github.com/repos/${REPOSITORY}/contributors?per_page=100&page=2`).then(
        (res) => res.json(),
      ) as Promise<Contributor[]>,
    queryKey: ['additional-contributors', REPOSITORY],
    enabled: initialContributors && initialContributors?.length === 100,
  });

  useEffect(() => {
    if (initialContributors) {
      if (additionalContributors) {
        setAllContributors([...initialContributors, ...additionalContributors]);
      } else {
        setAllContributors(initialContributors);
      }
    }
  }, [initialContributors, additionalContributors]);

  const { data: repoData, error: repoError } = useQuery({
    queryFn: () =>
      fetch(`https://api.github.com/repos/${REPOSITORY}`).then((res) => res.json() as any),
    queryKey: ['repo-data', REPOSITORY],
  });

  const { data: commitsData, error: commitsError } = useQuery({
    queryFn: () =>
      fetch(`https://api.github.com/repos/${REPOSITORY}/commits?per_page=100`).then(
        (res) => res.json() as any,
      ),
    queryKey: ['commits-data', REPOSITORY],
  });

  const { data: prsData, error: prsError } = useQuery({
    queryFn: () =>
      fetch(`https://api.github.com/repos/${REPOSITORY}/pulls?state=open`).then(
        (res) => res.json() as any,
      ),
    queryKey: ['prs-data', REPOSITORY],
  });

  const filteredCoreTeam = useMemo(() => {
    return allContributors
      ?.filter(
        (contributor) =>
          !excludedUsernames.includes(contributor.login) &&
          coreTeamMembers.some(
            (member) => member.toLowerCase() === contributor.login.toLowerCase(),
          ),
      )
      .sort((a, b) => {
        const positionA = specialRoles[a.login.toLowerCase()]?.position || 999;
        const positionB = specialRoles[b.login.toLowerCase()]?.position || 999;
        return positionA - positionB;
      });
  }, [allContributors]);

  const filteredContributors = useMemo(
    () =>
      allContributors
        ?.filter(
          (contributor) =>
            !excludedUsernames.includes(contributor.login) &&
            !coreTeamMembers.some(
              (member) => member.toLowerCase() === contributor.login.toLowerCase(),
            ),
        )
        .sort((a, b) => b.contributions - a.contributions),
    [allContributors],
  );

  useEffect(() => {
    if (repoError || commitsError || prsError) {
      setError(
        repoError?.message ||
          commitsError?.message ||
          prsError?.message ||
          'An error occurred while fetching data',
      );
      generateFallbackData();
      return;
    }

    if (!repoData || !commitsData || !prsData) {
      setIsLoading(true);
      return;
    }

    setIsLoading(false);
    setError(null);

    setRepoStats({
      stars: repoData.stargazers_count,
      forks: repoData.forks_count,
      watchers: repoData.subscribers_count,
      openIssues: repoData.open_issues_count - prsData.length,
      openPRs: prsData.length,
    });

    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      const dateStr = date.toISOString().split('T')[0];

      const dayCommits = commitsData.filter((commit: { commit: { author: { date: string } } }) =>
        commit.commit.author.date.startsWith(dateStr ?? ''),
      ).length;

      const dayIndex = i + 1;
      const growthFactor = dayIndex / 30;

      return {
        date: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        stars: Math.floor(repoData.stargazers_count * growthFactor),
        forks: Math.floor(repoData.forks_count * growthFactor),
        watchers: Math.floor(repoData.subscribers_count * growthFactor),
        commits: dayCommits || Math.floor(Math.random() * 5),
      };
    });

    setTimelineData(last30Days);

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      const today = date.getDay();
      const daysToSubtract = today + (6 - i);
      date.setDate(date.getDate() - daysToSubtract);

      const dateStr = date.toISOString().split('T')[0];

      const dayCommits = commitsData.filter((commit: { commit: { author: { date: string } } }) =>
        commit.commit.author.date.startsWith(dateStr ?? ''),
      ).length;

      const commits = dayCommits || Math.floor(Math.random() * 5) + 1;

      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        commits,
        issues: Math.max(1, Math.floor(commits * 0.3)),
        pullRequests: Math.max(1, Math.floor(commits * 0.2)),
      };
    });

    setActivityData(last7Days);
  }, [repoData, commitsData, prsData, repoError, commitsError, prsError]);

  const generateFallbackData = () => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return {
        date: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        stars: Math.floor(Math.random() * 100),
        forks: Math.floor(Math.random() * 50),
        watchers: Math.floor(Math.random() * 30),
        commits: Math.floor(Math.random() * 10),
      };
    });

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      const today = date.getDay();
      const daysToSubtract = today + (6 - i);
      date.setDate(date.getDate() - daysToSubtract);

      const commits = Math.floor(Math.random() * 8) + 2;
      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short' }),
        commits,
        issues: Math.max(1, Math.floor(commits * 0.3)),
        pullRequests: Math.max(1, Math.floor(commits * 0.2)),
      };
    });

    setTimelineData(last30Days);
    setActivityData(last7Days);
  };

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium text-neutral-900 dark:text-white">
            Something went wrong
          </h3>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent dark:border-white dark:border-t-transparent" />
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-white text-black dark:bg-neutral-950 dark:text-white">
      <Navigation />

      <div className="absolute top-6 right-4 md:top-8 md:right-auto md:left-8">
        <a href="/">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-gray-600 hover:text-gray-900 dark:text-white dark:hover:text-white/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </a>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Header with theme toggle */}
        <div className="mb-6 flex justify-end">
          <ThemeToggle />
        </div>

        {/* Project Stats */}
        <div className="mb-8 overflow-hidden rounded-xl border bg-gradient-to-b from-white/50 to-white/10 p-6 backdrop-blur-sm dark:border-neutral-700 dark:from-neutral-900/50 dark:to-neutral-900/30">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <a href="/">
                  <div className="relative h-8 w-8">
                    <img
                      src="/black-icon.svg"
                      alt="0.email Logo"
                      className="object-contain dark:hidden"
                    />
                    <img
                      src="/white-icon.svg"
                      alt="0.email Logo"
                      className="hidden object-contain dark:block"
                    />
                  </div>
                </a>
              </div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                An open source email app built with modern technologies
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="gap-2 border-neutral-200 bg-white/50 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:hover:text-white"
              >
                <a href={`https://github.com/${REPOSITORY}`} target="_blank">
                  <Github className="h-4 w-4" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>

          <Separator className="my-6 dark:bg-neutral-700" />

          <div className="flex flex-wrap items-center divide-x divide-neutral-200 dark:divide-neutral-700">
            <div className="flex items-center gap-3 px-3 first:pl-0 last:pr-0 sm:px-4">
              <Star className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-neutral-900 sm:text-lg dark:text-white">
                  {repoStats.stars}
                </span>
                <span className="hidden text-xs text-neutral-500 sm:inline dark:text-neutral-400">
                  &nbsp;stars
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 first:pl-0 last:pr-0 sm:px-4">
              <GitFork className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-neutral-900 sm:text-lg dark:text-white">
                  {repoStats.forks}
                </span>
                <span className="hidden text-xs text-neutral-500 sm:inline dark:text-neutral-400">
                  &nbsp;forks
                </span>
              </div>
            </div>

            <div className="hidden items-center gap-3 px-3 first:pl-0 last:pr-0 sm:flex sm:px-4">
              <Github className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-neutral-900 sm:text-lg dark:text-white">
                  {repoStats.watchers}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  &nbsp;watchers
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 first:pl-0 last:pr-0 sm:px-4">
              <MessageCircle className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-neutral-900 sm:text-lg dark:text-white">
                  {repoStats.openIssues}
                </span>
                <span className="hidden text-xs text-neutral-500 sm:inline dark:text-neutral-400">
                  &nbsp;issues
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 px-3 first:pl-0 last:pr-0 sm:px-4">
              <GitPullRequest className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              <div className="flex items-baseline gap-1">
                <span className="text-base font-bold text-neutral-900 sm:text-lg dark:text-white">
                  {repoStats.openPRs}
                </span>
                <span className="hidden text-xs text-neutral-500 sm:inline dark:text-neutral-400">
                  &nbsp;PRs
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {/* Repository Growth */}
            <Card className="col-span-full border-neutral-100 bg-white/50 p-4 transition-all hover:bg-white/60 lg:col-span-2 dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:bg-neutral-900/60">
              <h3 className="mb-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                Repository Growth
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={timelineData} className="-mx-5 mt-2">
                  <defs>
                    <linearGradient id="stars" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgb(64, 64, 64)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="rgb(64, 64, 64)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="starsDark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgb(255, 255, 255)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="rgb(255, 255, 255)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="forks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgb(64, 64, 64)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="rgb(64, 64, 64)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="forksDark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgb(200, 200, 200)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="rgb(200, 200, 200)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    stroke="currentColor"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    className="text-neutral-600 dark:text-neutral-400"
                  />
                  <YAxis
                    stroke="currentColor"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                    className="text-neutral-600 dark:text-neutral-400"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
                            <div className="grid gap-2">
                              <div className="flex items-center gap-2">
                                <Star className="h-4 w-4 text-neutral-900 dark:text-white" />
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                  Stars:
                                </span>
                                <span className="font-medium text-neutral-900 dark:text-white">
                                  {payload[0]?.value}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <GitFork className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                  Forks:
                                </span>
                                <span className="font-medium text-neutral-900 dark:text-white">
                                  {payload[1]?.value}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="stars"
                    stroke="rgb(64, 64, 64)"
                    strokeWidth={2}
                    fill="url(#stars)"
                    className="dark:fill-[url(#starsDark)] dark:stroke-white"
                  />
                  <Area
                    type="monotone"
                    dataKey="forks"
                    stroke="rgb(64, 64, 64)"
                    strokeWidth={2}
                    fill="url(#forks)"
                    className="dark:fill-[url(#forksDark)] dark:stroke-neutral-300"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Activity Chart */}
            <Card className="col-span-full border-neutral-200 bg-white/50 p-4 transition-all hover:bg-white/60 lg:col-span-1 dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:bg-neutral-900/60">
              <h3 className="mb-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                Recent Activity
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={activityData} className="-mx-5 mt-2" layout="horizontal">
                  <XAxis
                    dataKey="date"
                    stroke="currentColor"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    className="text-neutral-600 dark:text-neutral-400"
                    interval={0}
                  />
                  <YAxis
                    stroke="currentColor"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    className="text-neutral-600 dark:text-neutral-400"
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
                            <div className="grid gap-2">
                              <div className="flex items-center gap-2">
                                <GitGraph className="h-4 w-4 text-neutral-900 dark:text-white" />
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                  Commits:
                                </span>
                                <span className="font-medium text-neutral-900 dark:text-white">
                                  {payload[0]?.value}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MessageCircle className="h-4 w-4 text-neutral-700 dark:text-neutral-300" />
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                  Issues:
                                </span>
                                <span className="font-medium text-neutral-900 dark:text-white">
                                  {payload[1]?.value}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <GitPullRequest className="h-4 w-4 text-neutral-500 dark:text-neutral-500" />
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                  PRs:
                                </span>
                                <span className="font-medium text-neutral-900 dark:text-white">
                                  {payload[2]?.value}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="commits"
                    radius={[4, 4, 0, 0]}
                    className="fill-neutral-900 dark:fill-white"
                  />
                  <Bar
                    dataKey="issues"
                    radius={[4, 4, 0, 0]}
                    className="fill-neutral-700 dark:fill-neutral-300"
                  />
                  <Bar
                    dataKey="pullRequests"
                    radius={[4, 4, 0, 0]}
                    className="fill-neutral-500 dark:fill-neutral-500"
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>

        {/* Core Team Section */}
        <div className="mb-12 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900/80 dark:text-white">
              Core Team
            </h1>
            <p className="text-muted-foreground mt-2">Meet the people behind 0.email</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCoreTeam?.map((member, index) => (
              <div
                key={member.login}
                className="group relative flex items-center gap-4 rounded-xl border bg-white/50 p-4 transition-all hover:-translate-y-1 hover:bg-white hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:bg-neutral-900 dark:hover:shadow-neutral-900/50"
                style={{
                  animationDelay: `${index * 100}ms`,
                  animation: 'fadeInUp 0.5s ease-out forwards',
                  opacity: 0,
                  transform: 'translateY(10px)',
                }}
              >
                <Avatar className="h-16 w-16 ring-2 ring-neutral-200 transition-transform group-hover:scale-105 group-hover:ring-neutral-300 dark:ring-neutral-800 dark:group-hover:ring-neutral-700">
                  <AvatarImage
                    src={`https://github.com/${member.login}.png`}
                    alt={member.login}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-xs">
                    {member.login.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1">
                  <h3 className="text-lg font-medium text-neutral-900 transition-colors group-hover:text-neutral-700 dark:text-neutral-200 dark:group-hover:text-white">
                    {member.login}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {specialRoles[member.login.toLowerCase()]?.role || 'Maintainer'}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <a
                      href={`https://github.com/${member.login}`}
                      target="_blank"
                      className="rounded-md p-1 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                    >
                      <Github className="h-4 w-4" />
                    </a>
                    {specialRoles[member.login.toLowerCase()]?.x && (
                      <a
                        href={`https://x.com/${specialRoles[member.login.toLowerCase()]?.x}`}
                        target="_blank"
                        className="rounded-md p-1 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                      >
                        <Twitter className="dark:fill-muted-foreground h-4 w-4" />
                      </a>
                    )}
                    {specialRoles[member.login.toLowerCase()]?.website && (
                      <a
                        href={specialRoles[member.login.toLowerCase()]?.website || '#'}
                        target="_blank"
                        className="rounded-md p-1 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                          />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contributors Section */}
        <div className="mb-16 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900/80 dark:text-white">
              Contributors
            </h1>
            <div className="text-muted-foreground mt-2 flex items-center justify-center gap-2">
              <span>Thank you to all the contributors who have helped make 0.email possible</span>
            </div>
          </div>

          <div>
            <Tabs defaultValue="grid" className="w-full">
              <div className="mb-6 flex justify-center">
                <TabsList className="grid h-full w-full grid-cols-2 border border-neutral-200 bg-white/50 p-1 sm:w-[200px] dark:border-neutral-800 dark:bg-neutral-900/50">
                  <TabsTrigger
                    value="grid"
                    className="flex items-center gap-2 text-neutral-600 data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm dark:text-neutral-400 dark:data-[state=active]:bg-neutral-800 dark:data-[state=active]:text-white"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Grid
                  </TabsTrigger>
                  <TabsTrigger
                    value="chart"
                    className="flex items-center gap-2 text-neutral-600 data-[state=active]:bg-white data-[state=active]:text-neutral-900 data-[state=active]:shadow-sm dark:text-neutral-400 dark:data-[state=active]:bg-neutral-800 dark:data-[state=active]:text-white"
                  >
                    <ChartAreaIcon className="h-4 w-4" />
                    Chart
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="grid">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  {filteredContributors?.map((contributor, index) => (
                    <a
                      key={contributor.login}
                      href={contributor.html_url}
                      target="_blank"
                      className="group relative flex flex-col items-center rounded-xl border bg-white/50 p-4 transition-all hover:-translate-y-1 hover:bg-white hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:bg-neutral-900 dark:hover:shadow-neutral-900/50"
                      style={{
                        animationDelay: `${index * 50}ms`,
                        animation: 'fadeInUp 0.5s ease-out forwards',
                        opacity: 0,
                        transform: 'translateY(10px)',
                      }}
                    >
                      <Avatar className="h-16 w-16 ring-2 ring-neutral-200 transition-transform group-hover:scale-105 group-hover:ring-neutral-300 dark:ring-neutral-800 dark:group-hover:ring-neutral-700">
                        <AvatarImage
                          src={contributor.avatar_url}
                          alt={contributor.login}
                          className="object-cover"
                        />
                        <AvatarFallback className="text-xs">
                          {contributor.login.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="mt-3 text-center">
                        <span className="block text-sm font-medium text-neutral-900 transition-colors group-hover:text-neutral-700 dark:text-neutral-200 dark:group-hover:text-white">
                          {contributor.login}
                        </span>
                        <div className="mt-2 flex items-center justify-center gap-1">
                          <GitGraph className="h-3 w-3 text-neutral-500 transition-colors group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-300" />
                          <span className="text-sm font-medium text-neutral-700 transition-colors group-hover:text-neutral-900 dark:text-neutral-300 dark:group-hover:text-white">
                            {contributor.contributions}
                          </span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="chart">
                <Card className="bg-white/50 p-6 dark:bg-neutral-900/50">
                  <ChartControls
                    showAll={showAllContributors}
                    setShowAll={setShowAllContributors}
                    total={filteredContributors?.length || 0}
                  />

                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={filteredContributors?.slice(0, showAllContributors ? undefined : 10)}
                      margin={{ top: 10, right: 10, bottom: 20, left: 10 }}
                    >
                      <XAxis
                        dataKey="login"
                        interval={0}
                        tick={(props) => {
                          const { x, y, payload } = props;
                          const contributor = allContributors?.find(
                            (c) => c.login === payload.value,
                          );

                          return (
                            <g transform={`translate(${x},${y})`}>
                              <foreignObject x="-12" y="8" width="24" height="24">
                                <Avatar className="h-6 w-6 ring-1 ring-neutral-200 dark:ring-neutral-800">
                                  <AvatarImage src={contributor?.avatar_url} />
                                  <AvatarFallback className="text-[8px]">
                                    {payload.value.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              </foreignObject>
                            </g>
                          );
                        }}
                        height={60}
                        className="text-neutral-600 dark:text-neutral-400"
                      />
                      <YAxis
                        stroke="currentColor"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                        className="text-neutral-600 dark:text-neutral-400"
                      />
                      <Tooltip
                        cursor={{ fill: 'rgb(0 0 0 / 0.05)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0]?.payload;
                            return (
                              <div className="rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8 ring-1 ring-neutral-200 dark:ring-neutral-800">
                                    <AvatarImage src={data.avatar_url} />
                                    <AvatarFallback>
                                      {data.login.slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="text-sm font-medium text-neutral-900 dark:text-white">
                                      {data.login}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400">
                                      <GitGraph className="h-3 w-3" />
                                      <span>{data.contributions} commits</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="contributions"
                        className="fill-neutral-900 dark:fill-white"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="mb-8">
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-neutral-50 to-white shadow-sm dark:border-neutral-800 dark:from-neutral-900/80 dark:to-neutral-900/30">
            <div className="absolute inset-0 opacity-20 dark:opacity-20"></div>

            <div className="relative p-6">
              <div className="flex flex-col items-center gap-8 md:flex-row">
                <div className="w-full md:w-2/3">
                  <div className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white dark:bg-white dark:text-neutral-900">
                    <Github className="mr-1.5 h-3.5 w-3.5" />
                    MIT Licensed
                  </div>
                  <h2 className="mt-3 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                    Let&apos;s build the future of email together
                  </h2>
                  <p className="mt-3 text-neutral-600 dark:text-neutral-300">
                    Whether you&apos;re fixing bugs, adding features, or improving documentation,
                    every contribution matters.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button
                      asChild
                      className="relative overflow-hidden bg-neutral-900 text-white transition-all hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100"
                    >
                      <a
                        href={`https://github.com/${REPOSITORY}/blob/main/.github/CONTRIBUTING.md`}
                        target="_blank"
                      >
                        <span className="relative z-10 flex items-center">
                          <GitGraph className="mr-2 h-4 w-4" />
                          Start Contributing
                        </span>
                      </a>
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      className="gap-2 border-neutral-200 bg-white/80 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:hover:text-white"
                    >
                      <a href={`https://github.com/${REPOSITORY}/issues`} target="_blank">
                        <MessageCircle className="h-4 w-4" />
                        Open Issues
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="hidden md:block md:w-1/3">
                  <div className="space-y-4 rounded-xl border border-neutral-200 bg-white/80 p-5 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/80">
                    <div className="flex items-center gap-1">
                      <div className="flex -space-x-4">
                        {filteredContributors?.slice(0, 5).map((contributor) => (
                          <Avatar
                            key={contributor.login}
                            className="h-8 w-8 rounded-full border-2 border-white dark:border-neutral-900"
                          >
                            <AvatarImage src={contributor.avatar_url} alt={contributor.login} />
                            <AvatarFallback className="text-xs">
                              {contributor.login.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {filteredContributors && filteredContributors.length > 5 && (
                          <div className="z-50 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-neutral-100 text-xs font-medium text-neutral-800 dark:border-neutral-900 dark:bg-neutral-800 dark:text-neutral-200">
                            +{filteredContributors.length - 5}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-neutral-600 dark:text-neutral-300">
                        contributors
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-neutral-50 p-2 dark:bg-neutral-800/50">
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">Stars</div>
                        <div className="mt-1 flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-neutral-700 dark:text-neutral-300" />
                          <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                            {repoStats.stars}
                          </span>
                        </div>
                      </div>
                      <div className="rounded-lg bg-neutral-50 p-2 dark:bg-neutral-800/50">
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">Forks</div>
                        <div className="mt-1 flex items-center gap-1">
                          <GitFork className="h-3.5 w-3.5 text-neutral-700 dark:text-neutral-300" />
                          <span className="text-sm font-semibold text-neutral-900 dark:text-white">
                            {repoStats.forks}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 mb-6 flex items-center justify-center gap-4">
          <a
            href="https://discord.gg/mail0"
            target="_blank"
            className="text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            aria-label="Join our Discord"
          >
            <Discord className="dark:fill-muted-foreground h-4 w-4" />
          </a>
          <a
            href="https://x.com/mail0dotcom"
            target="_blank"
            className="text-neutral-500 transition-colors hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            aria-label="Follow us on X (Twitter)"
          >
            <Twitter className="dark:fill-muted-foreground h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
