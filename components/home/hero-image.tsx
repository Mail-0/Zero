import Image from "next/image";

const HeroImage = () => {
  return (
    <div className="mx-auto mt-8 w-full max-w-5xl px-4">
      <div className="relative items-center justify-center rounded-xl border border-muted-foreground/30 bg-muted p-1 shadow-xl shadow-black/40 backdrop-blur-lg dark:shadow-xl dark:shadow-black/85 md:flex md:animate-move-up md:p-2">
        <Image
          src="/homepage-image.png"
          alt="hero"
          width={800}
          height={600}
          className="h-full w-full rounded-xl shadow-md shadow-black invert dark:invert-0 md:rounded-lg"
        />
      </div>
    </div>
  );
};

export default HeroImage;
