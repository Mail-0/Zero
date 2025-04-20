import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  async function loadGoogleFont(font: string, weight: string) {
    const url = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}&display=swap`;
    const css = await (await fetch(url)).text();
    const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);

    if (resource?.[1]) {
      const response = await fetch(resource[1]);
      if (response.status === 200) {
        return await response.arrayBuffer();
      }
    }

    throw new Error('failed to load font data');
  }

  const mailBuffer = await fetch(
    new URL('../../../../public/white-icon.svg', import.meta.url),
  ).then((res) => res.arrayBuffer());
  const mailBase64 = Buffer.from(mailBuffer).toString('base64');
  const mail = `data:image/svg+xml;base64,${mailBase64}`;

  const fontWeight400 = await loadGoogleFont('Geist', '400');
  const fontWeight600 = await loadGoogleFont('Geist', '600');

  return new ImageResponse(
    (
      <div tw="text-white bg-black w-full py-3 px-6 h-full flex items-center justify-center flex-col">
        <div tw="flex flex-col items-center justify-center">
          <div tw="flex mb-8 rounded-xl border-white p-4 items-center">
            {/* <div tw="flex items-center rounded-lg bg-white/20 justify-center border-2 border-white p-2"> */}
            <img src={mail} width="72" height="72" alt="mail" />
            {/* </div> */}
            {/* <h3 tw="ml-4 text-4xl border-l-2 px-4 border-white">0</h3> */}
          </div>
          <div
            tw="flex flex-col items-center justify-center text-8xl"
            style={{ fontFamily: 'bold' }}
          >
            <div tw="flex">
              <span tw="text-[#fff]">The future of email</span>
            </div>
            <span tw="text-[#A1A1A1]">is here</span>
          </div>

          <div tw="text-[36px] text-center text-neutral-400 mt-10" style={{ fontFamily: 'light' }}>
            Experience email the way you want with 0 - the first open source email app that puts
            your privacy and safety first.
          </div>
          <div tw="text-[36px] text-center mt-10" style={{ fontFamily: 'light' }}>
            Early Access Users: 12,000
          </div>
          {/* <div tw="text-3xl rounded-xl mt-16 text-primary w-[16rem] flex items-center justify-center h-20">
            <span tw="mr-2 border-2 border-white w-full h-16 bg-white/20 rounded-lg flex items-center justify-center">
              Register Now
            </span>
          </div> */}
        </div>

        <div
          style={{
            background: 'linear-gradient(135deg, #fff  100%, #ffff  100%)',
            width: '20rem',
            height: '20rem',
            filter: 'blur(180px)',
            borderRadius: '50%',
            display: 'flex',
            position: 'absolute',
            bottom: '-100px',
            left: '-40px',
            opacity: '0.18',
          }}
        ></div>
        <div
          style={{
            background: 'linear-gradient(135deg, #fff  100%, #fff  100%)',
            width: '20rem',
            height: '20rem',
            filter: 'blur(180px)',
            borderRadius: '50%',
            display: 'flex',
            position: 'absolute',
            top: '33%',
            right: '-40px',
            opacity: '0.26',
          }}
        ></div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      // debug: true,
      fonts: [
        {
          name: 'light',
          data: fontWeight400,
          style: 'normal',
          weight: 400,
        },
        {
          name: 'bold',
          data: fontWeight600,
          style: 'normal',
          weight: 600,
        },
      ],
    },
  );
}
