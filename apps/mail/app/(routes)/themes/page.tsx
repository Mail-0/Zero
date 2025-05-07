import { Search } from 'lucide-react';

export default function ThemesPage() {
  return (
    <div className="bg-background mx-auto min-h-screen w-full">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-12 flex flex-col items-center justify-center text-center">
          <h1 className="mb-2 text-3xl font-bold"> Themes</h1>
          <p className="text-muted-foreground max-w-2xl">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Est labore nam repudiandae
            cupiditate reiciendis quas harum praesentium accusantium? Beatae exercitationem earum
            facilis culpa sequi. Tempora libero quidem nobis a quo.
          </p>
        </div>

        <div className="mx-auto mb-12 max-w-3xl">
          <div className="relative">
            <input
              type="text"
              placeholder="Search for a theme..."
              className="bg-background border-input focus:ring-ring w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2"
            />
            <Search className="text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2 transform" />
          </div>
        </div>
      </div>
    </div>
  );
}
