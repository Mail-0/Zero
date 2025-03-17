import Image from "next/image";

const HeroImage = () => {
  return (
    <div className="mx-auto mt-8 w-full max-w-5xl px-4">
      <div className="border-muted-foreground/30 bg-muted md:animate-move-up relative items-center justify-center rounded-xl border p-1 shadow-xl shadow-black/40 backdrop-blur-lg md:flex md:p-2 dark:shadow-xl dark:shadow-black/85">
        <Image
          src="/homepage-image.png"
          alt="hero"
          width={800}
          height={600}
          className="h-full w-full rounded-xl shadow-md shadow-black invert md:rounded-lg dark:invert-0"
        />
      </div>
    </div>
  );
};

export default HeroImage;
